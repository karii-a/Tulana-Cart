// Configuration for each store the scraper knows about.
//
// Both sites organize products by category, not one giant "all products"
// page, so `listUrls` is an ARRAY: one URL per category/collection you want
// scraped. The scraper visits every URL in the array, clicks "Load More" (if
// loadMoreButtonText is set) until nothing new appears, and merges all the
// results together (de-duplicated by product name).
//
// To cover more of the catalog, add more category URLs to listUrls below.
//   - Mero Kirana: click through the top nav (Grocery, Bakery & Dairy, etc.)
//     or a collection page; each lands on its own /#/search/... URL.
//   - Vhandar: click through /category on the site; each lands on its own
//     /category/<slug> URL. See https://www.vhandar.com/category for the
//     full list — this app only tracks a subset so far.
//
// Run `node scrapers/inspect.js <store>` any time after changing selectors
// or URLs to verify they still work before a real sync (or
// `node scrapers/inspectHttp.js <url>` for http-mode stores like Vhandar).
//
// bbsm.com.np (Bhat-Bhateni corporate site) has no online product catalog
// -- it's a store locator only -- and Bhat-Bhateni/Saleways have been
// removed as stores in this app (see sql/002_stores_cleanup.sql).
//
// BigMart is dropped for now — its site has a client-side routing bug that
// makes it unreliable to scrape (see git history / prior notes for details).
// To bring it back later: re-add a `bigmart` entry here with real selectors
// (verified via inspect.js) and a stable listUrls array.

module.exports = {
  merokirana: {
    label: 'Mero Kirana',
    storeName: 'Mero Kirana', // created automatically on first sync if it doesn't exist yet
    baseUrl: 'https://www.merokirana.com',
    // One URL per category/collection. Only "Popular Rice Deals" is confirmed
    // so far — add more category URLs here as you find them (see note above).
    listUrls: [
      'https://www.merokirana.com/#/search/KiranaCollection/cd2c7d3dec9c44a4-b3e8f25a96b9945d/Popular-Rice-Deals.html',
    ],
    // Category name for each entry in listUrls above (same index). This is
    // what gets saved to products.category_id (via runSync.js, which looks
    // up/creates a matching row in the `categories` table by this name) —
    // it's what makes the category filter buttons on the Home page actually
    // work. Keep this array the same length as listUrls, in the same order.
    categories: [
      'Rice & Grains',
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
  vhandar: {
    label: 'Vhandar',
    storeName: 'Vhandar', // created automatically on first sync if it doesn't exist yet
    baseUrl: 'https://www.vhandar.com',
    // Vhandar's category pages are fully server-rendered — products are
    // already in the raw HTML, no browser/JS needed. This tells scraper.js
    // to use httpScraper.js (plain fetch + cheerio) instead of Puppeteer,
    // which is far more reliable than browser automation for a site like
    // this (see BigMart's config for the contrast — that site needs a real
    // browser and has its own routing bugs; this one doesn't need either).
    scrapeMode: 'http',
    // One URL per category — mapped to roughly match this app's existing
    // filter tabs (Rice & Grains, Oil & Ghee, Lentils & Pulses, Dairy,
    // Snacks, Beverages). Vhandar has MANY more categories than this
    // (see https://www.vhandar.com/category for the full list) — add more
    // /category/<slug> URLs here to broaden coverage.
    listUrls: [
      'https://www.vhandar.com/category/rice-atta-flour',
      'https://www.vhandar.com/category/oil-ghee-more',
      'https://www.vhandar.com/category/dals-pulses',
      'https://www.vhandar.com/category/dairy-bread-eggs',
      'https://www.vhandar.com/category/snacks-munchies',
      'https://www.vhandar.com/category/cold-drinks-juice',
      'https://www.vhandar.com/category/tea-coffee-health-drink',
    ],
    // Category name for each entry in listUrls above (same index — see the
    // note on merokirana.categories above for what this is for). These must
    // match your existing `categories` table rows (case-insensitive) —
    // aligned here to: Rice & Grains, Oil & Ghee, Lentils & Pulses, Dairy,
    // Snacks, Beverages.
    categories: [
      'Rice & Grains',
      'Oil & Ghee',
      'Lentils & Pulses',
      'Dairy',
      'Snacks',
      'Beverages',
      'Tea & Coffee',
    ],
    // Confirmed via inspectHttp.js against a real category page:
    //   <div class="productCard">
    //     <a href="/product/hulas-premium-basmati-rice-5kg">...</a>
    //     <div class="product-img..."><img src="/api/image?url=...jpg"></div>
    //     <p class="p-name" title="...">Hulas Premium Basmati Rice</p>
    //     <div class="rsParent"><p class="rs">Rs</p><p class="p1">780</p></div>       (actual/sale price — just the number)
    //     <div class="mrpParent"><div class="mrp">MRP</div><div class="p2 line-through">865</div></div>   (struck-through original price)
    //   </div>
    // Note: image `src` and link `href` are RELATIVE URLs (e.g.
    // "/product/..."); httpScraper.js resolves them against baseUrl
    // automatically.
    // Each category page returned 10 products with no visible pagination
    // controls in the HTML — larger categories may have more; not yet
    // confirmed whether those paginate via a URL param or need JS.
    cardSelector: '.productCard',
    nameSelector: '.p-name',
    priceSelector: '.rsParent .p1',
    imageSelector: '.product-img img',
    linkSelector: 'a[href^="/product/"]',
  },
}