import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer'
import Home from './pages/Home'
import Compare from './pages/Compare'
import Wishlist from './pages/Wishlist'
import Login from './pages/Login'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'
import { useAuth } from './context/AuthContext'
import Subscription from './pages/Subscription'
import SubscriptionSuccess from './pages/SubscriptionSuccess'
import SubscriptionFailed from './pages/SubscriptionFailed'
import Profile from './pages/Profile'
import ProductDetail from './pages/ProductDetail'
import OrderTracking from './pages/OrderTracking'
import Analytics from './pages/Analytics'


function App() {
  const { role, loading } = useAuth()

  if (loading) return <div className="loading">Loading...</div>

  return (
    <>
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/login" element={<Login />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/subscription/success" element={<SubscriptionSuccess />} />
          <Route path="/subscription/failed" element={<SubscriptionFailed />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/order/:id" element={<OrderTracking />} />
          <Route path="/product/:id" element={<ProductDetail />} />

          <Route
            path="/admin"
            element={role === 'admin' ? <Admin /> : <Navigate to="/" />}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}

export default App