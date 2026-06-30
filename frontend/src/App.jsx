import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Compare from './pages/Compare'
import Wishlist from './pages/Wishlist'
import Login from './pages/Login'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'
import { useAuth } from './context/AuthContext'
import Cart from './pages/Cart'
import PaymentSuccess from './pages/PaymentSuccess'
import PaymentFailed from './pages/PaymentFailed'
import Profile from './pages/Profile'

function App() {
  const { role, loading } = useAuth()

  if (loading) return <div className="loading">Loading...</div>

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/profile" element={<Profile />} />
        
<Route path="/payment-success" element={<PaymentSuccess />} />
<Route path="/payment-failed" element={<PaymentFailed />} />
        <Route
          path="/admin"
          element={role === 'admin' ? <Admin /> : <Navigate to="/" />}
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </>
  )
}

export default App