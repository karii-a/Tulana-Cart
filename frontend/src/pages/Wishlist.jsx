import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import ProductCard from '../components/ProductCard'
import { useNavigate } from 'react-router-dom'

function Wishlist() {
  const { user } = useAuth()
  const { lang } = useLang()
  const navigate = useNavigate()
  const [wishlist, setWishlist] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    fetchWishlist()
  }, [user])

  async function fetchWishlist() {
    setLoading(true)
    const { data, error } = await supabase
      .from('wishlist')
      .select(`
        id,
        product_id,
        products(
          *,
          categories(name, name_np),
          product_prices(price, unit, store_product_url, stores(name, name_np))
        )
      `)
      .eq('user_id', user.id)

    if (!error) setWishlist(data || [])
    setLoading(false)
  }

  async function removeFromWishlist(wishlistId) {
    await supabase.from('wishlist').delete().eq('id', wishlistId)
    setWishlist(prev => prev.filter(w => w.id !== wishlistId))
  }

  if (loading) return <div className="loading">{lang === 'en' ? 'Loading...' : 'लोड हुँदैछ...'}</div>

  return (
    <div className="page">
      <h1 className="wishlist-title">
        {lang === 'en' ? 'My Wishlist' : 'मेरो इच्छासूची'}
      </h1>

      {wishlist.length === 0 ? (
        <div className="wishlist-empty">
          <p>{lang === 'en' ? 'Your wishlist is empty.' : 'तपाईंको इच्छासूची खाली छ।'}</p>
          <button onClick={() => navigate('/')}>
            {lang === 'en' ? 'Browse Products' : 'उत्पादनहरू हेर्नुहोस्'}
          </button>
        </div>
      ) : (
        <div className="product-grid">
          {wishlist.map(w => (
            <div key={w.id} className="wishlist-item">
              <ProductCard product={w.products} />
              <button
                className="wishlist-remove"
                onClick={() => removeFromWishlist(w.id)}
              >
                {lang === 'en' ? 'Remove' : 'हटाउनुहोस्'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Wishlist