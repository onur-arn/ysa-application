"use client"

import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/context"
import { motion } from "framer-motion"
import { CalendarDays, Home, ListChecks, MessageCircle, Users } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const items = [
  { href: "/annuaire", icon: Users, key: "nav.directory" },
  { href: "/messages", icon: MessageCircle, key: "nav.messages" },
  { href: "/feed", icon: Home, key: "nav.feed" },
  { href: "/agenda", icon: CalendarDays, key: "nav.agenda" },
  { href: "/gorevler", icon: ListChecks, key: "nav.tasks" },
]

export function BottomNav() {
  const pathname = usePathname()
  const { t } = useI18n()

  return (
    <nav className="fixed inset-x-0 bottom-2 z-40 mx-auto w-full max-w-md border-t border-border bg-card/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
      <ul className="flex items-stretch justify-around px-2 pt-1.5">
        {items.map((item) => {
          const active = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className="relative flex h-14 flex-col items-center justify-center gap-1"
                aria-current={active ? "page" : undefined}
              >
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
                <span
                  className={cn(
                    "text-[10px] font-medium leading-none transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {t(item.key)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
