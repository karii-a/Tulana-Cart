import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'

const RANGES = {
  weekly: { labelEn: 'Weekly', labelNp: 'साप्ताहिक', weeks: 12 },
  monthly: { labelEn: 'Monthly', labelNp: 'मासिक', months: 12 },
  yearly: { labelEn: 'Yearly', labelNp: 'वार्षिक', years: 5 },
}

function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function bucketKey(dateStr, range) {
  const d = new Date(dateStr)
  if (range === 'weekly') return isoWeekKey(d)
  if (range === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return `${d.getFullYear()}`
}

function Analytics() {
  const { user } = useAuth()
  const { lang } = useLang()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('monthly')

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchData()
  }, [user])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select(`
        id, created_at, total_amount, status,
        order_items(quantity, price, products(name, name_np, category_id, categories(name, name_np)))
      `)
      .eq('user_id', user.id)
      .neq('status', 'failed')
      .order('created_at', { ascending: true })
    setOrders(data || [])
    setLoading(false)
  }

  const chartData = useMemo(() => {
    const buckets = {}
    for (const order of orders) {
      const key = bucketKey(order.created_at, range)
      buckets[key] = (buckets[key] || 0) + parseFloat(order.total_amount || 0)
    }
    const sortedKeys = Object.keys(buckets).sort()
    const limit = range === 'weekly' ? 12 : range === 'monthly' ? 12 : 5
    return sortedKeys.slice(-limit).map((key) => ({ period: key, spent: Math.round(buckets[key]) }))
  }, [orders, range])

  const topItems = useMemo(() => {
    const totals = {}
    for (const order of orders) {
      for (const item of order.order_items || []) {
        const name = lang === 'en' ? item.products?.name : (item.products?.name_np || item.products?.name)
        if (!name) continue
        totals[name] = (totals[name] || 0) + item.quantity
      }
    }
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, qty]) => ({ name, qty }))
  }, [orders, lang])

  const totalSpent = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0)
  const avgOrder = orders.length ? totalSpent / orders.length : 0

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="page">
      <h2 className="cart-title">{lang === 'en' ? 'Spending Analyzer' : 'खर्च विश्लेषक'}</h2>

      {orders.length === 0 ? (
        <div className="wishlist-empty">
          <p>{lang === 'en' ? 'No purchases yet — buy something to see your spending trends.' : 'अहिलेसम्म कुनै खरिद छैन।'}</p>
          <button onClick={() => navigate('/')}>{lang === 'en' ? 'Start Shopping' : 'किनमेल सुरु गर्नुहोस्'}</button>
        </div>
      ) : (
        <>
          <div className="admin-stats">
            <div className="admin-stat-card">
              <span className="admin-stat-card__icon">💸</span>
              <div>
                <div className="admin-stat-card__label">{lang === 'en' ? 'Total Spent' : 'कुल खर्च'}</div>
                <div className="admin-stat-card__value">Rs. {totalSpent.toFixed(0)}</div>
              </div>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-card__icon">🧾</span>
              <div>
                <div className="admin-stat-card__label">{lang === 'en' ? 'Orders' : 'अर्डरहरू'}</div>
                <div className="admin-stat-card__value">{orders.length}</div>
              </div>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-card__icon">📊</span>
              <div>
                <div className="admin-stat-card__label">{lang === 'en' ? 'Avg. Order' : 'औसत अर्डर'}</div>
                <div className="admin-stat-card__value">Rs. {avgOrder.toFixed(0)}</div>
              </div>
            </div>
          </div>

          <div className="admin-tabs">
            {Object.entries(RANGES).map(([key, cfg]) => (
              <button
                key={key}
                className={range === key ? 'active' : ''}
                onClick={() => setRange(key)}
              >
                {lang === 'en' ? cfg.labelEn : cfg.labelNp}
              </button>
            ))}
          </div>

          <div className="analytics-chart-card">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="period" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(value) => [`Rs. ${value}`, lang === 'en' ? 'Spent' : 'खर्च']} />
                <Bar dataKey="spent" radius={[6, 6, 0, 0]} fill="var(--chart-bar)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h3 className="admin-section-title">{lang === 'en' ? 'Most Bought Items' : 'सबैभन्दा बढी किनेका सामानहरू'}</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{lang === 'en' ? 'Item' : 'सामान'}</th>
                  <th>{lang === 'en' ? 'Quantity Bought' : 'किनेको परिमाण'}</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((item) => (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td>{item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default Analytics
