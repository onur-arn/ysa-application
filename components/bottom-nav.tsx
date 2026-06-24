"use client"

import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/context"
import { motion } from "framer-motion"
import { CalendarDays, Home, ListChecks, MessageCircle, Users } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

const items = [
  { href: "/annuaire",  icon: Users,        key: "nav.directory" },
  { href: "/messages",  icon: MessageCircle, key: "nav.messages"  },
  { href: "/feed",      icon: Home,          key: "nav.feed"      },
  { href: "/agenda",    icon: CalendarDays,  key: "nav.agenda"    },
  { href: "/gorevler",  icon: ListChecks,    key: "nav.tasks"     },
]

export function BottomNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const { t }    = useI18n()
  const navRef   = useRef<HTMLElement>(null)
  const [dragHover, setDragHover] = useState<string | null>(null)
  const isDragging      = useRef(false)
  const lastNavigated   = useRef<string | null>(null)

  // Prefetch all routes so the loading skeleton appears instantly
  useEffect(() => {
    items.forEach(item => router.prefetch(item.href))
  }, [router])

  function getHrefAt(clientX: number): string | null {
    if (!navRef.current) return null
    const lis = navRef.current.querySelectorAll<HTMLElement>("[data-href]")
    for (const li of lis) {
      const rect = li.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) {
        return li.dataset.href ?? null
      }
    }
    return null
  }

  function navigateTo(href: string) {
    if (href === lastNavigated.current) return
    lastNavigated.current = href
    router.push(href)
  }

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    isDragging.current = true
    lastNavigated.current = null
    // Capture pointer so moves outside nav are still tracked
    navRef.current?.setPointerCapture(e.pointerId)
    const href = getHrefAt(e.clientX)
    if (href) {
      setDragHover(href)
      navigateTo(href)
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLElement>) {
    if (!isDragging.current) return
    const href = getHrefAt(e.clientX)
    if (href) {
      setDragHover(href)
      navigateTo(href)
    } else {
      setDragHover(null)
    }
  }

  function onPointerUp() {
    isDragging.current = false
    lastNavigated.current = null
    setDragHover(null)
  }

  return (
    <nav
      ref={navRef}
      data-no-pull-refresh
      className="fixed bottom-8 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-border bg-card/95 shadow-lg backdrop-blur-lg touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <ul className="flex items-stretch justify-around px-2 pt-1.5">
        {items.map((item) => {
          const active = dragHover !== null
            ? dragHover === item.href
            : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <li key={item.href} className="flex-1" data-href={item.href}>
              <div className="relative flex h-14 flex-col items-center justify-center gap-1">
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute -top-px h-1 w-8 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 900, damping: 30 }}
                  />
                )}
                <Icon
                  className={cn("h-6 w-6 transition-colors", active ? "text-primary" : "text-muted-foreground")}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span className={cn(
                  "text-[10px] font-medium leading-none transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}>
                  {t(item.key)}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
