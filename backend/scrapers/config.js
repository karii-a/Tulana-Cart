// Configuration for each store the scraper knows about.
//
// Both sites organize products by category, not one giant "all products"
// page, so `listUrls` is an ARRAY: one URL per category/collection you want
// scraped. The scraper visits every URL in the array, clicks "Load More" (if
// loadMoreButtonText is set) until nothing new appears, and merges all the
// results together (de-duplicated by product name).
//
// To cover more of the catalog, add more category URLs to listUrls below.
//   - BigMart: click through "All Categories" in the top nav; each category
//     lands on a URL like https://bigmart.com.np/Section?section=N&sname=X.
//     Add each one you want scraped.
//   - Mero Kirana: click through the top nav (Grocery, Bakery & Dairy, etc.)
//     or a collection page; each lands on its own /#/search/... URL.
//
// Run `node scrapers/inspect.js <store>` any time after changing selectors
// or URLs to verify they still work before a real sync.
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
    // One URL per category. Two confirmed via discover.js so far — add more
    // section=N URLs as you find them (see note above; the "All Categories"
    // dropdown likely needs a manual click to reveal the rest).
    listUrls: [
      'https://bigmart.com.np/Section?section=17&sname=Fresh',
      'https://bigmart.com.np/Section?section=28&sname=Mahabachat',
    ],
    waitForSelector: '[class*="product"]',
    // TODO: not yet verified against real markup for this URL — run
    // `node scrapers/inspect.js bigmart` and check the "Testing current
    // selectors" + "Real product card HTML" sections it prints.
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
    // One URL per category/collection. Only "Popular Rice Deals" is confirmed
    // so far — add more category URLs here as you find them (see note above).
    listUrls: [
      'https://www.merokirana.com/#/search/KiranaCollection/cd2c7d3dec9c44a4-b3e8f25a96b9945d/Popular-Rice-Deals.html',
    ],
    waitForSelector: '.product-card',
    // Confirmed via inspect.js's real-HTML dump against an actual card:
    //   <div class="product-card"> ... 
    //     <h2 class="product-card__title" title="...">
    //       <a href="#/detail/...">Pearl Premium (Katarni) Jeera Masino Rice, 25kg</a>
    //     </h2>
    //     <div class="product-card__price-container">
    //       <span class="product-card__actual-price">NRs.2570</span>
    //       <span class="product-card__compare-price">NRs.2701</span>  (struck-through original price)
    //     </div>
    //   </div>
    // Note: the generic `[class*="title"], a` guess previously matched a
    // "SALE" ribbon badge instead of the real title — .product-card__title
    // is the exact, unambiguous selector.
    cardSelector: '.product-card',
    nameSelector: '.product-card__title',
    priceSelector: '.product-card__price-container', // contains both prices as text; parsePrice takes the first number (the actual/sale price)
    imageSelector: 'img',
    linkSelector: '.product-card__title a',
    // This page paginates with a red "Load More" button — click it
    // repeatedly (until it stops adding cards) before scraping.
    loadMoreButtonText: 'Load More',
  },
}