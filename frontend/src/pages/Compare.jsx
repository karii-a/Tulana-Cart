import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../context/LangContext'

const MAX_COMPARE = 4

function Compare() {
  const { lang } = useLang()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])

  useEffect(() => {
    fetchProducts()
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
    if (!error) setProducts(data || [])
    setLoading(false)
  }

  const filtered = query
    ? products.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.name_np && p.name_np.includes(query))
      )
    : products

  const selected = selectedIds
    .map(id => products.find(p => p.id === id))
    .filter(Boolean)

  // Unique stores across the selected products, so rows line up
  const storeMap = new Map()
  selected.forEach(p => {
    (p.product_prices ?? []).forEach(pp => {
      if (pp.stores?.id) storeMap.set(pp.stores.id, pp.stores)
    })
  })
  const stores = Array.from(storeMap.values())

  function toggleSelect(id) {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, id]
    })
  }

  function priceFor(product, storeId) {
    return (product.product_prices ?? []).find(pp => pp.stores?.id === storeId)
  }

  function cheapestPriceForProduct(product) {
    const nums = (product.product_prices ?? []).map(pp => pp.price)
    return nums.length > 0 ? Math.min(...nums) : null
  }

  return (
    <div className="page">
      <h1>{lang === 'en' ? 'Compare Products' : 'उत्पादनहरू तुलना गर्नुहोस्'}</h1>
      <p className="compare-hint">
        {lang === 'en'
          ? `Select up to ${MAX_COMPARE} products to compare prices side by side.`
          : `मूल्य तुलना गर्न ${MAX_COMPARE} सम्म उत्पादनहरू छान्नुहोस्।`}
      </p>

      <div className="search-bar">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={lang === 'en' ? '🔍 Search products to add...' : '🔍 उत्पादन खोज्नुहोस्...'}
        />
      </div>

      {loading ? (
        <div className="loading">{lang === 'en' ? 'Loading...' : 'लोड हुँदैछ...'}</div>
      ) : (
        <div className="compare-picker">
          {filtered.slice(0, 20).map(p => (
            <button
              key={p.id}
              className={`compare-chip ${selectedIds.includes(p.id) ? 'active' : ''}`}
              onClick={() => toggleSelect(p.id)}
              disabled={!selectedIds.includes(p.id) && selectedIds.length >= MAX_COMPARE}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {selected.length === 0 ? (
        <div className="no-results">
          {lang === 'en' ? 'No products selected yet.' : 'अहिलेसम्म कुनै उत्पादन छानिएको छैन।'}
        </div>
      ) : (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>{lang === 'en' ? 'Store' : 'स्टोर'}</th>
                {selected.map(p => (
                  <th key={p.id}>
                    {lang === 'en' ? p.name : (p.name_np || p.name)}
                    <button className="compare-remove" onClick={() => toggleSelect(p.id)}>×</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stores.map(store => (
                <tr key={store.id}>
                  <td className="compare-table__store">
                    {lang === 'en' ? store.name : (store.name_np || store.name)}
                  </td>
                  {selected.map(p => {
                    const pp = priceFor(p, store.id)
                    const cheapest = cheapestPriceForProduct(p)
                    const isBest = pp && pp.price === cheapest
                    return (
                      <td key={p.id} className={isBest ? 'compare-table__best' : ''}>
                        {pp ? (
                          <a
                            href={pp.store_product_url || '#'}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => { if (!pp.store_product_url) e.preventDefault() }}
                          >
                            Rs. {pp.price}
                          </a>
                        ) : (
                          <span className="compare-table__na">
                            {lang === 'en' ? 'N/A' : 'उपलब्ध छैन'}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Compare
