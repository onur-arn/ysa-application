"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const THRESHOLD = 72   // px to pull before triggering refresh
const MAX_PULL  = 96   // max visual distance

export function usePullToRefresh() {
  const router = useRouter()
  const [pull, setPull]             = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let startY    = 0
    let active    = false

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0) return
      startY = e.touches[0].clientY
      active = true
    }

    function onTouchMove(e: TouchEvent) {
      if (!active || refreshing) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0) { setPull(0); return }
      const clamped = Math.min(dy * 0.45, MAX_PULL)
      setPull(clamped)
    }

    function onTouchEnd() {
      if (!active) return
      active = false
      setPull((current) => {
        if (current >= THRESHOLD && !refreshing) {
          setRefreshing(true)
          router.refresh()
          setTimeout(() => {
            setRefreshing(false)
            setPull(0)
          }, 1200)
          return MAX_PULL
        }
        return 0
      })
    }

    window.addEventListener("touchstart",  onTouchStart,  { passive: true })
    window.addEventListener("touchmove",   onTouchMove,   { passive: true })
    window.addEventListener("touchend",    onTouchEnd,    { passive: true })
    window.addEventListener("touchcancel", onTouchEnd,    { passive: true })

    return () => {
      window.removeEventListener("touchstart",  onTouchStart)
      window.removeEventListener("touchmove",   onTouchMove)
      window.removeEventListener("touchend",    onTouchEnd)
      window.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [refreshing, router])

  return { pull, refreshing }
}
