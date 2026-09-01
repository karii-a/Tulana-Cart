// Generates the Table 3 data for Chapter 5, Section 5.2.3(b) — real computed
// Jaccard scores and System Decisions for every Store-A/Store-B product pair,
// using the actual matcher code in scrapers/productMatcher.js. This does NOT
// touch Supabase — it just scrapes both stores live (like testScrape.js) and
// compares every pair.
//
// You still need to fill in the "Manually Correct?" column yourself — that's
// a human judgement call this script can't make, since it means looking at
// both listings and deciding if they're genuinely the same product.
//
// Usage (from the backend/ folder):
//   node scripts/generateMatcherSample.js merokirana vhandar > table3.md
//
// Then open table3.md, eyeball each row, and fill in Yes/No for whether the
// system's decision (Matched / Not Matched) was actually correct.

const config = require('../scrapers/config')
const { scrapeStore } = require('../scrapers/scraper')
const { jaccardSimilarity, significantTokens, extractWeight } = require('../scrapers/productMatcher')

const SIMILARITY_THRESHOLD = 0.6

async function main() {
  const [keyA, keyB] = process.argv.slice(2)
  if (!keyA || !keyB) {
    console.error('Usage: node scripts/generateMatcherSample.js <storeKeyA> <storeKeyB>')
    console.error(`Available store keys: ${Object.keys(config).join(', ')}`)
    process.exit(1)
  }

  const configA = config[keyA]
  const configB = config[keyB]
  if (!configA || !configB) {
    console.error(`Unknown store key(s). Available: ${Object.keys(config).join(', ')}`)
    process.exit(1)
  }

  console.error(`Scraping ${configA.label}...`)
  const itemsA = await scrapeStore(configA)
  console.error(`Got ${itemsA.length} items from ${configA.label}.`)

  console.error(`Scraping ${configB.label}...`)
  const itemsB = await scrapeStore(configB)
  console.error(`Got ${itemsB.length} items from ${configB.label}.`)

  const rows = []
  for (const a of itemsA) {
    const weightA = extractWeight(a.name)
    const tokensA = significantTokens(a.name)

    for (const b of itemsB) {
      const weightB = extractWeight(b.name)
      const weightAgree = Boolean(weightA) && Boolean(weightB) && weightA === weightB
      const score = jaccardSimilarity(tokensA, significantTokens(b.name))
      // Only surface pairs that are at least plausible — otherwise this
      // is thousands of near-zero-score irrelevant pairs.
      if (score >= 0.3) {
        rows.push({
          a: a.name,
          b: b.name,
          score,
          weightAgree,
          decision: score >= SIMILARITY_THRESHOLD && weightAgree ? 'Matched' : 'Not Matched',
        })
      }
    }
  }

  // Highest-scoring pairs first, so the real matches and the near-misses
  // worth checking float to the top instead of being buried in noise.
  rows.sort((x, y) => y.score - x.score)

  console.log('| # | Store A Listing | Store B Listing | Jaccard Score | Weight Agree? | System Decision | Manually Correct? |')
  console.log('|---|---|---|---|---|---|---|')
  rows.slice(0, 60).forEach((r, i) => {
    console.log(
      `| ${i + 1} | ${r.a} | ${r.b} | ${r.score.toFixed(2)} | ${r.weightAgree ? 'Yes' : 'No'} | ${r.decision} | [ ] |`
    )
  })

  console.error(`\nWrote ${Math.min(rows.length, 60)} candidate pairs (of ${rows.length} total scoring >= 0.3).`)
  console.error('Pick >=30 of these rows for Table 3, including at least one near-miss just under 0.60, then fill in "Manually Correct?" by eye.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})