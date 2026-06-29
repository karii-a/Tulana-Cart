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
        <Link to="/wishlist">{lang === 'en' ? 'Wishlist' : 'इच्छासूची'}</Link>
        {role === 'admin' && (
          <Link to="/admin">{lang === 'en' ? 'Admin' : 'एडमिन'}</Link>
        )}
        {user ? (
          <>
            <span className="navbar__user">{user.email}</span>
            <button className="navbar__logout" onClick={handleLogout}>
              {lang === 'en' ? 'Logout' : 'लगआउट'}
            </button>
          </>
        ) : (
          <Link to="/login">{lang === 'en' ? 'Login' : 'लगइन'}</Link>
        )}
      </div>
      <LanguageToggle />
    </nav>
  )
}

export default Navbar