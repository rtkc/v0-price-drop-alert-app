-- Add Mango regional variants to support mangooutlet.com and other Mango domains
INSERT INTO retailers (name, domain, requires_browser, price_selector, image_selector, title_selector) VALUES
  ('Mango Outlet', 'mangooutlet.com', TRUE, '.product-price-new', 'img.product-gallery__image', '.product-name-heading'),
  ('Mango US', 'mangous.com', TRUE, '.product-price-new', 'img.product-gallery__image', '.product-name-heading'),
  ('Mango DE', 'mango.com', TRUE, '.product-price-new', 'img.product-gallery__image', '.product-name-heading'),
  ('Mango FR', 'mango.fr', TRUE, '.product-price-new', 'img.product-gallery__image', '.product-name-heading')
ON CONFLICT (domain) DO NOTHING;
