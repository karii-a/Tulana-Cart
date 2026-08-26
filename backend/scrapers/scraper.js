const { launchBrowser } = require('./browser')
const { scrapeStoreHttp } = require('./httpscraper')

// Pulls the first number out of a price string like "Rs. 1,250.00" or "रु १,२५०"
function parsePrice(text) {
  if (!text) return null
  const cleaned = text.replace(/,/g, '')
  const match = cleaned.match(/(\d+(\.\d+)?)/)
  return match ? parseFloat(match[1]) : null
}

/**
 * Extracts product cards from whatever is currently on the page.
 */
async function extractCards(page, storeConfig) {
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
      url: item.href || null,
      inStock: true,
    }))
    .filter((item) => item.price !== null)
}

/**
 * If storeConfig.loadMoreButtonText is set, repeatedly find a clickable
 * element whose text matches it and click it, waiting for new cards to
 * appear each time. Stops when the button disappears, stops adding new
 * cards, or the safety cap is hit — whichever comes first.
 */
async function clickLoadMoreUntilDone(page, storeConfig) {
  if (!storeConfig.loadMoreButtonText) return

  const MAX_CLICKS = 25
  let previousCount = -1

  for (let i = 0; i < MAX_CLICKS; i++) {
    const currentCount = await page.evaluate(
      (sel) => document.querySelectorAll(sel).length,
      storeConfig.cardSelector
    )
    // Stop once a click stopped adding new cards.
    if (currentCount === previousCount) break
    previousCount = currentCount

    const clicked = await page.evaluate((text) => {
      const normalize = (s) => (s || '').trim().toLowerCase()
      const candidates = Array.from(document.querySelectorAll('button, a, div, span'))
      const target = candidates.find(
        (el) => normalize(el.textContent) === normalize(text) && el.offsetParent !== null
      )
      if (target) {
        target.scrollIntoView({ block: 'center' })
        target.click()
        return true
      }
      return false
    }, storeConfig.loadMoreButtonText)

    if (!clicked) break // no more "Load More" button on screen

    // give the page time to fetch + render the next batch
    await new Promise((r) => setTimeout(r, 1500))
  }
}

/**
 * Scrapes one URL of a store's product listing (one category/collection page).
 */
async function scrapeOneUrl(page, storeConfig, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 })

  try {
    await page.waitForSelector(storeConfig.waitForSelector, { timeout: 15000 })
  } catch {
    // fall through — this URL just won't contribute any items
  }

  await clickLoadMoreUntilDone(page, storeConfig)

  return extractCards(page, storeConfig)
}

/**
 * Scrapes every listing URL configured for a store and merges the results,
 * de-duplicating by product name (case-insensitive).
 * @param {object} storeConfig - one entry from scrapers/config.js
 * @returns {Promise<Array<{name, price, imageUrl, url, inStock}>>}
 */
async function scrapeStore(storeConfig) {
  // Statically-rendered sites (e.g. Vhandar) don't need a browser at all —
  // plain HTTP + cheerio is far more reliable for them than Puppeteer.
  if (storeConfig.scrapeMode === 'http') {
    return scrapeStoreHttp(storeConfig)
  }

  // Back-compat: allow either `listUrls: [...]` (preferred, supports multiple
  // categories) or a single `listUrl` string (legacy — wrapped into an array).
  const urls = storeConfig.listUrls || (storeConfig.listUrl ? [storeConfig.listUrl] : [])
  if (urls.length === 0) {
    throw new Error(`storeConfig for "${storeConfig.label}" has no listUrls/listUrl configured`)
  }

  const browser = await launchBrowser()
  const seen = new Map() // lowercase name -> item, for de-duplication across pages

  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
    )
    await page.setViewport({ width: 1366, height: 900 })

    for (const url of urls) {
      let items = []
      try {
        items = await scrapeOneUrl(page, storeConfig, url)
      } catch (err) {
        // Some sites (e.g. BigMart) have client-side routing bugs that cause
        // spontaneous navigations mid-scrape, unrelated to anything we did,
        // which destroys Puppeteer's execution context. Retry once after a
        // short pause before giving up on this URL — one bad category
        // shouldn't stop the rest of the sync either way.
        console.error(`  [${storeConfig.label}] failed on ${url}: ${err.message} — retrying once...`)
        await new Promise((r) => setTimeout(r, 2000))
        try {
          items = await scrapeOneUrl(page, storeConfig, url)
        } catch (err2) {
          console.error(`  [${storeConfig.label}] retry also failed on ${url}: ${err2.message} — skipping this URL`)
          continue
        }
      }

      for (const item of items) {
        const key = item.name.trim().toLowerCase()
        if (!seen.has(key)) {
          seen.set(key, { ...item, url: item.url || url })
        }
      }
    }

    return Array.from(seen.values())
  } finally {
    await browser.close()
  }
}

module.exports = { scrapeStore, parsePrice }