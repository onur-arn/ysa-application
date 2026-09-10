"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Circle, CircleDot, CheckCircle2, MessageSquare, Send, ChevronDown, Check, Trash2, CalendarClock } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { type Task, type TaskStatus, type TaskPriority, type TaskComment } from "@/lib/data/tasks"
import { getStation, STATIONS, MEMBERS, type StationId } from "@/lib/data/stations"
import { Modal } from "@/components/ui/modal"
import { StationSelect, Field, inputClass } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { subscribeChannel } from "@/lib/supabase/realtime"
import { isAdminEmail } from "@/lib/admin"

type CurrentUser = { id: string; station: StationId; role: string; name: string; initials: string }

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"]

interface TasksClientProps {
  initialUserId?: string
  initialUserEmail?: string
  initialProfile?: { name: string; initials: string; station: string; role: string } | null
  initialProfiles?: { id: string; name: string; photo_url: string | null }[]
  initialTasks?: Record<string, unknown>[]
  initialComments?: Record<string, unknown>[]
}

function mapTasksFromRaw(
  tasksRaw: Record<string, unknown>[],
  commentsRaw: Record<string, unknown>[],
): Task[] {
  const commentsByTask: Record<string, TaskComment[]> = {}
  for (const c of commentsRaw) {
    const taskId = c.task_id as string
    commentsByTask[taskId] = commentsByTask[taskId] || []
    commentsByTask[taskId].push({
      id: c.id as string,
      author: (c.author as string) ?? "",
      initials: (c.initials as string) ?? "",
      text: (c.text as string) ?? "",
      time: new Date(c.created_at as string).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    })
  }
  return tasksRaw.map((t) => ({
    id: t.id as string,
    title: (t.title as string) ?? "",
    description: (t.description as string) ?? "",
    status: ((t.status as TaskStatus) ?? "todo"),
    priority: ((t.priority as TaskPriority) ?? "normal"),
    station: ((t.station as StationId) ?? "paris"),
    assignee: (t.assignee as string) ?? "Atanmadı",
    assigneeInitials: (t.assignee_initials as string) ?? "NA",
    assignedBy: (t.assigned_by as string) ?? "",
    assignedByInitials: (t.assigned_by_initials as string) ?? "",
    assignedByStation: ((t.assigned_by_station as StationId) ?? "paris"),
    comments: commentsByTask[t.id as string] ?? [],
    createdById: (t.created_by as string) ?? undefined,
    dueDate: (t.due_date as string) || undefined,
  }))
}

export function TasksClient({
  initialUserId = "",
  initialUserEmail = "",
  initialProfile = null,
  initialProfiles = [],
  initialTasks = [],
  initialComments = [],
}: TasksClientProps) {
  const { t } = useI18n()
  const isAdmin = isAdminEmail(initialUserEmail)
  const [tasks, setTasks] = useState<Task[]>(() => mapTasksFromRaw(initialTasks, initialComments))
  const [filter, setFilter] = useState<TaskStatus | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [myId, setMyId]             = useState(initialUserId)
  const [myStation, setMyStation] = useState<StationId>((initialProfile?.station as StationId) ?? "intl")
  const [myRole, setMyRole]       = useState(initialProfile?.role ?? "")
  const [myName, setMyName]       = useState(initialProfile?.name ?? "")
  const [myInitials, setMyInitials] = useState(initialProfile?.initials ?? "")
  const [photoMap, setPhotoMap]   = useState<Map<string, string>>(
    () => new Map(initialProfiles.filter(p => p.photo_url).map(p => [p.name, p.photo_url as string]))
  )

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("tasks-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks" }, (payload) => {
        const t = payload.new as Record<string, unknown>
        setTasks((prev) => {
          if (prev.some((x) => x.id === (t.id as string))) return prev
          return [{
            id: t.id as string,
            title: (t.title as string) ?? "",
            description: (t.description as string) ?? "",
            status: ((t.status as TaskStatus) ?? "todo"),
            priority: ((t.priority as TaskPriority) ?? "normal"),
            station: ((t.station as StationId) ?? "paris"),
            assignee: (t.assignee as string) ?? "Atanmadı",
            assigneeInitials: (t.assignee_initials as string) ?? "NA",
            assignedBy: (t.assigned_by as string) ?? "",
            assignedByInitials: (t.assigned_by_initials as string) ?? "",
            assignedByStation: ((t.assigned_by_station as StationId) ?? "paris"),
            comments: [],
            createdById: (t.created_by as string) ?? undefined,
            dueDate: (t.due_date as string) || undefined,
          }, ...prev]
        })
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks" }, (payload) => {
        const t = payload.new as Record<string, unknown>
        setTasks((prev) => prev.map((x) => x.id === (t.id as string) ? {
          ...x,
          title: (t.title as string) ?? x.title,
          description: (t.description as string) ?? x.description,
          status: (t.status as TaskStatus) ?? x.status,
          priority: (t.priority as TaskPriority) ?? x.priority,
          station: (t.station as StationId) ?? x.station,
          assignee: (t.assignee as string) ?? x.assignee,
          assigneeInitials: (t.assignee_initials as string) ?? x.assigneeInitials,
          assignedBy: (t.assigned_by as string) ?? x.assignedBy,
          assignedByInitials: (t.assigned_by_initials as string) ?? x.assignedByInitials,
          assignedByStation: (t.assigned_by_station as StationId) ?? x.assignedByStation,
          dueDate: (t.due_date as string) || undefined,
        } : x))
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tasks" }, (payload) => {
        setTasks((prev) => prev.filter((x) => x.id !== (payload.old as Record<string, unknown>).id))
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "task_comments" }, (payload) => {
        const c = payload.new as Record<string, unknown>
        setTasks((prev) => prev.map((t) => {
          if (t.id !== (c.task_id as string)) return t
          if (t.comments.some((x) => x.id === (c.id as string))) return t
          return {
            ...t,
            comments: [...t.comments, {
              id: c.id as string,
              author: (c.author as string) ?? "",
              initials: (c.initials as string) ?? "",
              text: (c.text as string) ?? "",
              time: new Date(c.created_at as string).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
            }],
          }
        }))
      })
    void subscribeChannel(supabase, channel, (status, err) => {
      if (status === "CHANNEL_ERROR") console.error("[tasks-realtime] channel error:", err)
      if (status === "TIMED_OUT") console.warn("[tasks-realtime] timed out")
    })

    return () => { supabase.removeChannel(channel) }
  }, [])

  const isIntl = myStation === "intl"

  // Visibility: intl sees all, stations see only their own tasks
  const visibleTasks = useMemo(
    () => myStation === "intl" ? tasks : tasks.filter((t) => t.station === myStation),
    [tasks, myStation],
  )

  const displayed = filter ? visibleTasks.filter((t) => t.status === filter) : visibleTasks

  const counts = useMemo(
    () => ({
      todo: visibleTasks.filter((t) => t.status === "todo").length,
      in_progress: visibleTasks.filter((t) => t.status === "in_progress").length,
      done: visibleTasks.filter((t) => t.status === "done").length,
    }),
    [visibleTasks],
  )

  async function cycleStatus(id: string) {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(task.status) + 1) % STATUS_ORDER.length]
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: next } : t))
    const supabase = createClient()
    await supabase.from("tasks").update({ status: next }).eq("id", id)
  }

  async function addComment(taskId: string, text: string) {
    const supabase = createClient()
    await supabase.from("task_comments").insert({ task_id: taskId, author: myName, initials: myInitials, text })
  }

  async function deleteTask(id: string) {
    const prev = tasks
    setTasks((t) => t.filter((x) => x.id !== id))
    try {
      const res = await fetch("/api/tasks/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: id }),
      })
      if (!res.ok) {
        setTasks(prev)
      }
    } catch {
      setTasks(prev)
    }
  }

  return (
    <div>
      {/* Status counters */}
      <div className="grid grid-cols-3 gap-2 px-4 pt-3">
        <CounterCard
          label={t("tasks.todo")}
          count={counts.todo}
          active={filter === "todo"}
          onClick={() => setFilter(filter === "todo" ? null : "todo")}
          color="oklch(0.6 0.02 250)"
        />
        <CounterCard
          label={t("tasks.inProgress")}
          count={counts.in_progress}
          active={filter === "in_progress"}
          onClick={() => setFilter(filter === "in_progress" ? null : "in_progress")}
          color="oklch(0.68 0.078 205)"
        />
        <CounterCard
          label={t("tasks.done")}
          count={counts.done}
          active={filter === "done"}
          onClick={() => setFilter(filter === "done" ? null : "done")}
          color="oklch(0.7 0.13 150)"
        />
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-3 px-4 pt-4">
        <AnimatePresence initial={false}>
          {displayed.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              canDelete={isAdmin || (!!task.createdById && task.createdById === myId)}
              photoMap={photoMap}
              onCycle={() => cycleStatus(task.id)}
              onComment={(text) => addComment(task.id, text)}
              onDelete={() => deleteTask(task.id)}
            />
          ))}
        </AnimatePresence>
        {displayed.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("tasks.empty")}</p>
        )}
      </div>

      {/* FAB — tous les membres peuvent créer une tâche */}
      <button
          onClick={() => setCreateOpen(true)}
          className="fixed bottom-28 right-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90"
          aria-label={t("tasks.newTask")}
        >
          <Plus className="size-6" />
        </button>

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        isIntl={isIntl}
        creatorStation={myStation}
        creatorName={myName}
        creatorInitials={myInitials}
        onCreate={async (task) => {
          setTasks((prev) => {
            if (prev.some((t) => t.id === task.id)) return prev
            return [task, ...prev]
          })
          setCreateOpen(false)
          const supabase = createClient()
          const { data: { user: u } } = await supabase.auth.getUser()
          const { error } = await supabase.from("tasks").insert({
            id: task.id,
            title: task.title,
            description: task.description || null,
            status: task.status,
            priority: task.priority,
            station: task.station,
            assignee: task.assignee || null,
            assignee_initials: task.assigneeInitials || null,
            assigned_by: task.assignedBy || null,
            assigned_by_initials: task.assignedByInitials || null,
            assigned_by_station: task.assignedByStation || null,
            created_by: u?.id ?? null,
            due_date: task.dueDate || null,
          })
          if (error) {
            setTasks((prev) => prev.filter((t) => t.id !== task.id))
          } else {
            setTasks((prev) =>
              prev.map((t) => (t.id === task.id ? { ...t, createdById: u?.id ?? undefined } : t)),
            )
          }
        }}
      />
    </div>
  )
}

function CounterCard({
  label,
  count,
  active,
  onClick,
  color,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
  color: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center rounded-2xl border p-3 transition-all ${
        active ? "border-transparent text-white" : "border-border bg-card text-foreground"
      }`}
      style={active ? { backgroundColor: color } : undefined}
    >
      <span className="text-2xl font-bold">{count}</span>
      <span className={`mt-0.5 text-center text-[11px] font-medium ${active ? "text-white/90" : "text-muted-foreground"}`}>
        {label}
      </span>
    </button>
  )
}

function MiniAvatar({
  name, initials, photoMap, colorClass, size = "size-5", textSize = "text-[9px]",
}: {
  name: string; initials: string; photoMap: Map<string, string>
  colorClass: string; size?: string; textSize?: string
}) {
  const photo = photoMap.get(name)
  if (photo) {
    return <img src={photo} alt={initials} className={`${size} shrink-0 rounded-full object-cover`} />
  }
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full ${colorClass} font-bold ${textSize}`}>
      {initials}
    </span>
  )
}

const STATUS_ICON: Record<TaskStatus, typeof Circle> = {
  todo: Circle,
  in_progress: CircleDot,
  done: CheckCircle2,
}
const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: "text-muted-foreground",
  in_progress: "text-primary",
  done: "text-emerald-500",
}

function priorityStyle(p: TaskPriority) {
  switch (p) {
    case "urgent": return "bg-destructive/10 text-destructive"
    case "normal": return "bg-primary/10 text-primary"
    case "low": return "bg-muted text-muted-foreground"
  }
}

function TaskCard({
  task,
  canDelete,
  photoMap,
  onCycle,
  onComment,
  onDelete,
}: {
  task: Task
  canDelete: boolean
  photoMap: Map<string, string>
  onCycle: () => void
  onComment: (text: string) => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  const [showComments, setShowComments] = useState(false)
  const [draft, setDraft] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const station = getStation(task.station)
  const StatusIcon = STATUS_ICON[task.status]
  const overdue = !!task.dueDate && task.status !== "done" && task.dueDate < new Date().toISOString().slice(0, 10)

  const priorityLabel: Record<TaskPriority, string> = {
    urgent: t("tasks.urgent"),
    normal: t("tasks.normal"),
    low: t("tasks.low"),
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`overflow-hidden rounded-2xl border bg-card ${
        overdue ? "border-destructive/40" : "border-border"
      }`}
    >
      <div className="flex gap-3 p-3.5">
        <button
          onClick={onCycle}
          className={`mt-0.5 shrink-0 ${STATUS_COLOR[task.status]} transition-transform active:scale-90`}
          aria-label={t("tasks.changeStatus")}
        >
          <StatusIcon className="size-6" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`font-semibold text-foreground ${task.status === "done" ? "text-muted-foreground line-through" : ""}`}>
              {task.title}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${priorityStyle(task.priority)}`}>
                {priorityLabel[task.priority]}
              </span>
              {canDelete && (
                confirmDelete ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onDelete()}
                      className="rounded-lg bg-destructive px-2 py-0.5 text-[11px] font-bold text-white"
                    >
                      Sil
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-lg border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      İptal
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
                    className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-destructive/10 active:text-destructive"
                    aria-label="Görevi sil"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )
              )}
            </div>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
              style={{ backgroundColor: `hsl(${station.color})` }}
            >
              {station.short}
            </span>
            {/* assignedBy → assignee */}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MiniAvatar name={task.assignedBy} initials={task.assignedByInitials} photoMap={photoMap} colorClass="bg-primary/15 text-primary" />
              <span className="max-w-[72px] truncate">{task.assignedBy}</span>
              <span className="text-muted-foreground/50">→</span>
              <MiniAvatar name={task.assignee} initials={task.assigneeInitials} photoMap={photoMap} colorClass="bg-secondary text-secondary-foreground" />
              <span className="max-w-[72px] truncate">{task.assignee}</span>
            </span>
          </div>
          {task.dueDate && (
            <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              overdue
                ? "bg-destructive/10 text-destructive"
                : "bg-secondary text-muted-foreground"
            }`}>
              <CalendarClock className="size-3" />
              {formatDueDate(task.dueDate)}
              {overdue ? " · Gecikti" : ""}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setShowComments((s) => !s)}
        className="flex w-full items-center gap-2 border-t border-border px-3.5 py-2.5 text-xs font-medium text-muted-foreground"
      >
        <MessageSquare className="size-4" />
        {task.comments.length} {t("tasks.comments")}
        <ChevronDown className={`ml-auto size-4 transition-transform ${showComments ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-secondary/40"
          >
            <div className="flex flex-col gap-2 p-3">
              {task.comments.map((c: TaskComment) => (
                <div key={c.id} className="flex gap-2">
                  <MiniAvatar name={c.author} initials={c.initials} photoMap={photoMap} colorClass="bg-primary/15 text-primary" size="size-7" textSize="text-[10px]" />
                  <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-card px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">{c.author}</span>
                      <span className="text-[10px] text-muted-foreground">{c.time}</span>
                    </div>
                    <p className="text-sm text-foreground">{c.text}</p>
                  </div>
                </div>
              ))}
              <div className="mt-1 flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && draft.trim()) {
                      onComment(draft.trim())
                      setDraft("")
                    }
                  }}
                  placeholder={t("tasks.addComment")}
                  className="h-10 flex-1 rounded-full border border-input bg-card px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
                <button
                  onClick={() => {
                    if (draft.trim()) {
                      onComment(draft.trim())
                      setDraft("")
                    }
                  }}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                  disabled={!draft.trim()}
                  aria-label={t("common.send")}
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Membres par station (annuaire + Supabase profiles) ────────────────────────
type AssigneeMember = { name: string; initials: string; role: string; photoUrl?: string }

function CreateTaskModal({
  open,
  onClose,
  onCreate,
  isIntl,
  creatorStation,
  creatorName,
  creatorInitials,
}: {
  open: boolean
  onClose: () => void
  onCreate: (t: Task) => void | Promise<void>
  isIntl: boolean
  creatorStation: StationId
  creatorName: string
  creatorInitials: string
}) {
  const { t } = useI18n()
  const [title, setTitle]                       = useState("")
  const [description, setDescription]           = useState("")
  const [station, setStation]                   = useState<string>(isIntl ? "paris" : creatorStation)
  const [priority, setPriority]                 = useState<TaskPriority>("normal")
  const [dueDate, setDueDate]                   = useState("")
  const [selectedAssignee, setSelectedAssignee] = useState<AssigneeMember | null>(null)
  const [stationMembers, setStationMembers]     = useState<AssigneeMember[]>([])
  const [submitting, setSubmitting]             = useState(false)
  const submittingRef = useRef(false)

  const targetStation = isIntl ? station : creatorStation

  // Recharge les membres dès que la station cible change
  useEffect(() => {
    const base: AssigneeMember[] = MEMBERS
      .filter(m => m.station === targetStation)
      .map(m => ({ name: m.name, initials: m.initials, role: m.role }))
    setStationMembers(base)
    setSelectedAssignee(null)

    async function loadFromSupabase() {
      const supabase = createClient()
      const { data } = await supabase.from("profiles").select("name,initials,role,photo_url").eq("station", targetStation)
      if (data && data.length > 0) {
        const extra: AssigneeMember[] = data.map((p) => ({
          name: p.name ?? "",
          initials: p.initials ?? "",
          role: p.role ?? "",
          photoUrl: p.photo_url ?? undefined,
        }))
        setStationMembers([...base, ...extra])
      }
    }
    loadFromSupabase()
  }, [targetStation])

  async function submit() {
    if (!title.trim() || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      await onCreate({
        id: crypto.randomUUID(),
        title: title.trim(),
        description: description.trim(),
        station: targetStation as StationId,
        priority,
        assignedBy: creatorName || "Uluslararası Büro",
        assignedByInitials: creatorInitials || "INT",
        assignedByStation: creatorStation,
        assignee: selectedAssignee?.name ?? "Atanmadı",
        assigneeInitials: selectedAssignee?.initials ?? "NA",
        status: "todo",
        comments: [],
        dueDate: dueDate || undefined,
      })
      setTitle("")
      setDescription("")
      setStation(isIntl ? "paris" : creatorStation)
      setPriority("normal")
      setDueDate("")
      setSelectedAssignee(null)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const priorities: { value: TaskPriority; label: string }[] = [
    { value: "urgent", label: t("tasks.urgent") },
    { value: "normal", label: t("tasks.normal") },
    { value: "low", label: t("tasks.low") },
  ]

  const targetStationInfo = getStation(targetStation as StationId)

  return (
    <Modal open={open} onClose={onClose} title={t("tasks.newTask")}>
      <div className="flex flex-col gap-4">
        <Field label={t("agenda.eventTitle")}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder={t("tasks.titlePlaceholder")} />
        </Field>
        <Field label={t("tasks.description")}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${inputClass} h-auto py-2.5`}
            placeholder={t("tasks.descPlaceholder")}
          />
        </Field>
        <Field label={t("tasks.priority")}>
          <div className="grid grid-cols-3 gap-2">
            {priorities.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                  priority === p.value ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Son tarih">
          <input
            type="date"
            lang="tr"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className={inputClass + " text-sm"}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">İsteğe bağlı — görev için deadline seçin</p>
        </Field>

        {/* Station (intl seulement) */}
        {isIntl ? (
          <Field label={t("agenda.station")}>
            <StationSelect value={station} onChange={setStation} />
          </Field>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: `hsl(${targetStationInfo.color})` }} />
            <span className="text-sm font-medium text-foreground">{targetStationInfo.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">Station fixée</span>
          </div>
        )}

        {/* Atanan — membres de la station cible */}
        <Field label={t("tasks.assignee")}>
          <div className="overflow-hidden rounded-xl border border-input">
            {stationMembers.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                Bu istasyonda kayıtlı üye yok
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto">
                {/* Tümü — tüm ekip seçeneği */}
                {(() => {
                  const tumuSelected = selectedAssignee?.name === "Tümü"
                  return (
                    <button
                      key="tumuoption"
                      type="button"
                      onClick={() => setSelectedAssignee(tumuSelected ? null : { name: "Tümü", initials: "TM", role: "Tüm ekip" })}
                      className={`flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left transition-colors ${tumuSelected ? "bg-primary/8" : "hover:bg-secondary/60"}`}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                        TM
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">Tümü</p>
                        <p className="truncate text-xs text-muted-foreground">Tüm ekip</p>
                      </div>
                      {tumuSelected && <Check className="size-4 shrink-0 text-primary" />}
                    </button>
                  )
                })()}
                {stationMembers.map((m, i) => {
                  const selected = selectedAssignee?.name === m.name
                  return (
                    <button
                      key={`${m.name}-${i}`}
                      type="button"
                      onClick={() => setSelectedAssignee(selected ? null : m)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        i < stationMembers.length - 1 ? "border-b border-border" : ""
                      } ${selected ? "bg-primary/8" : "hover:bg-secondary/60"}`}
                    >
                      {m.photoUrl ? (
                        <img src={m.photoUrl} alt={m.initials} className="size-8 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ backgroundColor: `hsl(${targetStationInfo.color})` }}
                        >
                          {m.initials}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.role}</p>
                      </div>
                      {selected && <Check className="size-4 shrink-0 text-primary" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {selectedAssignee && (
            <p className="mt-1.5 text-xs text-primary">
              ✓ {selectedAssignee.name} seçildi
            </p>
          )}
        </Field>

        <Button onClick={submit} className="mt-1 h-12" disabled={!title.trim() || submitting}>
          {submitting ? "Kaydediliyor…" : t("common.create")}
        </Button>
      </div>
    </Modal>
  )
}

function formatDueDate(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00")
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })
}
