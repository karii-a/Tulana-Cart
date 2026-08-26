const express = require('express')
const router = express.Router()
const { runSync } = require('../scrapers/runSync')

// Triggers a real scrape of every store in scrapers/config.js
// (BigMart, Mero Kirana) and upserts the results into Supabase.
//
// This is separate from /api/sync-products (routes/sync.js), which just
// seeds random placeholder data from a demo API and is only useful for
// populating the UI before real selectors are working.
router.post('/scrape', async (req, res) => {
  try {
    const summary = await runSync()
    res.json(summary)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router