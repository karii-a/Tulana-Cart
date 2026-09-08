// ONE-OFF MIGRATION — run this exactly once, then never again:
//
//   node scripts/resetLegacyTranslationPlaceholders.js
//
// Older versions of this project inserted categories/stores with
// name_np set to a duplicate of the English name as a "not translated
// yet" placeholder. That's unsafe to detect automatically on every run
// (a genuine translation can legitimately come back identical to the
// English text for a proper noun or brand name, which would look
// exactly like an untouched placeholder and get re-translated forever —
// that was the actual bug). So instead: run this ONE TIME to reset any
// current placeholder rows to null, then backfillTranslations.js's
// null-only check takes over correctly from there. If you've never used
// an older version of this project, this script will just report 0 rows
// reset and you don't need it.
const supabase = require('../supabase')

async function resetLegacyPlaceholders(table) {
  const { data, error } = await supabase.from(table).select('id, name, name_np')
  if (error) throw new Error(`could not load ${table}: ${error.message}`)

  const placeholders = (data || []).filter((row) => row.name_np === row.name)
  for (const row of placeholders) {
    const { error: updateError } = await supabase
      .from(table)
      .update({ name_np: null })
      .eq('id', row.id)
    if (updateError) {
      throw new Error(`could not reset ${table} #${row.id}: ${updateError.message}`)
    }
  }
  return placeholders.length
}

async function main() {
  const categoriesReset = await resetLegacyPlaceholders('categories')
  const storesReset = await resetLegacyPlaceholders('stores')
  console.log(`Reset ${categoriesReset} categor${categoriesReset === 1 ? 'y' : 'ies'} and ${storesReset} store(s) back to untranslated.`)
  console.log('Now run: node scripts/backfillTranslations.js')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  })