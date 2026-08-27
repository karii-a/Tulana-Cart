import { useState } from 'react'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import { useWishlist } from '../context/WishlistContext'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

function Wishlist() {
  const { lang } = useLang()
  const { user } = useAuth()
  const { items, loading, removeFromWishlist } = useWishlist()
  const [boughtMsg, setBoughtMsg] = useState('')
  const [savingId, setSavingId] = useState(null)

  // Records this wishlist item as a real purchase — an `orders` row plus one
  // `order_items` row — so it shows up on the Spending/Analytics page, which
  // reads from those same tables. Uses the best (lowest) price shown, since
  // that's what a shopper would realistically have bought at.
  async function markAsBought(product, price) {
    if (!user || price == null) return
    setSavingId(product.id)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{ user_id: user.id, total_amount: price, status: 'delivered' }])
      .select()
      .single()

    if (orderError || !order) {
      setBoughtMsg(lang === 'en' ? 'Could not save purchase — try again.' : 'खरिद बचत गर्न सकिएन — फेरि प्रयास गर्नुहोस्।')
      setSavingId(null)
      setTimeout(() => setBoughtMsg(''), 3000)
      return
    }

    const { error: itemError } = await supabase
      .from('order_items')
      .insert([{ order_id: order.id, product_id: product.id, quantity: 1, price }])

    setSavingId(null)
    if (itemError) {
      setBoughtMsg(lang === 'en' ? 'Could not save purchase — try again.' : 'खरिद बचत गर्न सकिएन — फेरि प्रयास गर्नुहोस्।')
    } else {
      setBoughtMsg(
        lang === 'en'
          ? `Marked "${product.name}" as bought — it'll show up in Spending.`
          : `"${product.name}" किनिएको रूपमा चिन्ह लगाइयो — यो खर्चमा देखिनेछ।`
      )
      // Purchased items don't need to stay on the wishlist anymore.
      await removeFromWishlist(product.id)
    }
    setTimeout(() => setBoughtMsg(''), 3500)
  }

  if (!user) {
    return (
      <div className="page">
        <h1>{lang === 'en' ? 'Wishlist' : 'इच्छासूची'}</h1>
        <div className="no-results">
          {lang === 'en' ? 'Please ' : 'कृपया '}
          <Link to="/login">{lang === 'en' ? 'log in' : 'लगइन गर्नुहोस्'}</Link>
          {lang === 'en' ? ' to view your wishlist.' : ' गरेर आफ्नो इच्छासूची हेर्नुहोस्।'}
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="loading">{lang === 'en' ? 'Loading...' : 'लोड हुँदैछ...'}</div>
  }

  return (
    <div className="page">
      <h1>{lang === 'en' ? 'My Wishlist' : 'मेरो इच्छासूची'}</h1>

      {boughtMsg && <div className="wishlist-toast">{boughtMsg}</div>}

      {items.length === 0 ? (
        <div className="no-results">
          {lang === 'en' ? 'Your wishlist is empty. Add products from the home page.' : 'तपाईंको इच्छासूची खाली छ। गृहपृष्ठबाट उत्पादनहरू थप्नुहोस्।'}
        </div>
      ) : (
        <div className="wishlist-table-wrap">
          <table className="wishlist-table">
            <thead>
              <tr>
                <th>{lang === 'en' ? 'Product' : 'उत्पादन'}</th>
                <th>{lang === 'en' ? 'Best Price' : 'उत्तम मूल्य'}</th>
                <th>{lang === 'en' ? 'Available At' : 'उपलब्ध स्टोर'}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const product = item.products
                if (!product) return null
                const prices = product.product_prices ?? []
                const nums = prices.map(p => p.price)
                const minPrice = nums.length > 0 ? Math.min(...nums) : null

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="wishlist-table__name">{product.name}</div>
                      <div className="wishlist-table__brand">{product.brand}</div>
                    </td>
                    <td>{minPrice !== null ? `Rs. ${minPrice}` : '-'}</td>
                    <td>
                      <div className="wishlist-table__stores">
                        {prices.map((pp, i) => (
                          <a
                            key={i}
                            href={pp.store_product_url || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className={`store-tag ${pp.price === minPrice ? 'store-tag--best' : ''}`}
                            onClick={(e) => { if (!pp.store_product_url) e.preventDefault() }}
                          >
                            {pp.stores?.name} - Rs. {pp.price}
                          </a>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="wishlist-table__actions">
                        <button
                          className="wishlist-bought-btn"
                          disabled={minPrice === null || savingId === product.id}
                          onClick={() => markAsBought(product, minPrice)}
                        >
                          {savingId === product.id
                            ? (lang === 'en' ? 'Saving...' : 'बचत हुँदैछ...')
                            : (lang === 'en' ? '✔ Mark as Bought' : '✔ किनिएको चिन्ह लगाउनुहोस्')}
                        </button>
                        <button
                          className="admin-btn admin-btn--delete"
                          onClick={() => removeFromWishlist(product.id)}
                        >
                          {lang === 'en' ? 'Remove' : 'हटाउनुहोस्'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Wishlist