// Quick diagnostic: how many products in the DB actually have prices from
// MORE THAN ONE store (i.e. would show 2+ store tags / be worth comparing)?
// Run this before and after a matcher change to see if it's actually
// helping.
//
// Usage (from the backend/ folder):
//   node scripts/checkMatches.js

const supabase = require('../supabase')

async function main() {
  const { data: prices, error } = await supabase
    .from('product_prices')
    .select('product_id, store_id, stores(name), products(name)')

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }

  const byProduct = new Map()
  for (const row of prices) {
    if (!byProduct.has(row.product_id)) {
      byProduct.set(row.product_id, { name: row.products?.name, stores: new Set() })
    }
    byProduct.get(row.product_id).stores.add(row.stores?.name)
  }

  const total = byProduct.size
  const multiStore = [...byProduct.values()].filter((p) => p.stores.size > 1)

  console.log(`Total products: ${total}`)
  console.log(`Products with 2+ stores (actually comparable): ${multiStore.length}`)
  console.log(`That's ${((multiStore.length / total) * 100).toFixed(1)}% of the catalog.\n`)

  console.log('Sample of matched (comparable) products:')
  for (const p of multiStore.slice(0, 20)) {
    console.log(`  - ${p.name}  [${[...p.stores].join(', ')}]`)
  }
}

main()