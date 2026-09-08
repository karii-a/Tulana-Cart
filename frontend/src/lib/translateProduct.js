// Asks the backend to translate a product's name to Nepali and cache it,
// but only if it doesn't already have a real translation. Safe to call
// every time a product renders in Nepali mode — it's a no-op once
// name_np is actually filled in.

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Tracks ids currently being translated so we don't fire duplicate
// requests if the same product is on screen more than once (e.g. it
// shows up in two lists at the same time).
const inFlight = new Set()

export function needsTranslation(product) {
  return !product.name_np || product.name_np === product.name
}

// onTranslated(name_np) is called once the translation comes back, so the
// caller can update whatever local state is showing this product.
export async function requestProductTranslation(product, onTranslated) {
  if (!needsTranslation(product)) return
  if (inFlight.has(product.id)) return
  inFlight.add(product.id)

  try {
    const res = await fetch(`${apiUrl}/api/translate-product/${product.id}`, {
      method: 'POST',
    })
    if (!res.ok) throw new Error(`Translation request failed (${res.status})`)
    const data = await res.json()
    if (data.name_np) onTranslated(data.name_np)
  } catch (err) {
    // Fails silently on purpose — the UI already has the English name to
    // fall back to, so a translation hiccup shouldn't break the page.
    console.warn(`Could not translate product ${product.id}:`, err.message)
  } finally {
    inFlight.delete(product.id)
  }
}