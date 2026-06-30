const express = require('express')
const router = express.Router()
const supabase = require('../supabase')
const crypto = require('crypto')

const STORES = [1, 2, 3]

router.get('/sync-products', async (req, res) => {
  try {
    const response = await fetch('https://simple-grocery-store-api.click/products')
    const apiProducts = await response.json()

    let inserted = 0

    for (const item of apiProducts) {
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

router.post('/esewa/initiate', async (req, res) => {
  const { amount, order_id } = req.body

  const total_amount = amount
  const transaction_uuid = `order-${order_id}-${Date.now()}`
  const product_code = process.env.ESEWA_MERCHANT_ID
  const secret = process.env.ESEWA_SECRET

  const message = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`
  const signature = crypto.createHmac('sha256', secret).update(message).digest('base64')

  res.json({
    total_amount,
    transaction_uuid,
    product_code,
    signature,
    success_url: `http://localhost:5173/payment-success?order_id=${order_id}`,
    failure_url: `http://localhost:5173/payment-failed?order_id=${order_id}`,
    payment_url: 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'
  })
})

module.exports = router