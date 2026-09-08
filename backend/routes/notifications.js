const express = require('express')
const router = express.Router()
const { notifyOrderStatus, notifyPurchase } = require('../services/notify')


router.post('/notify/order-status', async (req, res) => {
  const { orderId, userId, status } = req.body
  if (!orderId || !userId || !status) {
    return res.status(400).json({ error: 'orderId, userId and status are required' })
  }
  try {
    await notifyOrderStatus({ orderId, userId, status })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// Called from Wishlist.jsx right after a "Mark as Bought" write succeeds.
router.post('/notify/purchase', async (req, res) => {
  const { userId, productName, amount } = req.body
  if (!userId || !productName || amount == null) {
    return res.status(400).json({ error: 'userId, productName and amount are required' })
  }
  try {
    await notifyPurchase({ userId, productName, amount })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router