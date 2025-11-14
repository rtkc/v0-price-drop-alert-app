"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PriceCheckAdmin() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleManualCheck = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const cronSecret = prompt(
        "Enter CRON_SECRET to manually trigger price check:"
      )
      if (!cronSecret) {
        setError("CRON_SECRET is required")
        setLoading(false)
        return
      }

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

      setResult(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to trigger price check"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Manual Price Check</CardTitle>
            <CardDescription>
              Trigger the price checking job manually for testing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleManualCheck}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Checking..." : "Trigger Price Check"}
            </Button>

            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {result && (
              <div className="bg-green-50 border border-green-200 text-green-900 p-3 rounded-md text-sm space-y-2">
                <p className="font-semibold">✓ Success</p>
                <p>Checked: {result.checkedCount} items</p>
                <p>Price drops detected: {result.priceDropsDetected}</p>
                <p className="text-xs opacity-75">
                  {new Date(result.timestamp).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
