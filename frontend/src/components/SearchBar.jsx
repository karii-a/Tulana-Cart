import { useState } from 'react'
import { useLang } from '../context/LangContext'

function SearchBar({ onSearch }) {
  const { lang } = useLang()
  const [query, setQuery] = useState('')

  function handleChange(e) {
    setQuery(e.target.value)
    onSearch(e.target.value)
  }

  return (
    <div className="search-bar">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={lang === 'en' ? '🔍 Search for rice, oil, dal...' : '🔍 चामल, तेल, दाल खोज्नुहोस्...'}
      />
    </div>
  )
}

export default SearchBar