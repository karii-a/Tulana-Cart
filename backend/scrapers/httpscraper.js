// Scraper for STATICALLY-RENDERED stores (currently: Vhandar) — products are
// already present in the raw server-rendered HTML, so a plain HTTP request
// + cheerio parsing works, with no browser/Puppeteer involved at all. This
// is far more reliable than browser automation for sites built this way.
//
// Used automatically by scraper.js's scrapeStore() when a store's config
// has `scrapeMode: 'http'`.

const cheerio = require('cheerio')

function parsePrice(text) {
  if (!text) return null
  const cleaned = text.replace(/,/g, '')
  const match = cleaned.match(/(\d+(\.\d+)?)/)
  return match ? parseFloat(match[1]) : null
}

// Some sites (Vhandar included) show the weight/size as a separate badge
// next to the product name rather than as part of the name text itself —
// e.g. name="Hulas Premium Basmati Rice", with "20kg" shown in its own
// element elsewhere in the card. Left alone, that makes every pack size of
// the same product look identical and — worse — makes it impossible for
// productMatcher.js to tell genuinely different pack sizes apart. This
// finds a weight-like token anywhere in the card's text and appends it to
// the name if it isn't already there, regardless of exactly which element
// it lives in.
function findWeightInCardText(cardText) {
  const match = cardText.match(/(\d+(\.\d+)?)\s?(kg|kgs|gm|grams?|g|ml|ltr|litres?|liters?|l)\b/i)
  return match ? match[0].replace(/\s+/g, '') : null
}

function withWeightAppended(name, cardText) {
  const weight = findWeightInCardText(cardText)
  if (!weight) return name
  const alreadyPresent = name.toLowerCase().replace(/\s+/g, '').includes(weight.toLowerCase())
  return alreadyPresent ? name : `${name}, ${weight}`
}

// Resolves a possibly-relative URL (e.g. "/product/foo" or
// "/api/image?url=...") against the store's baseUrl into an absolute one.
function resolveUrl(baseUrl, maybeRelative) {
  if (!maybeRelative) return null
  try {
    return new URL(maybeRelative, baseUrl).href
  } catch {
    return null
  }
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  return response.text()
}

function extractCardsFromHtml(html, storeConfig) {
  const $ = cheerio.load(html)
  const cards = $(storeConfig.cardSelector)
  const items = []

  cards.each((_, el) => {
    const card = $(el)
    const rawName = card.find(storeConfig.nameSelector).first().text().trim()
    const priceText = card.find(storeConfig.priceSelector).first().text().trim()
    const imageSrc = card.find(storeConfig.imageSelector).first().attr('src')
    const href = card.find(storeConfig.linkSelector).first().attr('href')

    if (!rawName || !priceText) return
    const price = parsePrice(priceText)
    if (price === null) return

    const name = withWeightAppended(rawName, card.text())

    items.push({
      name,
      price,
      imageUrl: resolveUrl(storeConfig.baseUrl, imageSrc),
      url: resolveUrl(storeConfig.baseUrl, href),
      inStock: true,
    })
  })

  return items
}

// Appends/overwrites a `page` query param on a listing URL for page N.
// e.g. "https://www.vhandar.com/category/rice-atta-flour" + page 2
//   -> "https://www.vhandar.com/category/rice-atta-flour?page=2"
function withPageParam(url, pageNumber) {
  const u = new URL(url)
  u.searchParams.set('page', String(pageNumber))
  return u.href
}

// Scrapes ALL pages of a single category URL by walking page=1,2,3...
// until a page returns zero genuinely-new items (compared against items
// already collected from earlier pages of the SAME category), or the
// MAX_PAGES safety cap is hit. Whatever the last successfully-fetched
// page returned that had zero new items ends the loop — this is what
// makes it stop instead of re-scraping page 1 forever if a site just
// ignores an unknown/out-of-range ?page= value.
async function scrapeAllPagesOfCategory(baseUrl, storeConfig) {
  const MAX_PAGES = 30
  const seenInCategory = new Map()

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber++) {
    const pageUrl = pageNumber === 1 ? baseUrl : withPageParam(baseUrl, pageNumber)
    let html
    try {
      html = await fetchHtml(pageUrl)
    } catch (err) {
      console.error(`  [${storeConfig.label}] failed to fetch ${pageUrl}: ${err.message}`)
      break // stop paginating this category on a fetch error; keep what we have
    }

    const items = extractCardsFromHtml(html, storeConfig)
    let newCount = 0
    for (const item of items) {
      const key = item.name.trim().toLowerCase()
      if (!seenInCategory.has(key)) {
        seenInCategory.set(key, item)
        newCount++
      }
    }

    // Nothing new on this page — either we've hit the real last page, or
    // ?page= isn't a pattern this site supports at all (in which case
    // every "page" just re-returns page 1, so newCount is 0 immediately
    // and we correctly stop after page 1 with no harm done).
    if (newCount === 0) break
  }

  return Array.from(seenInCategory.values())
}

/**
 * Scrapes every listing URL configured for an HTTP-mode store and merges
 * the results, de-duplicating by product name (case-insensitive). Same
 * shape/contract as scraper.js's scrapeStore(), so callers don't need to
 * know which underlying method is being used.
 */
async function scrapeStoreHttp(storeConfig) {
  const urls = storeConfig.listUrls || (storeConfig.listUrl ? [storeConfig.listUrl] : [])
  if (urls.length === 0) {
    throw new Error(`storeConfig for "${storeConfig.label}" has no listUrls/listUrl configured`)
  }

  const seen = new Map()

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    // storeConfig.categories (added in config.js) has one entry per
    // listUrls entry, same index — this is how each item ends up tagged
    // with the category it was scraped under.
    const categoryName = storeConfig.categories?.[i] || null

    const items = await scrapeAllPagesOfCategory(url, storeConfig)
    for (const item of items) {
      const key = item.name.trim().toLowerCase()
      if (!seen.has(key)) {
        seen.set(key, { ...item, categoryName })
      }
    }
  }

  return Array.from(seen.values())
}

module.exports = { scrapeStoreHttp, parsePrice }