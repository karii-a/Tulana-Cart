const { launchBrowser } = require('./browser')

// Pulls the first number out of a price string like "Rs. 1,250.00" or "रु १,२५०"
function parsePrice(text) {
  if (!text) return null
  const cleaned = text.replace(/,/g, '')
  const match = cleaned.match(/(\d+(\.\d+)?)/)
  return match ? parseFloat(match[1]) : null
}

/**
 * Scrapes one store's product listing page.
 * @param {object} storeConfig - one entry from scrapers/config.js
 * @returns {Promise<Array<{name, price, imageUrl, url, inStock}>>}
 */
async function scrapeStore(storeConfig) {
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
    )
    await page.setViewport({ width: 1366, height: 900 })

    await page.goto(storeConfig.listUrl, { waitUntil: 'networkidle2', timeout: 45000 })

    // SPAs render after JS executes; give the app a moment plus wait for a
    // selector that should exist once products are on screen.
    try {
      await page.waitForSelector(storeConfig.waitForSelector, { timeout: 15000 })
    } catch {
      // fall through — we'll return an empty list and the caller will log it
    }

    const raw = await page.evaluate((cfg) => {
      const cards = Array.from(document.querySelectorAll(cfg.cardSelector))
      return cards.map((card) => {
        const nameEl = card.querySelector(cfg.nameSelector)
        const priceEl = card.querySelector(cfg.priceSelector)
        const imgEl = card.querySelector(cfg.imageSelector)
        const linkEl = card.querySelector(cfg.linkSelector)
        return {
          name: nameEl ? nameEl.textContent.trim() : null,
          priceText: priceEl ? priceEl.textContent.trim() : null,
          imageUrl: imgEl ? imgEl.src : null,
          href: linkEl ? linkEl.href : null,
        }
      })
    }, storeConfig)

    return raw
      .filter((item) => item.name && item.priceText)
      .map((item) => ({
        name: item.name,
        price: parsePrice(item.priceText),
        imageUrl: item.imageUrl,
        url: item.href || storeConfig.listUrl,
        inStock: true,
      }))
      .filter((item) => item.price !== null)
  } finally {
    await browser.close()
  }
}

module.exports = { scrapeStore, parsePrice }
