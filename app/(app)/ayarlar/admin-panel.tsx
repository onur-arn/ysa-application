"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Shield, ChevronDown, Trash2, Loader2, Users,
  CalendarDays, Rocket, ListTodo, FileDown, MessageCircle, ChevronRight, Newspaper,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getStation } from "@/lib/data/stations"

type Member = { id: string; name: string; email: string; station: string; role: string; photo_url?: string | null }
type Event  = { id: string; title: string; date: string; station: string; place: string }
type IgemReq = { id: string; author: string; initials: string; station: string; motivation: string; created_at: string }
type Task   = { id: string; title: string; station: string; assignee: string; status: string }
type PostItem = { id: string; author: string; content: string; station: string; created_at: string }
type Conv   = {
  id: string; type: string; name: string | null; created_at: string
  conversation_members: Array<{ member_name: string }>
  chat_messages: Array<{ id: string; sender_name: string; text: string | null; created_at: string; is_system: boolean }>
}

export function AdminPanel() {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<"members" | "events" | "igem" | "tasks" | "convs" | "posts" | null>(null)

  const [members,  setMembers]  = useState<Member[]>([])
  const [events,   setEvents]   = useState<Event[]>([])
  const [igemReqs, setIgemReqs] = useState<IgemReq[]>([])
  const [tasks,    setTasks]    = useState<Task[]>([])
  const [posts,    setPosts]    = useState<PostItem[]>([])
  const [convs,    setConvs]    = useState<Conv[]>([])
  const [openConvId, setOpenConvId] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportDone, setExportDone] = useState(false)

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const [m, e, ig, t, p, c] = await Promise.all([
      supabase.from("profiles").select("id,name,email,station,role,photo_url").order("name"),
      supabase.from("events").select("id,title,date,station,place").order("date", { ascending: false }),
      supabase.from("igem_requests").select("id,author,initials,station,motivation,created_at").order("created_at", { ascending: false }),
      supabase.from("tasks").select("id,title,station,assignee,status").order("created_at", { ascending: false }),
      supabase.from("posts").select("id,author,content,station,created_at").order("created_at", { ascending: false }),
      supabase.from("conversations").select("id,type,name,created_at,conversation_members(member_name),chat_messages(id,sender_name,text,created_at,is_system)").order("created_at", { ascending: false }),
    ])
    setMembers((m.data ?? []).filter(x => x.email !== "admin@youthstation.org"))
    setEvents(e.data ?? [])
    setIgemReqs(ig.data ?? [])
    setTasks(t.data ?? [])
    setPosts(p.data ?? [])
    setConvs((c.data ?? []) as Conv[])
    setLoading(false)
  }

  useEffect(() => {
    if (open) loadAll()
  }, [open])

  async function deleteMember(id: string) {
    setMembers(prev => prev.filter(m => m.id !== id))
    await fetch("/api/admin/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    })
  }

  async function deleteEvent(id: string) {
    setEvents(prev => prev.filter(e => e.id !== id))
    await fetch("/api/admin/delete-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: id }),
    })
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch("/api/admin/delete-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: id }),
    })
  }

  async function deletePost(id: string) {
    setPosts(prev => prev.filter(p => p.id !== id))
    const supabase = createClient()
    await supabase.from("posts").delete().eq("id", id)
  }

  async function rejectIgem(id: string) {
    setIgemReqs(prev => prev.filter(r => r.id !== id))
    await fetch("/api/admin/delete-igem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id }),
    })
  }

  async function exportPdf() {
    setExporting(true)
    const supabase = createClient()
    const [{ data: profiles }, { data: posts }, { data: igem }] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("posts").select("*"),
      supabase.from("igem_requests").select("*"),
    ])
    await fetch("/api/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestedBy: "admin@youthstation.org",
        profiles: (profiles ?? []).map((m: Record<string, unknown>) => ({
          name: m.name, email: m.email, station: m.station,
          role: m.role, phone: m.phone, birthday: m.birthday,
          memleket: m.memleket, linkedin: m.linkedin, igem_egitimi: m.igem_egitimi,
        })),
        posts: posts ?? [],
        tasks: [],
        igem: igem ?? [],
      }),
    })
    setExporting(false)
    setExportDone(true)
    setTimeout(() => setExportDone(false), 4000)
  }

  const tabs: { key: typeof section; icon: typeof Shield; label: string; count: number }[] = [
    { key: "members", icon: Users,          label: "Üyeler",     count: members.length },
    { key: "events",  icon: CalendarDays,   label: "Etkinlik",   count: events.length },
    { key: "igem",    icon: Rocket,         label: "iGEM",       count: igemReqs.length },
    { key: "tasks",   icon: ListTodo,       label: "Görevler",   count: tasks.length },
    { key: "posts",   icon: Newspaper,      label: "Paylaşım",   count: posts.length },
    { key: "convs",   icon: MessageCircle,  label: "Sohbetler",  count: convs.length },
  ]

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <Shield className="size-5 shrink-0 text-amber-500" />
        <span className="flex-1 font-semibold text-foreground">Yönetici Paneli</span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-amber-500/20"
          >
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-col gap-0">

                {/* PDF Export */}
                <div className="px-4 py-3 border-b border-border/50">
                  {exportDone && (
                    <p className="mb-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600">
                      ✓ PDF gönderildi
                    </p>
                  )}
                  <button
                    onClick={exportPdf}
                    disabled={exporting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-50"
                  >
                    {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                    {exporting ? "Oluşturuluyor…" : "PDF raporu gönder"}
                  </button>
                </div>

                {/* Tabs */}
                <div className="grid grid-cols-6 gap-0 border-b border-border/50">
                  {tabs.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setSection(section === tab.key ? null : tab.key)}
                      className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                        section === tab.key
                          ? "bg-amber-500/10 text-amber-600"
                          : "text-muted-foreground active:bg-secondary"
                      }`}
                    >
                      <tab.icon className="size-4" />
                      {tab.label}
                      {tab.count > 0 && (
                        <span className={`rounded-full px-1.5 text-[9px] font-bold ${
                          section === tab.key ? "bg-amber-500 text-white" : "bg-secondary text-foreground"
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Members */}
                <AnimatePresence initial={false}>
                  {section === "members" && (
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-border/50 max-h-72 overflow-y-auto">
                        {members.length === 0 && (
                          <p className="py-6 text-center text-sm text-muted-foreground">Üye yok</p>
                        )}
                        {members.map(m => {
                          const s = getStation(m.station as never)
                          return (
                            <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                              {m.photo_url
                                ? <img src={m.photo_url} alt={m.name} className="size-8 shrink-0 rounded-full object-cover" />
                                : <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: `hsl(${s.color})` }}>
                                    {m.name.trim().split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                                  </span>
                              }
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{m.role} · {s.name}</p>
                              </div>
                              <DeleteButton onConfirm={() => deleteMember(m.id)} />
                            </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Events */}
                <AnimatePresence initial={false}>
                  {section === "events" && (
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-border/50 max-h-72 overflow-y-auto">
                        {events.length === 0 && (
                          <p className="py-6 text-center text-sm text-muted-foreground">Etkinlik yok</p>
                        )}
                        {events.map(e => {
                          const s = getStation(e.station as never)
                          return (
                            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                              <span
                                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold text-white"
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
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* iGEM */}
                <AnimatePresence initial={false}>
                  {section === "igem" && (
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-border/50 max-h-80 overflow-y-auto">
                        {igemReqs.length === 0 && (
                          <p className="py-6 text-center text-sm text-muted-foreground">Bekleyen talep yok</p>
                        )}
                        {igemReqs.map(r => {
                          const s = getStation(r.station as never)
                          return (
                            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: `hsl(${s.color})` }}>
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
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tasks */}
                <AnimatePresence initial={false}>
                  {section === "tasks" && (
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-border/50 max-h-72 overflow-y-auto">
                        {tasks.length === 0 && (
                          <p className="py-6 text-center text-sm text-muted-foreground">Görev yok</p>
                        )}
                        {tasks.map(t => {
                          const s = getStation(t.station as never)
                          const statusColor = t.status === "done" ? "text-emerald-500" : t.status === "in_progress" ? "text-primary" : "text-muted-foreground"
                          return (
                            <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                              <span
                                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold text-white"
                                style={{ backgroundColor: `hsl(${s.color})` }}
                              >
                                {s.short}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{t.title}</p>
                                <p className={`truncate text-xs ${statusColor}`}>{t.assignee}</p>
                              </div>
                              <DeleteButton onConfirm={() => deleteTask(t.id)} />
                            </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Posts */}
                <AnimatePresence initial={false}>
                  {section === "posts" && (
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-border/50 max-h-72 overflow-y-auto">
                        {posts.length === 0 && (
                          <p className="py-6 text-center text-sm text-muted-foreground">Paylaşım yok</p>
                        )}
                        {posts.map(p => {
                          const s = getStation(p.station as never)
                          return (
                            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                              <span
                                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold text-white"
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
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Conversations */}
                <AnimatePresence initial={false}>
                  {section === "convs" && (
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="divide-y divide-border/50 max-h-96 overflow-y-auto">
                        {convs.length === 0 && (
                          <p className="py-6 text-center text-sm text-muted-foreground">Sohbet yok</p>
                        )}
                        {convs.map(conv => {
                          const members = conv.conversation_members.map(m => m.member_name)
                          const msgs = (conv.chat_messages ?? []).filter(m => !m.is_system)
                          const isOpen = openConvId === conv.id
                          const title = conv.type === "dm"
                            ? `DM: ${members.join(" & ")}`
                            : (conv.name ?? "Grup")
                          return (
                            <div key={conv.id} className="border-b border-border/50 last:border-0">
                              <button
                                onClick={() => setOpenConvId(isOpen ? null : conv.id)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-secondary"
                              >
                                <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {members.join(", ")} · {msgs.length} mesaj
                                  </p>
                                </div>
                                <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                              </button>
                              {isOpen && (
                                <div className="max-h-48 overflow-y-auto border-t border-border/30 bg-secondary/30">
                                  {msgs.length === 0 && (
                                    <p className="py-3 text-center text-xs text-muted-foreground">Mesaj yok</p>
                                  )}
                                  {msgs
                                    .slice()
                                    .sort((a, b) => a.created_at.localeCompare(b.created_at))
                                    .map((msg) => (
                                      <div key={msg.id} className="border-b border-border/20 px-4 py-2 last:border-0">
                                        <div className="flex items-baseline gap-2">
                                          <span className="shrink-0 text-[11px] font-semibold text-primary">{msg.sender_name}</span>
                                          <span className="text-[10px] text-muted-foreground">
                                            {new Date(msg.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                          </span>
                                        </div>
                                        <p className="text-xs text-foreground">{msg.text ?? ""}</p>
                                      </div>
                                    ))
                                  }
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Inline confirm-before-delete button
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
      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-destructive/10 active:text-destructive"
    >
      <Trash2 className="size-3.5" />
    </button>
  )
}
