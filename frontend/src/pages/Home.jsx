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

  function handleSearch(query) {
    if (!query) return setFiltered(products)
    const q = query.toLowerCase()
    setFiltered(products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.name_np && p.name_np.includes(q))
    ))
  }

  function handleCategory(cat) {
    setCategory(cat)
    if (cat === 'All') return setFiltered(products)
    setFiltered(products.filter(p =>
      p.categories?.name === cat
    ))
  }

  return (
    <div className="page">
      <div className="home-hero">
        <h1>{lang === 'en' ? 'Compare Grocery Prices in Nepal' : 'नेपालमा किराना मूल्य तुलना गर्नुहोस्'}</h1>
        <p>{lang === 'en' ? 'Find the best prices across BigMart, Bhat-Bhateni & Saleways' : 'बिगमार्ट, भाट-भटेनी र सेलवेजमा सर्वोत्तम मूल्य खोज्नुहोस्'}</p>
        <SearchBar onSearch={handleSearch} />
      </div>

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