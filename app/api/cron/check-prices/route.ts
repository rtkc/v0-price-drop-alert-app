import { NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { scrapeUrl } from "@/lib/scraper"

export const maxDuration = 300; // Allow up to 5 minutes for all items

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("[v0] CRON_SECRET environment variable not set")
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    )
  }

  // Verify the secret matches (supports both "Bearer SECRET" and query param)
  const headerSecret = authHeader?.replace("Bearer ", "")
  const querySecret = request.nextUrl.searchParams.get("secret")
  const isValidSecret = headerSecret === cronSecret || querySecret === cronSecret

  if (!isValidSecret) {
    console.error("[v0] Invalid CRON_SECRET provided")
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  try {
    const supabase = await getSupabaseServerClient()

    const { data: items, error: itemsError } = await supabase
      .from("tracked_items")
      .select("id, user_id, url, current_price, target_price, retailer_name")

    if (itemsError) throw itemsError

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No items to check",
        checkedCount: 0,
      })
    }

    let checkedCount = 0
    let priceDropsDetected = 0
    const errors: string[] = []

    // Check price for each item
    for (const item of items) {
      try {
        const scrapedData = await scrapeUrl(item.url)

        if (scrapedData.error || scrapedData.price === null) {
          console.log(`[v0] Could not extract price from ${item.url}: ${scrapedData.error}`)
          errors.push(`${item.retailer_name || 'Item'}: ${scrapedData.error}`)
          continue
        }

        const price = scrapedData.price
        checkedCount++

        // Store price history
        const { error: historyError } = await supabase
          .from("price_history")
          .insert({
            item_id: item.id,
            price,
            checked_at: new Date().toISOString(),
          })

        if (historyError) {
          console.error(`[v0] Error storing price history: ${historyError.message}`)
          continue
        }

        // Check if price dropped
        const oldPrice = item.current_price
        const priceDrop = oldPrice ? oldPrice - price : 0

        const updateData: any = {
          current_price: price,
          last_price_checked_at: new Date().toISOString(),
        }

        // Update thumbnail if we scraped a new one
        if (scrapedData.imageUrl) {
          updateData.thumbnail_url = scrapedData.imageUrl
        }

        const { error: updateError } = await supabase
          .from("tracked_items")
          .update(updateData)
          .eq("id", item.id)

        if (updateError) {
          console.error(`[v0] Error updating item: ${updateError.message}`)
        }

        if (priceDrop > 0) {
          priceDropsDetected++

          // Create alert for price drop
          const dropPercentage = oldPrice ? ((priceDrop / oldPrice) * 100).toFixed(1) : "N/A"

          const { error: alertError } = await supabase
            .from("price_alerts")
            .insert({
              item_id: item.id,
              old_price: oldPrice,
              new_price: price,
              price_drop_percent: parseFloat(dropPercentage as string),
            })

          if (alertError) {
            console.error(`[v0] Error creating alert: ${alertError.message}`)
          }

          console.log(
            `[v0] Price drop detected for item ${item.id}: $${oldPrice} → $${price}`
          )
        }
      } catch (itemError) {
        console.error(`[v0] Error checking price for item ${item.id}:`, itemError)
        errors.push(`Item ${item.id}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Price check completed",
      checkedCount,
      priceDropsDetected,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[v0] Cron job error:", error)
    return NextResponse.json(
      {
        error: "Price check failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
