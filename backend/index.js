const express = require('express')
const cors = require('cors')
const cron = require('node-cron')
require('dotenv').config()

const syncRoutes = require('./routes/sync')
const scrapeRoutes = require('./routes/scrape')
const { runSync } = require('./scrapers/runSync')

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'Tulana Kart API running' })
})

app.use('/api', syncRoutes)
app.use('/api', scrapeRoutes)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

// Re-scrape BigMart / Mero Kirana every night at 2 AM server time.
// Remove this if you'd rather trigger POST /api/scrape manually or from
// an external scheduler (e.g. a Vercel/Render cron).
cron.schedule('0 2 * * *', async () => {
  console.log('[cron] starting nightly scrape...')
  try {
    const summary = await runSync()
    console.log('[cron] scrape finished:', JSON.stringify(summary))
  } catch (err) {
    console.error('[cron] scrape failed:', err)
  }
})