// One-time helper for STATICALLY-RENDERED store sites (like Vhandar) where
// products already show up in the raw HTML — no browser/JS needed. This
// fetches a URL with a plain HTTP request and dumps the real markup of one
// product card, so we can write exact CSS selectors for scrapers/config.js.
//
// Requires the `cheerio` package (not yet in package.json) — run this once
// first if you haven't:
//   npm install cheerio
//
// Usage:
//   cd backend
//   node scrapers/inspectHttp.js https://www.vhandar.com/category/rice-atta-flour

const cheerio = require('cheerio')

async function main() {
  const url = process.argv[2]
  if (!url) {
    console.error('Usage: node scrapers/inspectHttp.js <url>')
    process.exit(1)
  }

  console.log(`Fetching ${url} ...`)
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
  })
  console.log(`HTTP status: ${response.status}`)
  const html = await response.text()
  console.log(`Fetched ${html.length} characters of HTML.`)

  const $ = cheerio.load(html)

  // Product detail links look like /product/<slug> on Vhandar — find every
  // anchor whose href matches that, which is a very reliable way to locate
  // one "card" per product regardless of what CSS classes they use.
  const productLinks = $('a[href*="/product/"]')
  console.log(`\nFound ${productLinks.length} link(s) matching /product/<slug>.`)

  if (productLinks.length === 0) {
    console.log('No product links found at all on this page — check the URL, or the site')
    console.log('may need JS to render (in which case this HTTP approach will not work here).')
    return
  }

  // Take the first product link, walk UP a few levels to find the repeating
  // "card" wrapper (the smallest ancestor that also contains a price-looking
  // "Rs" + digits text), and print its full outerHTML.
  const priceRegex = /Rs\.?\s*\d/i
  let card = $(productLinks[0])
  for (let i = 0; i < 6; i++) {
    const parent = card.parent()
    if (parent.length === 0) break
    if (priceRegex.test(parent.text())) {
      card = parent
      break
    }
    card = parent
  }

  console.log('\n=== Real product card HTML (for building selectors) ===')
  console.log(`Card wrapper tag/class: <${card.prop('tagName')} class="${card.attr('class') || ''}">`)
  console.log('\nFull outerHTML of this card:\n')
  console.log($.html(card))

  console.log('\n=== All product links found on this page (name via href slug) ===')
  productLinks.each((i, el) => {
    if (i < 20) console.log(`  ${$(el).attr('href')}`)
  })
  if (productLinks.length > 20) console.log(`  ...and ${productLinks.length - 20} more`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})