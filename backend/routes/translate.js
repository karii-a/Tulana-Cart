const express = require('express')
const router = express.Router()
const supabase = require('../supabase')
const { translateProductName } = require('../services/translate')

// POST /api/translate-product/:id
//
// Called by the frontend the first time a product is shown with the
// Nepali toggle on and it has no real Nepali name yet. Translates once,
// saves it to products.name_np, and every future viewer (any user, any
// page) just reads that column directly — no repeat API calls.
router.post('/translate-product/:id', async (req, res) => {
  const { id } = req.params

  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('id, name, name_np')
    .eq('id', id)
    .single()

  if (fetchError || !product) {
    return res.status(404).json({ error: 'Product not found' })
  }

  // Already has a real translation (not just the English name duplicated
  // as a placeholder by the scraper) — nothing to do.
  if (product.name_np && product.name_np !== product.name) {
    return res.json({ name_np: product.name_np, cached: true })
  }

  try {
    const name_np = await translateProductName(product.name)

    const { error: updateError } = await supabase
      .from('products')
      .update({ name_np })
      .eq('id', id)

    if (updateError) throw updateError

    res.json({ name_np, cached: false })
  } catch (err) {
    console.error(`translate-product ${id} failed:`, err.message)
    res.status(502).json({ error: 'Translation failed', detail: err.message })
  }
})

module.exports = router