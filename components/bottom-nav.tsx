"use client"

import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/context"
import { motion } from "framer-motion"
import { CalendarDays, Home, ListChecks, MessageCircle, Users } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { prefetchStories } from "@/lib/queries/stories"

const items = [
  { href: "/annuaire",  icon: Users,        key: "nav.directory" },
  { href: "/messages",  icon: MessageCircle, key: "nav.messages"  },
  { href: "/feed",      icon: Home,          key: "nav.feed"      },
  { href: "/agenda",    icon: CalendarDays,  key: "nav.agenda"    },
  { href: "/gorevler",  icon: ListChecks,    key: "nav.tasks"     },
]

export function BottomNav({ hasUnread = false }: { hasUnread?: boolean }) {
  const pathname = usePathname()
  const router   = useRouter()
  const queryClient = useQueryClient()
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
    if (href === "/feed") void prefetchStories(queryClient)
    router.replace(href)
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
      className="fixed bottom-6 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-border/60 bg-card/92 shadow-xl shadow-black/[0.08] backdrop-blur-2xl touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <ul className="flex items-stretch justify-around px-1 py-1">
        {items.map((item) => {
          const active = dragHover !== null
            ? dragHover === item.href
            : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <li key={item.href} className="flex-1" data-href={item.href}>
              <div className="relative flex h-14 flex-col items-center justify-center gap-0.5">
                {active && (
                  <motion.span
                    layoutId="nav-bg"
                    className="absolute inset-x-1 inset-y-1 rounded-xl bg-primary/10"
                    transition={{ type: "spring", stiffness: 800, damping: 32 }}
                  />
                )}
                <div className="relative">
                  <Icon
                    className={cn("h-5 w-5 transition-colors", active ? "text-primary" : "text-muted-foreground/70")}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                  {/* Unread dot — only on messages tab */}
                  {item.href === "/messages" && hasUnread && (
                    <span className="absolute -right-1 -top-1 size-2 rounded-full bg-rose-500" />
                  )}
                </div>
                <span className={cn(
                  "relative text-[9.5px] font-semibold leading-none tracking-wide transition-colors",
                  active ? "text-primary" : "text-muted-foreground/60",
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
