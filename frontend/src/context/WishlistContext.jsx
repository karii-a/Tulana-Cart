import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const WishlistContext = createContext()

export function WishlistProvider({ children }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchWishlist = useCallback(async () => {
    if (!user) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('wishlists')
      .select(`
        id,
        product_id,
        products(
          *,
          categories(name, name_np),
          product_prices(price, unit, store_product_url, in_stock, stores(name, name_np))
        )
      `)
      .eq('user_id', user.id)
    if (!error) setItems(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchWishlist()
  }, [fetchWishlist])

  const isWishlisted = (productId) => items.some(i => i.product_id === productId)

  async function addToWishlist(productId) {
    if (!user) return { error: 'not_logged_in' }
    const { error } = await supabase
      .from('wishlists')
      .insert([{ user_id: user.id, product_id: productId }])
    if (!error) await fetchWishlist()
    return { error }
  }

  async function removeFromWishlist(productId) {
    if (!user) return { error: 'not_logged_in' }
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId)
    if (!error) await fetchWishlist()
    return { error }
  }

  async function toggleWishlist(productId) {
    if (isWishlisted(productId)) return removeFromWishlist(productId)
    return addToWishlist(productId)
  }

  return (
    <WishlistContext.Provider value={{ items, loading, isWishlisted, addToWishlist, removeFromWishlist, toggleWishlist }}>
      {children}
    </WishlistContext.Provider>
  )
}

export function useWishlist() {
  return useContext(WishlistContext)
}
