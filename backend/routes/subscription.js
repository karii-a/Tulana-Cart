const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const supabase = require('../supabase')

// CHANGE THIS TO YOUR LIVE FRONTEND URL (same pattern as routes/sync.js)
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://YOUR-FRONTEND-URL.vercel.app'

// eSewa ePay v2 endpoints. Defaults point at eSewa's UAT/test environment
// (rc-epay / rc.esewa.com.np) so this works out of the box with the test
// merchant credentials (product_code EPAYTEST). Set ESEWA_GATEWAY_URL and
// ESEWA_STATUS_URL to the production URLs (epay.esewa.com.np /
// esewa.com.np) once you have real merchant credentials.
const ESEWA_GATEWAY_URL = process.env.ESEWA_GATEWAY_URL || 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'
const ESEWA_STATUS_URL = process.env.ESEWA_STATUS_URL || 'https://rc.esewa.com.np/api/epay/transaction/status/'

// Paid tiers only — free has no payment step. Amounts here are the source
// of truth for what actually gets charged; keep them in sync with the
// prices shown on frontend/src/pages/Subscription.jsx.
const TIERS = {
  smart_saver: { name: 'Smart Saver', amount: 199 },
  family: { name: 'Family Plan', amount: 349 },
}

function buildSignature(totalAmount, transactionUuid, productCode, secret) {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`
  return crypto.createHmac('sha256', secret).update(message).digest('base64')
}

// Step 1 — user picks a plan on the Subscription page. We record a pending
// payment and hand back everything the frontend needs to build and submit
// the eSewa form (see frontend/src/pages/Subscription.jsx).
router.post('/subscription/initiate', async (req, res) => {
  try {
    const { user_id, tier_id } = req.body
    const tier = TIERS[tier_id]
    if (!user_id || !tier) {
      return res.status(400).json({ error: 'user_id and a valid tier_id are required' })
    }

    const product_code = process.env.ESEWA_MERCHANT_ID
    const secret = process.env.ESEWA_SECRET
    if (!product_code || !secret) {
      return res.status(500).json({ error: 'eSewa is not configured on the server (ESEWA_MERCHANT_ID / ESEWA_SECRET missing)' })
    }

    const transaction_uuid = `sub-${tier_id}-${Date.now()}`
    const total_amount = tier.amount

    const { error: insertError } = await supabase.from('subscription_payments').insert([{
      user_id,
      tier_id,
      amount: total_amount,
      transaction_uuid,
      status: 'pending',
    }])
    if (insertError) throw insertError

    res.json({
      amount: total_amount,
      tax_amount: 0,
      total_amount,
      transaction_uuid,
      product_code,
      product_service_charge: 0,
      product_delivery_charge: 0,
      success_url: `${FRONTEND_URL}/subscription/success`,
      failure_url: `${FRONTEND_URL}/subscription/failed`,
      signed_field_names: 'total_amount,transaction_uuid,product_code',
      signature: buildSignature(total_amount, transaction_uuid, product_code, secret),
      payment_url: ESEWA_GATEWAY_URL,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// Step 2 — eSewa redirects the browser to
// `${FRONTEND_URL}/subscription/success?data=<base64>` (or /failed with no
// data) after the user pays. The frontend forwards the raw `data` string
// here. We never trust that payload on its own — a client could tamper
// with a redirect URL — so we (a) verify its HMAC signature and (b) ask
// eSewa's own status API to confirm before activating anything.
router.post('/subscription/verify', async (req, res) => {
  try {
    const { data } = req.body
    if (!data) return res.status(400).json({ error: 'data is required' })

    const secret = process.env.ESEWA_SECRET
    const decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf-8'))
    const { transaction_uuid, total_amount, product_code, status, signed_field_names, signature } = decoded

    const fieldNames = (signed_field_names || 'total_amount,transaction_uuid,product_code').split(',')
    const message = fieldNames.map((f) => `${f}=${decoded[f]}`).join(',')
    const expectedSignature = crypto.createHmac('sha256', secret).update(message).digest('base64')

    if (expectedSignature !== signature) {
      return res.status(400).json({ error: 'Signature mismatch — payment could not be verified' })
    }

    const statusRes = await fetch(
      `${ESEWA_STATUS_URL}?product_code=${product_code}&total_amount=${total_amount}&transaction_uuid=${transaction_uuid}`
    )
    const statusData = await statusRes.json()

    if (status !== 'COMPLETE' || statusData.status !== 'COMPLETE') {
      await supabase
        .from('subscription_payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('transaction_uuid', transaction_uuid)
      return res.status(400).json({ error: 'Payment not completed' })
    }

    const { data: payment, error: fetchError } = await supabase
      .from('subscription_payments')
      .select('user_id, tier_id')
      .eq('transaction_uuid', transaction_uuid)
      .single()
    if (fetchError || !payment) throw fetchError || new Error('payment record not found')

    await supabase
      .from('subscription_payments')
      .update({
        status: 'paid',
        esewa_ref_id: statusData.ref_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('transaction_uuid', transaction_uuid)

    const periodEnd = new Date()
    periodEnd.setDate(periodEnd.getDate() + 30)

    await supabase.from('user_subscriptions').upsert({
      user_id: payment.user_id,
      tier_id: payment.tier_id,
      status: 'active',
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })

    res.json({ ok: true, tier_id: payment.tier_id, current_period_end: periodEnd.toISOString() })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router