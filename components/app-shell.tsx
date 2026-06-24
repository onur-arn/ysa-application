"use client"

import { BottomNav } from "@/components/bottom-nav"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { usePullToRefresh } from "@/lib/use-pull-to-refresh"
import { useMidnightLogout } from "@/lib/use-midnight-logout"
import { NavVisibilityProvider, useNavVisibility } from "@/lib/nav-visibility"
import { PresenceProvider } from "@/lib/presence"

const PAGE_TITLES: { path: string; label: string }[] = [
  { path: "/feed",      label: "Ana Sayfa" },
  { path: "/messages",  label: "Mesajlar" },
  { path: "/annuaire",  label: "Rehber" },
  { path: "/agenda",    label: "Takvim" },
  { path: "/gorevler",  label: "Görevler" },
  { path: "/ayarlar",   label: "Ayarlar" },
]

function BottomNavWrapper() {
  const { hideNav } = useNavVisibility()
  if (hideNav) return null
  return <BottomNav />
}

function MainWrapper({ children, pull }: { children: ReactNode; pull: number }) {
  const { hideNav } = useNavVisibility()
  return (
    <main
      className={`relative flex-1 ${hideNav ? "" : "pb-28"}`}
      style={{ transform: pull > 0 ? `translateY(${pull * 0.3}px)` : undefined, transition: pull === 0 ? "transform 0.25s ease" : "none" }}
    >
      {children}
    </main>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const onSettings = pathname.startsWith("/ayarlar")
  const pageTitle = PAGE_TITLES.find(p => pathname.startsWith(p.path))?.label ?? "YouthStation"

  const [avatar, setAvatar] = useState<{ photoUrl?: string | null; initials: string; color: string } | null>(null)
  const [userName, setUserName] = useState("")

  const { pull, refreshing } = usePullToRefresh()
  useMidnightLogout()

  useEffect(() => {
    async function loadAvatar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from("profiles").select("name,initials,station,photo_url").eq("id", user.id).single()
      if (!p) return
      // compute station color
      const colors: Record<string, string> = {
        paris: "199 89% 48%", strasbourg: "262 83% 58%", lyon: "142 71% 45%",
        bordeaux: "27 87% 60%", marseille: "349 89% 60%", intl: "262 83% 58%",
        nice: "262 83% 58%", toulouse: "199 89% 48%"
      }
      setAvatar({ photoUrl: p.photo_url, initials: p.initials || "?", color: colors[p.station] || "262 83% 58%" })
      setUserName(p.name ?? "")
    }
    loadAvatar()
  }, [])

  const THRESHOLD = 72
  const pullProgress = Math.min(pull / THRESHOLD, 1)

  return (
    <NavVisibilityProvider>
    <PresenceProvider userName={userName}>
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/50 bg-background/85 px-5 py-3 backdrop-blur-xl">
        <h1 className="font-heading text-[1.35rem] font-bold tracking-[-0.01em] text-foreground">
          {pageTitle}
        </h1>
        <div className="flex items-center gap-2">
          {!onSettings && (
            <Link
              href="/ayarlar"
              className="flex size-8 shrink-0 items-center justify-center rounded-full overflow-hidden ring-2 ring-border/60 hover:ring-primary/40 transition-all"
              aria-label="Ayarlar"
            >
              {avatar?.photoUrl ? (
                <img src={avatar.photoUrl} alt="Profil" className="size-full object-cover" />
              ) : (
                <span
                  className="flex size-full items-center justify-center text-[11px] font-bold text-white"
                  style={{ backgroundColor: `hsl(${avatar?.color ?? "258 70% 55%"})` }}
                >
                  {avatar?.initials ?? "?"}
                </span>
              )}
            </Link>
          )}
        </div>
      </header>

      {/* Pull-to-refresh indicator */}
      <div
        className="pointer-events-none flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: pull > 0 || refreshing ? `${pull}px` : 0 }}
      >
        <svg
          className="text-primary"
          style={{
            width: 28,
            height: 28,
            opacity: pullProgress,
            transform: `rotate(${refreshing ? 0 : pullProgress * 360 * 0.8}deg)`,
            animation: refreshing ? "spin 0.7s linear infinite" : "none",
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>

      <MainWrapper pull={pull}>{children}</MainWrapper>
      <BottomNavWrapper />
    </div>
    </PresenceProvider>
    </NavVisibilityProvider>
  )
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pb-1 pt-5">
      <h2 className="font-heading text-lg font-bold tracking-[-0.01em] text-foreground">{title}</h2>
      {action}
    </div>
  )
}
