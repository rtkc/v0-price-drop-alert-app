import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { put } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';

export interface ScrapedData {
  price: number | null;
  title: string | null;
  imageUrl: string | null;
  error: string | null;
}

// Get retailer config from database
async function getRetailerConfig(domain: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Try exact match first
  let { data, error } = await supabase
    .from('retailers')
    .select('*')
    .eq('domain', domain)
    .maybeSingle();

  if (data) return data;

  // If no match, try matching base domain (remove subdomains like 'outlet', 'us', 'de')
  // For example: mangooutlet.com -> mango.com, asos.com -> asos.com
  const parts = domain.split('.');
  if (parts.length > 2) {
    // Try removing the first part (subdomain)
    const baseDomain = parts.slice(1).join('.');
    ({ data, error } = await supabase
      .from('retailers')
      .select('*')
      .eq('domain', baseDomain)
      .maybeSingle());

    if (data) return data;
  }

  // If still no match, try partial match on main domain
  // For example: mangooutlet.com contains 'mango'
  const mainDomain = parts[0];
  ({ data } = await supabase
    .from('retailers')
    .select('*')
    .or(`domain.ilike.%${mainDomain}%,name.ilike.%${mainDomain}%`)
    .maybeSingle());

  if (data) return data;

  return null;
}

// Extract price from HTML
function extractPrice(html: string, selector: string | null): number | null {
  if (!selector) return null;

  const $ = cheerio.load(html);
  let priceText = $(selector).first().text();

  if (!priceText) return null;

  // Extract numeric value from price text
  const match = priceText.match(/[\d,]+\.?\d*/);
  if (match) {
    return parseFloat(match[0].replace(/,/g, ''));
  }

  return null;
}

// Extract title from HTML
function extractTitle(html: string, selector: string | null): string | null {
  if (!selector) return null;

  const $ = cheerio.load(html);
  return $(selector).first().text().trim() || null;
}

// Extract image URL from HTML
function extractImageUrl(html: string, selector: string | null, baseUrl: string): string | null {
  if (!selector) return null;

  const $ = cheerio.load(html);
  let imageSrc = $(selector).first().attr('src') || $(selector).first().attr('data-src');

  if (!imageSrc) return null;

  // Handle relative URLs
  if (imageSrc.startsWith('/')) {
    const url = new URL(baseUrl);
    return url.origin + imageSrc;
  }

  if (imageSrc.startsWith('http')) {
    return imageSrc;
  }

  return new URL(imageSrc, baseUrl).href;
}

// Download and store image in Vercel Blob
async function storeImageInBlob(imageUrl: string, itemId: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 5000,
    });

    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';

    const { url } = await put(`product-images/${itemId}.${ext}`, buffer, {
      access: 'public',
    });

    return url;
  } catch (error) {
    console.error('[v0] Failed to store image in Blob:', error);
    return null;
  }
}

// Scrape with static HTML (cheerio)
async function scrapeStatic(url: string, retailerConfig: any): Promise<ScrapedData> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    });

    if (!response.ok) {
      return {
        price: null,
        title: null,
        imageUrl: null,
        error: `Failed to fetch page (${response.status})`,
      };
    }

    const html = await response.text();

    const price = extractPrice(html, retailerConfig.price_selector);
    const title = extractTitle(html, retailerConfig.title_selector);
    const imageUrl = extractImageUrl(html, retailerConfig.image_selector, url);

    return {
      price,
      title,
      imageUrl,
      error: price === null ? 'Could not extract price from page' : null,
    };
  } catch (error) {
    return {
      price: null,
      title: null,
      imageUrl: null,
      error: `Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Scrape with Puppeteer (for JS-heavy sites)
async function scrapeBrowser(url: string, retailerConfig: any): Promise<ScrapedData> {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
      ],
    });

    const page = await browser.newPage();
    
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': url.split('/').slice(0, 3).join('/'),
    });

    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(15000);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    } catch (error) {
      console.log('[v0] Navigation timeout, continuing with partial page load');
    }

    if (retailerConfig.price_selector) {
      try {
        await page.waitForSelector(retailerConfig.price_selector, { timeout: 8000 });
      } catch {
        console.log('[v0] Price selector not found, trying alternative methods');
      }
    }

    const pageContent = await page.content();

    const price = extractPrice(pageContent, retailerConfig.price_selector);
    const title = extractTitle(pageContent, retailerConfig.title_selector);
    const imageUrl = extractImageUrl(pageContent, retailerConfig.image_selector, url);

    if (price === null && title === null) {
      return {
        price: null,
        title: null,
        imageUrl: null,
        error: 'The website may have blocked automated access. Please try a different product or retailer.',
      };
    }

    return {
      price,
      title,
      imageUrl,
      error: price === null ? 'Could not extract price from page. The website structure may have changed.' : null,
    };
  } catch (error) {
    console.log('[v0] Browser scraping error:', error);
    return {
      price: null,
      title: null,
      imageUrl: null,
      error: 'The website blocked automated access. This is a common protection used by retailers. Please try a different URL.',
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

// Main scrape function
export async function scrapeUrl(url: string): Promise<ScrapedData> {
  try {
    // Extract domain from URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');

    // Get retailer config
    const retailerConfig = await getRetailerConfig(domain);

    if (!retailerConfig) {
      return {
        price: null,
        title: null,
        imageUrl: null,
        error: 'Retailer not supported. Currently supporting: Amazon, H&M, Zara, Mango, Asos, Cos',
      };
    }

    // Use appropriate scraping method
    const scrapedData = retailerConfig.requires_browser
      ? await scrapeBrowser(url, retailerConfig)
      : await scrapeStatic(url, retailerConfig);

    // Store image in Blob if found
    if (scrapedData.imageUrl && !scrapedData.error) {
      scrapedData.imageUrl = (await storeImageInBlob(scrapedData.imageUrl, url)) || scrapedData.imageUrl;
    }

    return scrapedData;
  } catch (error) {
    return {
      price: null,
      title: null,
      imageUrl: null,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
