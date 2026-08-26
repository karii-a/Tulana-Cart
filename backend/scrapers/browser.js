const puppeteer = require('puppeteer')

async function launchBrowser() {
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
        `Chrome isn't installed where Puppeteer expected it. On Render: (1) redeploy with ` +
        `"Clear build cache & deploy" so "postinstall" actually reruns and downloads Chrome, ` +
        `and (2) set the env var PUPPETEER_CACHE_DIR to the same path named in the original ` +
        `error, so build-time download and run-time lookup agree. Original error: ${err.message}`
      )
    }
    throw err
  }
}

module.exports = { launchBrowser }