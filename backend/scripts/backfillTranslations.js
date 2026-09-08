// Run this by hand to translate everything currently missing a Nepali
// name, without waiting for the nightly cron:
//
//   node scripts/backfillTranslations.js
//
// Safe to re-run any time — anything already translated is skipped.
const { backfillTranslations } = require('../scrapers/backfillTranslations')

backfillTranslations()
  .then((summary) => {
    console.log(`Translated ${summary.translated} row(s).`)
    if (summary.errors.length) {
      console.log(`${summary.errors.length} error(s):`)
      summary.errors.forEach((e) => console.log(' -', e))
    }
    process.exit(0)
  })
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exit(1)
  })