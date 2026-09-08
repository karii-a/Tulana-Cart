// Lists EXISTING products that are probably the same real-world item but
// score too low (0.3–0.59) for backfillMerge.js / the live matcher to
// merge automatically — different brand phrasing, one store using a
// generic name, word-order differences, etc. These need a human eye.
//
// This does NOT change anything in the DB. It just prints candidate
// pairs with their product ids, sorted by score (best guesses first).
// Look through the list and for any pair you confirm is really the same
// product, run:
//
//   node scripts/approveMerge.js <keepId> <dropId>
//
// Usage (from the backend/ folder):
//   node scripts/reviewQueue.js                 (prints top 50 pairs)
//   node scripts/reviewQueue.js --min 0.2        (lower the floor)
//   node scripts/reviewQueue.js --limit 100      (show more rows)

const supabase = require('../supabase')
const { jaccardSimilarity, significantTokens, extractWeight } = require('../scrapers/productMatcher')

const AUTO_MERGE_THRESHOLD = 0.6 // anything >= this is already handled by backfillMerge.js

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag)
  if (i === -1 || !process.argv[i + 1]) return fallback
  return parseFloat(process.argv[i + 1])
}

async function main() {
  const minScore = argValue('--min', 0.3)
  const limit = argValue('--limit', 50)

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name')
  if (productsError) {
    console.error('Failed to load products:', productsError.message)
    process.exit(1)
  }

  const { data: prices, error: pricesError } = await supabase
    .from('product_prices')
    .select('product_id, store_id')
  if (pricesError) {
    console.error('Failed to load product_prices:', pricesError.message)
    process.exit(1)
  }

  const storesByProduct = new Map()
  for (const row of prices) {
    if (!storesByProduct.has(row.product_id)) storesByProduct.set(row.product_id, new Set())
    storesByProduct.get(row.product_id).add(row.store_id)
  }

  const enriched = products.map((p) => ({
    id: p.id,
    name: p.name,
    tokens: significantTokens(p.name),
    weight: extractWeight(p.name),
    stores: storesByProduct.get(p.id) || new Set(),
  }))

  const rows = []
  const seenPairs = new Set()

  for (let i = 0; i < enriched.length; i++) {
    for (let j = i + 1; j < enriched.length; j++) {
      const a = enriched[i]
      const b = enriched[j]

      const sharesAStore = [...a.stores].some((s) => b.stores.has(s))
      if (a.stores.size > 0 && b.stores.size > 0 && sharesAStore) continue

      const score = jaccardSimilarity(a.tokens, b.tokens)
      if (score < minScore || score >= AUTO_MERGE_THRESHOLD) continue

      const pairKey = `${a.id}-${b.id}`
      if (seenPairs.has(pairKey)) continue
      seenPairs.add(pairKey)

      rows.push({ aId: a.id, aName: a.name, bId: b.id, bName: b.name, score })
    }
  }

  rows.sort((x, y) => y.score - x.score)

  console.log(`${rows.length} borderline pair(s) scoring between ${minScore} and ${AUTO_MERGE_THRESHOLD}.`)
  console.log(`Showing top ${Math.min(limit, rows.length)}:\n`)

  rows.slice(0, limit).forEach((r, i) => {
    console.log(`${i + 1}. [score ${r.score.toFixed(2)}]`)
    console.log(`   #${r.aId}  "${r.aName}"`)
    console.log(`   #${r.bId}  "${r.bName}"`)
    console.log(`   -> if same product: node scripts/approveMerge.js ${r.aId} ${r.bId}\n`)
  })
}

main()