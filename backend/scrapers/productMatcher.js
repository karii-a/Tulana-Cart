// Matches a scraped item name against existing products so the SAME
// product from different stores lands on one product row (with multiple
// product_prices rows) instead of creating a separate card per store.
//
// The old logic used an exact (case-insensitive) name match, which almost
// never fires across stores since they phrase things slightly differently
// — e.g. "Thakali Long Grain Rice, 5kg" (Mero Kirana) vs "Thakali Long
// Grain Basmati Rice, 5kg" (Vhandar). This does fuzzy matching instead:
// normalize + strip filler words, require the weight/quantity to match
// exactly when both sides have one (a 5kg bag and a 20kg bag are genuinely
// different products/prices — never merge those), and require enough
// overlap in the remaining significant words.
//
// This is a heuristic, not perfect product-identity resolution (no real
// SKU/barcode to match on) — expect occasional misses on very differently
// worded listings, and rare false merges on generically-named items.
// Both are much better than the previous "basically never matches" state.

const STOPWORDS = new Set([
  'premium', 'fresh', 'the', 'a', 'an', 'pack', 'of', 'with', 'new', 'original',
])

const SIMILARITY_THRESHOLD = 0.6

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[.,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Pulls out a weight/volume/count like "5kg", "500ml", "1ltr" and
// normalizes units (kg->g, l->ml) so "0.5kg" and "500g" compare equal.
function extractWeight(name) {
  const match = name
    .toLowerCase()
    .match(/(\d+(\.\d+)?)\s?(kg|gm|gram|grams|g|ml|ltr|litre|liter|l|pcs|pc)\b/)
  if (!match) return null

  let num = parseFloat(match[1])
  let unit = match[3]

  if (/^(gm|gram|grams)$/.test(unit)) unit = 'g'
  if (/^(ltr|litre|liter)$/.test(unit)) unit = 'l'
  if (unit === 'pc') unit = 'pcs'

  if (unit === 'kg') { num *= 1000; unit = 'g' }
  if (unit === 'l') { num *= 1000; unit = 'ml' }

  return `${num}${unit}`
}

function significantTokens(name) {
  const weight = extractWeight(name)
  return normalize(name)
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && t !== weight)
}

function jaccardSimilarity(tokensA, tokensB) {
  const a = new Set(tokensA)
  const b = new Set(tokensB)
  const intersectionSize = [...a].filter((t) => b.has(t)).length
  const unionSize = new Set([...a, ...b]).size
  return unionSize === 0 ? 0 : intersectionSize / unionSize
}

/**
 * @param {string} itemName - the freshly scraped product's name
 * @param {Array<{id: number, name: string}>} candidates - existing products
 *   (from the DB, plus any created earlier in the same sync run)
 * @returns {{id: number, name: string} | null} the best match, or null if
 *   nothing scored above the similarity threshold
 */
function findMatchingProduct(itemName, candidates) {
  const itemWeight = extractWeight(itemName)
  const itemTokens = significantTokens(itemName)

  let best = null
  let bestScore = 0

  for (const candidate of candidates) {
    const candWeight = extractWeight(candidate.name)

    // Both have a detectable weight and they disagree -> definitely
    // different products (different pack sizes). Skip.
    if (itemWeight && candWeight && itemWeight !== candWeight) continue
    // One has a detectable weight and the other doesn't -> too uncertain
    // to merge safely. Skip.
    if (Boolean(itemWeight) !== Boolean(candWeight)) continue

    const score = jaccardSimilarity(itemTokens, significantTokens(candidate.name))
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }

  return bestScore >= SIMILARITY_THRESHOLD ? best : null
}

module.exports = { findMatchingProduct, normalize, extractWeight, significantTokens, jaccardSimilarity }