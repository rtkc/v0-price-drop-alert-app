# Implementation Plan: Auto-Check Price & Add Metadata on Item Creation

## Current System Analysis

### How It Works Now:
1. **Add Item Flow** (`AddItemDialog`):
   - User submits URL, name, target price
   - Item is inserted into `tracked_items` with `current_price: null`
   - Dialog closes immediately
   - No price checking happens until the cron job runs (twice daily)

2. **Price Checking** (`/api/cron/check-prices`):
   - Runs on a schedule (12 AM & 12 PM UTC)
   - Fetches HTML from URL using basic regex to extract prices
   - Basic price extraction: looks for `$123.45` patterns
   - Creates price history records and alerts on drops

3. **Display** (`ItemCard`):
   - Shows current price from database
   - Shows last checked time
   - Shows price history and change percentage

### Current Limitations:
- No image/thumbnail stored
- No retailer name detected
- Current price is `null` until cron runs (bad UX)
- Price extraction is basic regex (fragile, unreliable)
- No metadata about the product

---

## Proposed Solution

### Features to Add:

#### 1. **Immediate Price Check on Item Add**
- Call price-checking logic right after insert
- Return price, image, retailer name
- Update the item with these values
- Show result to user immediately

#### 2. **Extract Product Metadata**
- **Product Image**: Extract OG image (`og:image` meta tag)
- **Retailer Name**: Extract domain name (amazon.com → "Amazon")
- **Product Title**: Use HTML title or OG title if available

#### 3. **Improved Price Extraction**
- Use OG price meta tag (`og:price`)
- Look for structured data (Schema.org JSON-LD)
- Fall back to regex if needed

#### 4. **Database Schema Updates**
- Add `thumbnail_image_url` column to `tracked_items`
- Add `retailer_name` column to `tracked_items`
- Add `is_active` column (already exists in cron)

#### 5. **API Enhancement**
- Create new `/api/items/check-price` endpoint
- Reusable price extraction function
- Returns: `{ price, imageUrl, retailerName, title }`

---

## Implementation Approach

### Option A: Synchronous (Simple but Slower)
\`\`\`
User adds item
  ↓
Insert into DB
  ↓
Fetch price/image (in modal - user waits)
  ↓
Update DB with metadata
  ↓
Close dialog & show results
\`\`\`

**Pros**: Simple, immediate feedback
**Cons**: User waits 2-5 seconds, poor UX if URL is slow

### Option B: Asynchronous (Better UX)
\`\`\`
User adds item
  ↓
Insert into DB (current_price: null)
  ↓
Close dialog immediately
  ↓
Background: Fetch price/image in separate API call
  ↓
Update DB with results
  ↓
UI auto-refreshes (polling or real-time subscription)
\`\`\`

**Pros**: Fast, responsive
**Cons**: More complex, requires real-time updates

### Recommendation: **Hybrid Approach**
- Show loading state dialog while fetching
- Timeout after 3 seconds → insert with null price
- Background job continues fetching image & retailer
- UI updates when done (use SWR polling)

---

## What Could Go Wrong?

### 🔴 Critical Issues:

1. **Timeout Issues**
   - Some websites slow to respond (10+ seconds)
   - Fetch timeout needed to prevent hanging
   - Risk: User waits forever

2. **CORS / Bot Protection**
   - Some sites block requests (Cloudflare, bot detection)
   - `User-Agent` header helps but not guaranteed
   - Risk: Fail silently, no price extracted

3. **Meta Tag Extraction Failure**
   - Not all sites have `og:image` or `og:price`
   - Different sites use different meta tags
   - Risk: Missing image/price for many sites

4. **Image URL Expiration**
   - Some sites use temporary signed URLs for images
   - Images stored in DB might break after days/weeks
   - Risk: Broken images in UI

5. **Rate Limiting**
   - Fetching images for every new item adds load
   - Shared fetch quota across all users
   - Risk: API gets rate limited

### ⚠️ Moderate Issues:

6. **Structured Data Parsing**
   - Different sites use different Schema.org implementations
   - JSON-LD parsing is fragile
   - Risk: Inconsistent data extraction

7. **Domain Extraction Ambiguity**
   - "amazon.co.uk" vs "Amazon" vs "Amazon UK"
   - Need mapping table
   - Risk: Confusing retailer names

8. **Price Currency Detection**
   - Different currencies ($, £, €)
   - Regional pricing
   - Risk: Storing prices in wrong format

---

## Critical Questions for You:

### 1. **User Experience - How Long Should We Wait?**
   - Should user wait for image/price (blocking)?
   - Or close dialog immediately (async)?
   - Max timeout: 3 seconds, 5 seconds, 10 seconds?

### 2. **Image Storage**
   - Store as URL reference (external images, might break)
   - Download & store in Vercel Blob Storage?
   - Use Vercel's image optimization service?
   - Size/limit concerns?

### 3. **Website Support Priority**
   - Should we support ANY website or focus on major retailers?
   - Major retailers: Amazon, Walmart, Best Buy, eBay, etc.
   - Risk: Generic approach vs. specific integrations

### 4. **Error Handling**
   - If we can't extract price, should we:
     - Block the add (require user to specify)?
     - Allow but show warning?
     - Add price later from cron?

### 5. **Retailer Name Mapping**
   - Should we maintain a mapping of domain → retailer name?
   - Or just use domain name as-is?
   - Need database table for this?

### 6. **Fallback Strategy**
   - If meta tags unavailable, use first image on page?
   - If no price found, auto-detect from content?
   - Or leave blank and let cron fix it?

---

## Proposed Data Flow

\`\`\`
ADD ITEM REQUEST
  ↓
1. Validate URL format
2. Insert into DB (current_price: null, thumbnail: null, retailer: null)
3. Immediately call price extraction API
   ├─ Fetch URL with timeout (3-5 seconds)
   ├─ Extract: og:image, og:price, title, domain
   ├─ Return: { price, imageUrl, retailerName, title }
   └─ If timeout → return { price: null, imageUrl: null, ... }
4. Update DB with extracted metadata
5. Return item to client
6. Client re-renders with metadata
  ↓
RESULT
- Item displayed immediately with image & price
- Retailer name shown
- Even if extraction partially failed, item is added
\`\`\`

---

## Proposed Schema Changes

\`\`\`sql
ALTER TABLE tracked_items ADD COLUMN IF NOT EXISTS thumbnail_image_url TEXT;
ALTER TABLE tracked_items ADD COLUMN IF NOT EXISTS retailer_name TEXT;
ALTER TABLE tracked_items ADD COLUMN IF NOT EXISTS product_title TEXT;
\`\`\`

---

## Files to Create/Modify

### New Files:
- `/lib/metadata-extractor.ts` - Price/image/retailer extraction logic
- `/app/api/items/extract-metadata/route.ts` - API endpoint

### Modified Files:
- `/components/add-item-dialog.tsx` - Add loading state, call extraction API
- `/components/item-card.tsx` - Display image & retailer name
- `/scripts/add-columns-v4.sql` - Add new columns to DB

---

## Next Steps

1. Answer the 6 critical questions above
2. Choose sync vs. async approach
3. Decide on timeout duration
4. Review the implementation plan
5. Start building!
