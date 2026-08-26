// Configuration for each store the scraper knows about.
//
// bigmart.com.np and merokirana.com are React/JS single-page apps, so the
// selectors below are BEST-GUESS starting points, not verified against the
// live site (this project's sandbox can't launch a browser against external
// domains). Before your first real sync:
//
//   1. cd backend
//   2. node scrapers/inspect.js bigmart
//   3. node scrapers/inspect.js merokirana
//
// Each command opens the category page in headless Chrome and prints the
// outerHTML of elements it thinks are product cards, plus screenshots to
// backend/scrapers/debug/. Use that to fix the selectors below (right-click
// a product price in your browser -> Inspect -> note the class name).
//
// bbsm.com.np (Bhat-Bhateni corporate site) has no online product catalog
// -- it's a store locator only -- and Bhat-Bhateni/Saleways have been
// removed as stores in this app (see sql/002_stores_cleanup.sql). Only
// BigMart and Mero Kirana are tracked now.

module.exports = {
  bigmart: {
    label: 'BigMart',
    storeName: 'BigMart', // must match the `stores.name` value in Supabase (looked up automatically)
    baseUrl: 'https://bigmart.com.np',
    // A category/listing page that shows many products with prices at once.
    listUrl: 'https://bigmart.com.np/products',
    waitForSelector: '[class*="product"]',
    // Selector for one product "card" within the listing
    cardSelector: '[class*="product-card"], [class*="ProductCard"]',
    nameSelector: '[class*="name"], [class*="title"]',
    priceSelector: '[class*="price"]',
    imageSelector: 'img',
    linkSelector: 'a',
  },
  merokirana: {
    label: 'Mero Kirana',
    storeName: 'Mero Kirana', // created automatically on first sync if it doesn't exist yet
    baseUrl: 'https://www.merokirana.com',
    listUrl: 'https://www.merokirana.com/#/products',
    waitForSelector: '[class*="product"]',
    cardSelector: '[class*="product-card"], [class*="ProductCard"], [class*="product-item"]',
    nameSelector: '[class*="name"], [class*="title"]',
    priceSelector: '[class*="price"]',
    imageSelector: 'img',
    linkSelector: 'a',
  },
}