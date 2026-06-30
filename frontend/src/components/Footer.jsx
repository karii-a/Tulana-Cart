import { useLang } from '../context/LangContext'

function Footer() {
  const { lang } = useLang()
  return (
    <footer className="footer">
      <p>
        🛒 Tulana Kart — {lang === 'en'
          ? 'Compare grocery prices across Nepal'
          : 'नेपालभर किराना मूल्य तुलना गर्नुहोस्'}
      </p>
      <p className="footer__credit">
        {lang === 'en' ? 'A final year project by Kareena Acharya' : 'कारिना आचार्यको अन्तिम वर्ष परियोजना'}
      </p>
    </footer>
  )
}

export default Footer