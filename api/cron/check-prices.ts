import { neon } from "@neondatabase/serverless"

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const sql = neon(process.env.DATABASE_URL || "")

  try {
    // Get all tracked items
    const items = await sql`
      SELECT id, url, current_price, user_id FROM tracked_items
    `

    for (const item of items) {
      try {
        // Fetch current price from URL (basic meta tag extraction)
        const response = await fetch(item.url, {
          headers: {
            "User-Agent": "Mozilla/5.0",
          },
        })
        const html = await response.text()

        // Extract price from common meta tags
        let price: number | null = null
        const priceMatch = html.match(/(?:price|amount)['":\s]+['"]?(\d+\.?\d*)/i)
        if (priceMatch) {
          price = Number.parseFloat(priceMatch[1])
        }

        if (price !== null) {
          // Store price history
          await sql`
            INSERT INTO price_history (item_id, price)
            VALUES (${item.id}, ${price})
          `

          // Check if price dropped
          if (item.current_price && price < item.current_price) {
            const priceDropPercent = ((item.current_price - price) / item.current_price) * 100

            // Create alert
            await sql`
              INSERT INTO price_alerts (item_id, old_price, new_price, price_drop_percent)
              VALUES (${item.id}, ${item.current_price}, ${price}, ${priceDropPercent})
            `
          }

          // Update current price
          await sql`
            UPDATE tracked_items
            SET current_price = ${price}, updated_at = NOW()
            WHERE id = ${item.id}
          `
        }
      } catch (error) {
        console.error(`Error fetching price for item ${item.id}:`, error)
      }
    }

    return new Response(JSON.stringify({ success: true, checked: items.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Price check error:", error)
    return new Response(JSON.stringify({ error: "Failed to check prices" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
