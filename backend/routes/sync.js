const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

const STORES = [1, 2, 3]

// CHANGE THIS TO YOUR LIVE FRONTEND URL
const FRONTEND_URL = process.env.FRONTEND_URL || "https://YOUR-FRONTEND-URL.vercel.app"

// Same "look up by name, create if missing" pattern as
// scrapers/runSync.js's resolveCategoryId — keeps this demo-data seeder
// from dumping everything into a hardcoded category_id: 1 the way it used
// to (that's what was breaking the category filter buttons on the Home page).
async function resolveCategoryId(categoryName) {
  const name = categoryName || 'Uncategorized'
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', name)
    .maybeSingle()
  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('categories')
    .insert([{ name, name_np: name }])
    .select()
    .single()
  if (error) throw new Error(`could not create category "${name}": ${error.message}`)
  return created.id
}

router.get('/sync-products', async (req, res) => {
  try {
    const response = await fetch('https://simple-grocery-store-api.click/products')
    const apiProducts = await response.json()

    let inserted = 0

    for (const item of apiProducts) {
      const categoryId = await resolveCategoryId(item.category)
      const { data: product, error: prodError } = await supabase
        .from('products')
        .insert([{
          name: item.name,
          // Left null on purpose — see scrapers/runSync.js for why.
          name_np: null,
          brand: item.name.trim().split(/\s+/)[0],
          category_id: categoryId
        }])
        .select()
        .single()

      if (prodError) continue

      const basePrice = Math.floor(Math.random() * 300) + 50

      const priceRows = STORES.map(storeId => ({
        product_id: product.id,
        store_id: storeId,
        price: basePrice + Math.floor(Math.random() * 30) - 15,
        unit: 'unit',
        in_stock: item.inStock ?? true
      }))

      await supabase
        .from('product_prices')
        .insert(priceRows)

      inserted++
    }

    res.json({
      message: `Synced ${inserted} products`,
      total: apiProducts.length
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router