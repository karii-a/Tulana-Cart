const express = require('express')
const router = express.Router()
const { notifyOrderStatus } = require('../services/notify')

// Called by the Admin page after updating an order's status.
// Body: { orderId, userId, status }
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

module.exports = router
