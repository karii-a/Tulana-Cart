const express = require('express')
const router = express.Router()
const supabase = require('../supabase')

const STORES = [1, 2, 3] // BigMart, Bhat-Bhateni, Saleways store IDs

router.get('/sync-products', async (req, res) => {
  try {
    const response = await fetch('https://simple-grocery-store-api.click/products')
    const apiProducts = await response.json()

    let inserted = 0

    for (const item of apiProducts) {
      // Insert product
      const { data: product, error: prodError } = await supabase
        .from('products')
        .insert([{
          name: item.name,
          name_np: item.name,
          brand: 'Imported',
          category_id: 1
        }])
        .select()
        .single()

      if (prodError) continue

      // Generate random NPR prices for each store
      const basePrice = Math.floor(Math.random() * 300) + 50
      const priceRows = STORES.map(storeId => ({
        product_id: product.id,
        store_id: storeId,
        price: basePrice + Math.floor(Math.random() * 30) - 15,
        unit: 'unit',
        in_stock: item.inStock ?? true
      }))

      await supabase.from('product_prices').insert(priceRows)
      inserted++
    }

    res.json({ message: `Synced ${inserted} products`, total: apiProducts.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router