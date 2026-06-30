import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useNavigate } from 'react-router-dom'

function Profile() {
  const { user, role } = useAuth()
  const { lang } = useLang()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchOrders()
  }, [user])

  async function fetchOrders() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(
          quantity, price,
          products(name, name_np),
          stores(name)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  function getStatusColor(status) {
    if (status === 'paid') return 'status--paid'
    if (status === 'failed') return 'status--failed'
    return 'status--pending'
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="page">
      <div className="profile-header">
        <div className="profile-avatar">
          {user.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="avatar" />
          ) : (
            <div className="profile-avatar__placeholder">
              {user.email?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="profile-info">
          <h2>{user.user_metadata?.full_name || user.email}</h2>
          <p>{user.email}</p>
          <span className={`profile-role ${role === 'admin' ? 'profile-role--admin' : ''}`}>
            {role === 'admin' ? '👑 Admin' : '👤 User'}
          </span>
        </div>
      </div>

      <h3 className="profile-section-title">
        {lang === 'en' ? 'Order History' : 'अर्डर इतिहास'}
      </h3>

      {orders.length === 0 ? (
        <div className="wishlist-empty">
          <p>{lang === 'en' ? 'No orders yet.' : 'अहिलेसम्म कुनै अर्डर छैन।'}</p>
          <button onClick={() => navigate('/')}>
            {lang === 'en' ? 'Start Shopping' : 'किनमेल सुरु गर्नुहोस्'}
          </button>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-card__header">
                <div>
                  <span className="order-card__id">Order #{order.id}</span>
                  <span className="order-card__date">
                    {new Date(order.created_at).toLocaleDateString('en-NP')}
                  </span>
                </div>
                <div className="order-card__right">
                  <span className={`order-status ${getStatusColor(order.status)}`}>
                    {order.status.toUpperCase()}
                  </span>
                  <strong className="order-card__total">Rs. {order.total_amount}</strong>
                </div>
              </div>
              <div className="order-card__items">
                {order.order_items?.map((item, i) => (
                  <div key={i} className="order-item">
                    <span>{lang === 'en' ? item.products?.name : (item.products?.name_np || item.products?.name)}</span>
                    <span>{item.stores?.name}</span>
                    <span>x{item.quantity}</span>
                    <span>Rs. {item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Profile