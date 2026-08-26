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

  await supabase.from('notifications').insert(rows)

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

  await supabase.from('notifications').insert([{
    user_id: userId,
    type: 'order_status',
    title,
    message,
    order_id: orderId,
  }])

  const email = await getUserEmail(userId)
  if (email) {
    await sendEmail({
      to: email,
      subject: title,
      html: `<p>${message}</p>`,
    })
  }
}

module.exports = { notifyPriceDrop, notifyOrderStatus }
