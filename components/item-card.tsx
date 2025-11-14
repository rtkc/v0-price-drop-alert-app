"use client"

import { useState, useEffect } from "react"
import { Trash2, ExternalLink, Clock, AlertTriangle, ImageIcon } from 'lucide-react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/lib/supabase/client"

interface TrackedItem {
  id: string
  name: string
  url: string
  current_price: number | null
  target_price: number | null
  price_drop_threshold: number
  last_price_checked_at: string | null
  created_at: string
  thumbnail_url?: string | null
  retailer_name?: string | null
}

interface ItemCardProps {
  item: TrackedItem
  onDeleted: (id: string) => void
}

export function ItemCard({ item, onDeleted }: ItemCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [priceHistory, setPriceHistory] = useState<any[]>([])
  const [hasError, setHasError] = useState(false)
  const supabase = getSupabaseClient()

  useEffect(() => {
    const fetchPriceHistory = async () => {
      const { data } = await supabase
        .from("price_history")
        .select("*")
        .eq("item_id", item.id)
        .order("checked_at", { ascending: false })
        .limit(5)

      if (data) {
        setPriceHistory(data)
        setHasError(item.current_price === null)
      }
    }

    fetchPriceHistory()
  }, [item.id, item.current_price, supabase])

  const handleDelete = async () => {
    setIsDeleting(true)
    const { error } = await supabase.from("tracked_items").delete().eq("id", item.id)

    if (!error) {
      onDeleted(item.id)
    }
    setIsDeleting(false)
  }

  const priceChange = priceHistory.length > 1 ? priceHistory[0].price - priceHistory[1].price : null

  const formatLastChecked = (timestamp: string | null) => {
    if (!timestamp) return "Never"
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <Card className={`p-4 hover:shadow-md transition-shadow ${hasError ? 'border-yellow-200 bg-yellow-50/50' : ''}`}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate text-sm">{item.name}</h3>
              {item.retailer_name && (
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary flex-shrink-0">
                  {item.retailer_name}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{item.url}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting} className="flex-shrink-0">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {item.thumbnail_url && (
          <div className="w-full h-32 rounded-md bg-muted overflow-hidden flex items-center justify-center">
            <img 
              src={item.thumbnail_url || "/placeholder.svg"} 
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
        )}

        {hasError && (
          <div className="p-3 rounded-md bg-yellow-100 border border-yellow-200 flex gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-700 flex-shrink-0 mt-0.5" />
            <div className="text-yellow-800">
              <p className="font-semibold">Price unavailable</p>
              <p className="text-xs mt-1">We couldn't fetch the price for this item. It may have been removed or the website layout changed.</p>
            </div>
          </div>
        )}

        {/* Prices */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Current Price</p>
            <p className={`text-lg font-bold ${hasError ? 'text-yellow-700' : ''}`}>
              {item.current_price ? `$${item.current_price.toFixed(2)}` : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Target Price</p>
            <p className="text-lg font-bold">{item.target_price ? `$${item.target_price.toFixed(2)}` : "Not set"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
          <Clock className="h-3 w-3" />
          <span>Last checked: {formatLastChecked(item.last_price_checked_at)}</span>
        </div>

        {/* Price Change */}
        {priceChange !== null && !hasError && (
          <div className={`text-sm font-semibold ${priceChange < 0 ? "text-green-600" : "text-red-600"}`}>
            {priceChange < 0 ? "↓" : "↑"} ${Math.abs(priceChange).toFixed(2)} (
            {((priceChange / priceHistory[1].price) * 100).toFixed(1)}%)
          </div>
        )}

        {/* CTA */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-2 bg-transparent" asChild>
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              View
            </a>
          </Button>
        </div>
      </div>
    </Card>
  )
}
