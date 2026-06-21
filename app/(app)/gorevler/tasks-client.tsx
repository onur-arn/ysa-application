"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Circle, CircleDot, CheckCircle2, MessageSquare, Send, ChevronDown, Check } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { TASKS, type Task, type TaskStatus, type TaskPriority, type TaskComment } from "@/lib/data/tasks"
import { getStation, STATIONS, MEMBERS, type StationId } from "@/lib/data/stations"
import { PageHeader } from "@/components/app-shell"
import { Modal } from "@/components/ui/modal"
import { StationSelect, Field, inputClass } from "@/components/form-fields"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type CurrentUser = { station: StationId; role: string; name: string; initials: string }

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"]

export function TasksClient() {
  const { t } = useI18n()
  const [tasks, setTasks] = useState<Task[]>(TASKS)
  const [filter, setFilter] = useState<TaskStatus | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [myStation, setMyStation] = useState<StationId>("intl")
  const [myRole, setMyRole]       = useState("")
  const [myName, setMyName]       = useState("")
  const [myInitials, setMyInitials] = useState("")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from("profiles").select("name,initials,station,role").eq("id", user.id).single()
      if (profile) {
        setMyStation((profile.station as StationId) ?? "intl")
        setMyRole(profile.role ?? "")
        setMyName(profile.name ?? "")
        setMyInitials(profile.initials ?? "")
      }
    }
    load()
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

  function cycleStatus(id: string) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const next = STATUS_ORDER[(STATUS_ORDER.indexOf(t.status) + 1) % STATUS_ORDER.length]
        return { ...t, status: next }
      }),
    )
  }

  function addComment(taskId: string, text: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              comments: [
                ...t.comments,
                { id: String(Date.now()), author: myName, initials: myInitials, text, time: "Şimdi" },
              ],
            }
          : t,
      ),
    )
  }

  const myStationInfo = getStation(myStation)

  return (
    <div>
      <PageHeader title={t("nav.tasks")} />

      {/* Station indicator */}
      <div className="mx-4 mb-1 mt-2 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
        <span
          className="size-2.5 rounded-full"
          style={{ backgroundColor: `hsl(${myStationInfo.color})` }}
        />
        <span>
          {myStation === "intl"
            ? "Uluslararası Büro — tüm görevleri görüyorsunuz"
            : `${myStationInfo.name} — yalnızca istasyonunuzun görevleri`}
        </span>
      </div>

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
              onCycle={() => cycleStatus(task.id)}
              onComment={(text) => addComment(task.id, text)}
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
          className="fixed bottom-20 right-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90"
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
        onCreate={(task) => {
          setTasks((prev) => [task, ...prev])
          setCreateOpen(false)
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
  onCycle,
  onComment,
}: {
  task: Task
  onCycle: () => void
  onComment: (text: string) => void
}) {
  const { t } = useI18n()
  const [showComments, setShowComments] = useState(false)
  const [draft, setDraft] = useState("")
  const station = getStation(task.station)
  const StatusIcon = STATUS_ICON[task.status]

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
      className="overflow-hidden rounded-2xl border border-border bg-card"
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
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${priorityStyle(task.priority)}`}>
              {priorityLabel[task.priority]}
            </span>
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
              <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                {task.assignedByInitials}
              </span>
              <span className="max-w-[72px] truncate">{task.assignedBy}</span>
              <span className="text-muted-foreground/50">→</span>
              <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-secondary-foreground">
                {task.assigneeInitials}
              </span>
              <span className="max-w-[72px] truncate">{task.assignee}</span>
            </span>
          </div>
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
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                    {c.initials}
                  </span>
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
type AssigneeMember = { name: string; initials: string; role: string }

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
  onCreate: (t: Task) => void
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
  const [selectedAssignee, setSelectedAssignee] = useState<AssigneeMember | null>(null)
  const [stationMembers, setStationMembers]     = useState<AssigneeMember[]>([])

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
      const { data } = await supabase.from("profiles").select("name,initials,role").eq("station", targetStation)
      if (data && data.length > 0) {
        const extra: AssigneeMember[] = data.map((p) => ({
          name: p.name ?? "",
          initials: p.initials ?? "",
          role: p.role ?? "",
        }))
        setStationMembers([...base, ...extra])
      }
    }
    loadFromSupabase()
  }, [targetStation])

  function submit() {
    if (!title.trim()) return
    onCreate({
      id: String(Date.now()),
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
    })
    setTitle("")
    setDescription("")
    setStation(isIntl ? "paris" : creatorStation)
    setPriority("normal")
    setSelectedAssignee(null)
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
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: `hsl(${targetStationInfo.color})` }}
                      >
                        {m.initials}
                      </span>
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

        <Button onClick={submit} className="mt-1 h-12" disabled={!title.trim()}>
          {t("common.create")}
        </Button>
      </div>
    </Modal>
  )
}
