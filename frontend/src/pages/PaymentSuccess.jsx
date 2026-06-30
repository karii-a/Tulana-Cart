import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'

function PaymentSuccess() {
  const { lang } = useLang()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const orderId = params.get('order_id')

  useEffect(() => {
    if (orderId && user) {
      // Update order status
      supabase.from('orders').update({ status: 'paid' }).eq('id', orderId)
      // Clear cart
      supabase.from('cart').delete().eq('user_id', user.id)
    }
  }, [orderId, user])

  return (
    <div className="page payment-page">
      <div className="payment-card payment-card--success">
        <div className="payment-icon">✅</div>
        <h2>{lang === 'en' ? 'Payment Successful!' : 'भुक्तानी सफल भयो!'}</h2>
        <p>{lang === 'en' ? `Order #${orderId} confirmed.` : `अर्डर #${orderId} पुष्टि भयो।`}</p>
        <button onClick={() => navigate('/')}>
          {lang === 'en' ? 'Continue Shopping' : 'किनमेल जारी राख्नुहोस्'}
        </button>
      </div>
    </div>
  )
}

export default PaymentSuccess