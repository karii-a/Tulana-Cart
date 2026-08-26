// One-time helper: run this locally to see what a store's page actually
// looks like once JS has rendered, so you can fix the selectors in
// scrapers/config.js. This is NOT used in the real sync job.
//
// Usage:
//   cd backend
//   node scrapers/inspect.js bigmart
//   node scrapers/inspect.js merokirana
//   node scrapers/inspect.js bigmart https://bigmart.com.np/shop   <- optional 2nd arg
//                                                                       overrides the URL,
//                                                                       for trying a URL you
//                                                                       haven't added to
//                                                                       listUrls yet
//
// By default it tests the FIRST url in storeConfig.listUrls. It will:
//   1. Open that URL in a real (visible) Chrome window
//   2. Wait a few seconds for the page to render
//   3. Save screenshots to backend/scrapers/debug/<store>*.png
//   4. Click "Load More" (if loadMoreButtonText is set) a couple of times,
//      same as the real scraper does
//   5. Test the CURRENT selectors from config.js directly against the page
//      and report how many cards/names/prices they actually find
//   6. Print the outerHTML of one real product "card" so you can see the
//      exact class names to put in scrapers/config.js
//   7. Log any page redirects/navigations it sees along the way (helps
//      explain crashes caused by the site redirecting mid-script)

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

  const overrideUrl = process.argv[3]
  const urls = storeConfig.listUrls || (storeConfig.listUrl ? [storeConfig.listUrl] : [])
  if (!overrideUrl && urls.length === 0) {
    console.error(`storeConfig for "${key}" has no listUrls/listUrl configured`)
    process.exit(1)
  }
  const listUrl = overrideUrl || urls[0]
  if (overrideUrl) {
    console.log(`(using URL override from command line, ignoring listUrls in config.js)`)
  } else if (urls.length > 1) {
    console.log(`(storeConfig has ${urls.length} listUrls configured — testing only the first: ${listUrl})`)
  }

  const debugDir = path.join(__dirname, 'debug')
  fs.mkdirSync(debugDir, { recursive: true })

  const browser = await puppeteer.launch({ headless: false }) // visible so you can see what loads
  const page = await browser.newPage()
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
  )
  await page.setViewport({ width: 1366, height: 900 })

  // Log every navigation so redirects show up in the console instead of just
  // crashing an evaluate() call later with a confusing error.
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      console.log(`[navigation] page is now at: ${frame.url()}`)
    }
  })

  console.log(`Opening ${listUrl} ...`)
  try {
    const response = await page.goto(listUrl, { waitUntil: 'networkidle2', timeout: 60000 })
    console.log(`HTTP status: ${response ? response.status() : 'no response object'}`)
  } catch (err) {
    console.log(`!! page.goto threw: ${err.message}`)
  }

  console.log('Waiting 5s for the app to finish rendering...')
  await new Promise((r) => setTimeout(r, 5000))

  // Every step below is independently wrapped so one failure (e.g. the site
  // redirecting mid-script) doesn't stop the rest of the diagnostics from running.

  await safeStep('page diagnostics', async () => {
    const diagnostics = await page.evaluate(() => {
      const bodyText = document.body.innerText || ''
      const lowerText = bodyText.toLowerCase()
      const botCheckHints = ['just a moment', 'checking your browser', 'verify you are human', 'captcha', 'cloudflare', 'access denied', 'attention required']
      return {
        title: document.title,
        currentUrl: window.location.href,
        bodyTextLength: bodyText.length,
        bodyTextSample: bodyText.slice(0, 300),
        possibleBotCheck: botCheckHints.some((hint) => lowerText.includes(hint)),
      }
    })
    console.log('\n=== Page diagnostics ===')
    console.log(JSON.stringify(diagnostics, null, 2))
    if (diagnostics.possibleBotCheck) {
      console.log('!! Wording typical of a bot-check/CAPTCHA page detected.')
    }
    const requestedBase = listUrl.split('#')[0].replace(/\/$/, '')
    const endedUpBase = diagnostics.currentUrl.split('#')[0].replace(/\/$/, '')
    if (requestedBase !== endedUpBase && !diagnostics.currentUrl.includes(requestedBase)) {
      console.log(`!! The page redirected away from the URL you requested.`)
      console.log(`!! Requested: ${listUrl}`)
      console.log(`!! Ended up : ${diagnostics.currentUrl}`)
      console.log(`!! That target URL is probably not a real/stable route on this site.`)
    }
  })

  await safeStep('screenshot', async () => {
    const screenshotPath = path.join(debugDir, `${key}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`Saved screenshot: ${screenshotPath}`)
  })

  if (storeConfig.loadMoreButtonText) {
    await safeStep('clicking "Load More" a couple of times', async () => {
      for (let i = 0; i < 3; i++) {
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
        console.log(`  click ${i + 1}: ${clicked ? 'found and clicked "' + storeConfig.loadMoreButtonText + '"' : 'button not found (may be gone already)'}`)
        if (!clicked) break
        await new Promise((r) => setTimeout(r, 1500))
      }
    })
  }

  await safeStep('scroll + second screenshot', async () => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await new Promise((r) => setTimeout(r, 3000))
    const screenshotPathAfterScroll = path.join(debugDir, `${key}-after-scroll.png`)
    await page.screenshot({ path: screenshotPathAfterScroll, fullPage: true })
    console.log(`Saved post-scroll screenshot: ${screenshotPathAfterScroll}`)
  })

  // --- Test the CURRENT selectors from config.js directly ---
  await safeStep('testing current config.js selectors', async () => {
    const result = await page.evaluate((cfg) => {
      const cards = Array.from(document.querySelectorAll(cfg.cardSelector))
      const sample = cards.slice(0, 3).map((card) => {
        const nameEl = card.querySelector(cfg.nameSelector)
        const priceEl = card.querySelector(cfg.priceSelector)
        const imgEl = card.querySelector(cfg.imageSelector)
        return {
          name: nameEl ? nameEl.textContent.trim() : null,
          priceText: priceEl ? priceEl.textContent.trim() : null,
          imageSrc: imgEl ? imgEl.src : null,
        }
      })
      return { cardCount: cards.length, sample }
    }, storeConfig)

    console.log(`\n=== Testing current selectors from config.js (${key}) ===`)
    console.log(`cardSelector "${storeConfig.cardSelector}" matched ${result.cardCount} element(s)`)
    console.log(JSON.stringify(result.sample, null, 2))
    if (result.cardCount > 0 && result.sample.every((s) => s.name && s.priceText)) {
      console.log('>> These selectors already look like they work! You may not need to change config.js.')
    } else if (result.cardCount > 0) {
      console.log('>> Cards were found, but name or price came back empty — nameSelector/priceSelector need fixing.')
    } else {
      console.log('>> No cards matched cardSelector at all — see the real card HTML dumped below to fix it.')
    }
  })

  // --- Find one real product card by walking up from a price-looking element,
  //     and dump its outerHTML so the real class names are visible directly. ---
  await safeStep('dumping one real product card', async () => {
    const cardHtml = await page.evaluate(() => {
      const priceRegex = /(Rs\.?|रु|रू|NPR|₨)\s?\d/i
      const all = Array.from(document.querySelectorAll('body *'))
      let priceEl = null
      for (const el of all) {
        const text = el.textContent?.trim() || ''
        if (text.length < 60 && priceRegex.test(text) && el.children.length <= 1) {
          priceEl = el
          break
        }
      }
      if (!priceEl) return { found: false }

      // Walk up looking for an ancestor whose class name contains "card"
      // or "item" (common naming for a repeating product wrapper), capped
      // at 8 levels so we don't grab the entire page.
      let ancestor = priceEl
      let levels = 0
      let cardAncestor = null
      while (ancestor && levels < 8) {
        const cls = typeof ancestor.className === 'string' ? ancestor.className : ''
        if (/card|item|product/i.test(cls) && ancestor !== priceEl) {
          cardAncestor = ancestor
          break
        }
        ancestor = ancestor.parentElement
        levels++
      }

      const target = cardAncestor || priceEl.parentElement || priceEl
      return {
        found: true,
        priceElementText: priceEl.textContent.trim(),
        cardClassName: target.className,
        outerHtml: target.outerHTML.slice(0, 2000),
      }
    })

    console.log('\n=== Real product card HTML (for building selectors) ===')
    if (!cardHtml.found) {
      console.log('No price-looking element found on the page at all — nothing to dump.')
    } else {
      console.log(`Card wrapper class: "${cardHtml.cardClassName}"`)
      console.log('First ~2000 chars of its outerHTML:\n')
      console.log(cardHtml.outerHtml)
    }
  })

  await browser.close()
}

async function safeStep(label, fn) {
  try {
    await fn()
  } catch (err) {
    console.log(`\n!! Step "${label}" failed: ${err.message}`)
    console.log('!! Continuing with remaining diagnostics anyway...')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})