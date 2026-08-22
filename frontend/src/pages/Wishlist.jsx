import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import { useWishlist } from '../context/WishlistContext'
import { Link } from 'react-router-dom'

function Wishlist() {
  const { lang } = useLang()
  const { user } = useAuth()
  const { items, loading, removeFromWishlist } = useWishlist()

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
                      <button
                        className="admin-btn admin-btn--delete"
                        onClick={() => removeFromWishlist(product.id)}
                      >
                        {lang === 'en' ? 'Remove' : 'हटाउनुहोस्'}
                      </button>
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
