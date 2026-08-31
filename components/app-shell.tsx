"use client"

import { BottomNav } from "@/components/bottom-nav"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { useMidnightLogout } from "@/lib/use-midnight-logout"
import { NavVisibilityProvider, useNavVisibility } from "@/lib/nav-visibility"
import { PresenceProvider } from "@/lib/presence"
import { CallProvider } from "@/lib/call/call-context"
import { QueryProvider } from "@/components/providers/query-provider"
import { registerSW } from "@/lib/push"
import { subscribeChannel } from "@/lib/supabase/realtime"

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

function AppHeader({ pageTitle, onSettings, avatar }: {
  pageTitle: string
  onSettings: boolean
  avatar: { photoUrl?: string | null; initials: string; color: string } | null
}) {
  const { hideNav } = useNavVisibility()
  if (hideNav) return null
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/50 bg-background/85 px-5 py-3 backdrop-blur-xl">
      <h1 className="font-heading text-[1.35rem] font-bold tracking-[-0.01em] text-foreground">
        {pageTitle}
      </h1>
      <div className="flex items-center gap-2">
        {!onSettings && (
          <Link
            href="/ayarlar"
            className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-border/60 transition-all hover:ring-primary/40"
            aria-label="Ayarlar"
          >
            {avatar?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
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
  )
}

function MainWrapper({ children }: { children: ReactNode }) {
  const { hideNav } = useNavVisibility()
  return (
    <main className={`relative flex min-h-0 flex-1 flex-col ${hideNav ? "" : "pb-28"}`}>
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

  useEffect(() => { registerSW() }, [])

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
      if (!p) {
        // Profile deleted by admin — force sign out immediately
        await supabase.auth.signOut()
        window.location.href = "/auth/login"
        return
      }
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

  // Unread badge — skip when already on messages (conversations-meta handles it there)
  useEffect(() => {
    if (!userName || pathname.startsWith("/messages")) return
    const supabase = createClient()
    const channel = supabase
      .channel("shell-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const msg = payload.new as { sender_name?: string; text?: string }
        if (msg.sender_name === userName) return
        setHasUnread(true)
        try {
          const prefs = JSON.parse(localStorage.getItem("ys-notif-prefs") ?? "{}")
          if (prefs.messages !== false && document.visibilityState === "hidden") {
            navigator.serviceWorker?.ready.then((reg) => {
              reg.showNotification("Yeni Mesaj", {
                body: msg.text ? `${msg.sender_name}: ${msg.text}` : `${msg.sender_name} bir mesaj gönderdi`,
                icon: "/icon.png",
                badge: "/icon.png",
                data: { url: "/messages" },
              })
            })
          }
        } catch {}
      })
    void subscribeChannel(supabase, channel)
    return () => { supabase.removeChannel(channel) }
  }, [userName, pathname])

  // Clear dot when user navigates to messages
  useEffect(() => {
    if (pathname.startsWith("/messages")) setHasUnread(false)
  }, [pathname])

  return (
    <QueryProvider>
    <NavVisibilityProvider>
    <PresenceProvider userName={userName}>
    <CallProvider userName={userName}>
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <AppHeader pageTitle={pageTitle} onSettings={onSettings} avatar={avatar} />
      <MainWrapper>{children}</MainWrapper>
      <BottomNavWrapper hasUnread={hasUnread} />
    </div>
    </CallProvider>
    </PresenceProvider>
    </NavVisibilityProvider>
    </QueryProvider>
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
