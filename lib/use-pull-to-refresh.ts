"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

const THRESHOLD          = 72   // px to pull before triggering refresh
const MAX_PULL           = 96   // max visual distance
const DIRECTION_LOCK_PX  = 10   // pixels moved before locking direction

export function usePullToRefresh() {
  const router = useRouter()
  const [pull, setPull]             = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let startY             = 0
    let startX             = 0
    let active             = false
    let directionLocked    = false
    let isVerticalDown     = false

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0) return
      startY          = e.touches[0].clientY
      startX          = e.touches[0].clientX
      active          = true
      directionLocked = false
      isVerticalDown  = false
    }

    function onTouchMove(e: TouchEvent) {
      if (!active || refreshing) return

      const dy = e.touches[0].clientY - startY
      const dx = e.touches[0].clientX - startX

      // Determine direction once we have enough movement
      if (!directionLocked) {
        if (Math.abs(dy) < DIRECTION_LOCK_PX && Math.abs(dx) < DIRECTION_LOCK_PX) return
        directionLocked = true

        // Horizontal swipe or initial scroll-up: cancel this gesture
        if (Math.abs(dx) >= Math.abs(dy) || dy < 0) {
          active = false
          return
        }

        isVerticalDown = true
      }

      if (!isVerticalDown) return

      if (dy <= 0) { setPull(0); return }
      const clamped = Math.min(dy * 0.45, MAX_PULL)
      setPull(clamped)
    }

    function onTouchEnd() {
      if (!active) return
      active          = false
      directionLocked = false
      isVerticalDown  = false

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
