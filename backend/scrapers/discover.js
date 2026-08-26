// Helper: tries to auto-find every category URL on a store's site, so you
// don't have to click through "All Categories" by hand for each one.
//
// Usage:
//   node scrapers/discover.js bigmart
//
// It opens storeConfig.baseUrl, finds a VISIBLE "All Categories"-style
// toggle, moves a real (virtual) mouse over it and clicks it, then figures
// out where that leaves us — whether it opened an in-page menu, or actually
// navigated to a whole different page — and lists whatever links are there.

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

  console.log(`Opening ${storeConfig.baseUrl} ...`)
  const browser = await puppeteer.launch({ headless: false })
  const page = await browser.newPage()
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
  )
  await page.setViewport({ width: 1366, height: 900 })

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      console.log(`[navigation] page is now at: ${frame.url()}`)
    }
  })

  await page.goto(storeConfig.baseUrl, { waitUntil: 'networkidle2', timeout: 60000 })
  await new Promise((r) => setTimeout(r, 3000))

  const startUrl = page.url()
  const beforeLinks = await getAllLinksWithRetry(page)
  console.log(`\nTotal links on page before opening any menu: ${beforeLinks.length}`)

  const toggleRect = await safeEvaluate(page, () => {
    const normalize = (s) => (s || '').trim().toLowerCase()
    const isVisible = (el) => {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }
    const all = Array.from(document.querySelectorAll('button, a, div, span'))
    let toggle = all.find((el) => isVisible(el) && normalize(el.textContent) === 'all categories')
    if (!toggle) toggle = all.find((el) => isVisible(el) && /all categories/i.test(el.textContent || ''))
    if (!toggle) return null
    const rect = toggle.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  })

  if (!toggleRect) {
    console.log('Could not find a visible "All Categories" toggle at all.')
    console.log('Check the screenshot below, or tell me the exact label you see on screen.')
  } else {
    console.log(`Found a visible toggle at (${Math.round(toggleRect.x)}, ${Math.round(toggleRect.y)}) — moving mouse there and clicking...`)
    await safeRun('hover + click toggle', async () => {
      await page.mouse.move(toggleRect.x, toggleRect.y, { steps: 10 })
      await new Promise((r) => setTimeout(r, 800))
      await page.mouse.click(toggleRect.x, toggleRect.y)
    })

    // Give any navigation time to happen and (mostly) settle. We poll the
    // URL a few times rather than one fixed wait, since this site's home
    // page is known to sometimes keep re-navigating on its own.
    let lastUrl = null
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 700))
      const url = page.url()
      if (url !== lastUrl) console.log(`  ...currently at: ${url}`)
      lastUrl = url
    }
  }

  const endUrl = page.url()
  console.log(`\nStarted at : ${startUrl}`)
  console.log(`Ended at   : ${endUrl}`)
  if (endUrl !== startUrl) {
    console.log('!! Clicking "All Categories" navigated to a DIFFERENT PAGE (not just an')
    console.log('!! in-page dropdown). That page itself might be a full category index —')
    console.log('!! worth checking directly with:')
    console.log(`!!   node scrapers/inspect.js ${key} ${endUrl}`)
  }

  await safeRun('screenshot', async () => {
    const shotPath = path.join(debugDir, `${key}-categories-menu.png`)
    await page.screenshot({ path: shotPath, fullPage: false })
    console.log(`Saved screenshot: ${shotPath}`)
  })

  const afterLinks = await getAllLinksWithRetry(page)
  console.log(`Total links on the current page: ${afterLinks.length}`)

  const beforeSet = new Set(beforeLinks.map((l) => l.href))
  const newLinks = afterLinks.filter((l) => !beforeSet.has(l.href))

  console.log(`\n=== ${newLinks.length} link(s) here that weren't on the original homepage ===`)
  console.log(JSON.stringify(newLinks.slice(0, 150), null, 2))
  if (newLinks.length > 150) {
    console.log(`...and ${newLinks.length - 150} more (truncated).`)
  }

  if (newLinks.length > 0) {
    console.log('\nCopy the category hrefs you want (skip ones that are clearly not')
    console.log('product categories, e.g. "Login", social links, etc.) into the')
    console.log('`listUrls` array for this store in scrapers/config.js, then re-run')
    console.log('`node scrapers/inspect.js ' + key + '` to verify.')
  } else {
    console.log('\nStill no new links found. Check the screenshot to see what state the')
    console.log('page is actually in — paste it here and I\'ll take a look.')
  }

  await browser.close()
}

async function getAllLinksWithRetry(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await safeEvaluate(page, () => {
      return Array.from(document.querySelectorAll('a[href]')).map((a) => ({
        href: a.href,
        text: a.textContent.trim().slice(0, 60),
      }))
    })
    if (result !== null) return result
    await new Promise((r) => setTimeout(r, 800)) // page was mid-navigation — give it a moment and retry
  }
  return []
}

// Runs page.evaluate(fn, ...args) defensively, since this site's homepage
// can fire background navigations that destroy the execution context
// mid-call. Returns null (instead of throwing) if that happens.
async function safeEvaluate(page, fn, ...args) {
  try {
    return await page.evaluate(fn, ...args)
  } catch (err) {
    return null
  }
}

// Runs an arbitrary async step defensively, same reasoning as safeEvaluate.
async function safeRun(label, fn) {
  try {
    return await fn()
  } catch (err) {
    console.log(`(step "${label}" failed: ${err.message})`)
    return null
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})