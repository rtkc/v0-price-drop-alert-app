# Implementation Plan: Auto-Check Price & Add Metadata (FINAL)

## Your Requirements Summary

✅ **UX**: Close dialog immediately, fetch in background  
✅ **Image Storage**: Download and store in Vercel Blob Storage  
✅ **Website Support**: Amazon, H&M, Zara, Mango, Asos, Cos (+ generic fallback)  
✅ **Error Handling**: Show warning "Apologies, we cannot fetch the price of this item." with explanation  
✅ **Retailer Names**: Display as "Amazon" (not amazon.com) with database mapping  
✅ **Timeout**: Wait longer (10 seconds max)  
✅ **JavaScript Support**: Use headless browser (Puppeteer) for JS-heavy sites (Zara, Mango, Asos)  

---

## Proposed Architecture

### Step 1: User Adds Item
\`\`\`
User submits: https://www.zara.com/productpage/B123456789
↓
Validate URL format
↓
Insert into DB (current_price: null, thumbnail: null, retailer: null, extraction_status: 'pending')
↓
Dialog closes immediately ← USER SEES INSTANT FEEDBACK
\`\`\`

### Step 2: Background Metadata Extraction (Asynchronous)
\`\`\`
Trigger: POST /api/items/extract-metadata with { itemId, url }
↓
Determine retailer type:
  - Static site (Amazon, H&M, Cos)? → Use fetch + DOM parsing
  - JS-heavy site (Zara, Mango, Asos)? → Use Puppeteer headless browser
↓
Extract metadata with 10 second timeout:
  - og:price, og:image, og:title
  - OR Schema.org JSON-LD productPrice, image, name
  - Fallback to regex price matching
↓
Download image:
  - If image found → Download to memory
  - Upload to Vercel Blob Storage → Get permanent URL
  - Store Blob URL in DB
↓
Update DB with:
  - current_price (or null if failed)
  - thumbnail_image_url (Blob URL or null)
  - retailer_name (from mapping table)
  - product_title
  - extraction_status: 'success' | 'partial' | 'failed'
  - last_checked_at
↓
If extraction fails:
  - Store extraction_status = 'failed'
  - Next UI refresh shows warning with reason
\`\`\`

### Step 3: Real-Time UI Updates
\`\`\`
Client uses SWR to poll item data
↓
When metadata arrives, ItemCard updates with:
  - Thumbnail image
  - Retailer badge
  - Current price
  - Last checked time
  - Warning message if extraction_status = 'failed'
\`\`\`

---

## Supported Retailers

| Retailer | Domain | Type | Price Source | Image Source |
|----------|--------|------|---|---|
| Amazon | amazon.com | Static | og:price | og:image |
| H&M | hm.com | Static | JSON-LD | og:image |
| Zara | zara.com | **JS-heavy** | **Puppeteer** | **Puppeteer** |
| Mango | mango.com | **JS-heavy** | **Puppeteer** | **Puppeteer** |
| Asos | asos.com | **JS-heavy** | **Puppeteer** | **Puppeteer** |
| Cos | cosstores.com | Static | JSON-LD | og:image |
| Generic | any site | Static | Regex / Meta | og:image |

### Retailer Mapping (Database Table)
\`\`\`
retailers table:
- id: UUID
- domain_pattern: TEXT (e.g., "amazon.com", "zara.com")
- display_name: TEXT (e.g., "Amazon", "Zara")
- uses_headless_browser: BOOLEAN
- extraction_notes: TEXT
\`\`\`

---

## Database Changes

\`\`\`sql
-- Add new columns to tracked_items
ALTER TABLE tracked_items ADD COLUMN IF NOT EXISTS thumbnail_image_url TEXT;
ALTER TABLE tracked_items ADD COLUMN IF NOT EXISTS retailer_name TEXT;
ALTER TABLE tracked_items ADD COLUMN IF NOT EXISTS product_title TEXT;
ALTER TABLE tracked_items ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending';
ALTER TABLE tracked_items ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP;

-- Create retailers mapping table
CREATE TABLE IF NOT EXISTS retailers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_pattern TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  uses_headless_browser BOOLEAN DEFAULT false,
  extraction_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert initial retailers
INSERT INTO retailers (domain_pattern, display_name, uses_headless_browser) VALUES
  ('amazon.com', 'Amazon', false),
  ('hm.com', 'H&M', false),
  ('zara.com', 'Zara', true),
  ('mango.com', 'Mango', true),
  ('asos.com', 'Asos', true),
  ('cosstores.com', 'Cos', false);
\`\`\`

---

## Files to Create/Modify

### New Files:
1. **`/lib/metadata-extractor.ts`** - Core extraction logic with retailer-specific handlers
2. **`/lib/headless-browser.ts`** - Puppeteer setup for JS-heavy sites
3. **`/app/api/items/extract-metadata/route.ts`** - Background API endpoint (called after item creation)
4. **`/scripts/add-metadata-columns-v6.sql`** - Schema migration with retailers table
5. **`/lib/blob-storage.ts`** - Vercel Blob utilities for image download/upload

### Modified Files:
1. **`/components/add-item-dialog.tsx`** - After insert, immediately close dialog and trigger background API call
2. **`/components/item-card.tsx`** - Display thumbnail, retailer name, warning if extraction failed
3. **`/app/dashboard/page.tsx`** - Use SWR to refresh items every 2 seconds while extraction is pending

---

## Technical Implementation Strategy

### Metadata Extractor (`/lib/metadata-extractor.ts`)
\`\`\`
extractMetadata(url, retailerName):
  1. Determine if JS-heavy site
  2. If static: fetch with proper User-Agent → parse HTML → extract via og:meta or JSON-LD
  3. If JS-heavy: use Puppeteer → wait for content load → extract price/image
  4. Download image to Blob
  5. Return { price, imageUrl, title, status }
\`\`\`

### Headless Browser (`/lib/headless-browser.ts`)
\`\`\`
- Use Puppeteer with Chromium
- Set timeout to 10 seconds
- Wait for price selector to appear
- Return rendered HTML
- Close browser session
\`\`\`

### Background API (`/app/api/items/extract-metadata/route.ts`)
\`\`\`
POST /api/items/extract-metadata
Body: { itemId, url }
- Extract metadata
- Download/upload image
- Update DB
- Return status
\`\`\`

### Image Upload (`/lib/blob-storage.ts`)
\`\`\`
uploadImageToBlob(imageBuffer, fileName):
- Download image as Buffer
- Upload to Vercel Blob with public URL
- Return permanent Blob URL
\`\`\`

---

## Error Handling & Warnings

### Failure Scenarios:
| Scenario | Status | User Message |
|----------|--------|---|
| Price found, image not found | `partial` | Show price, no image |
| Price not found, image found | `partial` | Show image with warning |
| Neither price nor image found | `failed` | "Apologies, we cannot fetch the price of this item. This could be because the website blocks automated access or the product page is not publicly available." |
| URL invalid/unreachable | `failed` | "Apologies, we cannot fetch the price of this item. The URL might be invalid or the website is temporarily unavailable." |
| Timeout (>10s) | `failed` | "Apologies, we cannot fetch the price of this item. The website took too long to respond." |

### User Cannot:
- ❌ Manually enter price
- ❌ Skip warning
- ✅ Can delete item and try different URL
- ✅ Can try again later (manual price check via admin)

---

## Potential Risks & Mitigations

### ❌ Risk 1: CORS & Bot Detection
**Problem**: Cloudflare, bot detection blocks requests  
**Mitigation**: 
- Server-side fetch with proper User-Agent header
- Respect rate limits with exponential backoff
- Monitor failures and skip blocked sites

### ❌ Risk 2: Puppeteer Costs
**Problem**: JS rendering is slow (3-5s per page) and resource-intensive  
**Mitigation**:
- Only use for JS-heavy sites (Zara, Mango, Asos)
- Cache results for 24 hours
- Consider timeout management

### ❌ Risk 3: Image URLs Expire
**Problem**: Signed URLs expire after days  
**Mitigation**:
- Download to Blob Storage immediately
- Store permanent Blob URL

### ❌ Risk 4: Blob Storage Quota
**Problem**: Many images could exceed Blob storage limits  
**Mitigation**:
- Monitor Blob usage
- Set image size limits (compress if needed)
- Clean up old images periodically

### ✅ Risk 5: Partial Failures
**Problem**: Price extraction fails but image works (or vice versa)  
**Mitigation**:
- `extraction_status` field tracks what succeeded/failed
- Show partial data + warning
- User can still use the app

---

## Performance Considerations

| Operation | Time | Impact |
|-----------|------|--------|
| Static site extraction | ~1-2 seconds | Fast, good UX |
| JS-heavy extraction (Puppeteer) | ~3-5 seconds | Slower, visible loading |
| Image download + Blob upload | ~1-2 seconds | Depends on image size |
| **Total for JS site** | **~5-7 seconds** | Acceptable with background processing |

**UX Impact**: User adds item → Dialog closes immediately → Item appears in list as "Loading..." → Updates to show price/image in 5-7 seconds

---

## Implementation Order

1. **Phase 1**: Database schema + Retailers table
2. **Phase 2**: Static site extractor (Amazon, H&M, Cos)
3. **Phase 3**: Image download + Vercel Blob integration
4. **Phase 4**: Background API endpoint
5. **Phase 5**: Add dialog integration (trigger background fetch)
6. **Phase 6**: UI updates (warning messages, loading states)
7. **Phase 7**: Puppeteer integration (JS-heavy sites)

---

## Dependencies to Add

\`\`\`json
{
  "puppeteer": "^21.0.0",
  "@vercel/blob": "^0.20.0",
  "cheerio": "^1.0.0-rc.12"
}
\`\`\`

- **puppeteer**: Headless browser for JS-heavy sites
- **@vercel/blob**: Image storage in Vercel Blob
- **cheerio**: Fast HTML parsing for static sites

---

## Ready to Build?

✅ All requirements clarified  
✅ Architecture designed  
✅ Error handling defined  
✅ Database schema planned  

**Next**: Should I start building Phase 1-2? Or do you have more questions?
