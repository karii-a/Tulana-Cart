// Shared helper: merges two product rows that represent the same
// real-world item (e.g. one created from a Mero Kirana scrape, one from
// a Vhandar scrape, before the fuzzy matcher existed).
//
// Moves every product_prices row from `dropId` onto `keepId`, then
// deletes the now-empty `dropId` product row. If `keepId` already has a
// price row for a store that `dropId` also has (shouldn't normally
// happen for genuine duplicates, but be defensive), the existing keepId
// row wins and the dropId row is just deleted instead of causing a
// unique-constraint error.
//
// Used by both backfillMerge.js (automatic, high-confidence merges) and
// approveMerge.js (manually confirmed merges from the review queue).

const supabase = require('../supabase')

async function mergeProductRows(keepId, dropId) {
  if (keepId === dropId) return { moved: 0, skipped: 0 }

  const { data: dropPrices, error: fetchError } = await supabase
    .from('product_prices')
    .select('id, store_id')
    .eq('product_id', dropId)

  if (fetchError) throw new Error(`fetch prices for product ${dropId}: ${fetchError.message}`)

  const { data: keepPrices, error: keepFetchError } = await supabase
    .from('product_prices')
    .select('store_id')
    .eq('product_id', keepId)

  if (keepFetchError) throw new Error(`fetch prices for product ${keepId}: ${keepFetchError.message}`)

  const keepStoreIds = new Set((keepPrices || []).map((p) => p.store_id))

  let moved = 0
  let skipped = 0

  for (const price of dropPrices || []) {
    if (keepStoreIds.has(price.store_id)) {
      // keepId already has a price for this store — don't clash, just
      // drop the duplicate row instead of moving it.
      skipped++
      const { error } = await supabase.from('product_prices').delete().eq('id', price.id)
      if (error) throw new Error(`delete duplicate price row ${price.id}: ${error.message}`)
      continue
    }

    const { error } = await supabase
      .from('product_prices')
      .update({ product_id: keepId })
      .eq('id', price.id)
    if (error) throw new Error(`move price row ${price.id} to product ${keepId}: ${error.message}`)
    moved++
  }

  const { error: deleteError } = await supabase.from('products').delete().eq('id', dropId)
  if (deleteError) throw new Error(`delete duplicate product ${dropId}: ${deleteError.message}`)

  return { moved, skipped }
}

module.exports = { mergeProductRows }