"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import {
  Shield, ArrowLeft, Loader2, Users, CalendarDays, Rocket, ListTodo,
  FileDown, MessageCircle, Newspaper, Search, UsersRound, UserRound,
  Image as ImageIcon, Mic, Film, Trash2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getStation } from "@/lib/data/stations"
import { isAdminEmail } from "@/lib/admin"
import { useNavVisibility } from "@/lib/nav-visibility"
import { subscribeChannel } from "@/lib/supabase/realtime"

type Member = { id: string; name: string; email: string; station: string; role: string; photo_url?: string | null }
type Event  = { id: string; title: string; date: string; station: string; place: string }
type IgemReq = { id: string; author: string; initials: string; station: string; motivation: string; created_at: string }
type Task   = { id: string; title: string; station: string; assignee: string; status: string }
type PostItem = { id: string; author: string; content: string; station: string; created_at: string }
type ConvRow = {
  id: string
  type: string
  name: string | null
  created_at: string
  conversation_members: Array<{ member_name: string }>
}
type ChatMsg = {
  id: string
  conversation_id: string
  sender_name: string
  sender_initials: string
  text: string | null
  image_url: string | null
  gif_url?: string | null
  audio_url?: string | null
  message_type?: string | null
  is_system: boolean
  created_at: string
}

type Tab = "convs" | "members" | "events" | "igem" | "tasks" | "posts" | "stories" | "archive"
type ArchiveItem = {
  table: string
  id: string
  deletedBy: string | null
  deletedAt: string
  row: Record<string, unknown>
  path?: string
}
type StoryItem = {
  id: string
  author_name: string
  station: string
  created_at: string
  image_url?: string | null
  music_label?: string | null
  music_preview_url?: string | null
  initials?: string | null
}

export function AdminClient({ adminEmail }: { adminEmail: string }) {
  const { setHideNav } = useNavVisibility()
  const [tab, setTab] = useState<Tab>("convs")
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [igemReqs, setIgemReqs] = useState<IgemReq[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [posts, setPosts] = useState<PostItem[]>([])
  const [convs, setConvs] = useState<ConvRow[]>([])
  const [msgCounts, setMsgCounts] = useState<Record<string, number>>({})
  const [lastPreviews, setLastPreviews] = useState<Record<string, string>>({})
  const [lastAts, setLastAts] = useState<Record<string, string>>({})
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [convSearch, setConvSearch] = useState("")
  const [exporting, setExporting] = useState(false)
  const [exportDone, setExportDone] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [archives, setArchives] = useState<ArchiveItem[]>([])
  const [stories, setStories] = useState<StoryItem[]>([])

  useEffect(() => {
    setHideNav(true)
    return () => setHideNav(false)
  }, [setHideNav])

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    const supabase = createClient()
    const [m, e, ig, t, p, s, convRes] = await Promise.all([
      supabase.from("profiles").select("id,name,email,station,role,photo_url").order("name"),
      supabase.from("events").select("id,title,date,station,place").order("date", { ascending: false }),
      supabase.from("igem_requests").select("id,author,initials,station,motivation,created_at").order("created_at", { ascending: false }),
      supabase.from("tasks").select("id,title,station,assignee,status").order("created_at", { ascending: false }),
      supabase.from("posts").select("id,author,content,station,created_at").order("created_at", { ascending: false }),
      supabase.from("stories").select("id,author_name,station,created_at,image_url,music_label,music_preview_url,initials").order("created_at", { ascending: false }),
      fetch("/api/admin/conversations").then((r) => r.ok ? r.json() : null).catch(() => null),
    ])
    setMembers((m.data ?? []).filter((x) => !isAdminEmail(x.email)))
    setEvents(e.data ?? [])
    setIgemReqs(ig.data ?? [])
    setTasks(t.data ?? [])
    setPosts(p.data ?? [])
    setStories((s.data ?? []) as StoryItem[])

    if (convRes?.conversations) {
      setConvs(convRes.conversations as ConvRow[])
      setMsgCounts((convRes.msgCounts as Record<string, number>) ?? {})
      setLastPreviews((convRes.lastPreviews as Record<string, string>) ?? {})
      setLastAts((convRes.lastAts as Record<string, string>) ?? {})
      const conversationRows = convRes.conversations as ConvRow[]
      if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
        setSelectedConvId((prev) => prev ?? conversationRows[0]?.id ?? null)
      }
    } else {
      // Fallback if API fails
      const { data: c } = await supabase
        .from("conversations")
        .select("id,type,name,created_at,conversation_members(member_name)")
        .order("created_at", { ascending: false })
      setConvs((c ?? []) as ConvRow[])
      setLastAts({})
    }

    try {
      const archRes = await fetch("/api/admin/archives")
      if (archRes.ok) {
        const json = await archRes.json()
        setArchives(json.archives ?? [])
      }
    } catch {}

    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Keep admin lists in sync with other devices / user activity
  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { void load({ silent: true }) }, 400)
    }
    const tables = [
      "profiles", "events", "tasks", "posts", "stories",
      "igem_requests", "conversations", "conversation_members", "chat_messages",
    ] as const
    let ch = supabase.channel("admin-realtime")
    for (const table of tables) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, schedule)
    }
    void subscribeChannel(supabase, ch)
    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(ch)
    }
  }, [load])

  useEffect(() => {
    if (!selectedConvId) {
      setMessages([])
      return
    }
    let cancelled = false
    async function loadMessages() {
      setMsgsLoading(true)
      try {
        const res = await fetch("/api/admin/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: selectedConvId }),
        })
        const json = await res.json().catch(() => ({}))
        if (!cancelled) {
          setMessages((json.messages ?? []) as ChatMsg[])
          setMsgsLoading(false)
        }
      } catch {
        if (!cancelled) {
          setMessages([])
          setMsgsLoading(false)
        }
      }
    }
    loadMessages()
    return () => { cancelled = true }
  }, [selectedConvId])

  const filteredConvs = useMemo(() => {
    const q = convSearch.trim().toLowerCase()
    const sorted = [...convs].sort((a, b) => {
      const atA = lastAts[a.id] || a.created_at || ""
      const atB = lastAts[b.id] || b.created_at || ""
      return atB.localeCompare(atA)
    })
    if (!q) return sorted
    return sorted.filter((conv) => {
      const members = conv.conversation_members.map((m) => m.member_name).join(" ")
      const title = convTitle(conv)
      return title.toLowerCase().includes(q) || members.toLowerCase().includes(q)
    })
  }, [convs, convSearch, lastAts])

  const selectedConv = convs.find((c) => c.id === selectedConvId) ?? null
  const visibleMsgs = messages.filter((m) => !m.is_system)
  const totalMessages = Object.values(msgCounts).reduce((a, b) => a + b, 0)
  const showThreadMobile = tab === "convs" && !!selectedConvId

  async function deleteMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id))
    await fetch("/api/admin/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    })
  }

  async function deleteEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id))
    await fetch("/api/admin/delete-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: id }),
    })
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await fetch("/api/admin/delete-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: id }),
    })
  }

  async function deletePost(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id))
    await fetch("/api/admin/delete-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: id }),
    })
  }

  async function deleteStory(id: string, authorName: string) {
    setStories((prev) => prev.filter((s) => s.id !== id))
    await fetch("/api/admin/delete-story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId: id, authorName }),
    })
  }

  async function rejectIgem(id: string) {
    setIgemReqs((prev) => prev.filter((r) => r.id !== id))
    await fetch("/api/admin/delete-igem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id }),
    })
  }

  async function deleteConversation(id: string) {
    const ok = window.confirm(
      "Bu sohbeti her yerden kalıcı olarak silmek istediğinize emin misiniz? Mesajlar da silinir ve geri gelmez.",
    )
    if (!ok) return

    const res = await fetch("/api/admin/delete-conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: id }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string }
      window.alert(json.error || "Sohbet silinemedi")
      return
    }

    setConvs((prev) => prev.filter((c) => c.id !== id))
    setMsgCounts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setLastPreviews((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setLastAts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (selectedConvId === id) {
      setSelectedConvId(null)
      setMessages([])
    }
  }

  async function exportPdf() {
    setExporting(true)
    setExportError(null)
    setExportDone(false)
    try {
      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedBy: adminEmail, mode: "email" }),
      })
      const json = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!res.ok || json.ok === false) {
        setExportError(json.error || `Échec envoi (${res.status})`)
        // Fallback: télécharger le HTML pour impression PDF locale
        const dl = await fetch("/api/export-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestedBy: adminEmail, mode: "download" }),
        })
        if (dl.ok) {
          const blob = await dl.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `youthstation-export-${new Date().toISOString().slice(0, 10)}.html`
          a.click()
          URL.revokeObjectURL(url)
        }
        return
      }
      setExportDone(true)
      setTimeout(() => setExportDone(false), 5000)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Erreur réseau")
    } finally {
      setExporting(false)
    }
  }

  const tabs: { key: Tab; icon: typeof Shield; label: string; count: number }[] = [
    { key: "convs",   icon: MessageCircle, label: "Sohbetler", count: convs.length },
    { key: "members", icon: Users,         label: "Üyeler",    count: members.length },
    { key: "events",  icon: CalendarDays,  label: "Etkinlik",  count: events.length },
    { key: "igem",    icon: Rocket,        label: "iGEM",      count: igemReqs.length },
    { key: "tasks",   icon: ListTodo,      label: "Görevler",  count: tasks.length },
    { key: "posts",   icon: Newspaper,     label: "Paylaşım",  count: posts.length },
    { key: "stories", icon: Film,          label: "Hikayeler", count: stories.length },
    { key: "archive", icon: Trash2,        label: "Arşiv",     count: archives.length },
  ]

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className={`shrink-0 border-b border-border/60 bg-background px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] ${showThreadMobile ? "hidden md:block" : ""}`}>
        <div className="mb-3 flex items-center gap-3">
          <Link
            href="/ayarlar"
            className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors active:bg-secondary"
            aria-label="Ayarlara dön"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-amber-500" />
              <h1 className="font-heading text-lg font-bold text-foreground">Yönetici Paneli</h1>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {convs.length} sohbet · {totalMessages} mesaj · {members.length} üye
            </p>
          </div>
          <button
            onClick={exportPdf}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
            PDF
          </button>
        </div>

        {exportDone && (
          <p className="mb-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600">
            ✓ PDF özeti admin maillerine gönderildi (spam klasörünü de kontrol edin)
          </p>
        )}
        {exportError && (
          <p className="mb-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            Mail gönderilemedi — HTML indirme denendi. {exportError}
          </p>
        )}

        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key)
                if (t.key !== "convs") setSelectedConvId(null)
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.key
                  ? "border-amber-500/50 bg-amber-500 text-white"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              <t.icon className="size-3.5" />
              {t.label}
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                tab === t.key ? "bg-white/20" : "bg-secondary text-foreground"
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : tab === "convs" ? (
        <div className="flex min-h-0 flex-1">
          <aside className={`flex min-h-0 w-full flex-col md:w-[340px] md:shrink-0 md:border-r md:border-border/60 ${
            selectedConvId ? "hidden md:flex" : "flex"
          }`}>
            <div className="shrink-0 border-b border-border/40 px-3 py-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={convSearch}
                  onChange={(e) => setConvSearch(e.target.value)}
                  placeholder="Sohbet veya üye ara…"
                  className="h-9 w-full rounded-xl border border-input bg-card pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {filteredConvs.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">Sohbet bulunamadı</p>
              )}
              {filteredConvs.map((conv) => {
                const active = selectedConvId === conv.id
                const members = convParticipants(conv)
                return (
                  <div
                    key={conv.id}
                    className={`flex w-full items-start gap-2 border-b border-border/40 px-2 py-2 transition-colors ${
                      active ? "bg-primary/10" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedConvId(conv.id)}
                      className="flex min-w-0 flex-1 items-start gap-3 rounded-xl px-1 py-1 text-left active:bg-secondary"
                    >
                      <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl ${
                        conv.type === "dm" ? "bg-sky-500/15 text-sky-600" : "bg-amber-500/15 text-amber-600"
                      }`}>
                        {conv.type === "dm" ? <UserRound className="size-4" /> : <UsersRound className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{convTitle(conv)}</p>
                          <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                            {msgCounts[conv.id] ?? 0}
                          </span>
                        </div>
                        <p className="truncate text-[11px] font-medium text-sky-700 dark:text-sky-400">
                          {conv.type === "dm"
                            ? `Kimler: ${members.join(" ↔ ") || "—"}`
                            : `Üyeler: ${members.slice(0, 5).join(", ")}${members.length > 5 ? ` +${members.length - 5}` : ""}`}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
                          {lastPreviews[conv.id] ?? "Henüz mesaj yok"}
                        </p>
                      </div>
                    </button>
                    <div className="shrink-0 self-center pr-1">
                      <DeleteButton onConfirm={() => deleteConversation(conv.id)} />
                    </div>
                  </div>
                )
              })}
            </div>
          </aside>

          <section className={`min-h-0 min-w-0 flex-1 flex-col ${
            selectedConvId ? "flex" : "hidden md:flex"
          }`}>
            {selectedConv ? (
              <>
                <div className="flex shrink-0 items-center gap-2 border-b border-border/50 bg-card/80 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3">
                  <button
                    type="button"
                    onClick={() => setSelectedConvId(null)}
                    className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground md:hidden"
                    aria-label="Sohbet listesine dön"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{convTitle(selectedConv)}</p>
                    <p className="truncate text-xs font-medium text-sky-700 dark:text-sky-400">
                      {selectedConv.type === "dm"
                        ? `Kimler: ${convParticipants(selectedConv).join(" ↔ ") || "—"}`
                        : `Üyeler: ${convParticipants(selectedConv).join(", ") || "—"}`}
                      {" · "}{visibleMsgs.length} mesaj
                    </p>
                  </div>
                  <DeleteButton onConfirm={() => deleteConversation(selectedConv.id)} />
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-5">
                  {msgsLoading ? (
                    <div className="flex justify-center py-16">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : visibleMsgs.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">Bu sohbette mesaj yok</p>
                  ) : (
                    visibleMsgs.map((msg) => (
                      <MessageBubble key={msg.id} msg={msg} />
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                <MessageCircle className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Mesajları görmek için bir sohbet seçin</p>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          {tab === "members" && (
            <ListBlock empty="Üye yok" count={members.length}>
              {members.map((m) => {
                const s = getStation(m.station as never)
                return (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    {m.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photo_url} alt={m.name} className="size-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: `hsl(${s.color})` }}
                      >
                        {m.name.trim().split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{m.name || m.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.role} · {s.name}</p>
                    </div>
                    <DeleteButton onConfirm={() => deleteMember(m.id)} />
                  </div>
                )
              })}
            </ListBlock>
          )}

          {tab === "events" && (
            <ListBlock empty="Etkinlik yok" count={events.length}>
              {events.map((e) => {
                const s = getStation(e.station as never)
                return (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white"
                      style={{ backgroundColor: `hsl(${s.color})` }}
                    >
                      {s.short}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{e.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{e.date} · {e.place}</p>
                    </div>
                    <DeleteButton onConfirm={() => deleteEvent(e.id)} />
                  </div>
                )
              })}
            </ListBlock>
          )}

          {tab === "igem" && (
            <ListBlock empty="Bekleyen talep yok" count={igemReqs.length}>
              {igemReqs.map((r) => {
                const s = getStation(r.station as never)
                return (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: `hsl(${s.color})` }}
                    >
                      {r.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{r.author}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.name}</p>
                    </div>
                    <DeleteButton onConfirm={() => rejectIgem(r.id)} />
                  </div>
                )
              })}
            </ListBlock>
          )}

          {tab === "tasks" && (
            <ListBlock empty="Görev yok" count={tasks.length}>
              {tasks.map((t) => {
                const s = getStation(t.station as never)
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white"
                      style={{ backgroundColor: `hsl(${s.color})` }}
                    >
                      {s.short}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{t.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.assignee} · {t.status}</p>
                    </div>
                    <DeleteButton onConfirm={() => deleteTask(t.id)} />
                  </div>
                )
              })}
            </ListBlock>
          )}

          {tab === "posts" && (
            <ListBlock empty="Paylaşım yok" count={posts.length}>
              {posts.map((p) => {
                const s = getStation(p.station as never)
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white"
                      style={{ backgroundColor: `hsl(${s.color})` }}
                    >
                      {s.short}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{p.author}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.content}</p>
                    </div>
                    <DeleteButton onConfirm={() => deletePost(p.id)} />
                  </div>
                )
              })}
            </ListBlock>
          )}

          {tab === "stories" && (
            <ListBlock empty="Hikaye yok" count={stories.length}>
              {stories.map((st) => {
                const s = getStation(st.station as never)
                return (
                  <div key={st.id} className="flex items-center gap-3 px-4 py-3">
                    {st.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={st.image_url}
                        alt=""
                        className="size-12 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span
                        className="flex size-12 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white"
                        style={{ backgroundColor: `hsl(${s.color})` }}
                      >
                        {s.short}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{st.author_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.name} · {new Date(st.created_at).toLocaleString("tr-TR")}
                      </p>
                      {st.music_label && (
                        <p className="truncate text-[11px] text-primary">♪ {st.music_label}</p>
                      )}
                    </div>
                    <DeleteButton onConfirm={() => deleteStory(st.id, st.author_name)} />
                  </div>
                )
              })}
            </ListBlock>
          )}

          {tab === "archive" && (
            <ListBlock empty="Arşivde silinmiş kayıt yok" count={archives.length}>
              {archives.map((a, i) => {
                const row = a.row ?? {}
                const label =
                  (row.title as string) ||
                  (row.content as string) ||
                  (row.motivation as string) ||
                  (row.name as string) ||
                  (row.author_name as string) ||
                  (row.author as string) ||
                  a.id
                return (
                  <div key={`${a.path ?? a.id}-${i}`} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 rounded-lg bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase text-destructive">
                      {a.table}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{String(label).slice(0, 100)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Silen: {a.deletedBy || "—"} · {a.deletedAt ? new Date(a.deletedAt).toLocaleString("tr-TR") : "—"}
                      </p>
                    </div>
                  </div>
                )
              })}
            </ListBlock>
          )}
        </div>
      )}
    </div>
  )
}

function convParticipants(conv: ConvRow): string[] {
  const names = (conv.conversation_members ?? [])
    .map((m) => m.member_name?.trim())
    .filter((n): n is string => !!n)
  return [...new Set(names)]
}

function convTitle(conv: ConvRow) {
  const members = convParticipants(conv)
  if (conv.type === "dm") {
    if (members.length >= 2) return `${members[0]} ↔ ${members[1]}`
    if (members.length === 1) return `DM · ${members[0]}`
    return "DM · Özel"
  }
  const groupName = conv.name?.trim() || "Grup"
  if (members.length === 0) return groupName
  return `${groupName} (${members.length} üye)`
}

function MessageBubble({ msg }: { msg: ChatMsg }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 px-3.5 py-2.5 shadow-sm">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-[12px] font-semibold text-primary">{msg.sender_name}</span>
        <span className="text-[10px] text-muted-foreground">
          {new Date(msg.created_at).toLocaleString("tr-TR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      {msg.text && <p className="whitespace-pre-wrap text-sm text-foreground">{msg.text}</p>}
      {msg.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={msg.image_url} alt="" className="mt-2 max-h-64 rounded-xl object-cover" />
      )}
      {msg.gif_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={msg.gif_url} alt="GIF" className="mt-2 max-h-64 rounded-xl object-cover" />
      )}
      {msg.audio_url && (
        <div className="mt-2 flex items-center gap-2">
          <Mic className="size-3.5 shrink-0 text-muted-foreground" />
          <audio controls src={msg.audio_url} className="h-8 max-w-full" />
        </div>
      )}
      {!msg.text && !msg.image_url && !msg.gif_url && !msg.audio_url && (
        <p className="text-xs italic text-muted-foreground">[boş mesaj]</p>
      )}
      {(msg.image_url || msg.gif_url) && (
        <a
          href={msg.image_url || msg.gif_url || "#"}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary"
        >
          {msg.gif_url ? <Film className="size-3" /> : <ImageIcon className="size-3" />}
          Tam boyutta aç
        </a>
      )}
    </div>
  )
}

function ListBlock({
  children,
  empty,
  count,
}: {
  children: React.ReactNode
  empty: string
  count: number
}) {
  return (
    <div className="divide-y divide-border/50">
      {count === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        children
      )}
    </div>
  )
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirm, setConfirm] = useState(false)
  if (confirm) {
    return (
      <div className="flex shrink-0 gap-1">
        <button
          onClick={() => { onConfirm(); setConfirm(false) }}
          className="rounded-lg bg-destructive px-2 py-1 text-[11px] font-bold text-white"
        >
          Sil
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground"
        >
          İptal
        </button>
      </div>
    )
  }
  return (
    <button
      onClick={() => setConfirm(true)}
      className="rounded-lg border border-destructive/30 px-2 py-1 text-[11px] font-semibold text-destructive active:bg-destructive/10"
    >
      Sil
    </button>
  )
}
