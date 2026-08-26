import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Admin() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [stores, setStores] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [form, setForm] = useState({ name: '', name_np: '', brand: '', category_id: '', image_url: '' })
  const [priceForm, setPriceForm] = useState({ product_id: '', store_id: '', price: '', unit: '', store_product_url: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [p, c, s, o] = await Promise.all([
      supabase.from('products').select('*, categories(name), product_prices(id, price, unit, stores(name))'),
      supabase.from('categories').select('*'),
      supabase.from('stores').select('*'),
      supabase.from('orders').select('*').order('created_at', { ascending: false })
    ])
    setProducts(p.data || [])
    setCategories(c.data || [])
    setStores(s.data || [])
    setOrders(o.data || [])
    setLoading(false)
  }

  async function addProduct() {
    setError('')
    if (!form.name || !form.category_id) { setError('Name and category are required.'); return }
    const { error } = await supabase.from('products').insert([{
      name: form.name, name_np: form.name_np, brand: form.brand,
      category_id: parseInt(form.category_id), image_url: form.image_url
    }])
    if (error) setError(error.message)
    else { setMessage('Product added!'); setForm({ name: '', name_np: '', brand: '', category_id: '', image_url: '' }); fetchAll() }
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product and all its prices?')) return
    await supabase.from('product_prices').delete().eq('product_id', id)
    await supabase.from('products').delete().eq('id', id)
    setMessage('Product deleted.'); fetchAll()
  }

  async function addPrice() {
    setError('')
    if (!priceForm.product_id || !priceForm.store_id || !priceForm.price) { setError('Product, store and price are required.'); return }
    const { error } = await supabase.from('product_prices').insert([{
      product_id: parseInt(priceForm.product_id), store_id: parseInt(priceForm.store_id),
      price: parseFloat(priceForm.price), unit: priceForm.unit, store_product_url: priceForm.store_product_url
    }])
    if (error) setError(error.message)
    else { setMessage('Price added!'); setPriceForm({ product_id: '', store_id: '', price: '', unit: '', store_product_url: '' }); fetchAll() }
  }

  async function deletePrice(id) {
    await supabase.from('product_prices').delete().eq('id', id)
    setMessage('Price deleted.'); fetchAll()
  }

  async function updateOrderStatus(orderId, newStatus) {
    const order = orders.find(o => o.id === orderId)
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
    await supabase.from('order_status_history').insert([{
      order_id: orderId, status: newStatus, note: `Updated to ${newStatus} by admin`
    }])
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
    setMessage(`Order #${orderId} updated to ${newStatus}`)

    // Fire the in-app + email notification to the customer (best-effort;
    // don't block the UI if the backend/email is temporarily unavailable).
    if (order?.user_id) {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      fetch(`${apiUrl}/api/notify/order-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, userId: order.user_id, status: newStatus })
      }).catch(() => {})
    }
  }

  const totalRevenue = orders.filter(o => o.status === 'paid' || o.status === 'delivered').reduce((s, o) => s + parseFloat(o.total_amount || 0), 0)
  const pendingOrders = orders.filter(o => o.status === 'pending').length

  if (loading) return <div className="loading">Loading admin panel...</div>

  return (
    <div className="admin-page">
      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="admin-sidebar__logo">🛒 Admin</div>
        <nav className="admin-nav">
          {[
            { id: 'dashboard', icon: '📊', label: 'Dashboard' },
            { id: 'products', icon: '📦', label: 'Products' },
            { id: 'prices', icon: '💰', label: 'Prices' },
            { id: 'orders', icon: '🧾', label: 'Orders' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`admin-nav__item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="admin-main">
        <div className="admin-header">
          <h1 className="admin-header__title">
            {activeTab === 'dashboard' && '📊 Dashboard'}
            {activeTab === 'products' && '📦 Products'}
            {activeTab === 'prices' && '💰 Prices'}
            {activeTab === 'orders' && '🧾 Orders'}
          </h1>
        </div>

        {message && <div className="auth-message" style={{margin: '0 0 1rem'}}>{message}</div>}
        {error && <div className="auth-error" style={{margin: '0 0 1rem'}}>{error}</div>}

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="admin-stats">
              <div className="admin-stat-card">
                <div className="admin-stat-card__icon">📦</div>
                <div>
                  <p className="admin-stat-card__label">Total Products</p>
                  <h2 className="admin-stat-card__value">{products.length}</h2>
                </div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-card__icon">🧾</div>
                <div>
                  <p className="admin-stat-card__label">Total Orders</p>
                  <h2 className="admin-stat-card__value">{orders.length}</h2>
                </div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-card__icon">⏳</div>
                <div>
                  <p className="admin-stat-card__label">Pending Orders</p>
                  <h2 className="admin-stat-card__value">{pendingOrders}</h2>
                </div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-card__icon">💵</div>
                <div>
                  <p className="admin-stat-card__label">Total Revenue</p>
                  <h2 className="admin-stat-card__value">Rs. {totalRevenue.toFixed(0)}</h2>
                </div>
              </div>
            </div>

            <h3 className="admin-section-title">Recent Orders</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 5).map(order => (
                    <tr key={order.id}>
                      <td><strong>#{order.id}</strong></td>
                      <td>{order.delivery_name || 'N/A'}</td>
                      <td>Rs. {order.total_amount}</td>
                      <td>
                        <span className={`admin-badge ${
                          order.status === 'delivered' || order.status === 'paid' ? 'admin-badge--green' :
                          order.status === 'out_for_delivery' ? 'admin-badge--blue' :
                          order.status === 'confirmed' ? 'admin-badge--purple' : 'admin-badge--orange'
                        }`}>
                          {order.status?.toUpperCase()}
                        </span>
                      </td>
                      <td>{new Date(order.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products */}
        {activeTab === 'products' && (
          <>
            <div className="admin-form-card">
              <h3>Add New Product</h3>
              <div className="admin-form__grid">
                <input className="admin-input" placeholder="Product name (EN)" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                <input className="admin-input" placeholder="Product name (NP)" value={form.name_np} onChange={e => setForm({...form, name_np: e.target.value})} />
                <input className="admin-input" placeholder="Brand" value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} />
                <input className="admin-input" placeholder="Image URL (optional)" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} />
                <select className="admin-input" value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}>
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button className="admin-btn" onClick={addProduct}>+ Add Product</button>
            </div>

            <h3 className="admin-section-title">All Products ({products.length})</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>ID</th><th>Name</th><th>Brand</th><th>Category</th><th>Stores</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td><span className="admin-id">#{p.id}</span></td>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.brand}</td>
                      <td>{p.categories?.name}</td>
                      <td><span className="admin-badge admin-badge--green">{p.product_prices?.length} stores</span></td>
                      <td>
                        <button className="admin-btn admin-btn--delete" onClick={() => deleteProduct(p.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Prices */}
        {activeTab === 'prices' && (
          <>
            <div className="admin-form-card">
              <h3>Add Price for Product</h3>
              <div className="admin-form__grid">
                <select className="admin-input" value={priceForm.product_id} onChange={e => setPriceForm({...priceForm, product_id: e.target.value})}>
                  <option value="">Select Product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="admin-input" value={priceForm.store_id} onChange={e => setPriceForm({...priceForm, store_id: e.target.value})}>
                  <option value="">Select Store</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input className="admin-input" placeholder="Price (Rs.)" type="number" value={priceForm.price} onChange={e => setPriceForm({...priceForm, price: e.target.value})} />
                <input className="admin-input" placeholder="Unit (e.g. 1kg, 500g)" value={priceForm.unit} onChange={e => setPriceForm({...priceForm, unit: e.target.value})} />
                <input className="admin-input" placeholder="Store product URL" value={priceForm.store_product_url} onChange={e => setPriceForm({...priceForm, store_product_url: e.target.value})} />
              </div>
              <button className="admin-btn" onClick={addPrice}>+ Add Price</button>
            </div>

            <h3 className="admin-section-title">All Prices</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Product</th><th>Store</th><th>Price</th><th>Unit</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {products.flatMap(p =>
                    (p.product_prices || []).map(pp => (
                      <tr key={pp.id}>
                        <td><strong>{p.name}</strong></td>
                        <td>{pp.stores?.name}</td>
                        <td><span className="admin-price">Rs. {pp.price}</span></td>
                        <td>{pp.unit}</td>
                        <td><button className="admin-btn admin-btn--delete" onClick={() => deletePrice(pp.id)}>Delete</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Orders */}
        {activeTab === 'orders' && (
          <>
            <h3 className="admin-section-title">All Orders ({orders.length})</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>ID</th><th>Customer</th><th>Address</th><th>Total</th><th>Date</th><th>Status</th><th>Update</th></tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr><td colSpan="7" style={{textAlign:'center', padding:'2rem', color:'#999'}}>No orders yet.</td></tr>
                  ) : orders.map(order => (
                    <tr key={order.id}>
                      <td><strong>#{order.id}</strong></td>
                      <td>
                        <strong>{order.delivery_name || 'N/A'}</strong>
                        {order.delivery_phone && <><br/><small style={{color:'#999'}}>{order.delivery_phone}</small></>}
                      </td>
                      <td style={{maxWidth:'150px', fontSize:'0.85rem'}}>{order.delivery_address || 'N/A'}</td>
                      <td><strong>Rs. {order.total_amount}</strong></td>
                      <td style={{fontSize:'0.85rem'}}>{new Date(order.created_at).toLocaleDateString()}</td>
                      <td>
                        <span className={`admin-badge ${
                          order.status === 'delivered' || order.status === 'paid' ? 'admin-badge--green' :
                          order.status === 'out_for_delivery' ? 'admin-badge--blue' :
                          order.status === 'confirmed' ? 'admin-badge--purple' : 'admin-badge--orange'
                        }`}>
                          {order.status?.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <select
                          className="admin-status-select"
                          value={order.status}
                          onChange={e => updateOrderStatus(order.id, e.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="processing">Processing</option>
                          <option value="out_for_delivery">Out for Delivery</option>
                          <option value="delivered">Delivered</option>
                          <option value="paid">Paid</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Admin