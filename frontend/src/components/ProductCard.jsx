import { useState } from 'react'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

function ProductCard({ product }) {
  const { lang } = useLang()
  const { user } = useAuth()

  const prices = product.product_prices ?? []
  const nums = prices.map((p) => p.price)
  const minPrice = nums.length > 0 ? Math.min(...nums) : null
  const bestPrice = prices.find((p) => p.price === minPrice)

  const [wishlisted, setWishlisted] = useState(false)
  const [adding, setAdding] = useState(false)
  const [cartMsg, setCartMsg] = useState('')

  async function toggleWishlist() {
    if (!user) {
      window.location.href = '/login'
      return
    }

    setAdding(true)

    if (wishlisted) {
      await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', product.id)

      setWishlisted(false)
    } else {
      await supabase
        .from('wishlist')
        .insert([
          {
            user_id: user.id,
            product_id: product.id,
          },
        ])

      setWishlisted(true)
    }

    setAdding(false)
  }

  async function addToCart() {
    if (!user) {
      window.location.href = '/login'
      return
    }

    if (!bestPrice) return

    const { error } = await supabase
      .from('cart')
      .insert([
        {
          user_id: user.id,
          product_id: product.id,
          store_id: bestPrice.stores?.id,
          price: bestPrice.price,
          quantity: 1,
        },
      ])

    if (!error) {
      setCartMsg('Added!')
      setTimeout(() => setCartMsg(''), 2000)
    }
  }

  return (
    <div className="product-card">
      <div className="product-card__body">
        <div className="product-card__header">
          <h3>{product.name}</h3>

          <button
            className={`wishlist-btn ${wishlisted ? 'wishlisted' : ''}`}
            onClick={toggleWishlist}
            disabled={adding}
          >
            {wishlisted ? '❤️' : '🤍'}
          </button>
        </div>

        <p className="product-card__brand">
          {product.brand}
        </p>

        <p className="product-card__category">
          {lang === 'en'
            ? product.categories?.name
            : product.categories?.name_np}
        </p>

        {minPrice !== null && (
          <p className="product-card__price">
            From <strong>Rs. {minPrice}</strong>
          </p>
        )}

        <div className="product-card__stores">
          {prices.map((pp, i) => (
            <a
              key={i}
              href={pp.store_product_url || '#'}
              target="_blank"
              rel="noreferrer"
              className="store-tag"
            >
              {lang === 'en'
                ? pp.stores?.name
                : pp.stores?.name_np}{' '}
              - Rs. {pp.price}
            </a>
          ))}
        </div>

        <button
          className="cart-btn"
          onClick={addToCart}
        >
          {cartMsg
            ? cartMsg
            : lang === 'en'
            ? '🛒 Add to Cart'
            : '🛒 कार्टमा थप्नुहोस्'}
        </button>
      </div>
    </div>
  )
}

export default ProductCard