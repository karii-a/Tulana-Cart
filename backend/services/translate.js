// Translates scraped product names into Nepali on demand.
//
// Uses Google Cloud Translation API v2 (simple REST call, no SDK needed).
// Requires GOOGLE_TRANSLATE_API_KEY in .env — get one from
// https://console.cloud.google.com/apis/credentials after enabling the
// "Cloud Translation API" on a project.
//
// NOTE on quality: plain machine translation will happily translate brand
// names too (e.g. "Hulas" or "Thakali" as if they were regular words),
// which looks wrong on a storefront. We do a light-touch fix: units like
// "20kg" / "5 Kg" are stripped before translating and re-appended after,
// since MT engines sometimes mangle numbers+units. Brand names are left to
// the translation API as-is for now — if a specific brand keeps coming out
// wrong, add it to BRAND_OVERRIDES below and it'll be preserved verbatim.

const BRAND_OVERRIDES = [
  // 'Hulas', 'Thakali', 'Tarun Delight', ...
  // Add brand names here exactly as they appear in scraped product names
  // if you notice the translator mangling them. They'll be swapped out
  // before translation and back in after, untouched.
]

const UNIT_RE = /(\d+(\.\d+)?\s?(kg|g|gm|gram|grams|ml|l|litre|liter|pcs|pack))\b/gi

// Replaces units and any configured brand names with placeholder tokens so
// the translation API can't touch them, then hands back a function to
// restore the originals after translation comes back.
function protect(text) {
  const found = []
  let working = text

  for (const brand of BRAND_OVERRIDES) {
    if (working.includes(brand)) {
      found.push(brand)
      working = working.replaceAll(brand, `__KEEP${found.length - 1}__`)
    }
  }

  working = working.replace(UNIT_RE, (match) => {
    found.push(match)
    return `__KEEP${found.length - 1}__`
  })

  return { protectedText: working, found }
}

function restore(text, found) {
  return found.reduce(
    (acc, original, i) => acc.replace(`__KEEP${i}__`, original),
    text
  )
}

async function translateProductName(name) {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_TRANSLATE_API_KEY is not set in the backend .env')
  }

  const { protectedText, found } = protect(name)

  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: protectedText,
        source: 'en',
        target: 'ne', // ISO code for Nepali
        format: 'text',
      }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Translation API error (${res.status}): ${body}`)
  }

  const data = await res.json()
  const translatedRaw = data?.data?.translations?.[0]?.translatedText
  if (!translatedRaw) {
    throw new Error('Translation API returned no result')
  }

  return restore(translatedRaw, found)
}

module.exports = { translateProductName }