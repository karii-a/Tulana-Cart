import { useNavigate } from 'react-router-dom'
import { useLang } from '../context/LangContext'

function SubscriptionFailed() {
  const { lang } = useLang()
  const navigate = useNavigate()

  return (
    <div className="page payment-page">
      <div className="payment-card payment-card--failed">
        <div className="payment-icon">❌</div>
        <h2>{lang === 'en' ? 'Payment Failed' : 'भुक्तानी असफल भयो'}</h2>
        <p>
          {lang === 'en'
            ? 'Your subscription payment was not completed.'
            : 'तपाईंको सदस्यता भुक्तानी पूरा भएन।'}
        </p>
        <button onClick={() => navigate('/subscription')}>
          {lang === 'en' ? 'Try Again' : 'फेरि प्रयास गर्नुहोस्'}
        </button>
      </div>
    </div>
  )
}

export default SubscriptionFailed