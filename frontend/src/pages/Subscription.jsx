import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'

const TIERS = [
  {
    id: 'free',
    name: { en: 'Free', np: 'निःशुल्क' },
    price: { en: 'Rs. 0', np: 'रु. ०' },
    period: { en: 'forever', np: 'सधैंको लागि' },
    features: [
      { en: 'Compare prices across all stores', np: 'सबै पसलहरूमा मूल्य तुलना गर्नुहोस्' },
      { en: 'Wishlist up to 10 products', np: '१० सम्म उत्पादन इच्छासूचीमा राख्नुहोस्' },
      { en: 'Weekly price-drop email digest', np: 'साप्ताहिक मूल्य घट्ने इमेल सारांश' },
    ],
  },
  {
    id: 'smart_saver',
    name: { en: 'Smart Saver', np: 'स्मार्ट सेभर' },
    price: { en: 'Rs. 199', np: 'रु. १९९' },
    period: { en: '/ month', np: '/ महिना' },
    highlight: true,
    features: [
      { en: 'Everything in Free', np: 'निःशुल्कमा भएका सबै सुविधा' },
      { en: 'Instant price-drop alerts (not weekly)', np: 'तुरुन्त मूल्य घट्ने सूचना (साप्ताहिक होइन)' },
      { en: 'Unlimited wishlist items', np: 'असीमित इच्छासूची वस्तुहरू' },
      { en: 'Price history charts per product', np: 'प्रत्येक उत्पादनको मूल्य इतिहास चार्ट' },
      { en: 'Full spending analytics dashboard', np: 'पूर्ण खर्च विश्लेषण ड्यासबोर्ड' },
    ],
  },
  {
    id: 'family',
    name: { en: 'Family Plan', np: 'पारिवारिक योजना' },
    price: { en: 'Rs. 349', np: 'रु. ३४९' },
    period: { en: '/ month', np: '/ महिना' },
    features: [
      { en: 'Everything in Smart Saver', np: 'स्मार्ट सेभरमा भएका सबै सुविधा' },
      { en: 'Shared wishlists (up to 5 family members)', np: 'साझा इच्छासूची (५ सदस्यसम्म)' },
      { en: 'Priority alerts — see drops before others', np: 'प्राथमिकता सूचना — अरूभन्दा पहिले हेर्नुहोस्' },
      { en: 'Monthly savings report by email', np: 'मासिक बचत प्रतिवेदन इमेलमा' },
      { en: 'Ad-free experience', np: 'विज्ञापन-रहित अनुभव' },
    ],
  },
]

function Subscription() {
  const { lang } = useLang()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selectedMsg, setSelectedMsg] = useState('')

  function handleChoose(tier) {
    if (!user) {
      navigate('/login')
      return
    }
    // Billing isn't wired up yet — this is a placeholder until a real
    // payment gateway (e.g. eSewa/Khalti) is connected.
    setSelectedMsg(
      lang === 'en'
        ? `Thanks for your interest in ${tier.name.en}! Payment isn't set up yet — check back soon.`
        : `${tier.name.np} मा रुचि राख्नुभएकोमा धन्यवाद! भुक्तानी अझै सेटअप भएको छैन — छिट्टै आउनुहोस्।`
    )
    setTimeout(() => setSelectedMsg(''), 4000)
  }

  return (
    <div className="page">
      <div className="subscription-header">
        <h1>{lang === 'en' ? 'Choose Your Plan' : 'आफ्नो योजना छान्नुहोस्'}</h1>
        <p>
          {lang === 'en'
            ? 'Save more with smarter alerts, deeper insights, and unlimited tracking.'
            : 'स्मार्ट सूचना, गहिरो विश्लेषण, र असीमित ट्र्याकिङका साथ थप बचत गर्नुहोस्।'}
        </p>
      </div>

      {selectedMsg && <div className="subscription-toast">{selectedMsg}</div>}

      <div className="subscription-tiers">
        {TIERS.map((tier) => (
          <div key={tier.id} className={`subscription-tier ${tier.highlight ? 'subscription-tier--highlight' : ''}`}>
            {tier.highlight && (
              <div className="subscription-tier__badge">
                {lang === 'en' ? 'MOST POPULAR' : 'सबैभन्दा लोकप्रिय'}
              </div>
            )}
            <h2>{tier.name[lang]}</h2>
            <div className="subscription-tier__price">
              <span className="subscription-tier__price-amount">{tier.price[lang]}</span>
              <span className="subscription-tier__price-period">{tier.period[lang]}</span>
            </div>
            <ul className="subscription-tier__features">
              {tier.features.map((f, i) => (
                <li key={i}>✓ {f[lang]}</li>
              ))}
            </ul>
            <button
              className={`subscription-tier__button ${tier.highlight ? 'subscription-tier__button--highlight' : ''}`}
              onClick={() => handleChoose(tier)}
            >
              {tier.id === 'free'
                ? lang === 'en' ? 'Current Plan' : 'हालको योजना'
                : lang === 'en' ? 'Choose Plan' : 'योजना छान्नुहोस्'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Subscription