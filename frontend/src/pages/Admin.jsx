import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Admin() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('products')

  // New product form
  const [form, setForm] = useState({
    name: '', name_np: '', brand: '', category_id: '', image_url: ''
  })

  // New price form
  const [priceForm, setPriceForm] = useState({
    product_id: '', store_id: '', price: '', unit: '', store_product_url: ''
  })

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [p, c, s] = await Promise.all([
      supabase.from('products').select('*, categories(name), product_prices(id, price, unit, stores(name))'),
      supabase.from('categories').select('*'),
      supabase.from('stores').select('*')
    ])
    setProducts(p.data || [])
    setCategories(c.data || [])
    setStores(s.data || [])
    setLoading(false)
  }

  async function addProduct() {
    setError('')
    if (!form.name || !form.category_id) {
      setError('Name and category are required.')
      return
    }
    const { error } = await supabase.from('products').insert([{
      name: form.name,
      name_np: form.name_np,
      brand: form.brand,
      category_id: parseInt(form.category_id),
      image_url: form.image_url
    }])
    if (error) setError(error.message)
    else {
      setMessage('Product added!')
      setForm({ name: '', name_np: '', brand: '', category_id: '', image_url: '' })
      fetchAll()
    }
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product and all its prices?')) return
    await supabase.from('product_prices').delete().eq('product_id', id)
    await supabase.from('products').delete().eq('id', id)
    setMessage('Product deleted.')
    fetchAll()
  }

  async function addPrice() {
    setError('')
    if (!priceForm.product_id || !priceForm.store_id || !priceForm.price) {
      setError('Product, store and price are required.')
      return
    }
    const { error } = await supabase.from('product_prices').insert([{
      product_id: parseInt(priceForm.product_id),
      store_id: parseInt(priceForm.store_id),
      price: parseFloat(priceForm.price),
      unit: priceForm.unit,
      store_product_url: priceForm.store_product_url
    }])
    if (error) setError(error.message)
    else {
      setMessage('Price added!')
      setPriceForm({ product_id: '', store_id: '', price: '', unit: '', store_product_url: '' })
      fetchAll()
    }
  }

  async function deletePrice(id) {
    await supabase.from('product_prices').delete().eq('id', id)
    setMessage('Price deleted.')
    fetchAll()
  }

  if (loading) return <div className="loading">Loading admin panel...</div>

  return (
    <div className="page">
      <h1 className="admin-title">Admin Panel</h1>

      <div className="admin-tabs">
        <button className={activeTab === 'products' ? 'active' : ''} onClick={() => setActiveTab('products')}>
          Products
        </button>
        <button className={activeTab === 'prices' ? 'active' : ''} onClick={() => setActiveTab('prices')}>
          Prices
        </button>
      </div>

      {message && <div className="auth-message">{message}</div>}
      {error && <div className="auth-error">{error}</div>}

      {activeTab === 'products' && (
        <>
          <div className="admin-form">
            <h3>Add New Product</h3>
            <div className="admin-form__grid">
              <input placeholder="Product name (EN)" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <input placeholder="Product name (NP)" value={form.name_np} onChange={e => setForm({...form, name_np: e.target.value})} />
              <input placeholder="Brand" value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} />
              <input placeholder="Image URL (optional)" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} />
              <select value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}>
                <option value="">Select Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button className="admin-btn" onClick={addProduct}>Add Product</button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Brand</th>
                  <th>Category</th>
                  <th>Prices</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.name}</td>
                    <td>{p.brand}</td>
                    <td>{p.categories?.name}</td>
                    <td>{p.product_prices?.length} stores</td>
                    <td>
                      <button className="admin-btn admin-btn--delete" onClick={() => deleteProduct(p.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'prices' && (
        <>
          <div className="admin-form">
            <h3>Add Price for Product</h3>
            <div className="admin-form__grid">
              <select value={priceForm.product_id} onChange={e => setPriceForm({...priceForm, product_id: e.target.value})}>
                <option value="">Select Product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={priceForm.store_id} onChange={e => setPriceForm({...priceForm, store_id: e.target.value})}>
                <option value="">Select Store</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input placeholder="Price (Rs.)" type="number" value={priceForm.price} onChange={e => setPriceForm({...priceForm, price: e.target.value})} />
              <input placeholder="Unit (e.g. 1kg, 500g)" value={priceForm.unit} onChange={e => setPriceForm({...priceForm, unit: e.target.value})} />
              <input placeholder="Store product URL" value={priceForm.store_product_url} onChange={e => setPriceForm({...priceForm, store_product_url: e.target.value})} />
            </div>
            <button className="admin-btn" onClick={addPrice}>Add Price</button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Store</th>
                  <th>Price</th>
                  <th>Unit</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.flatMap(p =>
                  (p.product_prices || []).map(pp => (
                    <tr key={pp.id}>
                      <td>{p.name}</td>
                      <td>{pp.stores?.name}</td>
                      <td>Rs. {pp.price}</td>
                      <td>{pp.unit}</td>
                      <td>
                        <button className="admin-btn admin-btn--delete" onClick={() => deletePrice(pp.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default Admin