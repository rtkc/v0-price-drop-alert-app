'use client'

import type React from 'react'

import { useEffect, useState } from 'react'
import { Plus, X, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { createTrackedItem } from '@/app/actions/items'
import { getSupabaseClient } from '@/lib/supabase/client'

interface AddItemDialogProps {
  onItemAdded: (item: any) => void
}

export function AddItemDialog({ onItemAdded }: AddItemDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [url, setUrl] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [scrapingStatus, setScrapingStatus] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = getSupabaseClient()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.user?.id) {
        setUserId(session.user.id)
      }
    }
    getUser()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setWarning('')
    setScrapingStatus('')
    setIsLoading(true)

    try {
      try {
        new URL(url)
      } catch {
        setError('Invalid URL format')
        setIsLoading(false)
        return
      }

      setScrapingStatus('Fetching product details...')

      const result = await createTrackedItem(
        url,
        targetPrice ? parseFloat(targetPrice) : undefined,
        userId || undefined
      )

      if (!result.success) {
        if (result.warning) {
          setWarning(result.error)
          setScrapingStatus('')
          // Still close dialog and refresh items since item was created
          setUrl('')
          setTargetPrice('')
          setIsOpen(false)
          onItemAdded(null) // Trigger refresh
        } else {
          setError(result.error || 'Failed to add item')
          setScrapingStatus('')
        }
      } else {
        setScrapingStatus('')
        setUrl('')
        setTargetPrice('')
        setIsOpen(false)
        onItemAdded(result.item)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setScrapingStatus('')
    } finally {
      setIsLoading(false)
    }
  }

  if (isOpen) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Add New Item</h3>
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-muted rounded" disabled={isLoading}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Product URL</label>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://amazon.com/dp/..."
              required
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Supported: Amazon, H&M, Zara, Mango, Asos, Cos
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Target Price (optional)</label>
            <Input
              type="number"
              step="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="e.g., 199.99"
              disabled={isLoading}
            />
          </div>

          {scrapingStatus && (
            <div className="p-3 rounded bg-blue-50 text-blue-700 text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {scrapingStatus}
            </div>
          )}

          {error && (
            <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {warning && (
            <div className="p-3 rounded bg-yellow-100 border border-yellow-200 flex gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-yellow-700 flex-shrink-0 mt-0.5" />
              <div className="text-yellow-800">
                <p className="font-semibold">Item added, but price couldn't be fetched</p>
                <p className="text-xs mt-1">{warning}</p>
                <p className="text-xs mt-2">The item has been added to your list. We'll continue trying to fetch the price automatically.</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setIsOpen(false)
                setError('')
                setWarning('')
              }} 
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Add Item'
              )}
            </Button>
          </div>
        </form>
      </Card>
    )
  }

  return (
    <Button onClick={() => setIsOpen(true)} size="lg" className="gap-2">
      <Plus className="h-5 w-5" />
      Add Item to Track
    </Button>
  )
}
