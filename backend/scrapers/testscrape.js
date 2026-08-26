// Quick way to see what scrapeStore() actually extracts for a store,
// WITHOUT touching Supabase or running a real sync. Good for verifying
// config.js changes before wiring things up for real.
//
// Usage:
//   cd backend
//   node scrapers/testScrape.js vhandar
//   node scrapers/testScrape.js merokirana
//   node scrapers/testScrape.js bigmart

const config = require('./config')
const { scrapeStore } = require('./scraper')

async function main() {
  const key = process.argv[2]
  const storeConfig = config[key]
  if (!storeConfig) {
    console.error(`Unknown store "${key}". Available: ${Object.keys(config).join(', ')}`)
    process.exit(1)
  }

  console.log(`Scraping ${storeConfig.label} (${storeConfig.listUrls.length} URL(s))...`)
  const items = await scrapeStore(storeConfig)

  console.log(`\nGot ${items.length} unique product(s).`)
  console.log('First 10:')
  console.log(JSON.stringify(items.slice(0, 10), null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})