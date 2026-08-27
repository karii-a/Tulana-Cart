// On Render, browser.js uses @sparticuz/chromium (see scrapers/browser.js) —
// so downloading Puppeteer's own full Chrome browser there too is pure
// waste, and on a constrained/free hosting tier, installing TWO separate
// full Chromium browsers in one build (100–300MB+ combined) is a plausible
// way for one of those downloads to partially fail or extract incompletely.
// Only download Puppeteer's own Chrome locally, where it's actually used
// (by inspect.js / discover.js / testScrape.js).
const { execSync } = require('child_process')

if (process.env.RENDER) {
  console.log('[postinstall] Running on Render — skipping local Puppeteer Chrome download (using @sparticuz/chromium instead).')
} else {
  console.log('[postinstall] Not on Render — downloading Puppeteer\'s Chrome for local dev scripts...')
  execSync('npx puppeteer browsers install chrome', { stdio: 'inherit' })
}