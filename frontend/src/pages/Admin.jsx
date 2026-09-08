import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Tulana Kart is a price-COMPARISON app, not a checkout system — there is no
// cart or order fulfillment. The only thing that writes an `orders` row is a
// user clicking "Mark as Bought" on their Wishlist (see Wishlist.jsx), which
// just logs a self-reported purchase for their own spending page. Real money
// moves through subscriptions (user_subscriptions / subscription_payments,
// via eSewa — see backend/routes/subscription.js). This admin panel reflects
// that: no delivery/status workflow, a Subscribers tab for real revenue, and
// a read-only Purchases tab for the self-reported "bought" activity.

const TIER_LABELS = { free: 'Free', smart_saver: 'Smart Saver', family: 'Family Plan' }

function Admin() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [stores, setStores] = useState([])
  const [purchases, setPurchases] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [form, setForm] = useState({ name: '', name_np: '', brand: '', category_id: '', image_url: '' })
  const [priceForm, setPriceForm] = useState({ product_id: '', store_id: '', price: '', unit: '', store_product_url: '' })
  const [storeForm, setStoreForm] = useState({ name: '', name_np: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [p, c, s, purch, subs, pays] = await Promise.all([
      supabase.from('products').select('*, categories(name), product_prices(id, price, unit, stores(name))'),
      supabase.from('categories').select('*'),
      supabase.from('stores').select('*, product_prices(id)'),
      supabase.from('orders').select('*, order_items(quantity, price, products(name))').order('created_at', { ascending: false }),
      supabase.from('user_subscriptions').select('*').order('updated_at', { ascending: false }),
      supabase.from('subscription_payments').select('*').order('created_at', { ascending: false }),
    ])
    setProducts(p.data || [])
    setCategories(c.data || [])
    setStores(s.data || [])
    setPurchases(purch.data || [])
    setSubscriptions(subs.data || [])
    setPayments(pays.data || [])
    setLoading(false)
  }

  function flash(msg) { setMessage(msg); setTimeout(() => setMessage(''), 3000) }

  async function addProduct() {
    setError('')
    if (!form.name || !form.category_id) { setError('Name and category are required.'); return }
    const { error } = await supabase.from('products').insert([{
      name: form.name, name_np: form.name_np, brand: form.brand,
      category_id: parseInt(form.category_id), image_url: form.image_url
    }])
    if (error) setError(error.message)
    else { flash('Product added!'); setForm({ name: '', name_np: '', brand: '', category_id: '', image_url: '' }); fetchAll() }
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product and all its prices?')) return
    await supabase.from('product_prices').delete().eq('product_id', id)
    await supabase.from('products').delete().eq('id', id)
    flash('Product deleted.'); fetchAll()
  }

  async function addPrice() {
    setError('')
    if (!priceForm.product_id || !priceForm.store_id || !priceForm.price) { setError('Product, store and price are required.'); return }
    const { error } = await supabase.from('product_prices').insert([{
      product_id: parseInt(priceForm.product_id), store_id: parseInt(priceForm.store_id),
      price: parseFloat(priceForm.price), unit: priceForm.unit, store_product_url: priceForm.store_product_url
    }])
    if (error) setError(error.message)
    else { flash('Price added!'); setPriceForm({ product_id: '', store_id: '', price: '', unit: '', store_product_url: '' }); fetchAll() }
  }

  async function deletePrice(id) {
    await supabase.from('product_prices').delete().eq('id', id)
    flash('Price deleted.'); fetchAll()
  }

  async function addStore() {
    setError('')
    if (!storeForm.name) { setError('Store name is required.'); return }
    const { error } = await supabase.from('stores').insert([{ name: storeForm.name, name_np: storeForm.name_np || null }])
    if (error) setError(error.message)
    else { flash('Store added!'); setStoreForm({ name: '', name_np: '' }); fetchAll() }
  }

  async function deleteStore(id) {
    if (!confirm('Delete this store and every price listed under it?')) return
    await supabase.from('product_prices').delete().eq('store_id', id)
    await supabase.from('stores').delete().eq('id', id)
    flash('Store deleted.'); fetchAll()
  }

  // Real revenue: money that actually changed hands via eSewa subscriptions.
  const subscriptionRevenue = payments.filter(p => p.status === 'paid').reduce((s, p) => s + parseFloat(p.amount || 0), 0)
  const activeSubscribers = subscriptions.filter(s => s.status === 'active').length
  // Secondary, self-reported signal: what users have told us they bought.
  // Not real revenue — nothing was actually transacted through this app.
  const trackedSpend = purchases.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0)

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
            { id: 'stores', icon: '🏬', label: 'Stores' },
            { id: 'subscribers', icon: '⭐', label: 'Subscribers' },
            { id: 'purchases', icon: '🧾', label: 'Purchases' },
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
            {activeTab === 'stores' && '🏬 Stores'}
            {activeTab === 'subscribers' && '⭐ Subscribers'}
            {activeTab === 'purchases' && '🧾 Purchases'}
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
                <div className="admin-stat-card__icon">🏬</div>
                <div>
                  <p className="admin-stat-card__label">Stores Tracked</p>
                  <h2 className="admin-stat-card__value">{stores.length}</h2>
                </div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-card__icon">⭐</div>
                <div>
                  <p className="admin-stat-card__label">Active Subscribers</p>
                  <h2 className="admin-stat-card__value">{activeSubscribers}</h2>
                </div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-card__icon">💵</div>
                <div>
                  <p className="admin-stat-card__label">Subscription Revenue</p>
                  <h2 className="admin-stat-card__value">Rs. {subscriptionRevenue.toFixed(0)}</h2>
                </div>
              </div>
            </div>

            <h3 className="admin-section-title">Recent Subscription Payments</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Tier</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td colSpan="4" style={{textAlign:'center', padding:'2rem', color:'#999'}}>No subscription payments yet.</td></tr>
                  ) : payments.slice(0, 5).map(pay => (
                    <tr key={pay.id}>
                      <td><strong>{TIER_LABELS[pay.tier_id] || pay.tier_id}</strong></td>
                      <td>Rs. {pay.amount}</td>
                      <td>
                        <span className={`admin-badge ${
                          pay.status === 'paid' ? 'admin-badge--green' :
                          pay.status === 'failed' ? 'admin-badge--orange' : 'admin-badge--blue'
                        }`}>
                          {pay.status?.toUpperCase()}
                        </span>
                      </td>
                      <td>{pay.created_at ? new Date(pay.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="admin-section-title">Recently Marked as Bought</h3>
            <p style={{color: '#999', fontSize: '0.85rem', margin: '-0.5rem 0 1rem'}}>
              Self-reported by shoppers from their Wishlist — not a real order, just what they told us they bought.
            </p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Product</th><th>Amount</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {purchases.length === 0 ? (
                    <tr><td colSpan="3" style={{textAlign:'center', padding:'2rem', color:'#999'}}>No purchases logged yet.</td></tr>
                  ) : purchases.slice(0, 5).map(o => (
                    <tr key={o.id}>
                      <td><strong>{o.order_items?.[0]?.products?.name || '—'}</strong></td>
                      <td>Rs. {o.total_amount}</td>
                      <td>{new Date(o.created_at).toLocaleDateString()}</td>
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

        {/* Stores */}
        {activeTab === 'stores' && (
          <>
            <div className="admin-form-card">
              <h3>Add New Store</h3>
              <p style={{color: '#999', fontSize: '0.85rem', margin: '-0.25rem 0 1rem'}}>
                Stores are also created automatically the first time the scraper syncs a new one — this is mainly for adding a store manually before you have any prices for it.
              </p>
              <div className="admin-form__grid">
                <input className="admin-input" placeholder="Store name (EN)" value={storeForm.name} onChange={e => setStoreForm({...storeForm, name: e.target.value})} />
                <input className="admin-input" placeholder="Store name (NP, optional)" value={storeForm.name_np} onChange={e => setStoreForm({...storeForm, name_np: e.target.value})} />
              </div>
              <button className="admin-btn" onClick={addStore}>+ Add Store</button>
            </div>

            <h3 className="admin-section-title">All Stores ({stores.length})</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>ID</th><th>Name</th><th>Name (NP)</th><th>Prices Listed</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {stores.length === 0 ? (
                    <tr><td colSpan="5" style={{textAlign:'center', padding:'2rem', color:'#999'}}>No stores yet.</td></tr>
                  ) : stores.map(s => (
                    <tr key={s.id}>
                      <td><span className="admin-id">#{s.id}</span></td>
                      <td><strong>{s.name}</strong></td>
                      <td>{s.name_np || '—'}</td>
                      <td><span className="admin-badge admin-badge--blue">{s.product_prices?.length || 0} prices</span></td>
                      <td><button className="admin-btn admin-btn--delete" onClick={() => deleteStore(s.id)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Subscribers */}
        {activeTab === 'subscribers' && (
          <>
            <div className="admin-stats" style={{marginBottom: '2rem'}}>
              <div className="admin-stat-card">
                <div className="admin-stat-card__icon">⭐</div>
                <div>
                  <p className="admin-stat-card__label">Active Subscribers</p>
                  <h2 className="admin-stat-card__value">{activeSubscribers}</h2>
                </div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-card__icon">💵</div>
                <div>
                  <p className="admin-stat-card__label">Total Revenue (Paid)</p>
                  <h2 className="admin-stat-card__value">Rs. {subscriptionRevenue.toFixed(0)}</h2>
                </div>
              </div>
            </div>

            <h3 className="admin-section-title">Active & Past Subscriptions ({subscriptions.length})</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>User ID</th><th>Tier</th><th>Status</th><th>Renews / Expired</th></tr>
                </thead>
                <tbody>
                  {subscriptions.length === 0 ? (
                    <tr><td colSpan="4" style={{textAlign:'center', padding:'2rem', color:'#999'}}>No subscriptions yet.</td></tr>
                  ) : subscriptions.map(sub => (
                    <tr key={sub.user_id + sub.tier_id}>
                      <td style={{fontSize: '0.8rem'}}>{sub.user_id}</td>
                      <td><strong>{TIER_LABELS[sub.tier_id] || sub.tier_id}</strong></td>
                      <td>
                        <span className={`admin-badge ${sub.status === 'active' ? 'admin-badge--green' : 'admin-badge--orange'}`}>
                          {sub.status?.toUpperCase()}
                        </span>
                      </td>
                      <td>{sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="admin-section-title">Payment History ({payments.length})</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>User ID</th><th>Tier</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td colSpan="5" style={{textAlign:'center', padding:'2rem', color:'#999'}}>No payments yet.</td></tr>
                  ) : payments.map(pay => (
                    <tr key={pay.id}>
                      <td style={{fontSize: '0.8rem'}}>{pay.user_id}</td>
                      <td><strong>{TIER_LABELS[pay.tier_id] || pay.tier_id}</strong></td>
                      <td>Rs. {pay.amount}</td>
                      <td>
                        <span className={`admin-badge ${
                          pay.status === 'paid' ? 'admin-badge--green' :
                          pay.status === 'failed' ? 'admin-badge--orange' : 'admin-badge--blue'
                        }`}>
                          {pay.status?.toUpperCase()}
                        </span>
                      </td>
                      <td>{pay.created_at ? new Date(pay.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Purchases (self-reported "Mark as Bought", read-only) */}
        {activeTab === 'purchases' && (
          <>
            <div className="admin-stats" style={{marginBottom: '2rem'}}>
              <div className="admin-stat-card">
                <div className="admin-stat-card__icon">🧾</div>
                <div>
                  <p className="admin-stat-card__label">Purchases Logged</p>
                  <h2 className="admin-stat-card__value">{purchases.length}</h2>
                </div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-card__icon">💰</div>
                <div>
                  <p className="admin-stat-card__label">Tracked Spend</p>
                  <h2 className="admin-stat-card__value">Rs. {trackedSpend.toFixed(0)}</h2>
                </div>
              </div>
            </div>
            <p style={{color: '#999', fontSize: '0.85rem', margin: '-1rem 0 1rem'}}>
              Tulana Kart doesn't have checkout or delivery — these rows come from shoppers tapping "Mark as Bought" on their Wishlist to track their own spending. There's nothing to fulfill or update here.
            </p>

            <h3 className="admin-section-title">All Purchases ({purchases.length})</h3>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>ID</th><th>Product</th><th>Amount</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {purchases.length === 0 ? (
                    <tr><td colSpan="4" style={{textAlign:'center', padding:'2rem', color:'#999'}}>No purchases logged yet.</td></tr>
                  ) : purchases.map(o => (
                    <tr key={o.id}>
                      <td><strong>#{o.id}</strong></td>
                      <td>{o.order_items?.map(i => i.products?.name).filter(Boolean).join(', ') || '—'}</td>
                      <td><strong>Rs. {o.total_amount}</strong></td>
                      <td style={{fontSize:'0.85rem'}}>{new Date(o.created_at).toLocaleDateString()}</td>
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