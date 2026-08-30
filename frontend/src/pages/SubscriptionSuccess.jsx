import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useLang } from '../context/LangContext'

function SubscriptionSuccess() {
  const { lang } = useLang()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying') // verifying | ok | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    const data = params.get('data')
    if (!data) {
      setStatus('error')
      setMessage(lang === 'en' ? 'No payment data received.' : 'भुक्तानी डाटा प्राप्त भएन।')
      return
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    fetch(`${apiUrl}/api/subscription/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Verification failed')
        setStatus('ok')
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.message)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="page payment-page">
      <div className={`payment-card ${status === 'error' ? 'payment-card--failed' : 'payment-card--success'}`}>
        <div className="payment-icon">{status === 'verifying' ? '⏳' : status === 'ok' ? '✅' : '❌'}</div>
        <h2>
          {status === 'verifying'
            ? lang === 'en' ? 'Confirming your payment...' : 'भुक्तानी पुष्टि गर्दै...'
            : status === 'ok'
              ? lang === 'en' ? 'Subscription Activated!' : 'सदस्यता सक्रिय भयो!'
              : lang === 'en' ? 'Payment Verification Failed' : 'भुक्तानी पुष्टि असफल भयो'}
        </h2>
        {status === 'error' && <p>{message}</p>}
        {status !== 'verifying' && (
          <button onClick={() => navigate(status === 'ok' ? '/profile' : '/subscription')}>
            {status === 'ok'
              ? lang === 'en' ? 'Go to Profile' : 'प्रोफाइलमा जानुहोस्'
              : lang === 'en' ? 'Back to Plans' : 'योजनाहरूमा फर्कनुहोस्'}
          </button>
        )}
      </div>
    </div>
  )
}

export default SubscriptionSuccess