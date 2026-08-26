// One-time helper: run this locally to see what a store's page actually
// looks like once JS has rendered, so you can fix the selectors in
// scrapers/config.js. This is NOT used in the real sync job.
//
// Usage:
//   cd backend
//   node scrapers/inspect.js bigmart
//   node scrapers/inspect.js merokirana
//
// It will:
//   1. Open the store's listUrl in a real (visible) Chrome window
//   2. Wait a few seconds for the SPA to render
//   3. Save a full-page screenshot to backend/scrapers/debug/<store>.png
//   4. Print the outerHTML of any element whose text looks like a price
//      (contains "Rs", "रु", or "NPR" followed by digits), so you can see
//      the real class names to use as cardSelector / priceSelector / etc.

const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')
const config = require('./config')

async function main() {
  const key = process.argv[2]
  const storeConfig = config[key]
  if (!storeConfig) {
    console.error(`Unknown store "${key}". Available: ${Object.keys(config).join(', ')}`)
    process.exit(1)
  }

  const debugDir = path.join(__dirname, 'debug')
  fs.mkdirSync(debugDir, { recursive: true })

  console.log(`Opening ${storeConfig.listUrl} ...`)
  const browser = await puppeteer.launch({ headless: false }) // visible so you can see what loads
  const page = await browser.newPage()
  await page.setViewport({ width: 1366, height: 900 })
  await page.goto(storeConfig.listUrl, { waitUntil: 'networkidle2', timeout: 60000 })

  console.log('Waiting 5s for the app to finish rendering...')
  await new Promise((r) => setTimeout(r, 5000))

  const screenshotPath = path.join(debugDir, `${key}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true })
  console.log(`Saved screenshot: ${screenshotPath}`)

  const priceLikeElements = await page.evaluate(() => {
    const priceRegex = /(Rs\.?|रु|NPR)\s?\d/i
    const all = Array.from(document.querySelectorAll('body *'))
    const matches = []
    for (const el of all) {
      const text = el.textContent?.trim() || ''
      // only leaf-ish elements (avoid huge parent containers matching too)
      if (text.length < 40 && priceRegex.test(text) && el.children.length <= 1) {
        matches.push({
          text,
          className: el.className,
          tag: el.tagName,
          // walk up 2 parents to help find the repeating "card" wrapper
          parentClass: el.parentElement?.className,
          grandparentClass: el.parentElement?.parentElement?.className,
        })
      }
    }
    return matches.slice(0, 15)
  })

  console.log('\n=== Elements that look like prices (first 15) ===')
  console.log(JSON.stringify(priceLikeElements, null, 2))
  console.log('\nLook at "parentClass" / "grandparentClass" above to find the repeating')
  console.log('product-card wrapper class, then update scrapers/config.js with:')
  console.log('  cardSelector  -> the repeating card wrapper')
  console.log('  nameSelector  -> selector for the product name within a card')
  console.log('  priceSelector -> selector for the price within a card (shown above as "className")')

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
