// Fills in name_np for products, categories, and stores — sequentially,
// one at a time, with a delay between each call. This replaces the old
// approach of translating on-demand from the browser, which fired one
// request PER PRODUCT CARD ON THE PAGE (300+ at once on a full page
// load) straight at MyMemory and burned through the whole daily quota
// in seconds, every single time anyone visited the site.
//
// Run automatically at the end of every nightly sync (see runSync.js),
// and can also be run by hand any time via:
//   node scripts/backfillTranslations.js
const supabase = require('../supabase')
const { translateProductName, sleep, DELAY_BETWEEN_CALLS_MS } = require('../services/translate')

// Caps how many rows one run will attempt, so a huge backlog can't turn
// a single sync into an hours-long run — it just catches up a bit more
// on each nightly pass instead.
const MAX_ROWS_PER_TABLE_PER_RUN = 300

// Products are always inserted with name_np: null (see upsertProduct in
// this same folder), so that's the only thing we need to look for here.
async function findPendingProducts(limit) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name')
    .is('name_np', null)
    .limit(limit)
  if (error) throw new Error(`could not load pending products: ${error.message}`)
  return data || []
}

// Categories and stores are small, fixed-size tables (dozens of rows,
// not thousands), so it's fine to just pull them all — unlike products
// they were, until recently, sometimes inserted with name_np duplicating
// the English name as a placeholder (see resolveCategoryId /
// resolveStoreId in runSync.js, and the old routes/sync.js seeder).
//
// IMPORTANT: "pending" is null ONLY, same as products — never "name_np
// still equals name". A proper noun or brand-like name (e.g. a store
// called "Vhandar") can genuinely translate to itself; if we treated
// that as "still needs translating" we'd re-translate the same row
// every single run forever, which is exactly the loop that was
// happening. resetLegacyPlaceholders below sweeps any OLD placeholder
// rows back to null ONCE so they get picked up by the null check below,
// translated, saved — even if the saved value happens to equal the
// English name — and never touched again.
async function resetLegacyPlaceholders(table) {
  const { data, error } = await supabase.from(table).select('id, name, name_np')
  if (error) throw new Error(`could not load ${table}: ${error.message}`)

  const placeholders = (data || []).filter((row) => row.name_np === row.name)
  for (const row of placeholders) {
    await supabase.from(table).update({ name_np: null }).eq('id', row.id)
  }
}

async function findPendingRows(table, limit) {
  const { data, error } = await supabase
    .from(table)
    .select('id, name')
    .is('name_np', null)
    .limit(limit)
  if (error) throw new Error(`could not load pending ${table}: ${error.message}`)
  return data || []
}

async function backfillTable(table, rows, summary) {
  for (const row of rows) {
    try {
      const name_np = await translateProductName(row.name)
      const { error } = await supabase.from(table).update({ name_np }).eq('id', row.id)
      if (error) throw error
      summary.translated++
    } catch (err) {
      summary.errors.push(`${table} #${row.id} ("${row.name}"): ${err.message}`)
      // If both translators are down or the daily quota really is
      // exhausted, every subsequent call will fail identically too —
      // stop this table's loop early instead of burning through the
      // rest of the batch (and the rate limit) on calls that can't
      // succeed anyway. Next run will pick up where this left off.
      break
    }

    // The whole point: never fire the next call back-to-back. This is
    // what actually prevents the burst that caused the 429s.
    await sleep(DELAY_BETWEEN_CALLS_MS)
  }
}

/**
 * Translates whatever products/categories/stores are still missing a
 * real Nepali name, a bounded batch at a time, one request at a time.
 * Safe to call every night — anything already translated is skipped.
 */
async function backfillTranslations() {
  const summary = { translated: 0, errors: [] }

  // One-time sweep: any row still carrying the old "name_np duplicates
  // name" placeholder gets reset to null so it's picked up by the
  // null-only check below. Safe to run every time — once a table has no
  // more placeholders left, this is just two cheap SELECTs that find
  // nothing to reset.
  await resetLegacyPlaceholders('categories')
  await resetLegacyPlaceholders('stores')

  const [pendingCategories, pendingStores, pendingProducts] = await Promise.all([
    findPendingRows('categories', MAX_ROWS_PER_TABLE_PER_RUN),
    findPendingRows('stores', MAX_ROWS_PER_TABLE_PER_RUN),
    findPendingProducts(MAX_ROWS_PER_TABLE_PER_RUN),
  ])

  // Categories and stores first and last — there are far fewer of them,
  // so they finish fast and every category label is usable even if a
  // big product backlog means not every product gets to this run.
  await backfillTable('categories', pendingCategories, summary)
  await backfillTable('stores', pendingStores, summary)
  await backfillTable('products', pendingProducts, summary)

  return summary
}

module.exports = { backfillTranslations }