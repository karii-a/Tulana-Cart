// Runs TC-ESW-03 and TC-ESW-04 against your LOCAL backend (must already be
// running via `node index.js` in another terminal).
//
// Usage (from the backend/ folder, in a SECOND PowerShell window):
//   node scripts/testEsewaVerify.js
//
// This reads ESEWA_SECRET from your own .env — it never gets sent anywhere
// except to your own localhost server, and never printed to the console.

require('dotenv').config()
const crypto = require('crypto')

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`
const secret = process.env.ESEWA_SECRET
const product_code = process.env.ESEWA_MERCHANT_ID || 'EPAYTEST'

if (!secret) {
  console.error('ESEWA_SECRET not found in your .env — run this from the backend/ folder.')
  process.exit(1)
}

function buildSignature(totalAmount, transactionUuid, productCode) {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`
  return crypto.createHmac('sha256', secret).update(message).digest('base64')
}

async function postVerify(decodedPayload) {
  const data = Buffer.from(JSON.stringify(decodedPayload)).toString('base64')
  const res = await fetch(`${BASE_URL}/api/subscription/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  let body
  try {
    body = await res.json()
  } catch {
    body = await res.text()
  }
  return { status: res.status, body }
}

async function main() {
  console.log(`Target: ${BASE_URL}/api/subscription/verify\n`)

  // ---- TC-ESW-03: tampered amount, deliberately WRONG signature ----
  console.log('--- TC-ESW-03: tampered payload, invalid signature ---')
  const forged = {
    transaction_uuid: `sub-smart_saver-${Date.now()}`,
    total_amount: '1', // tampered down from the real 199
    product_code,
    status: 'COMPLETE',
    signed_field_names: 'total_amount,transaction_uuid,product_code',
    signature: 'dGhpcy1pcy1ub3QtYS12YWxpZC1zaWduYXR1cmU=', // garbage, on purpose
  }
  const r1 = await postVerify(forged)
  console.log(`Status: ${r1.status}`)
  console.log('Body:', r1.body)
  console.log(
    r1.status === 400 && JSON.stringify(r1.body).toLowerCase().includes('signature')
      ? '=> Looks like a PASS: rejected with a signature-mismatch error.\n'
      : '=> Does NOT match the expected result — check subscription.js.\n'
  )

  // ---- TC-ESW-04: CORRECTLY signed, but a transaction eSewa's status API won't confirm ----
  console.log('--- TC-ESW-04: valid signature, unconfirmed transaction ---')
  const transaction_uuid = `sub-smart_saver-nonexistent-${Date.now()}`
  const total_amount = 199
  const signature = buildSignature(total_amount, transaction_uuid, product_code)
  const valid = {
    transaction_uuid,
    total_amount,
    product_code,
    status: 'COMPLETE', // claims complete, but eSewa's own status API has no record of this uuid
    signed_field_names: 'total_amount,transaction_uuid,product_code',
    signature,
  }
  const r2 = await postVerify(valid)
  console.log(`Status: ${r2.status}`)
  console.log('Body:', r2.body)
  console.log(
    r2.status === 400
      ? '=> Looks like a PASS: signature matched, but the status-API cross-check still blocked activation.\n'
      : '=> Does NOT match the expected result — check subscription.js.\n'
  )

  console.log('Next: check your subscription_payments table — both transaction_uuids above should show status = "failed", and neither should have created/updated a user_subscriptions row.')
}

main().catch((err) => {
  console.error('Script error:', err.message)
  process.exit(1)
})