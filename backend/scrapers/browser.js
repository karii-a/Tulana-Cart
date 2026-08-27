// On Render, use @sparticuz/chromium — a Chromium build packaged as a
// normal npm dependency specifically for constrained Linux hosts (Render,
// Lambda, etc). It gets installed like any other package during the normal
// `npm install` step, with NO separate browser-download step at all — this
// sidesteps the entire class of "Chrome downloaded to path X, looked for at
// path Y" problems that a separately-downloaded browser can hit on Render.
//
// Locally (e.g. your Windows dev machine, used by inspect.js/discover.js/
// testScrape.js), regular `puppeteer` with its own downloaded browser still
// works fine and is simpler — so this only switches to the Render path when
// actually running there. Render automatically sets process.env.RENDER, so
// no extra config is needed to detect it.
const RENDER = !!process.env.RENDER

async function launchBrowser() {
  if (RENDER) {
    const chromium = require('@sparticuz/chromium')
    const puppeteerCore = require('puppeteer-core')
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })
  }

  const puppeteer = require('puppeteer')
  try {
    return await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    })
  } catch (err) {
    if (/Could not find (Chrome|Chromium)/i.test(err.message)) {
      throw new Error(
        `Chrome isn't installed locally for Puppeteer. Run: npx puppeteer browsers install chrome. ` +
        `Original error: ${err.message}`
      )
    }
    throw err
  }
}

module.exports = { launchBrowser }