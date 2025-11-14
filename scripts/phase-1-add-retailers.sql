-- Create retailers table for mapping domains to retailer names and scraping rules
CREATE TABLE IF NOT EXISTS retailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL UNIQUE,
  requires_browser BOOLEAN DEFAULT FALSE,
  price_selector TEXT,
  image_selector TEXT,
  title_selector TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add retailer_id and thumbnail_url columns to tracked_items
ALTER TABLE tracked_items ADD COLUMN IF NOT EXISTS retailer_id UUID REFERENCES retailers(id);
ALTER TABLE tracked_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE tracked_items ADD COLUMN IF NOT EXISTS retailer_name TEXT;
ALTER TABLE tracked_items ADD COLUMN IF NOT EXISTS last_price_checked_at TIMESTAMP;

-- Insert default retailers
INSERT INTO retailers (name, domain, requires_browser, price_selector, image_selector, title_selector) VALUES
  ('Amazon', 'amazon.com', FALSE, 'span.a-price-whole', 'img.s-image', 'span.a-size-base-plus'),
  ('H&M', 'hm.com', TRUE, '.productPrice__priceValue', 'img.productImage__img', '.productNameHeader__title'),
  ('Zara', 'zara.com', TRUE, '.product-price__amount', 'img.product-image__img', '.product-name'),
  ('Mango', 'mango.com', TRUE, '.product-price-new', 'img.product-gallery__image', '.product-name-heading'),
  ('Asos', 'asos.com', TRUE, 'span[data-bind*="price"]', 'img.productImage', 'h1.productTitle'),
  ('Cos', 'cosstores.com', FALSE, '.product-price', 'img.product-image', 'h1.product-name')
ON CONFLICT (name) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_retailers_domain ON retailers(domain);
CREATE INDEX IF NOT EXISTS idx_tracked_items_retailer_id ON tracked_items(retailer_id);
CREATE INDEX IF NOT EXISTS idx_tracked_items_last_checked ON tracked_items(last_price_checked_at);

-- RLS policy for retailers (everyone can read, no one can modify)
ALTER TABLE retailers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Retailers are readable by everyone" ON retailers FOR SELECT USING (TRUE);
