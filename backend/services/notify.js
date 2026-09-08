const supabase = require('../supabase')
const { sendEmail } = require('./mailer')

/**
 * Notify every user who has `productId` in their wishlist that its price dropped.
 */
async function notifyPriceDrop({ productId, productName, storeName, oldPrice, newPrice }) {
  const { data: watchers, error } = await supabase
    .from('wishlists')
    .select('user_id')
    .eq('product_id', productId)

  if (error || !watchers?.length) return

  const title = `Price drop: ${productName}`
  const message = `${productName} at ${storeName} dropped from Rs. ${oldPrice} to Rs. ${newPrice}.`

  const rows = watchers.map((w) => ({
    user_id: w.user_id,
    type: 'price_drop',
    title,
    message,
    product_id: productId,
  }))

  const { error: insertError } = await supabase.from('notifications').insert(rows)
  if (insertError) {
    console.error('[notify] notifications insert failed:', insertError)
  }

  for (const w of watchers) {
    const email = await getUserEmail(w.user_id)
    if (!email) continue
    await sendEmail({
      to: email,
      subject: title,
      html: `<p>${message}</p><p>Good time to grab it on Tulana Kart!</p>`,
    })
  }
}

// Service-role lookup of a user's email via Supabase Auth admin API
// (there's no guarantee `profiles` stores email, so ask auth directly).
async function getUserEmail(userId) {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error) return null
  return data?.user?.email ?? null
}

/**
 * Notify the order's owner that its status changed.
 */
async function notifyOrderStatus({ orderId, userId, status }) {
  const title = `Order #${orderId} update`
  const message = `Your order #${orderId} is now "${status}".`

  const { error: insertError } = await supabase.from('notifications').insert([{
    user_id: userId,
    type: 'order_status',
    title,
    message,
    order_id: orderId,
  }])
  if (insertError) {
    console.error('[notify] notifications insert failed:', insertError)
  }

  const email = await getUserEmail(userId)
  if (email) {
    await sendEmail({
      to: email,
      subject: title,
      html: `<p>${message}</p>`,
    })
  }
}

/**
 * Notify a user that we've logged a "Mark as Bought" purchase from their
 * Wishlist (see frontend/src/pages/Wishlist.jsx). This isn't a real order —
 * Tulana Kart has no checkout — it's just confirming their self-reported
 * spending was saved.
 */
async function notifyPurchase({ userId, productName, amount }) {
  const title = `Marked as bought: ${productName}`
  const message = `You marked "${productName}" as bought for Rs. ${amount}. It's now in your Spending history.`

  const { error: insertError } = await supabase.from('notifications').insert([{
    user_id: userId,
    type: 'purchase',
    title,
    message,
  }])
  if (insertError) {
    console.error('[notify] notifications insert failed:', insertError)
  }

  const email = await getUserEmail(userId)
  if (email) {
    await sendEmail({
      to: email,
      subject: title,
      html: `<p>${message}</p>`,
    })
  }
}

/**
 * Notify a user right when they pick a paid tier on the Subscription page —
 * i.e. as soon as we create the `pending` row in subscription_payments,
 * before they've been redirected to eSewa. This fires whether or not they
 * ever actually complete the payment, by design: it's confirming the
 * *selection* was recorded, not that money moved.
 */
async function notifySubscriptionSelected({ userId, tierName, amount }) {
  const title = `${tierName} plan selected`
  const message = `You selected the ${tierName} plan (Rs. ${amount}/month). Complete payment via eSewa to activate it — if you haven't finished checkout yet, this plan isn't active.`

  const { error: insertError } = await supabase.from('notifications').insert([{
    user_id: userId,
    type: 'subscription_selected',
    title,
    message,
  }])
  if (insertError) {
    console.error('[notify] notifications insert failed:', insertError)
  }

  const email = await getUserEmail(userId)
  if (email) {
    await sendEmail({
      to: email,
      subject: title,
      html: `<p>${message}</p>`,
    })
  }
}

module.exports = { notifyPriceDrop, notifyOrderStatus, notifyPurchase, notifySubscriptionSelected }