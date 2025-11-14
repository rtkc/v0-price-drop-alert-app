"use client"

import { useEffect, useState } from "react"
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { ItemCard } from "@/components/item-card"
import { AddItemDialog } from "@/components/add-item-dialog"
import { LogoutButton } from "@/components/logout-button"

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

export default function DashboardPage() {
  const [items, setItems] = useState<TrackedItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = getSupabaseClient()

  useEffect(() => {
    const loadData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/login")
        return
      }

      setUser(session.user)

      // Fetch tracked items
      const { data, error } = await supabase
        .from("tracked_items")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })

      if (!error && data) {
        setItems(data)
      }

      setIsLoading(false)
    }

    loadData()
  }, [supabase, router])

  const handleItemAdded = (newItem: TrackedItem | null) => {
    if (newItem) {
      setItems([newItem, ...items])
    } else {
      // Refresh the entire list when item was added but we want fresh data
      const loadData = async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          const { data, error } = await supabase
            .from("tracked_items")
            .select("*")
            .eq("user_id", session.user.id)
            .order("created_at", { ascending: false })

          if (!error && data) {
            setItems(data)
          }
        }
      }
      loadData()
    }
  }

  const handleItemDeleted = (itemId: string) => {
    setItems(items.filter((item) => item.id !== itemId))
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Loading your items...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Price Tracker</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <LogoutButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Add Item Section */}
        <div className="mb-8">
          <AddItemDialog onItemAdded={handleItemAdded} />
        </div>

        {/* Items List */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Your Tracked Items</h2>
          {items.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No items tracked yet. Add your first item to get started!</p>
              <AddItemDialog onItemAdded={handleItemAdded} />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} onDeleted={handleItemDeleted} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
