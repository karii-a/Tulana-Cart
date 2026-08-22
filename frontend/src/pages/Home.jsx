import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../context/LangContext'
import SearchBar from '../components/SearchBar'
import ProductCard from '../components/ProductCard'

function Home() {
  const { lang } = useLang()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])

  // All filter criteria live in one object so they combine instead of
  // overwriting each other (search + category + store + brand + price).
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [store, setStore] = useState('All')
  const [brand, setBrand] = useState('All')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState('none')

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  async function fetchProducts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        categories(name, name_np),
        product_prices(price, unit, store_product_url, in_stock, stores(name, name_np))
      `)
    if (!error) setProducts(data || [])
    setLoading(false)
  }

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*')
    if (data) setCategories(data)
  }

  function minPriceOf(product) {
    const nums = (product.product_prices ?? []).map(p => p.price)
    return nums.length > 0 ? Math.min(...nums) : null
  }

  // Unique store and brand options, derived from the loaded products
  const storeOptions = useMemo(() => {
    const names = new Set()
    products.forEach(p => (p.product_prices ?? []).forEach(pp => {
      if (pp.stores?.name) names.add(pp.stores.name)
    }))
    return Array.from(names)
  }, [products])

  const brandOptions = useMemo(() => {
    const names = new Set()
    products.forEach(p => { if (p.brand) names.add(p.brand) })
    return Array.from(names)
  }, [products])

  // Single derived filter pass — every active criterion is applied together
  const filtered = useMemo(() => {
    let result = products

    if (query) {
      const q = query.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.name_np && p.name_np.includes(q))
      )
    }

    if (category !== 'All') {
      result = result.filter(p => p.categories?.name === category)
    }

    if (store !== 'All') {
      result = result.filter(p =>
        (p.product_prices ?? []).some(pp => pp.stores?.name === store)
      )
    }

    if (brand !== 'All') {
      result = result.filter(p => p.brand === brand)
    }

    if (minPrice !== '') {
      const min = parseFloat(minPrice)
      result = result.filter(p => {
        const mp = minPriceOf(p)
        return mp !== null && mp >= min
      })
    }

    if (maxPrice !== '') {
      const max = parseFloat(maxPrice)
      result = result.filter(p => {
        const mp = minPriceOf(p)
        return mp !== null && mp <= max
      })
    }

    if (sort === 'price_asc') {
      result = [...result].sort((a, b) => (minPriceOf(a) ?? Infinity) - (minPriceOf(b) ?? Infinity))
    } else if (sort === 'price_desc') {
      result = [...result].sort((a, b) => (minPriceOf(b) ?? -Infinity) - (minPriceOf(a) ?? -Infinity))
    }

    return result
  }, [products, query, category, store, brand, minPrice, maxPrice, sort])

  function clearFilters() {
    setQuery('')
    setCategory('All')
    setStore('All')
    setBrand('All')
    setMinPrice('')
    setMaxPrice('')
    setSort('none')
  }

  return (
    <div className="page">
      <div className="home-hero">
        <h1>{lang === 'en' ? 'Compare Grocery Prices in Nepal' : 'नेपालमा किराना मूल्य तुलना गर्नुहोस्'}</h1>
        <p>{lang === 'en' ? 'Find the best prices across BigMart, Bhat-Bhateni & Saleways' : 'बिगमार्ट, भाट-भटेनी र सेलवेजमा सर्वोत्तम मूल्य खोज्नुहोस्'}</p>
        <SearchBar onSearch={setQuery} />
      </div>

      <div className="category-bar">
        <button
          className={`cat-btn ${category === 'All' ? 'active' : ''}`}
          onClick={() => setCategory('All')}
        >
          {lang === 'en' ? 'All' : 'सबै'}
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`cat-btn ${category === cat.name ? 'active' : ''}`}
            onClick={() => setCategory(cat.name)}
          >
            {lang === 'en' ? cat.name : cat.name_np}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <div className="filter-field">
          <label>{lang === 'en' ? 'Store' : 'स्टोर'}</label>
          <select value={store} onChange={e => setStore(e.target.value)}>
            <option value="All">{lang === 'en' ? 'All Stores' : 'सबै स्टोर'}</option>
            {storeOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="filter-field">
          <label>{lang === 'en' ? 'Brand' : 'ब्रान्ड'}</label>
          <select value={brand} onChange={e => setBrand(e.target.value)}>
            <option value="All">{lang === 'en' ? 'All Brands' : 'सबै ब्रान्ड'}</option>
            {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="filter-field">
          <label>{lang === 'en' ? 'Min Price (Rs.)' : 'न्यूनतम मूल्य'}</label>
          <input
            type="number"
            min="0"
            value={minPrice}
            onChange={e => setMinPrice(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="filter-field">
          <label>{lang === 'en' ? 'Max Price (Rs.)' : 'अधिकतम मूल्य'}</label>
          <input
            type="number"
            min="0"
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            placeholder={lang === 'en' ? 'Any' : 'कुनै पनि'}
          />
        </div>

        <div className="filter-field">
          <label>{lang === 'en' ? 'Sort By' : 'क्रमबद्ध गर्नुहोस्'}</label>
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="none">{lang === 'en' ? 'Default' : 'पूर्वनिर्धारित'}</option>
            <option value="price_asc">{lang === 'en' ? 'Price: Low to High' : 'मूल्य: कम देखि बढी'}</option>
            <option value="price_desc">{lang === 'en' ? 'Price: High to Low' : 'मूल्य: बढी देखि कम'}</option>
          </select>
        </div>

        <button className="filter-clear" onClick={clearFilters}>
          {lang === 'en' ? 'Clear Filters' : 'फिल्टर हटाउनुहोस्'}
        </button>
      </div>

      {loading ? (
        <div className="loading">{lang === 'en' ? 'Loading...' : 'लोड हुँदैछ...'}</div>
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
