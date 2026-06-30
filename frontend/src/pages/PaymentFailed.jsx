import { useSearchParams, useNavigate } from 'react-router-dom'
import { useLang } from '../context/LangContext'

function PaymentFailed() {
  const { lang } = useLang()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const orderId = params.get('order_id')

  return (
    <div className="page payment-page">
      <div className="payment-card payment-card--failed">
        <div className="payment-icon">❌</div>
        <h2>{lang === 'en' ? 'Payment Failed' : 'भुक्तानी असफल भयो'}</h2>
        <p>{lang === 'en' ? `Order #${orderId} was not completed.` : `अर्डर #${orderId} पूरा भएन।`}</p>
        <button onClick={() => navigate('/cart')}>
          {lang === 'en' ? 'Try Again' : 'फेरि प्रयास गर्नुहोस्'}
        </button>
      </div>
    </div>
  )
}

export default PaymentFailed