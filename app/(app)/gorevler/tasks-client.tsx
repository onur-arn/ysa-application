"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Circle, CircleDot, CheckCircle2, MessageSquare, Send, ChevronDown } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { TASKS, type Task, type TaskStatus, type TaskPriority, type TaskComment } from "@/lib/data/tasks"
import { getStation, type StationId } from "@/lib/data/stations"
import { PageHeader } from "@/components/app-shell"
import { Modal } from "@/components/ui/modal"
import { StationSelect, Field, inputClass } from "@/components/form-fields"
import { Button } from "@/components/ui/button"

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"]

export function TasksClient() {
  const { t } = useI18n()
  const [tasks, setTasks] = useState<Task[]>(TASKS)
  const [filter, setFilter] = useState<TaskStatus | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const counts = useMemo(
    () => ({
      todo: tasks.filter((t) => t.status === "todo").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
    }),
    [tasks],
  )

  const visible = filter ? tasks.filter((t) => t.status === filter) : tasks

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
                { id: String(Date.now()), author: "Moi", initials: "MO", text, time: "À l'instant" },
              ],
            }
          : t,
      ),
    )
  }

  return (
    <div>
      <PageHeader title={t("nav.tasks")} />

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
          {visible.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onCycle={() => cycleStatus(task.id)}
              onComment={(text) => addComment(task.id, text)}
            />
          ))}
        </AnimatePresence>
        {visible.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("tasks.empty")}</p>
        )}
      </div>

      {/* FAB */}
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
    case "urgent":
      return "bg-destructive/10 text-destructive"
    case "normal":
      return "bg-primary/10 text-primary"
    case "low":
      return "bg-muted text-muted-foreground"
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
            <p
              className={`font-semibold text-foreground ${task.status === "done" ? "text-muted-foreground line-through" : ""}`}
            >
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
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-secondary-foreground">
                {task.assigneeInitials}
              </span>
              {task.assignee}
            </span>
          </div>
        </div>
      </div>

      {/* Comments toggle */}
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

function CreateTaskModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (t: Task) => void
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [station, setStation] = useState<string>("paris")
  const [priority, setPriority] = useState<TaskPriority>("normal")
  const [assignee, setAssignee] = useState("")

  function submit() {
    if (!title.trim()) return
    const initials =
      assignee
        .trim()
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "NA"
    onCreate({
      id: String(Date.now()),
      title: title.trim(),
      description: description.trim(),
      station: station as StationId,
      priority,
      assignee: assignee.trim() || "Non assigné",
      assigneeInitials: initials,
      status: "todo",
      comments: [],
    })
    setTitle("")
    setDescription("")
    setStation("paris")
    setPriority("normal")
    setAssignee("")
  }

  const priorities: { value: TaskPriority; label: string }[] = [
    { value: "urgent", label: t("tasks.urgent") },
    { value: "normal", label: t("tasks.normal") },
    { value: "low", label: t("tasks.low") },
  ]

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
        <Field label={t("tasks.assignee")}>
          <input value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputClass} placeholder="Ex : Lucas Martin" />
        </Field>
        <Field label={t("agenda.station")}>
          <StationSelect value={station} onChange={setStation} />
        </Field>
        <Button onClick={submit} className="mt-1 h-12">
          {t("common.create")}
        </Button>
      </div>
    </Modal>
  )
}
