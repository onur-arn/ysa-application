"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

function msUntilMidnight(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  return midnight.getTime() - now.getTime()
}

export function useMidnightLogout() {
  const router = useRouter()

  useEffect(() => {
    const ms = msUntilMidnight()

    const timer = setTimeout(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push("/auth/login")
    }, ms)

    return () => clearTimeout(timer)
  }, [router])
}
