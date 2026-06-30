import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../context/LangContext'

function Compare() {
  const { lang } = useLang()
  const [products, setProducts] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select(`
        *,
        categories(name, name_np),
        product_prices(
          price,
          unit,
          store_product_url,
          in_stock,
          stores(id, name, name_np)
        )
      `)

    setProducts(data || [])
    setLoading(false)
  }

  function handleSelect(id) {
    setSelectedId(id)

    const found = products.find(
      (p) => p.id === parseInt(id)
    )

    setSelectedProduct(found || null)
  }

  const sortedPrices = selectedProduct
    ? [...(selectedProduct.product_prices || [])].sort(
        (a, b) => a.price - b.price
      )
    : []

  return (
    <div className="page">
      <h1 className="compare-title">
        {lang === 'en'
          ? 'Compare Prices'
          : 'मूल्य तुलना गर्नुहोस्'}
      </h1>

      <div className="compare-select-wrap">
        <select
          className="compare-select"
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
        >
          <option value="">
            {lang === 'en'
              ? 'Select a product to compare'
              : 'तुलना गर्न उत्पादन छान्नुहोस्'}
          </option>

          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {lang === 'en'
                ? p.name
                : (p.name_np || p.name)}
            </option>
          ))}
        </select>
      </div>

      {selectedProduct && (
        <div className="compare-result">
          <div className="compare-result__header">
            <h2>
              {lang === 'en'
                ? selectedProduct.name
                : (selectedProduct.name_np || selectedProduct.name)}
            </h2>

            <p>
              {selectedProduct.brand} ·{' '}
              {lang === 'en'
                ? selectedProduct.categories?.name
                : selectedProduct.categories?.name_np}
            </p>
          </div>

          <div className="compare-list">
            {sortedPrices.map((pp, i) => (
              <div
                key={i}
                className={`compare-row ${
                  i === 0 ? 'compare-row--best' : ''
                }`}
              >
                <div className="compare-row__store">
                  {i === 0 && (
                    <span className="compare-badge">
                      {lang === 'en'
                        ? 'BEST PRICE'
                        : 'उत्तम मूल्य'}
                    </span>
                  )}

                  <strong>
                    {lang === 'en'
                      ? pp.stores?.name
                      : pp.stores?.name_np}
                  </strong>
                </div>

                <div className="compare-row__unit">
                  {pp.unit}
                </div>

                <div className="compare-row__price">
                  Rs. {pp.price}
                </div>

                <a
                  href={pp.store_product_url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="compare-row__link"
                >
                  {lang === 'en'
                    ? 'Visit Store'
                    : 'पसल हेर्नुहोस्'}
                </a>
              </div>
            ))}
          </div>

          {sortedPrices.length > 1 && (
            <p className="compare-savings">
              {lang === 'en'
                ? `You save Rs. ${
                    sortedPrices[sortedPrices.length - 1].price -
                    sortedPrices[0].price
                  } by choosing ${
                    sortedPrices[0].stores?.name
                  }`
                : `${sortedPrices[0].stores?.name} छान्दा रु. ${
                    sortedPrices[sortedPrices.length - 1].price -
                    sortedPrices[0].price
                  } बचत हुन्छ`}
            </p>
          )}
        </div>
      )}

      {!selectedProduct && !loading && (
        <div className="compare-empty">
          <p>
            {lang === 'en'
              ? 'Pick a product above to see price comparison.'
              : 'मूल्य तुलना हेर्न माथिको उत्पादन छान्नुहोस्।'}
          </p>
        </div>
      )}
    </div>
  )
}

export default Compare