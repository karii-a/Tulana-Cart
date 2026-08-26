const supabase = require('../supabase')
const config = require('./config')
const { scrapeStore } = require('./scraper')
const { notifyPriceDrop } = require('../services/notify')

const DEFAULT_CATEGORY_ID = 1 // fallback category for newly-discovered products

/**
 * Runs a full sync across every store in scrapers/config.js.
 * Returns a summary object for logging / the API response.
 */
async function runSync() {
  const summary = { stores: {}, startedAt: new Date().toISOString() }

  for (const [key, storeConfig] of Object.entries(config)) {
    const result = { scraped: 0, updated: 0, created: 0, priceDrops: 0, errors: [] }

    try {
      const items = await scrapeStore(storeConfig)
      result.scraped = items.length

      if (items.length === 0) {
        result.errors.push(
          'No products found — selectors in scrapers/config.js likely need fixing. Run "node scrapers/inspect.js ' +
            key + '" to debug.'
        )
      }

      for (const item of items) {
        await upsertProduct(item, storeConfig, result)
      }
    } catch (err) {
      result.errors.push(err.message)
    }

    summary.stores[key] = result
  }

  summary.finishedAt = new Date().toISOString()
  return summary
}

async function upsertProduct(item, storeConfig, result) {
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
    .eq('store_id', storeConfig.storeId)
    .maybeSingle()

  if (existingPrice) {
    await supabase
      .from('product_prices')
      .update({
        price: item.price,
        previous_price: existingPrice.price,
        in_stock: item.inStock,
        scraped_url: item.url,
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', existingPrice.id)

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
    await supabase.from('product_prices').insert([{
      product_id: productId,
      store_id: storeConfig.storeId,
      price: item.price,
      previous_price: null,
      unit: 'unit',
      in_stock: item.inStock,
      scraped_url: item.url,
      last_checked_at: new Date().toISOString(),
    }])
  }

  result.updated++
}

module.exports = { runSync }
