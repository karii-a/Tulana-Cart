const supabase = require('../supabase')
const config = require('./config')
const { scrapeStore } = require('./scraper')
const { notifyPriceDrop } = require('../services/notify')

const DEFAULT_CATEGORY_ID = 1 // fallback category for newly-discovered products

// Cache store name -> id lookups for the duration of one sync run
const storeIdCache = {}

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

/**
 * Runs a full sync across every store in scrapers/config.js.
 * Returns a summary object for logging / the API response.
 */
async function runSync() {
  const summary = { stores: {}, startedAt: new Date().toISOString() }

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
        await upsertProduct(item, storeConfig, storeId, result)
      }
    } catch (err) {
      result.errors.push(err.message)
    }

    summary.stores[key] = result
  }

  summary.finishedAt = new Date().toISOString()
  return summary
}

async function upsertProduct(item, storeConfig, storeId, result) {
  // Find an existing product by name (simple match — good enough for a
  // student project; a real system would match by SKU/URL).
  let { data: existingProduct } = await supabase
    .from('products')
    .select('id')
    .ilike('name', item.name)
    .maybeSingle()

  let productId = existingProduct?.id

  if (!productId) {
    const { data: created, error } = await supabase
      .from('products')
      .insert([{
        name: item.name,
        name_np: item.name,
        brand: storeConfig.label,
        category_id: DEFAULT_CATEGORY_ID,
        image_url: item.imageUrl,
      }])
      .select()
      .single()
    if (error) {
      result.errors.push(`insert product "${item.name}": ${error.message}`)
      return
    }
    productId = created.id
    result.created++
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