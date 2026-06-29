"use client"

import { BottomNav } from "@/components/bottom-nav"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
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

function BottomNavWrapper({ hasUnread }: { hasUnread: boolean }) {
  const { hideNav } = useNavVisibility()
  if (hideNav) return null
  return <BottomNav hasUnread={hasUnread} />
}

function MainWrapper({ children }: { children: ReactNode }) {
  const { hideNav } = useNavVisibility()
  return (
    <main className={`relative flex-1 ${hideNav ? "" : "pb-28"}`}>
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
  const [hasUnread, setHasUnread] = useState(false)

  useMidnightLogout()

  useEffect(() => {
    const supabase = createClient()
    const colors: Record<string, string> = {
      paris: "199 89% 48%", strasbourg: "262 83% 58%", lyon: "142 71% 45%",
      bordeaux: "27 87% 60%", marseille: "349 89% 60%", intl: "262 83% 58%",
      nice: "262 83% 58%", toulouse: "199 89% 48%"
    }

    let userId = ""

    async function loadAvatar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userId = user.id
      const { data: p } = await supabase.from("profiles").select("name,initials,station,photo_url").eq("id", user.id).single()
      if (!p) return
      setAvatar({ photoUrl: p.photo_url, initials: p.initials || "?", color: colors[p.station] || "262 83% 58%" })
      setUserName(p.name ?? "")
    }

    loadAvatar()

    const channel = supabase
      .channel("shell-profile")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        const p = payload.new as { id: string; name: string; initials: string; station: string; photo_url: string | null }
        if (p.id !== userId) return
        setAvatar({ photoUrl: p.photo_url, initials: p.initials || "?", color: colors[p.station] || "262 83% 58%" })
        setUserName(p.name ?? "")
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Listen for new messages from others → show red dot on Mesajlar tab
  useEffect(() => {
    if (!userName) return
    const supabase = createClient()
    const channel = supabase
      .channel("shell-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const msg = payload.new as { sender_name?: string }
        if (msg.sender_name === userName) return
        if (!window.location.pathname.startsWith("/messages")) setHasUnread(true)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userName])

  // Clear dot when user navigates to messages
  useEffect(() => {
    if (pathname.startsWith("/messages")) setHasUnread(false)
  }, [pathname])

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

      <MainWrapper>{children}</MainWrapper>
      <BottomNavWrapper hasUnread={hasUnread} />
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
