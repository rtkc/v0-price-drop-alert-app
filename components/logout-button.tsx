"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/lib/supabase/client"

export function LogoutButton() {
  const router = useRouter()
  const supabase = getSupabaseClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <Button variant="outline" onClick={handleLogout}>
      Sign Out
    </Button>
  )
}
