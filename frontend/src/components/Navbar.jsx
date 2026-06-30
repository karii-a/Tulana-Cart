import { Link, useNavigate } from 'react-router-dom'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import LanguageToggle from './LanguageToggle'
import { supabase } from '../lib/supabase'

function Navbar() {
  const { lang } = useLang()
  const { user, role } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <nav className="navbar">
      <div className="navbar__logo">
        <Link to="/">🛒 Tulana Kart</Link>
      </div>
      <div className="navbar__links">
        <Link to="/">{lang === 'en' ? 'Home' : 'गृहपृष्ठ'}</Link>
        <Link to="/compare">{lang === 'en' ? 'Compare' : 'तुलना'}</Link>
        <Link to="/cart">{lang === 'en' ? '🛒 Cart' : '🛒 कार्ट'}</Link>
        <Link to="/wishlist">{lang === 'en' ? '♡ Wishlist' : '♡ इच्छासूची'}</Link>
        {role === 'admin' && (
          <Link to="/admin">{lang === 'en' ? 'Admin' : 'एडमिन'}</Link>
        )}
      </div>
      <div className="navbar__right">
        {user ? (
          <>
            <Link to="/profile" className="navbar__user">
              {user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
            </Link>
            <button className="navbar__logout" onClick={handleLogout}>
              {lang === 'en' ? 'Logout' : 'लगआउट'}
            </button>
          </>
        ) : (
          <Link to="/login" className="navbar__login-btn">
            {lang === 'en' ? 'Login' : 'लगइन'}
          </Link>
        )}
        <LanguageToggle />
      </div>
    </nav>
  )
}

export default Navbar