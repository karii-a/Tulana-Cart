const supabase = require('../supabase')
const config = require('./config')
const { scrapeStore } = require('./scraper')
const { notifyPriceDrop } = require('../services/notify')
const { findMatchingProduct } = require('./productMatcher')

// Fallback used only when an item has no categoryName at all (e.g. a store
// config entry with no `categories` array — see config.js).
const DEFAULT_CATEGORY_NAME = 'Uncategorized'

// Cache store name -> id and category name -> id lookups for the duration
// of one sync run
const storeIdCache = {}
const categoryIdCache = {}

async function resolveStoreId(storeName) {
  if (storeIdCache[storeName]) return storeIdCache[storeName]

  const { data: existing } = await supabase
    .from('stores')
    .select('id')
    .ilike('name', storeName)
    .maybeSingle()

  if (existing) {
    storeIdCache[storeName] = existing.id
    return existing.id
  }

  const { data: created, error } = await supabase
    .from('stores')
    .insert([{ name: storeName, name_np: storeName }])
    .select()
    .single()

  if (error) throw new Error(`could not create store "${storeName}": ${error.message}`)

  storeIdCache[storeName] = created.id
  return created.id
}

// Looks up a category by name (case-insensitive), creating it if it
// doesn't exist yet — same pattern as resolveStoreId above. This is what
// actually assigns products to real categories instead of everything
// silently landing under one hardcoded id, which is why the category
// filter on the Home page wasn't working.
async function resolveCategoryId(categoryName) {
  const name = categoryName || DEFAULT_CATEGORY_NAME
  if (categoryIdCache[name]) return categoryIdCache[name]

  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', name)
    .maybeSingle()

  if (existing) {
    categoryIdCache[name] = existing.id
    return existing.id
  }

  const { data: created, error } = await supabase
    .from('categories')
    .insert([{ name, name_np: name }])
    .select()
    .single()

  if (error) throw new Error(`could not create category "${name}": ${error.message}`)

  categoryIdCache[name] = created.id
  return created.id
}

/**
 * Runs a full sync across every store in scrapers/config.js.
 * Returns a summary object for logging / the API response.
 */
async function runSync() {
  const summary = { stores: {}, startedAt: new Date().toISOString() }

  // Loaded once and kept in memory for the whole run: every existing
  // product, plus anything created by an earlier store in THIS run, so a
  // Vhandar item scraped after a Mero Kirana item (or vice versa) in the
  // same sync can still match against it. See productMatcher.js for how
  // matching works.
  const { data: existingProducts, error: loadError } = await supabase
    .from('products')
    .select('id, name')
  if (loadError) {
    summary.stores = { _fatal: { scraped: 0, updated: 0, created: 0, priceDrops: 0, errors: [loadError.message] } }
    summary.finishedAt = new Date().toISOString()
    return summary
  }
  const knownProducts = existingProducts || []

  for (const [key, storeConfig] of Object.entries(config)) {
    const result = { scraped: 0, updated: 0, created: 0, priceDrops: 0, errors: [] }

    try {
      const storeId = await resolveStoreId(storeConfig.storeName)
      const items = await scrapeStore(storeConfig)
      result.scraped = items.length

      if (items.length === 0) {
        result.errors.push(
          'No products found — selectors in scrapers/config.js likely need fixing. Run "node scrapers/inspect.js ' +
            key + '" to debug.'
        )
      }

      for (const item of items) {
        await upsertProduct(item, storeConfig, storeId, result, knownProducts)
      }
    } catch (err) {
      result.errors.push(err.message)
    }

    summary.stores[key] = result
  }

  summary.finishedAt = new Date().toISOString()
  return summary
}

async function upsertProduct(item, storeConfig, storeId, result, knownProducts) {
  // Fuzzy-match against every product seen so far (existing DB rows, plus
  // anything created earlier in this same run) instead of requiring an
  // exact name match — see productMatcher.js for why.
  const match = findMatchingProduct(item.name, knownProducts)
  let productId = match?.id
  const categoryId = await resolveCategoryId(item.categoryName)

  if (!productId) {
    const { data: created, error } = await supabase
      .from('products')
      .insert([{
        name: item.name,
        name_np: item.name,
        brand: storeConfig.label,
        category_id: categoryId,
        image_url: item.imageUrl,
      }])
      .select()
      .single()
    if (error) {
      result.errors.push(`insert product "${item.name}": ${error.message}`)
      return
    }
    productId = created.id
    knownProducts.push({ id: created.id, name: item.name })
    result.created++
  } else {
    // Existing product (e.g. from before this categorization fix was
    // deployed, or still on category_id 1) — bring its category up to date
    // too, so old rows self-heal on the next sync instead of staying
    // miscategorized forever.
    await supabase.from('products').update({ category_id: categoryId }).eq('id', productId)
  }

  // Find the existing price row for this product+store to compare for a drop
  const { data: existingPrice } = await supabase
    .from('product_prices')
    .select('id, price')
    .eq('product_id', productId)
    .eq('store_id', storeId)
    .maybeSingle()

  if (existingPrice) {
    const { error } = await supabase
      .from('product_prices')
      .update({
        price: item.price,
        previous_price: existingPrice.price,
        in_stock: item.inStock,
        store_product_url: item.url,
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', existingPrice.id)

    if (error) {
      result.errors.push(`update product_prices for "${item.name}": ${error.message}`)
      return
    }

    if (item.price < existingPrice.price) {
      result.priceDrops++
      await notifyPriceDrop({
        productId,
        productName: item.name,
        storeName: storeConfig.label,
        oldPrice: existingPrice.price,
        newPrice: item.price,
      })
    }
  } else {
    const { error } = await supabase.from('product_prices').insert([{
      product_id: productId,
      store_id: storeId,
      price: item.price,
      previous_price: null,
      unit: 'unit',
      in_stock: item.inStock,
      store_product_url: item.url,
      last_checked_at: new Date().toISOString(),
    }])

    if (error) {
      result.errors.push(`insert product_prices for "${item.name}": ${error.message}`)
      return
    }
  }

  result.updated++
}

module.exports = { runSync }