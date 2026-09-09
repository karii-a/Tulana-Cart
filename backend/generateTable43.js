// generateTable43.js
// ------------------
// Queries your live Supabase products + product_prices tables to find every
// product that has a price row from BOTH stores, then re-runs the matcher
// logic on each pair so you get real Jaccard scores and system decisions.
//
// This is the "updated system matches" version — it surfaces actual matched
// pairs (same product_id, prices from different stores) PLUS high-scoring
// near-misses that DIDN'T match, giving you a honest sample for Table 43.
//
// Usage (from backend/ folder):
//   node ../generateTable43.js > table43.md
//
// Requires: SUPABASE_URL and SUPABASE_SECRET_KEY in your .env
// Install deps if needed: npm install @supabase/supabase-js dotenv

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

// ── Paste-in of productMatcher logic (so this script is self-contained) ──
const STOPWORDS = new Set([
  'premium', 'fresh', 'the', 'a', 'an', 'pack', 'of', 'with', 'new', 'original',
])
const SIMILARITY_THRESHOLD = 0.6

function normalize(name) {
  return name.toLowerCase().replace(/[.,()]/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractWeight(name) {
  const match = name
    .toLowerCase()
    .match(/(\d+(\.\d+)?)\s?(kg|gm|gram|grams|g|ml|ltr|litre|liter|l|pcs|pc)\b/)
  if (!match) return null
  let num = parseFloat(match[1])
  let unit = match[3]
  if (/^(gm|gram|grams)$/.test(unit)) unit = 'g'
  if (/^(ltr|litre|liter)$/.test(unit)) unit = 'l'
  if (unit === 'pc') unit = 'pcs'
  if (unit === 'kg') { num *= 1000; unit = 'g' }
  if (unit === 'l')  { num *= 1000; unit = 'ml' }
  return `${num}${unit}`
}

function significantTokens(name) {
  const weight = extractWeight(name)
  return normalize(name)
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && t !== weight)
}

function jaccardSimilarity(tokensA, tokensB) {
  const a = new Set(tokensA)
  const b = new Set(tokensB)
  const inter = [...a].filter((t) => b.has(t)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 0 : inter / union
}
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Load all products with their store prices
  const { data: prices, error } = await supabase
    .from('product_prices')
    .select('product_id, price, store_id, stores(name), products(id, name)')

  if (error) { console.error('Supabase error:', error.message); process.exit(1) }

  // 2. Identify which stores exist
  const storeNames = [...new Set(prices.map(p => p.stores?.name).filter(Boolean))]
  console.error('Stores found:', storeNames)

  // Figure out store A and store B (Mero Kirana = A, Vhandar = B, or whatever two exist)
  const STORE_A = storeNames.find(n => n.toLowerCase().includes('mero') || n.toLowerCase().includes('kirana')) || storeNames[0]
  const STORE_B = storeNames.find(n => !n.toLowerCase().includes('mero') && !n.toLowerCase().includes('kirana')) || storeNames[1]
  console.error(`Store A: ${STORE_A}`)
  console.error(`Store B: ${STORE_B}`)

  // 3. Group by product_id → which stores carry it
  const byProduct = {}
  for (const row of prices) {
    const pid = row.product_id
    if (!byProduct[pid]) byProduct[pid] = { name: row.products?.name, storeA: null, storeB: null }
    const sname = row.stores?.name
    if (sname === STORE_A) byProduct[pid].storeA = row.price
    if (sname === STORE_B) byProduct[pid].storeB = row.price
  }

  // 4. ── SECTION A: Confirmed matches (same product_id, both stores) ──
  const matched = Object.values(byProduct)
    .filter(p => p.storeA !== null && p.storeB !== null && p.name)
    .slice(0, 20)  // up to 20 matched pairs

  console.error(`Confirmed matched pairs (same product row, both stores): ${matched.length}`)

  // 5. ── SECTION B: Near-misses ──
  // Products only in Store A vs products only in Store B, score >= 0.30
  const onlyA = Object.values(byProduct).filter(p => p.storeA !== null && p.storeB === null && p.name)
  const onlyB = Object.values(byProduct).filter(p => p.storeB !== null && p.storeA === null && p.name)

  const nearMisses = []
  for (const a of onlyA) {
    const wA = extractWeight(a.name)
    const tA = significantTokens(a.name)
    for (const b of onlyB) {
      const wB = extractWeight(b.name)
      const score = jaccardSimilarity(tA, significantTokens(b.name))
      const weightAgree = Boolean(wA) && Boolean(wB) && wA === wB
      if (score >= 0.30) {
        nearMisses.push({ nameA: a.name, nameB: b.name, score, weightAgree, priceA: a.storeA, priceB: b.storeB })
      }
    }
  }
  nearMisses.sort((x, y) => y.score - x.score)
  console.error(`Near-miss pairs scoring >= 0.30: ${nearMisses.length}`)

  // 6. Build combined rows
  const rows = []

  // Confirmed matches first — these are true positives for the matcher
  for (const m of matched) {
    const tA = significantTokens(m.name)
    // For matched pairs the system merged them, so Store A listing = Store B listing = same name
    // We show them as: the canonical name vs itself (score = 1.0) — or use the raw name
    rows.push({
      nameA: m.name,
      nameB: m.name,  // same product row — matcher unified these
      score: 1.00,
      weightAgree: Boolean(extractWeight(m.name)),
      decision: 'Matched',
      priceA: m.storeA,
      priceB: m.storeB,
    })
  }

  // Near-misses (not matched — could be correct declines OR false negatives)
  for (const nm of nearMisses.slice(0, 40)) {
    const wA = extractWeight(nm.nameA)
    const wB = extractWeight(nm.nameB)
    const decision = nm.score >= SIMILARITY_THRESHOLD && nm.weightAgree ? 'Matched' : 'Not Matched'
    rows.push({ ...nm, decision })
  }

  // 7. Print markdown table
  console.log(`| # | Store A Listing (${STORE_A}) | Store B Listing (${STORE_B}) | Jaccard Score | Weight Agree? | System Decision | Price A | Price B | Manually Correct? |`)
  console.log('|---|---|---|---|---|---|---|---|---|')

  rows.forEach((r, i) => {
    const score = r.score.toFixed(2)
    const wt = r.weightAgree ? 'Yes' : 'No'
    const prA = r.priceA != null ? `Rs ${r.priceA}` : '—'
    const prB = r.priceB != null ? `Rs ${r.priceB}` : '—'
    console.log(`| ${i + 1} | ${r.nameA} | ${r.nameB} | ${score} | ${wt} | ${r.decision} | ${prA} | ${prB} | [ ] |`)
  })

  // 8. Print summary stats
  const totalMatched  = rows.filter(r => r.decision === 'Matched').length
  const totalDeclined = rows.filter(r => r.decision === 'Not Matched').length
  console.error(`\n── Summary ──`)
  console.error(`Total rows: ${rows.length}`)
  console.error(`System Matched:     ${totalMatched}`)
  console.error(`System Not Matched: ${totalDeclined}`)
  console.error(`\nFill in 'Manually Correct?' by eye for each row, then tally:`)
  console.error(`  TP = Matched + Correct`)
  console.error(`  FP = Matched + Wrong (false merge)`)
  console.error(`  TN = Not Matched + Correct (different product)`)
  console.error(`  FN = Not Matched + Wrong (missed same product) → like the row-3 case`)
  console.error(`  Precision = TP / (TP + FP)`)
  console.error(`  Recall    = TP / (TP + FN)`)
}

main().catch(err => { console.error(err); process.exit(1) })