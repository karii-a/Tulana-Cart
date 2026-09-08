// ONE-TIME backfill: merges duplicate products that already exist in the
// DB from before the fuzzy matcher was added (one row per store per item).
//
// Why this is needed: runSync.js's matcher only ever compares a NEWLY
// scraped item against existing products. For every product currently in
// the DB, each store's own past listing is already sitting there as a
// PERFECT (score 1.0) self-match, so future syncs just keep re-confirming
// the split instead of ever merging it. This script does the merge
// retroactively, once, using the exact same scoring logic
// (productMatcher.js) so behavior stays consistent with live syncs.
//
// Only merges pairs scoring >= SIMILARITY_THRESHOLD (same 0.6 used live)
// AND from two DIFFERENT stores — never merges two products already on
// the same store, and never merges a product with itself.
//
// Safe by default: runs as a DRY RUN and only PRINTS what it would merge.
// Pass --apply to actually perform the merges.
//
// Usage (from the backend/ folder):
//   node scripts/backfillMerge.js              (dry run, just prints)
//   node scripts/backfillMerge.js --apply       (actually merges)

const supabase = require('../supabase')
const { jaccardSimilarity, significantTokens, extractWeight } = require('../scrapers/productMatcher')
const { mergeProductRows } = require('./mergeProducts')

const SIMILARITY_THRESHOLD = 0.6

async function main() {
  const apply = process.argv.includes('--apply')

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

  // Which store(s) each product currently has a price row for.
  const storesByProduct = new Map()
  for (const row of prices) {
    if (!storesByProduct.has(row.product_id)) storesByProduct.set(row.product_id, new Set())
    storesByProduct.get(row.product_id).add(row.store_id)
  }

  // Precompute tokens/weight once per product instead of per pair.
  const enriched = products.map((p) => ({
    id: p.id,
    name: p.name,
    tokens: significantTokens(p.name),
    weight: extractWeight(p.name),
    stores: storesByProduct.get(p.id) || new Set(),
  }))

  const merged = new Set() // product ids already folded into another product
  const plan = [] // { keep, drop, score }

  for (let i = 0; i < enriched.length; i++) {
    const a = enriched[i]
    if (merged.has(a.id)) continue

    let best = null
    let bestScore = 0

    for (let j = 0; j < enriched.length; j++) {
      if (i === j) continue
      const b = enriched[j]
      if (merged.has(b.id)) continue

      // Only interested in cross-store duplicates — two products already
      // on the same store are, by definition, not the "one row per
      // store" problem this script fixes.
      const sharesAStore = [...a.stores].some((s) => b.stores.has(s))
      if (a.stores.size > 0 && b.stores.size > 0 && sharesAStore) continue

      if (a.weight && b.weight && a.weight !== b.weight) continue

      const score = jaccardSimilarity(a.tokens, b.tokens)
      if (score > bestScore) {
        bestScore = score
        best = b
      }
    }

    if (best && bestScore >= SIMILARITY_THRESHOLD) {
      // Keep whichever of the pair has prices from more stores already
      // (tie-break: lower id, i.e. the older row) so we're not
      // arbitrarily throwing away the "more complete" row.
      const keep = best.stores.size > a.stores.size ? best : a
      const drop = keep === best ? a : best

      merged.add(drop.id)
      plan.push({ keepId: keep.id, keepName: keep.name, dropId: drop.id, dropName: drop.name, score: bestScore })
    }
  }

  console.log(`Found ${plan.length} duplicate pair(s) to merge out of ${products.length} products.\n`)
  for (const m of plan) {
    console.log(
      `  [score ${m.score.toFixed(2)}] keep #${m.keepId} "${m.keepName}"  <-  drop #${m.dropId} "${m.dropName}"`
    )
  }

  if (!apply) {
    console.log('\nDry run only — no changes made. Re-run with --apply to actually merge these.')
    return
  }

  console.log('\nApplying merges...')
  let done = 0
  for (const m of plan) {
    try {
      const { moved, skipped } = await mergeProductRows(m.keepId, m.dropId)
      done++
      console.log(`  merged #${m.dropId} into #${m.keepId} (moved ${moved} price row(s), skipped ${skipped})`)
    } catch (err) {
      console.error(`  FAILED merging #${m.dropId} into #${m.keepId}: ${err.message}`)
    }
  }
  console.log(`\nDone. ${done}/${plan.length} merges applied.`)
}

main()