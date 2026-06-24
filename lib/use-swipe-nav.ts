"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

const SWIPE_THRESHOLD = 55   // px horizontal movement required
const VERTICAL_LIMIT  = 35   // max vertical drift to still count as horizontal

// Left swipe = navigate to page on the left in the bottom nav
// Right swipe = navigate to page on the right in the bottom nav
const SWIPE_MAP: Record<string, { left: string; right: string }> = {
  "/feed": { left: "/messages", right: "/agenda" },
}

export function useSwipeNav() {
  const router = useRouter()

  useEffect(() => {
    let startX = 0
    let startY = 0
    let active = false

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      active = true
    }

    function onTouchEnd(e: TouchEvent) {
      if (!active) return
      active = false

      const dx = e.changedTouches[0].clientX - startX
      const dy = Math.abs(e.changedTouches[0].clientY - startY)

      // Only clearly horizontal swipes
      if (Math.abs(dx) < SWIPE_THRESHOLD || dy > VERTICAL_LIMIT) return

      const pathname = window.location.pathname
      const mapping = SWIPE_MAP[pathname]
      if (!mapping) return

      if (dx < 0) {
        router.push(mapping.left)
      } else {
        router.push(mapping.right)
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchend",   onTouchEnd,   { passive: true })

    return () => {
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchend",   onTouchEnd)
    }
  }, [router])
}
