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
    // One URL per category/collection.
    //
    // CONFIRMED via inspect.js against all 10 URLs: these are the TOP-LEVEL
    // nav pages (Grocery, Bakery & Dairy, Beverage, etc.) and they list
    // products directly (not tile grids) — .product-card matched 24+
    // elements on every one after "Load More" was clicked out (Packaged
    // Food alone returned 168). No further verification needed here.
    //
    // NOTE: the old separate "Home-Baking" leaf-page entry was REMOVED.
    // Its products already show up under "Bakery & Dairy" (confirmed: that
    // page's own "REFINE BY" list includes "Home Baking" as a sub-filter),
    // and scraper.js de-dupes by product name keeping whichever URL it
    // scraped FIRST — so with Bakery & Dairy running before Home-Baking,
    // every Home Baking product was already being claimed under the
    // "Bakery & Dairy" category tag. Keeping the old entry added a wasted
    // page load per sync for zero new products.
    listUrls: [
      'https://www.merokirana.com/#/search/KiranaCollection/cd2c7d3dec9c44a4-b3e8f25a96b9945d/Popular-Rice-Deals.html',
      'https://www.merokirana.com/#/KiranaCategory/05f8fd1183e14d7e-9e68202448f2de5f/05f8fd1183e14d7e-9e68202448f2de5f/Grocery.html',
      'https://www.merokirana.com/#/KiranaCategory/f8af1b42636542a4-a802ecbe072d3307/f8af1b42636542a4-a802ecbe072d3307/Bakery-&-Dairy.html',
      'https://www.merokirana.com/#/KiranaCategory/8c5ded74107648d3-96f7453d21a97db1/8c5ded74107648d3-96f7453d21a97db1/Beverage.html',
      'https://www.merokirana.com/#/KiranaCategory/8ac3e639f1224f43-999c081adb4d0794/8ac3e639f1224f43-999c081adb4d0794/Eggs-&-Meat.html',
      'https://www.merokirana.com/#/KiranaCategory/71b5d81886ec45e9-acae90e08f1a781d/71b5d81886ec45e9-acae90e08f1a781d/Household-Items.html',
      'https://www.merokirana.com/#/KiranaCategory/1611ca0a01b440c6-bab84430d6d56eaa/1611ca0a01b440c6-bab84430d6d56eaa/Kitchen-&-Pet-Food.html',
      'https://www.merokirana.com/#/KiranaCategory/2ebe55bb3cd44e5f-8bf2611c2aedcc46/2ebe55bb3cd44e5f-8bf2611c2aedcc46/Packaged-Food.html',
      'https://www.merokirana.com/#/KiranaCategory/f9b9c14827c44100-91002b8aac8399d7/f9b9c14827c44100-91002b8aac8399d7/The-Baby-Store.html',
      'https://www.merokirana.com/#/KiranaCategory/064af0151e7447df-851523bf7804bca3/064af0151e7447df-851523bf7804bca3/The-Beauty-Store.html',
      'https://www.merokirana.com/#/KiranaCategory/35ae95a75bda48a3-ac60b32fab01d5db/35ae95a75bda48a3-ac60b32fab01d5db/Veg-&-Fruits.html',
    ],
    // Category name for each entry in listUrls above (same index). This is
    // what gets saved to products.category_id (via runSync.js, which looks
    // up/creates a matching row in the `categories` table by this name) —
    // it's what makes the category filter buttons on the Home page actually
    // work. Keep this array the same length as listUrls, in the same order.
    categories: [
      'Rice & Grains',
      'Grocery',
      'Bakery & Dairy',
      'Beverages',
      'Eggs & Meat',
      'Household Items',
      'Kitchen & Pet Food',
      'Packaged Food',
      'Baby Care',
      'Beauty & Cosmetics',
      'Veg & Fruits',
      'Home Baking',
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
    // One URL per category, pulled from the full "OUR CATEGORIES" grid on
    // vhandar.com/category. NOTE: the parent 'packaged-instant-food' page is
    // deliberately left OUT — it has 8 of its own sub-category pages
    // (noodles, pasta, soup, etc.), which are listed individually below so
    // products get tagged with a specific category instead of one catch-all
    // "Packaged Food" bucket.
    listUrls: [
      'https://www.vhandar.com/category/rice-atta-flour',
      'https://www.vhandar.com/category/oil-ghee-more',
      'https://www.vhandar.com/category/dals-pulses',
      'https://www.vhandar.com/category/dairy-bread-eggs',
      'https://www.vhandar.com/category/snacks-munchies',
      'https://www.vhandar.com/category/cold-drinks-juice',
      'https://www.vhandar.com/category/tea-coffee-health-drink',
      'https://www.vhandar.com/category/packaged-instant-food/noodles',
      'https://www.vhandar.com/category/packaged-instant-food/pasta',
      'https://www.vhandar.com/category/packaged-instant-food/soup',
      'https://www.vhandar.com/category/packaged-instant-food/baking-mixes-ingredients',
      'https://www.vhandar.com/category/packaged-instant-food/ready-to-cook-eat',
      'https://www.vhandar.com/category/packaged-instant-food/frozen-veg-snacks',
      'https://www.vhandar.com/category/packaged-instant-food/frozen-non-veg-snacks',
      'https://www.vhandar.com/category/packaged-instant-food/herbs-seasoning',
      'https://www.vhandar.com/category/masala-dry-fruits-more',
      'https://www.vhandar.com/category/sauces-spreads',
      'https://www.vhandar.com/category/sweet-tooth',
      'https://www.vhandar.com/category/liquors-smoke',
      'https://www.vhandar.com/category/beauty-cosmetics',
      'https://www.vhandar.com/category/cleaning-essentials',
      'https://www.vhandar.com/category/personal-care',
      'https://www.vhandar.com/category/home-office',
      'https://www.vhandar.com/category/pharma-wellness',
      'https://www.vhandar.com/category/baby-care',
      'https://www.vhandar.com/category/organic-healthy-living',
      'https://www.vhandar.com/category/bakery-biscuits',
      'https://www.vhandar.com/category/horeca',
      'https://www.vhandar.com/category/packaging-material',
    ],
    // Category name for each entry in listUrls above (same index — see the
    // note on merokirana.categories above for what this is for). The first
    // few are aligned to match this app's existing filter tabs; the rest are
    // new names — check them against your `categories` table and rename any
    // that should map onto an existing tab instead of creating a new one.
    categories: [
      'Rice & Grains',
      'Oil & Ghee',
      'Lentils & Pulses',
      'Dairy',
      'Snacks',
      'Beverages',
      'Tea & Coffee',
      'Noodles',
      'Pasta',
      'Soup',
      'Baking Mixes & Ingredients',
      'Ready to Cook & Eat',
      'Frozen Veg Snacks',
      'Frozen Non-Veg Snacks',
      'Herbs & Seasoning',
      'Masala & Dry Fruits',
      'Sauces & Spreads',
      'Sweets & Confectionery',
      'Liquor & Tobacco',
      'Beauty & Cosmetics',
      'Cleaning Essentials',
      'Personal Care',
      'Home & Office',
      'Pharma & Wellness',
      'Baby Care',
      'Organic & Healthy Living',
      'Bakery & Biscuits',
      'HoReCa',
      'Packaging Material',
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