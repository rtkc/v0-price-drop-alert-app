/**
 * Helper function to manually trigger the price check cron job
 * Used for testing or manual price updates
 */
export async function triggerPriceCheck(cronSecret: string) {
  try {
    const response = await fetch("/api/cron/check-prices", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Price check failed")
    }

    return data
  } catch (error) {
    console.error("[v0] Failed to trigger price check:", error)
    throw error
  }
}
