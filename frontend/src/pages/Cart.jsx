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
  const [step, setStep] = useState('cart') // 'cart' | 'delivery' | 'payment'
  const [delivery, setDelivery] = useState({
    name: '',
    phone: '',
    address: '',
    city: 'Kathmandu',
    note: ''
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchCart()
  }, [user])

  async function fetchCart() {
    setLoading(true)
    const { data } = await supabase
      .from('cart')
      .select(`*, products(name, name_np), stores(name, name_np)`)
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

  function handleDeliveryNext() {
    if (!delivery.name || !delivery.phone || !delivery.address) {
      setError(lang === 'en' ? 'Please fill in all required fields.' : 'सबै आवश्यक फिल्ड भर्नुहोस्।')
      return
    }
    if (!/^\d{10}$/.test(delivery.phone)) {
      setError(lang === 'en' ? 'Please enter a valid 10-digit phone number.' : 'वैध फोन नम्बर राख्नुहोस्।')
      return
    }
    setError('')
    setStep('payment')
  }

  async function handleCheckout() {
    if (cart.length === 0) return

    const estimatedDelivery = new Date()
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 2)

    const { data: order, error } = await supabase
      .from('orders')
      .insert([{
        user_id: user.id,
        total_amount: total,
        status: 'pending',
        delivery_name: delivery.name,
        delivery_phone: delivery.phone,
        delivery_address: `${delivery.address}, ${delivery.city}`,
        estimated_delivery: estimatedDelivery.toISOString()
      }])
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

    // Add initial status history
    await supabase.from('order_status_history').insert([{
      order_id: order.id,
      status: 'pending',
      note: 'Order placed successfully'
    }])

    // eSewa payment
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    const response = await fetch(`${apiUrl}/api/esewa/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: total, order_id: order.id })
    })
    const params = await response.json()

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
      {/* Step indicator */}
      <div className="checkout-steps">
        <div className={`checkout-step ${step === 'cart' ? 'active' : ''} ${step !== 'cart' ? 'done' : ''}`}>
          <span>1</span> {lang === 'en' ? 'Cart' : 'कार्ट'}
        </div>
        <div className="checkout-step__line"></div>
        <div className={`checkout-step ${step === 'delivery' ? 'active' : ''} ${step === 'payment' ? 'done' : ''}`}>
          <span>2</span> {lang === 'en' ? 'Delivery' : 'डेलिभरी'}
        </div>
        <div className="checkout-step__line"></div>
        <div className={`checkout-step ${step === 'payment' ? 'active' : ''}`}>
          <span>3</span> {lang === 'en' ? 'Payment' : 'भुक्तानी'}
        </div>
      </div>

      {/* STEP 1: Cart */}
      {step === 'cart' && (
        <>
          <h2 className="cart-title">{lang === 'en' ? 'My Cart' : 'मेरो कार्ट'}</h2>
          {cart.length === 0 ? (
            <div className="wishlist-empty">
              <p>{lang === 'en' ? 'Your cart is empty.' : 'तपाईंको कार्ट खाली छ।'}</p>
              <button onClick={() => navigate('/')}>{lang === 'en' ? 'Browse Products' : 'उत्पादनहरू हेर्नुहोस्'}</button>
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
                    <div className="cart-item__subtotal">Rs. {item.price * item.quantity}</div>
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
                <button className="cart-checkout-btn" onClick={() => setStep('delivery')}>
                  {lang === 'en' ? 'Proceed to Delivery' : 'डेलिभरीमा जानुहोस्'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* STEP 2: Delivery */}
      {step === 'delivery' && (
        <div className="delivery-form-wrap">
          <h2 className="cart-title">{lang === 'en' ? 'Delivery Details' : 'डेलिभरी विवरण'}</h2>
          {error && <div className="auth-error">{error}</div>}
          <div className="delivery-form">
            <div className="delivery-form__grid">
              <div className="auth-field">
                <label>{lang === 'en' ? 'Full Name *' : 'पूरा नाम *'}</label>
                <input
                  type="text"
                  placeholder={lang === 'en' ? 'Your full name' : 'तपाईंको पूरा नाम'}
                  value={delivery.name}
                  onChange={e => setDelivery({...delivery, name: e.target.value})}
                />
              </div>
              <div className="auth-field">
                <label>{lang === 'en' ? 'Phone Number *' : 'फोन नम्बर *'}</label>
                <input
                  type="tel"
                  placeholder="98XXXXXXXX"
                  value={delivery.phone}
                  onChange={e => setDelivery({...delivery, phone: e.target.value})}
                />
              </div>
              <div className="auth-field" style={{gridColumn: '1 / -1'}}>
                <label>{lang === 'en' ? 'Delivery Address *' : 'डेलिभरी ठेगाना *'}</label>
                <input
                  type="text"
                  placeholder={lang === 'en' ? 'Street, Tole, Ward No.' : 'सडक, टोल, वडा नं.'}
                  value={delivery.address}
                  onChange={e => setDelivery({...delivery, address: e.target.value})}
                />
              </div>
              <div className="auth-field">
                <label>{lang === 'en' ? 'City' : 'शहर'}</label>
                <select value={delivery.city} onChange={e => setDelivery({...delivery, city: e.target.value})}>
                  <option>Kathmandu</option>
                  <option>Lalitpur</option>
                  <option>Bhaktapur</option>
                  <option>Pokhara</option>
                  <option>Biratnagar</option>
                  <option>Butwal</option>
                  <option>Chitwan</option>
                </select>
              </div>
              <div className="auth-field">
                <label>{lang === 'en' ? 'Delivery Note (optional)' : 'डेलिभरी नोट (ऐच्छिक)'}</label>
                <input
                  type="text"
                  placeholder={lang === 'en' ? 'Any special instructions' : 'कुनै विशेष निर्देशन'}
                  value={delivery.note}
                  onChange={e => setDelivery({...delivery, note: e.target.value})}
                />
              </div>
            </div>

            <div className="delivery-estimate">
              <span>📦</span>
              <p>{lang === 'en' ? 'Estimated delivery: 2-3 business days' : 'अनुमानित डेलिभरी: २-३ कार्यदिन'}</p>
            </div>

            <div className="delivery-form__actions">
              <button className="back-btn" onClick={() => setStep('cart')}>
                ← {lang === 'en' ? 'Back to Cart' : 'कार्टमा फर्कनुहोस्'}
              </button>
              <button className="cart-checkout-btn" onClick={handleDeliveryNext}>
                {lang === 'en' ? 'Proceed to Payment' : 'भुक्तानीमा जानुहोस्'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Payment */}
      {step === 'payment' && (
        <div className="delivery-form-wrap">
          <h2 className="cart-title">{lang === 'en' ? 'Review & Pay' : 'समीक्षा र भुक्तानी'}</h2>
          <div className="review-card">
            <h3>{lang === 'en' ? 'Delivery To' : 'डेलिभरी'}</h3>
            <p><strong>{delivery.name}</strong></p>
            <p>{delivery.phone}</p>
            <p>{delivery.address}, {delivery.city}</p>
            {delivery.note && <p><em>{delivery.note}</em></p>}
          </div>

          <div className="review-card">
            <h3>{lang === 'en' ? 'Order Items' : 'अर्डर सामानहरू'}</h3>
            {cart.map(item => (
              <div key={item.id} className="review-item">
                <span>{item.products?.name} x{item.quantity}</span>
                <span>Rs. {item.price * item.quantity}</span>
              </div>
            ))}
            <div className="review-item review-item--total">
              <strong>{lang === 'en' ? 'Total' : 'जम्मा'}</strong>
              <strong>Rs. {total}</strong>
            </div>
          </div>

          <div className="delivery-form__actions">
            <button className="back-btn" onClick={() => setStep('delivery')}>
              ← {lang === 'en' ? 'Back' : 'फर्कनुहोस्'}
            </button>
            <button className="cart-checkout-btn" onClick={handleCheckout}>
              {lang === 'en' ? 'Pay with eSewa' : 'eSewa मार्फत भुक्तानी'}
            </button>
          </div>
          <div style={{textAlign: 'center', marginTop: '1rem'}}>
            <img src="https://esewa.com.np/common/images/esewa_logo.png" alt="eSewa" style={{width: '80px'}} />
          </div>
        </div>
      )}
    </div>
  )
}

export default Cart