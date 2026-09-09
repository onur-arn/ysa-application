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
import { getNavUnread, setNavUnread, NAV_UNREAD_EVENT, isSameSender } from "@/lib/nav-unread"
import { readNotifPrefs, showAppNotification } from "@/lib/notif-prefs"
import { NotificationListeners } from "@/components/notification-listeners"

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
  const [userStation, setUserStation] = useState("")
  const [hasUnread, setHasUnread] = useState(false)

  useMidnightLogout()

  useEffect(() => { registerSW() }, [])

  // Restore nav badge immediately (survives remount / hard refresh)
  useEffect(() => {
    setHasUnread(getNavUnread())
    const onUnread = (e: Event) => {
      const detail = (e as CustomEvent<{ hasUnread?: boolean }>).detail
      if (typeof detail?.hasUnread === "boolean") setHasUnread(detail.hasUnread)
      else setHasUnread(getNavUnread())
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === "ys-nav-unread" || e.key === "ys-last-read") setHasUnread(getNavUnread())
    }
    window.addEventListener(NAV_UNREAD_EVENT, onUnread)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(NAV_UNREAD_EVENT, onUnread)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

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
      setUserStation(p.station ?? "")
    }

    loadAvatar()

    const channel = supabase
      .channel("shell-profile")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        const p = payload.new as { id: string; name: string; initials: string; station: string; photo_url: string | null }
        if (p.id !== userId) return
        setAvatar({ photoUrl: p.photo_url, initials: p.initials || "?", color: colors[p.station] || "262 83% 58%" })
        setUserName(p.name ?? "")
        setUserStation(p.station ?? "")
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Unread badge + desktop notification — ONLY for conversations I'm in
  useEffect(() => {
    if (!userName) return
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission()
    }
    const supabase = createClient()
    const myConvIds = new Set<string>()
    let userId = ""

    async function refreshMyConversations() {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id ?? ""
      const queries = []
      if (userId) {
        queries.push(
          supabase.from("conversation_members").select("conversation_id").eq("user_id", userId),
        )
      }
      if (userName) {
        queries.push(
          supabase.from("conversation_members").select("conversation_id").eq("member_name", userName),
        )
      }
      const results = await Promise.all(queries)
      myConvIds.clear()
      for (const res of results) {
        for (const row of res.data ?? []) {
          myConvIds.add(row.conversation_id as string)
        }
      }
    }

    const channel = supabase
      .channel("shell-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const msg = payload.new as {
          sender_name?: string
          text?: string
          message_type?: string
          conversation_id?: string
          is_system?: boolean
        }
        if (msg.is_system) return
        // Never notify / badge for my own sends
        if (isSameSender(msg.sender_name, userName)) return
        // Ignore call system-ish events posted under message_type call from self already filtered;
        // still require membership
        if (!msg.conversation_id || !myConvIds.has(msg.conversation_id)) return
        if (msg.message_type === "call") return

        setNavUnread(true)
        setHasUnread(true)
        try {
          const prefs = readNotifPrefs()
          if (!prefs.messages) return
          const onMessages = pathname.startsWith("/messages")
          if (onMessages && document.visibilityState === "visible") return
          const body = msg.message_type === "audio" || msg.text?.startsWith("🎤")
            ? `${msg.sender_name}: 🎤 Sesli mesaj`
            : msg.text
              ? `${msg.sender_name}: ${msg.text}`
              : `${msg.sender_name} bir mesaj gönderdi`
          showAppNotification("Yeni Mesaj", {
            body,
            tag: msg.conversation_id ? `msg-${msg.conversation_id}` : "msg",
            url: msg.conversation_id ? `/messages?open=${msg.conversation_id}` : "/messages",
          })
        } catch {}
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_members" }, (payload) => {
        const row = payload.new as { conversation_id?: string; member_name?: string; user_id?: string }
        if (!row.conversation_id) return
        if (row.user_id === userId || row.member_name === userName) {
          myConvIds.add(row.conversation_id)
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "conversation_members" }, (payload) => {
        const row = payload.old as { conversation_id?: string; member_name?: string; user_id?: string }
        if (!row.conversation_id) return
        if (row.user_id === userId || row.member_name === userName) {
          myConvIds.delete(row.conversation_id)
        }
      })
    void (async () => {
      await refreshMyConversations()
      void subscribeChannel(supabase, channel)
    })()
    return () => { supabase.removeChannel(channel) }
  }, [userName, pathname])

  return (
    <QueryProvider>
    <NavVisibilityProvider>
    <PresenceProvider userName={userName}>
    <CallProvider userName={userName}>
    <NotificationListeners userName={userName} userStation={userStation} />
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
