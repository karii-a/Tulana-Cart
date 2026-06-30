import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useNavigate } from 'react-router-dom'

function Cart() {
  const { user } = useAuth()
  const { lang } = useLang()
  const navigate = useNavigate()
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchCart()
  }, [user])

  async function fetchCart() {
    setLoading(true)
    const { data } = await supabase
      .from('cart')
      .select(`
        *,
        products(name, name_np),
        stores(name, name_np)
      `)
      .eq('user_id', user.id)
    setCart(data || [])
    setLoading(false)
  }

  async function removeItem(id) {
    await supabase.from('cart').delete().eq('id', id)
    setCart(prev => prev.filter(c => c.id !== id))
  }

  async function updateQuantity(id, qty) {
    if (qty < 1) return
    await supabase.from('cart').update({ quantity: qty }).eq('id', id)
    setCart(prev => prev.map(c => c.id === id ? { ...c, quantity: qty } : c))
  }

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  async function handleCheckout() {
    if (cart.length === 0) return
  
    // Create order
    const { data: order, error } = await supabase
      .from('orders')
      .insert([{ user_id: user.id, total_amount: total, status: 'pending' }])
      .select()
      .single()
  
    if (error) return
  
    const items = cart.map(c => ({
      order_id: order.id,
      product_id: c.product_id,
      store_id: c.store_id,
      price: c.price,
      quantity: c.quantity
    }))
    await supabase.from('order_items').insert(items)
  
    // Get signed params from backend
    const response = await fetch('http://localhost:3000/api/esewa/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: total, order_id: order.id })
    })
    const params = await response.json()
  
    // Submit form to eSewa
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = params.payment_url
  
    const fields = {
      amount: params.total_amount,
      tax_amount: 0,
      total_amount: params.total_amount,
      transaction_uuid: params.transaction_uuid,
      product_code: params.product_code,
      product_service_charge: 0,
      product_delivery_charge: 0,
      success_url: params.success_url,
      failure_url: params.failure_url,
      signed_field_names: 'total_amount,transaction_uuid,product_code',
      signature: params.signature
    }
  
    Object.entries(fields).forEach(([key, val]) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = key
      input.value = val
      form.appendChild(input)
    })
  
    document.body.appendChild(form)
    form.submit()
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="page">
      <h1 className="cart-title">
        {lang === 'en' ? 'My Cart' : 'मेरो कार्ट'}
      </h1>

      {cart.length === 0 ? (
        <div className="wishlist-empty">
          <p>{lang === 'en' ? 'Your cart is empty.' : 'तपाईंको कार्ट खाली छ।'}</p>
          <button onClick={() => navigate('/')}>
            {lang === 'en' ? 'Browse Products' : 'उत्पादनहरू हेर्नुहोस्'}
          </button>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {cart.map(item => (
              <div key={item.id} className="cart-item">
                <div className="cart-item__info">
                  <h4>{lang === 'en' ? item.products?.name : (item.products?.name_np || item.products?.name)}</h4>
                  <p>{lang === 'en' ? item.stores?.name : item.stores?.name_np}</p>
                  <p className="cart-item__price">Rs. {item.price}</p>
                </div>
                <div className="cart-item__controls">
                  <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                  <span>{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                  <button className="cart-item__remove" onClick={() => removeItem(item.id)}>✕</button>
                </div>
                <div className="cart-item__subtotal">
                  Rs. {item.price * item.quantity}
                </div>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <h3>{lang === 'en' ? 'Order Summary' : 'अर्डर सारांश'}</h3>
            <div className="cart-summary__row">
              <span>{lang === 'en' ? 'Items' : 'सामानहरू'}</span>
              <span>{cart.reduce((s, i) => s + i.quantity, 0)}</span>
            </div>
            <div className="cart-summary__row">
              <span>{lang === 'en' ? 'Total' : 'जम्मा'}</span>
              <strong>Rs. {total}</strong>
            </div>
            <button className="cart-checkout-btn" onClick={handleCheckout}>
              {lang === 'en' ? 'Pay with eSewa' : 'eSewa मार्फत भुक्तानी गर्नुहोस्'}
            </button>
            <img
              src="https://esewa.com.np/common/images/esewa_logo.png"
              alt="eSewa"
              className="esewa-logo"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default Cart