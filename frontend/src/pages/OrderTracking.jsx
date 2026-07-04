import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'

const STATUSES = ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered']

function OrderTracking() {
  const { id } = useParams()
  const { user } = useAuth()
  const { lang } = useLang()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchOrder()
  }, [user])

  async function fetchOrder() {
    setLoading(true)
    const { data: orderData } = await supabase
      .from('orders')
      .select(`*, order_items(quantity, price, products(name), stores(name))`)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    const { data: historyData } = await supabase
      .from('order_status_history')
      .select('*')
      .eq('order_id', id)
      .order('updated_at', { ascending: true })

    setOrder(orderData)
    setHistory(historyData || [])
    setLoading(false)
  }

  function getStatusLabel(status) {
    const labels = {
      pending: lang === 'en' ? 'Order Placed' : 'अर्डर राखियो',
      confirmed: lang === 'en' ? 'Confirmed' : 'पुष्टि भयो',
      processing: lang === 'en' ? 'Processing' : 'प्रक्रियामा',
      out_for_delivery: lang === 'en' ? 'Out for Delivery' : 'डेलिभरीमा',
      delivered: lang === 'en' ? 'Delivered' : 'डेलिभर भयो'
    }
    return labels[status] || status
  }

  function getStatusIcon(status) {
    const icons = {
      pending: '📋',
      confirmed: '✅',
      processing: '📦',
      out_for_delivery: '🚴',
      delivered: '🎉'
    }
    return icons[status] || '📋'
  }

  const currentStatusIndex = order ? STATUSES.indexOf(order.status) : 0

  if (loading) return <div className="loading">Loading...</div>
  if (!order) return <div className="page"><p>Order not found.</p></div>

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate('/profile')}>
        ← {lang === 'en' ? 'Back to Profile' : 'प्रोफाइलमा फर्कनुहोस्'}
      </button>

      <h1 className="cart-title">
        {lang === 'en' ? `Order #${order.id}` : `अर्डर #${order.id}`}
      </h1>

      {/* Progress bar */}
      <div className="tracking-progress">
        {STATUSES.map((status, i) => (
          <div key={status} className="tracking-progress__step">
            <div className={`tracking-progress__dot ${i <= currentStatusIndex ? 'active' : ''} ${i < currentStatusIndex ? 'done' : ''}`}>
              {i <= currentStatusIndex ? getStatusIcon(status) : i + 1}
            </div>
            <p className={i <= currentStatusIndex ? 'active' : ''}>
              {getStatusLabel(status)}
            </p>
            {i < STATUSES.length - 1 && (
              <div className={`tracking-progress__line ${i < currentStatusIndex ? 'done' : ''}`}></div>
            )}
          </div>
        ))}
      </div>

      {/* Delivery info */}
      <div className="tracking-cards">
        <div className="review-card">
          <h3>{lang === 'en' ? 'Delivery Details' : 'डेलिभरी विवरण'}</h3>
          <p><strong>{order.delivery_name}</strong></p>
          <p>{order.delivery_phone}</p>
          <p>{order.delivery_address}</p>
          {order.estimated_delivery && (
            <p className="tracking-estimate">
              📅 {lang === 'en' ? 'Estimated:' : 'अनुमानित:'} {new Date(order.estimated_delivery).toLocaleDateString('en-NP')}
            </p>
          )}
        </div>

        <div className="review-card">
          <h3>{lang === 'en' ? 'Status History' : 'स्थिति इतिहास'}</h3>
          {history.map((h, i) => (
            <div key={i} className="status-history-item">
              <span className="status-history-icon">{getStatusIcon(h.status)}</span>
              <div>
                <p><strong>{getStatusLabel(h.status)}</strong></p>
                {h.note && <p className="status-history-note">{h.note}</p>}
                <p className="status-history-time">
                  {new Date(h.updated_at).toLocaleString('en-NP')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Order items */}
      <div className="review-card">
        <h3>{lang === 'en' ? 'Items' : 'सामानहरू'}</h3>
        {order.order_items?.map((item, i) => (
          <div key={i} className="review-item">
            <span>{item.products?.name} x{item.quantity} — {item.stores?.name}</span>
            <span>Rs. {item.price * item.quantity}</span>
          </div>
        ))}
        <div className="review-item review-item--total">
          <strong>{lang === 'en' ? 'Total' : 'जम्मा'}</strong>
          <strong>Rs. {order.total_amount}</strong>
        </div>
      </div>
    </div>
  )
}

export default OrderTracking