import { useLang } from '../context/LangContext'

function LanguageToggle() {
  const { lang, toggleLang } = useLang()

  return (
    <button className="lang-toggle" onClick={toggleLang}>
      {lang === 'en' ? 'नेपाली' : 'English'}
    </button>
  )
}

export default LanguageToggle