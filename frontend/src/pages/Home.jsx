import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../context/LangContext'
import SearchBar from '../components/SearchBar'
import ProductCard from '../components/ProductCard'

function Home() {
  const { lang } = useLang()
  const [products, setProducts] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All')
  const [categories, setCategories] = useState([])
  const [stores, setStores] = useState([])
  const [activeStore, setActiveStore] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    fetchStores()
  }, [])

  async function fetchProducts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        categories(name, name_np),
        product_prices(price, unit, store_product_url, in_stock, stores(id, name, name_np))
      `)
    if (!error) {
      setProducts(data)
      setFiltered(data)
    }
    setLoading(false)
  }

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*')
    if (data) setCategories(data)
  }

  async function fetchStores() {
    const { data } = await supabase.from('stores').select('*')
    if (data) setStores(data)
  }

  function applyFilters({ query = searchQuery, cat = category, store = activeStore }) {
    let result = products

    if (query) {
      const q = query.toLowerCase().trim()
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.name_np?.includes(query.trim()) ||
        p.brand?.toLowerCase().includes(q)
      )
    }

    if (cat !== 'All') {
      result = result.filter(p => p.categories?.name === cat)
    }

    if (store !== 'All') {
      result = result.filter(p =>
        p.product_prices?.some(pp => pp.stores?.name === store)
      )
    }

    setFiltered(result)
  }

  function handleSearch(query) {
    setSearchQuery(query)
    applyFilters({ query })
  }

  function handleCategory(cat) {
    setCategory(cat)
    applyFilters({ cat })
  }

  function handleStore(store) {
    setActiveStore(store)
    applyFilters({ store })
  }

  return (
    <div className="page">
      <div className="home-hero">
        <h1>{lang === 'en' ? 'Compare Grocery Prices in Nepal' : 'नेपालमा किराना मूल्य तुलना गर्नुहोस्'}</h1>
        <p>{lang === 'en' ? 'Find the best prices across BigMart, Bhat-Bhateni & Saleways' : 'बिगमार्ट, भाट-भटेनी र सेलवेजमा सर्वोत्तम मूल्य खोज्नुहोस्'}</p>
        <SearchBar onSearch={handleSearch} />
      </div>

      <div className="filter-section">
        <div className="filter-row">
          <span className="filter-label">{lang === 'en' ? 'Category:' : 'श्रेणी:'}</span>
          <div className="category-bar">
            <button
              className={`cat-btn ${category === 'All' ? 'active' : ''}`}
              onClick={() => handleCategory('All')}
            >
              {lang === 'en' ? 'All' : 'सबै'}
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`cat-btn ${category === cat.name ? 'active' : ''}`}
                onClick={() => handleCategory(cat.name)}
              >
                {lang === 'en' ? cat.name : cat.name_np}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-row">
          <span className="filter-label">{lang === 'en' ? 'Store:' : 'पसल:'}</span>
          <div className="category-bar">
            <button
              className={`cat-btn cat-btn--store ${activeStore === 'All' ? 'active' : ''}`}
              onClick={() => handleStore('All')}
            >
              {lang === 'en' ? 'All Stores' : 'सबै पसल'}
            </button>
            {stores.map(s => (
              <button
                key={s.id}
                className={`cat-btn cat-btn--store ${activeStore === s.name ? 'active' : ''}`}
                onClick={() => handleStore(s.name)}
              >
                {lang === 'en' ? s.name : s.name_np}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="product-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="product-card skeleton">
              <div className="skeleton-line skeleton-title"></div>
              <div className="skeleton-line skeleton-text"></div>
              <div className="skeleton-line skeleton-price"></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="no-results">{lang === 'en' ? 'No products found.' : 'कुनै उत्पादन फेला परेन।'}</div>
      ) : (
        <div className="product-grid">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Home