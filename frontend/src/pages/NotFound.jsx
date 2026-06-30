import { Link } from 'react-router-dom'
import { useLang } from '../context/LangContext'

function NotFound() {
  const { lang } = useLang()
  return (
    <div className="page not-found">
      <h1>404</h1>
      <p>{lang === 'en' ? 'Page not found' : 'पृष्ठ फेला परेन'}</p>
      <Link to="/">{lang === 'en' ? 'Back to Home' : 'गृहपृष्ठमा फर्कनुहोस्'}</Link>
    </div>
  )
}

export default NotFound