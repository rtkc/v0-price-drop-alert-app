# Price Tracker Integration Testing Guide

## Pre-Testing Checklist

### 1. Database Setup
- [ ] Run `/scripts/phase-1-add-retailers.sql` to create retailers table
- [ ] Run `/scripts/fix-foreign-key-v3.sql` to fix foreign key constraints
- [ ] Verify Supabase is connected and database is accessible

### 2. Environment Variables
- [ ] `CRON_SECRET` is set in Vercel env vars
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is available
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is available
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is available
- [ ] `BLOB_READ_WRITE_TOKEN` is available for image storage

### 3. Dependencies
- [ ] `puppeteer` is installed (for JS-heavy sites)
- [ ] `cheerio` is installed (for HTML parsing)
- [ ] `@vercel/blob` is installed
- [ ] All other dependencies from package.json are installed

---

## Testing Scenarios

### Test 1: User Authentication Flow
**Goal**: Verify signup and login work correctly

**Steps**:
1. Navigate to `http://localhost:3000`
2. Click "Sign Up"
3. Enter email (e.g., `test@example.com`)
4. Enter password (e.g., `Test123456`)
5. Click "Sign Up"
6. Verify redirect to dashboard or verify email prompt
7. Log out
8. Log back in with the same credentials

**Expected Results**:
- ✓ User account created successfully
- ✓ Authenticated user redirected to dashboard
- ✓ User can log out and log back in

---

### Test 2: Add Item with Supported Retailer (Static Site)
**Goal**: Verify adding an Amazon product works end-to-end

**Steps**:
1. Log in to dashboard
2. Click "Add Item to Track"
3. Paste an Amazon product URL (e.g., `https://amazon.com/dp/B0D4WC3VZN`)
4. Set a target price (e.g., `100`)
5. Click "Add Item"
6. Wait for scraping to complete

**Expected Results**:
- ✓ Dialog shows "Fetching product details..." status
- ✓ Item is added to the list with:
  - Product name (auto-extracted)
  - Current price
  - Retailer badge ("Amazon")
  - Product thumbnail image
  - "Last checked: Just now"
- ✓ Dialog closes after 5-10 seconds

---

### Test 3: Add Item with Unsupported Retailer
**Goal**: Verify error handling for unsupported retailers

**Steps**:
1. Log in to dashboard
2. Click "Add Item to Track"
3. Paste a URL from an unsupported retailer (e.g., `https://example-random-store.com/product/123`)
4. Click "Add Item"

**Expected Results**:
- ✓ Error message appears: "Retailer not supported..."
- ✓ Item is NOT added to the list
- ✓ Dialog stays open for user to correct

---

### Test 4: Add Item with Failed Price Extraction
**Goal**: Verify graceful handling when price can't be extracted

**Steps**:
1. Log in to dashboard
2. Click "Add Item to Track"
3. Paste a valid retailer URL but a page where price extraction fails
4. Click "Add Item"

**Expected Results**:
- ✓ Warning message appears: "Item added, but price couldn't be fetched"
- ✓ Item IS added to the list (with `current_price: null`)
- ✓ Item card shows yellow warning banner: "Price unavailable"
- ✓ Dialog closes and list refreshes

---

### Test 5: Add Item with JS-Heavy Retailer (Zara/H&M/Asos)
**Goal**: Verify Puppeteer scraping works for JS-rendered sites

**Steps**:
1. Log in to dashboard
2. Click "Add Item to Track"
3. Paste a Zara URL (e.g., `https://zara.com/us/en/product-name/p00000`)
4. Click "Add Item"
5. Wait 15-20 seconds for Puppeteer to render and scrape

**Expected Results**:
- ✓ Item is successfully added with:
  - Product name
  - Current price
  - "Zara" retailer badge
  - Product thumbnail
  - Last checked time

---

### Test 6: Item Card Display
**Goal**: Verify all item information is displayed correctly

**Steps**:
1. View dashboard with added items
2. Examine each item card

**Expected Results**:
- ✓ Product thumbnail displays correctly
- ✓ Retailer badge shows (e.g., "Amazon", "Zara")
- ✓ Current price displays
- ✓ Target price displays (or "Not set" if empty)
- ✓ "Last checked" time displays relative time (e.g., "5m ago")
- ✓ Price change shows direction (↑ for increase, ↓ for decrease) and percentage
- ✓ Delete button is present and functional

---

### Test 7: Manual Price Check (Cron Testing)
**Goal**: Verify the price checking job works

**Steps**:
1. Add 2-3 items to track
2. Go to `/admin/price-check`
3. Enter your `CRON_SECRET`
4. Click "Trigger Price Check"
5. Wait for results

**Expected Results**:
- ✓ Shows "Successfully checked X items"
- ✓ Shows number of price drops detected
- ✓ Item cards update with new prices
- ✓ "Last checked" time updates to "Just now"
- ✓ Errors are logged (if any)

---

### Test 8: Price Drop Alert
**Goal**: Verify alerts are created when prices drop

**Steps**:
1. Note the current price of an item
2. Wait for the next cron job (or manually trigger)
3. If price decreased, check that an alert was created

**Expected Results**:
- ✓ Price alert created in database
- ✓ Item card shows price change with green color (↓) and percentage
- ✓ Alert shows old price → new price

---

### Test 9: Image Storage in Blob
**Goal**: Verify product images are stored in Vercel Blob

**Steps**:
1. Add an item with a supported retailer
2. Wait for image to download
3. Check Vercel Blob dashboard or app logs

**Expected Results**:
- ✓ Image is stored in Blob storage
- ✓ Image displays on item card
- ✓ Image persists if retailer removes original

---

### Test 10: Delete Item
**Goal**: Verify item deletion works

**Steps**:
1. Click the trash icon on an item card
2. Verify the item is removed from the list

**Expected Results**:
- ✓ Item is deleted from database
- ✓ Item is removed from UI
- ✓ Item no longer appears on refresh

---

## API Testing

### Test Cron API Endpoint

**Request**:
\`\`\`bash
curl -X GET "http://localhost:3000/api/cron/check-prices" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
\`\`\`

**Expected Response**:
\`\`\`json
{
  "success": true,
  "message": "Price check completed",
  "checkedCount": 5,
  "priceDropsDetected": 2,
  "timestamp": "2025-01-15T12:30:00Z"
}
\`\`\`

---

## Debugging Tips

### Issue: "Foreign key constraint" error
- **Solution**: Run `/scripts/fix-foreign-key-v3.sql`

### Issue: Images not displaying
- **Solution**: Check Blob token is valid in Vercel env vars

### Issue: Puppeteer timeout on JS sites
- **Solution**: Increase timeout in `/lib/scraper/index.ts` from 8s to 10-12s

### Issue: Price not extracting from supported retailer
- **Solution**: Check CSS selectors in `retailers` table are correct for current site layout

### Issue: "Retailer not supported" error
- **Solution**: Verify domain is in `retailers` table (e.g., make sure it's `amazon.com`, not `www.amazon.com`)

---

## Performance Benchmarks

| Retailer | Scraping Time | Status |
|----------|---------------|--------|
| Amazon | 2-3s | Static HTML |
| H&M | 8-12s | JS-rendered |
| Zara | 8-12s | JS-rendered |
| Mango | 8-12s | JS-rendered |
| Asos | 10-15s | JS-rendered |
| Cos | 2-3s | Static HTML |

**Note**: JS-rendered sites are slower due to Puppeteer browser rendering. Target is <15s per item.

---

## Deployment Checklist

- [ ] All migrations have been run
- [ ] Environment variables are set in Vercel
- [ ] `vercel.json` has cron schedule configured
- [ ] CRON_SECRET is strong and unique
- [ ] Database RLS policies are enabled
- [ ] Blob storage token is valid
- [ ] Test with real URLs before going live
\`\`\`

Now create a testing utility script:
