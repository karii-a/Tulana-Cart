import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'

function ProductDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { lang } = useLang()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [selectedPrice, setSelectedPrice] = useState(null)
  const [cartMsg, setCartMsg] = useState('')
  const [wishlisted, setWishlisted] = useState(false)

  useEffect(() => {
    fetchProduct()
    if (user) checkWishlist()
  }, [id, user])

  async function fetchProduct() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select(`
        *,
        categories(name, name_np),
        product_prices(id, price, unit, store_product_url, in_stock, stores(id, name, name_np))
      `)
      .eq('id', id)
      .single()

    if (data) {
      setProduct(data)
      const sorted = [...(data.product_prices || [])].sort((a, b) => a.price - b.price)
      setSelectedPrice(sorted[0] || null)
    }
    setLoading(false)
  }

  async function checkWishlist() {
    const { data } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', id)
      .single()
    setWishlisted(!!data)
  }

  async function toggleWishlist() {
    if (!user) { navigate('/login'); return }
    if (wishlisted) {
      await supabase.from('wishlist').delete()
        .eq('user_id', user.id).eq('product_id', id)
      setWishlisted(false)
    } else {
      await supabase.from('wishlist').insert([{ user_id: user.id, product_id: parseInt(id) }])
      setWishlisted(true)
    }
  }

  async function addToCart() {
    if (!user) { navigate('/login'); return }
    if (!selectedPrice) return
    const { error } = await supabase.from('cart').insert([{
      user_id: user.id,
      product_id: parseInt(id),
      store_id: selectedPrice.stores?.id,
      price: selectedPrice.price,
      quantity
    }])
    if (!error) {
      setCartMsg(lang === 'en' ? 'Added to cart!' : 'कार्टमा थपियो!')
      setTimeout(() => setCartMsg(''), 2000)
    }
  }

  if (loading) return <div className="loading">Loading...</div>
  if (!product) return <div className="page"><p>Product not found.</p></div>

  const sortedPrices = [...(product.product_prices || [])].sort((a, b) => a.price - b.price)
  const minPrice = sortedPrices[0]?.price
  const maxPrice = sortedPrices[sortedPrices.length - 1]?.price

  return (
    <div className="page">
      <button className="back-btn" onClick={() => navigate(-1)}>
        ← {lang === 'en' ? 'Back' : 'फर्कनुहोस्'}
      </button>

      <div className="product-detail">
        <div className="product-detail__image">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} />
          ) : (
            <div className="product-detail__no-image">🛒</div>
          )}
        </div>

        <div className="product-detail__info">
          <p className="product-detail__category">
            {lang === 'en' ? product.categories?.name : product.categories?.name_np}
          </p>
          <h1>{lang === 'en' ? product.name : (product.name_np || product.name)}</h1>
          <p className="product-detail__brand">{lang === 'en' ? 'Brand' : 'ब्रान्ड'}: <strong>{product.brand}</strong></p>

          <div className="product-detail__price-range">
            {minPrice === maxPrice ? (
              <span className="price-main">Rs. {minPrice}</span>
            ) : (
              <span className="price-main">Rs. {minPrice} – Rs. {maxPrice}</span>
            )}
          </div>

          <div className="product-detail__stores">
            <h3>{lang === 'en' ? 'Available at:' : 'उपलब्ध स्थानहरू:'}</h3>
            {sortedPrices.map((pp, i) => (
              <div
                key={i}
                className={`store-option ${selectedPrice?.id === pp.id ? 'store-option--selected' : ''} ${i === 0 ? 'store-option--best' : ''}`}
                onClick={() => setSelectedPrice(pp)}
              >
                <div className="store-option__left">
                  {i === 0 && <span className="compare-badge">{lang === 'en' ? 'BEST' : 'उत्तम'}</span>}
                  <strong>{lang === 'en' ? pp.stores?.name : pp.stores?.name_np}</strong>
                  <span className="store-option__unit">{pp.unit}</span>
                </div>
                <div className="store-option__right">
                  <span className="store-option__price">Rs. {pp.price}</span>
                  {pp.store_product_url && (
                    <a
                      href={pp.store_product_url}
                      target="_blank"
                      rel="noreferrer"
                      className="store-option__link"
                      onClick={e => e.stopPropagation()}
                    >
                      {lang === 'en' ? 'Visit' : 'हेर्नुहोस्'}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="product-detail__actions">
            <div className="quantity-control">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))}>-</button>
              <span>{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)}>+</button>
            </div>

            <button className="detail-cart-btn" onClick={addToCart}>
              {cartMsg || (lang === 'en' ? '🛒 Add to Cart' : '🛒 कार्टमा थप्नुहोस्')}
            </button>

            <button
              className={`detail-wishlist-btn ${wishlisted ? 'wishlisted' : ''}`}
              onClick={toggleWishlist}
            >
              {wishlisted ? '❤️' : '🤍'}
            </button>
          </div>

          {selectedPrice && (
            <p className="product-detail__selected">
              {lang === 'en' ? 'Selected store:' : 'छानिएको पसल:'} <strong>{lang === 'en' ? selectedPrice.stores?.name : selectedPrice.stores?.name_np}</strong> — Rs. {selectedPrice.price}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductDetail