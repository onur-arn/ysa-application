"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { subscribeChannel } from "@/lib/supabase/realtime"
import {
  readNotifPrefs,
  showAppNotification,
  tomorrowISO,
  wasEventReminded,
  markEventReminded,
} from "@/lib/notif-prefs"
import { GROUP_CALL_CALLEE } from "@/lib/group-avatar"

function sameName(a?: string | null, b?: string | null) {
  return (a ?? "").trim() === (b ?? "").trim()
}

/**
 * Listens for preference-gated notifications while the app is open:
 * - Genel Bilgiler: new posts / new members (not iGEM)
 * - Yeni Görev: task assigned to me or Tümü on my station
 * - Yeni Mesaj: already handled in app-shell + messages; calls handled here
 * - Etkinlikler (J-1): events tomorrow for my station
 */
export function NotificationListeners({
  userName,
  userStation,
}: {
  userName: string
  userStation: string
}) {
  const nameRef = useRef(userName)
  const stationRef = useRef(userStation)
  useEffect(() => { nameRef.current = userName }, [userName])
  useEffect(() => { stationRef.current = userStation }, [userStation])

  // Genel Bilgiler + Yeni Görev
  useEffect(() => {
    if (!userName) return
    const supabase = createClient()

    const channel = supabase
      .channel(`notif-feed-tasks-${userName}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (payload) => {
        const prefs = readNotifPrefs()
        if (!prefs.genel) return
        const p = payload.new as { id?: string; author?: string; content?: string }
        if (sameName(p.author, nameRef.current)) return
        const snippet = (p.content ?? "").trim().slice(0, 80)
        showAppNotification("Genel Bilgiler", {
          body: snippet ? `${p.author}: ${snippet}` : `${p.author ?? "Bir üye"} yeni bir paylaşım yaptı`,
          tag: `post-${p.id ?? Date.now()}`,
          url: "/feed",
        })
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, (payload) => {
        const prefs = readNotifPrefs()
        if (!prefs.genel) return
        const p = payload.new as { id?: string; name?: string; station?: string }
        if (!p.name || sameName(p.name, nameRef.current)) return
        showAppNotification("Genel Bilgiler", {
          body: `${p.name} YouthStation'a katıldı`,
          tag: `member-${p.id ?? Date.now()}`,
          url: "/annuaire",
        })
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks" }, (payload) => {
        const prefs = readNotifPrefs()
        if (!prefs.gorev) return
        const t = payload.new as {
          id?: string
          title?: string
          assignee?: string
          station?: string
          assigned_by?: string
        }
        if (sameName(t.assigned_by, nameRef.current)) return
        const myStation = stationRef.current
        const assignee = (t.assignee ?? "").trim()
        const forMe = sameName(assignee, nameRef.current)
        const forStationTumu =
          assignee === "Tümü" &&
          !!t.station &&
          t.station === myStation
        if (!forMe && !forStationTumu) return
        showAppNotification("Yeni Görev", {
          body: forStationTumu
            ? `${t.assigned_by ?? "Birisi"} istasyonuna görev verdi: ${t.title ?? ""}`
            : `${t.assigned_by ?? "Birisi"} sana görev verdi: ${t.title ?? ""}`,
          tag: `task-${t.id ?? Date.now()}`,
          url: "/gorevler",
        })
      })
      // Also when an existing task is reassigned to me / Tümü
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks" }, (payload) => {
        const prefs = readNotifPrefs()
        if (!prefs.gorev) return
        const t = payload.new as {
          id?: string
          title?: string
          assignee?: string
          station?: string
          assigned_by?: string
        }
        const old = payload.old as { assignee?: string } | undefined
        if (sameName(t.assigned_by, nameRef.current)) return
        const assignee = (t.assignee ?? "").trim()
        const prev = (old?.assignee ?? "").trim()
        if (assignee === prev) return
        const myStation = stationRef.current
        const forMe = sameName(assignee, nameRef.current)
        const forStationTumu = assignee === "Tümü" && !!t.station && t.station === myStation
        if (!forMe && !forStationTumu) return
        showAppNotification("Yeni Görev", {
          body: forStationTumu
            ? `İstasyona yeni görev: ${t.title ?? ""}`
            : `Sana görev atandı: ${t.title ?? ""}`,
          tag: `task-upd-${t.id ?? Date.now()}`,
          url: "/gorevler",
        })
      })

    void subscribeChannel(supabase, channel)
    return () => { supabase.removeChannel(channel) }
  }, [userName])

  // Incoming calls → Yeni Mesaj preference
  useEffect(() => {
    if (!userName) return
    const supabase = createClient()
    const channel = supabase
      .channel(`notif-calls-${userName}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_sessions" }, (payload) => {
        const prefs = readNotifPrefs()
        if (!prefs.messages) return
        const row = payload.new as {
          id?: string
          caller_name?: string
          callee_name?: string
          status?: string
          conversation_id?: string
        }
        if (row.status !== "ringing") return
        if (sameName(row.caller_name, nameRef.current)) return
        const isDirect = sameName(row.callee_name, nameRef.current)
        const isGroup = row.callee_name === GROUP_CALL_CALLEE
        if (!isDirect && !isGroup) return
        showAppNotification("Yeni Mesaj", {
          body: isGroup
            ? `${row.caller_name ?? "Birisi"} grup araması başlattı`
            : `${row.caller_name ?? "Birisi"} seni arıyor`,
          tag: `call-${row.id ?? Date.now()}`,
          url: row.conversation_id ? `/messages?open=${row.conversation_id}` : "/messages",
        })
      })
    void subscribeChannel(supabase, channel)
    return () => { supabase.removeChannel(channel) }
  }, [userName])

  // Etkinlikler (J-1) — my station only
  useEffect(() => {
    if (!userName || !userStation) return

    async function checkTomorrowEvents() {
      const prefs = readNotifPrefs()
      if (!prefs.eventReminder) return
      const day = tomorrowISO()
      const supabase = createClient()
      const { data } = await supabase
        .from("events")
        .select("id,title,date,time,place,station")
        .eq("date", day)
        .eq("station", stationRef.current)

      for (const e of data ?? []) {
        if (wasEventReminded(e.id as string, day)) continue
        markEventReminded(e.id as string, day)
        const time = ((e.time as string) ?? "").toString().slice(0, 5)
        showAppNotification("Etkinlikler (J-1)", {
          body: `${e.title}${time ? ` · ${time}` : ""}${e.place ? ` · ${e.place}` : ""} — yarın`,
          tag: `event-j1-${e.id}`,
          url: "/agenda",
        })
      }
    }

    void checkTomorrowEvents()
    // Recheck when tab becomes visible / every 6h while open
    const onVis = () => {
      if (document.visibilityState === "visible") void checkTomorrowEvents()
    }
    document.addEventListener("visibilitychange", onVis)
    const interval = setInterval(() => { void checkTomorrowEvents() }, 6 * 60 * 60 * 1000)
    return () => {
      document.removeEventListener("visibilitychange", onVis)
      clearInterval(interval)
    }
  }, [userName, userStation])

  return null
}
