// Testing utilities for validating scraper and price extraction

export async function testScraper(url: string) {
  try {
    const response = await fetch(`/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();
    
    console.log('[v0] Scraper test result:', {
      url,
      price: data.price,
      title: data.title,
      imageUrl: data.imageUrl,
      error: data.error,
    });

    return data;
  } catch (error) {
    console.error('[v0] Scraper test error:', error);
    throw error;
  }
}

export async function testCronEndpoint(cronSecret: string) {
  try {
    const response = await fetch(`/api/cron/check-prices`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${cronSecret}` },
    });

    const data = await response.json();

    console.log('[v0] Cron test result:', {
      success: data.success,
      checkedCount: data.checkedCount,
      priceDropsDetected: data.priceDropsDetected,
      errors: data.errors,
    });

    return data;
  } catch (error) {
    console.error('[v0] Cron test error:', error);
    throw error;
  }
}

export const TEST_URLS = {
  amazon: 'https://amazon.com/dp/B0D4WC3VZN',
  hm: 'https://www2.hm.com/en_us/productpage.1234567.html',
  zara: 'https://www.zara.com/us/en/product-name/p00000',
  mango: 'https://shop.mango.com/product-name-p12345.html',
  asos: 'https://www.asos.com/brand-name/product-name/prd/12345',
  cos: 'https://www.cosstores.com/en_usd/product/product-name-p12345.html',
};
