// Translates scraped product names into Nepali on demand.
//
// Uses the MyMemory Translation API — completely free, no signup, no
// credit card, no API key. Good enough for short product-name strings.
// (Free-tier limit is ~5,000 words/day per IP address, which is plenty
// for on-demand translation of individual product names as people view
// them — this isn't bulk-translating your whole catalog at once.)
//
// If you later want higher volume or better quality, this is the only
// file you'd need to swap out — everything else (the route, the caching
// in Supabase, the frontend hook) stays the same either way.
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
  const { protectedText, found } = protect(name)

  const params = new URLSearchParams({
    q: protectedText,
    langpair: 'en|ne', // English -> Nepali
  })

  // Optional: if you ever hit the free-tier limit, adding a contact email
  // (de=you@example.com) as a query param raises the daily cap from
  // ~5,000 to ~50,000 words/day, still free, no card. Uncomment and set
  // MYMEMORY_CONTACT_EMAIL in Render's env vars if that's ever needed:
  // if (process.env.MYMEMORY_CONTACT_EMAIL) {
  //   params.set('de', process.env.MYMEMORY_CONTACT_EMAIL)
  // }

  const res = await fetch(
    `https://api.mymemory.translated.net/get?${params.toString()}`
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Translation API error (${res.status}): ${body}`)
  }

  const data = await res.json()
  const translatedRaw = data?.responseData?.translatedText

  if (!translatedRaw || data?.responseStatus !== 200) {
    throw new Error(
      `Translation API returned no usable result: ${JSON.stringify(data)}`
    )
  }




  return restore(translatedRaw, found)
}

module.exports = { translateProductName }