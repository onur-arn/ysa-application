"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, CalendarDays, List, MapPin, Clock, Plus, Link as LinkIcon, FileText, Trash2, Pencil } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { createClient } from "@/lib/supabase/client"
import { type EventItem } from "@/lib/data/feed"
import { STATIONS_SORTED, getStation, type StationId } from "@/lib/data/stations"
import { PageHeader } from "@/components/app-shell"
import { Modal } from "@/components/ui/modal"
import { StationSelect, Field, inputClass } from "@/components/form-fields"
import { Button } from "@/components/ui/button"

type View = "calendar" | "list"
type Filter = "all" | StationId

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
]
const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"]
const WEEKDAYS_FULL = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]

interface AgendaClientProps {
  initialUserId?: string
  initialUserStation?: string
  initialIsIntl?: boolean
  initialEvents?: Record<string, unknown>[]
}

function mapEventsFromRaw(eventsRaw: Record<string, unknown>[]): EventItem[] {
  return eventsRaw.map((e) => ({
    id: e.id as string,
    title: (e.title as string) ?? "",
    date: (e.date as string) ?? "",
    time: (e.time as string) ?? "18:00",
    place: (e.place as string) ?? "—",
    station: ((e.station as StationId) ?? "paris"),
    description: (e.description as string) ?? undefined,
    link: (e.link as string) ?? undefined,
    likes: 0,
    participantsCount: 0,
    notAttendingCount: 0,
    comments: [],
    createdBy: (e.created_by as string) ?? undefined,
  }))
}

export function AgendaClient({
  initialUserId = "",
  initialUserStation = "paris",
  initialIsIntl = false,
  initialEvents = [],
}: AgendaClientProps) {
  const { t } = useI18n()
  const [view, setView] = useState<View>("calendar")
  const [filter, setFilter] = useState<Filter>("all")
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [events, setEvents] = useState<EventItem[]>(() => mapEventsFromRaw(initialEvents))
  const [selected, setSelected] = useState<EventItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null)
  const [userStation, setUserStation] = useState<string>(initialUserStation)
  const [isIntl, setIsIntl] = useState(initialIsIntl)
  const [currentUserId, setCurrentUserId] = useState<string | null>(initialUserId || null)
  const [insertError, setInsertError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("events-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, (payload) => {
        const e = payload.new as Record<string, unknown>
        setEvents((prev) => {
          if (prev.some((x) => x.id === (e.id as string))) return prev
          return [...prev, {
            id: e.id as string,
            title: (e.title as string) ?? "",
            date: (e.date as string) ?? "",
            time: (e.time as string) ?? "18:00",
            place: (e.place as string) ?? "—",
            station: ((e.station as StationId) ?? "paris"),
            description: (e.description as string) ?? undefined,
            link: (e.link as string) ?? undefined,
            likes: 0, participantsCount: 0, notAttendingCount: 0, comments: [],
            createdBy: (e.created_by as string) ?? undefined,
          }]
        })
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "events" }, (payload) => {
        const e = payload.new as Record<string, unknown>
        setEvents((prev) => prev.map((x) =>
          x.id === (e.id as string) ? {
            ...x,
            title: (e.title as string) ?? x.title,
            date: (e.date as string) ?? x.date,
            time: (e.time as string) ?? x.time,
            place: (e.place as string) ?? x.place,
            station: ((e.station as StationId) ?? x.station),
            description: (e.description as string) ?? undefined,
            link: (e.link as string) ?? undefined,
          } : x
        ))
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "events" }, (payload) => {
        setEvents((prev) => prev.filter((e) => e.id !== (payload.old as Record<string, unknown>).id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = useMemo(
    () => events.filter((e) => filter === "all" || e.station === filter),
    [events, filter],
  )

  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  const monthEvents = useMemo(
    () =>
      filtered
        .filter((e) => {
          const d = localDate(e.date)
          return d.getFullYear() === year && d.getMonth() === month
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
    [filtered, year, month],
  )

  const eventsByDay = useMemo(() => {
    const map: Record<number, EventItem[]> = {}
    monthEvents.forEach((e) => {
      const day = localDate(e.date).getDate()
      map[day] = map[day] || []
      map[day].push(e)
    })
    return map
  }, [monthEvents])

  const firstDayIdx = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function changeMonth(delta: number) {
    setCursor(new Date(year, month + delta, 1))
  }

  async function handleDelete(eventId: string) {
    const supabase = createClient()
    const { error } = await supabase.from("events").delete().eq("id", eventId)
    if (!error) {
      setEvents((prev) => prev.filter((e) => e.id !== eventId))
      setSelected(null)
    }
  }

  async function handleUpdate(updated: EventItem) {
    if (!editingEvent) return
    const supabase = createClient()
    const { error } = await supabase.from("events").update({
      title: updated.title,
      date: updated.date,
      time: updated.time,
      place: updated.place !== "—" ? updated.place : null,
      station: updated.station,
      description: updated.description ?? null,
      link: updated.link ?? null,
    }).eq("id", editingEvent.id)

    if (!error) {
      setEvents((prev) => prev.map((e) =>
        e.id === editingEvent.id ? { ...e, ...updated, id: editingEvent.id, createdBy: editingEvent.createdBy } : e
      ))
    }
    setEditingEvent(null)
  }

  return (
    <div>
      <PageHeader title={t("nav.agenda")} />

      {/* Station filter */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2 pt-3">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={t("agenda.all")} />
        {STATIONS_SORTED.map((s) => (
          <FilterChip
            key={s.id}
            active={filter === s.id}
            onClick={() => setFilter(s.id)}
            label={s.city}
            color={s.color}
          />
        ))}
      </div>

      {/* View toggle */}
      <div className="px-4 pb-3">
        <div className="flex gap-1 rounded-xl bg-secondary p-1">
          {(["calendar", "list"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`relative flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                view === v ? "text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {view === v && (
                <motion.span
                  layoutId="agendaview"
                  className="absolute inset-0 rounded-lg bg-primary"
                  transition={{ type: "spring", stiffness: 600, damping: 30 }}
                />
              )}
              <span className="relative flex items-center justify-center gap-1.5">
                {v === "calendar" ? <CalendarDays className="size-4" /> : <List className="size-4" />}
                {v === "calendar" ? t("agenda.calendar") : t("agenda.list")}
              </span>
            </button>
          ))}
        </div>
      </div>

      {view === "calendar" ? (
        <div className="px-4">
          {/* Month nav */}
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => changeMonth(-1)} className="flex size-9 items-center justify-center rounded-full active:bg-secondary">
              <ChevronLeft className="size-5" />
            </button>
            <h2 className="font-heading text-base font-bold">
              {MONTHS_TR[month]} {year}
            </h2>
            <button onClick={() => changeMonth(1)} className="flex size-9 items-center justify-center rounded-full active:bg-secondary">
              <ChevronRight className="size-5" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="py-1 text-center text-xs font-semibold text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayIdx }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dayEvents = eventsByDay[day] || []
              const hasEvents = dayEvents.length > 0
              return (
                <button
                  key={day}
                  onClick={() => hasEvents && setSelected(dayEvents[0])}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors ${
                    hasEvents ? "bg-primary/10 font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {day}
                  {hasEvents && (
                    <span className="mt-0.5 flex gap-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: `hsl(${getStation(e.station).color})` }}
                        />
                      ))}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {monthEvents.length === 0 && (
            <p className="mt-6 py-4 text-center text-sm text-muted-foreground">{t("agenda.noEvents")}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-4">
          {[...filtered]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((e) => (
              <EventRow key={e.id} event={e} onClick={() => setSelected(e)} showMonth />
            ))}
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("agenda.noEvents")}</p>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-28 right-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90"
        aria-label={t("agenda.createEvent")}
      >
        <Plus className="size-6" />
      </button>

      {/* Event detail */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={t("agenda.eventDetail")}>
        {selected && (
          <div className="flex flex-col gap-4">
            {/* Author actions */}
            {selected.createdBy && selected.createdBy === currentUserId && (
              <div className="flex gap-2 self-end">
                <button
                  onClick={() => { setEditingEvent(selected); setSelected(null) }}
                  className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary transition-colors active:bg-primary/10"
                >
                  <Pencil className="size-4" /> Düzenle
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive transition-colors active:bg-destructive/10"
                >
                  <Trash2 className="size-4" /> Sil
                </button>
              </div>
            )}

            <div
              className="rounded-2xl p-4 text-white"
              style={{
                background: `linear-gradient(135deg, hsl(${getStation(selected.station).color}), hsl(${getStation(selected.station).color} / 0.7))`,
              }}
            >
              <h3 className="font-heading text-lg font-bold text-balance">{selected.title}</h3>
              <p className="mt-1 text-sm text-white/90">{getStation(selected.station).name}</p>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <CalendarDays className="size-5 shrink-0 text-primary" />
              <span>{formatLongDate(selected.date)}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="size-5 shrink-0 text-primary" />
              <span>{selected.time}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="size-5 shrink-0 text-primary" />
              <span>{selected.place}</span>
            </div>
            {selected.description && (
              <div className="flex items-start gap-3 text-sm">
                <FileText className="size-5 shrink-0 text-primary mt-0.5" />
                <span className="text-foreground">{selected.description}</span>
              </div>
            )}
            {selected.link && (
              <div className="flex items-center gap-3 text-sm">
                <LinkIcon className="size-5 shrink-0 text-primary" />
                <a
                  href={selected.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-primary underline"
                >
                  {selected.link}
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Insert error banner */}
      {insertError && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <span>{insertError}</span>
          <button onClick={() => setInsertError(null)} className="shrink-0 font-bold">✕</button>
        </div>
      )}

      {/* Create event */}
      <EventFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        userStation={userStation}
        isIntl={isIntl}
        onSubmit={async (e) => {
          setCreateOpen(false)
          setInsertError(null)
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          // Pre-generate UUID client-side to avoid relying on .select() after insert
          // (which fails when PostgREST schema cache is stale)
          const newId = crypto.randomUUID()
          const newEvent = { ...e, id: newId, createdBy: user?.id }

          // Show event immediately in UI
          setEvents((prev) => [...prev, newEvent])
          if (e.date) {
            const d = new Date(e.date + "T00:00:00")
            setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
          }
          setSelected(newEvent)

          const { error } = await supabase.from("events").insert({
            id: newId,
            title: e.title,
            date: e.date,
            time: e.time,
            place: e.place !== "—" ? e.place : null,
            station: e.station,
            description: e.description ?? null,
            link: e.link ?? null,
            created_by: user?.id ?? null,
          })

          if (error) {
            console.error("[agenda] insert event failed:", error.message)
            setEvents((prev) => prev.filter((x) => x.id !== newId))
            setSelected(null)
            setInsertError(`Etkinlik kaydedilemedi: ${error.message}`)
          }
        }}
      />

      {/* Edit event */}
      {editingEvent && (
        <EventFormModal
          open={!!editingEvent}
          onClose={() => setEditingEvent(null)}
          userStation={userStation}
          isIntl={isIntl}
          initialValues={editingEvent}
          onSubmit={handleUpdate}
        />
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean
  onClick: () => void
  label: string
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
      }`}
    >
      {color && <span className="size-2 rounded-full" style={{ backgroundColor: `hsl(${color})` }} />}
      {label}
    </button>
  )
}

function EventRow({
  event,
  onClick,
  showMonth,
}: {
  event: EventItem
  onClick: () => void
  showMonth?: boolean
}) {
  const station = getStation(event.station)
  const d = localDate(event.date)
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors active:bg-secondary"
    >
      <div
        className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl text-white"
        style={{ backgroundColor: `hsl(${station.color})` }}
      >
        <span className="text-base font-bold leading-none">{d.getDate()}</span>
        {showMonth && <span className="text-[10px] uppercase">{MONTHS_TR[d.getMonth()].slice(0, 3)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{event.title}</p>
        <div className="mt-0.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3 shrink-0" />
            {event.time}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{event.place}</span>
          </span>
        </div>
      </div>
    </button>
  )
}

function EventFormModal({
  open,
  onClose,
  onSubmit,
  userStation = "paris",
  isIntl = false,
  initialValues,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (e: EventItem) => void | Promise<void>
  userStation?: string
  isIntl?: boolean
  initialValues?: EventItem
}) {
  const { t } = useI18n()
  const isEdit = !!initialValues

  const [title, setTitle]       = useState(initialValues?.title ?? "")
  const [day, setDay]           = useState(initialValues?.date ?? "")
  const [time, setTime]         = useState(initialValues?.time ?? "")
  const [place, setPlace]       = useState(initialValues?.place === "—" ? "" : (initialValues?.place ?? ""))
  const [description, setDescription] = useState(initialValues?.description ?? "")
  const [link, setLink]         = useState(initialValues?.link ?? "")
  const [station, setStation]   = useState<string>(initialValues?.station ?? userStation)

  useEffect(() => {
    if (!initialValues) setStation(userStation)
  }, [userStation, initialValues])

  function submit() {
    if (!title.trim() || !day || !time) return
    onSubmit({
      id: initialValues?.id ?? String(Date.now()),
      title: title.trim(),
      date: day,
      time: time,
      place: place || "—",
      station: station as StationId,
      description: description.trim() || undefined,
      link: link.trim() || undefined,
      likes: 0,
      participantsCount: 0,
      notAttendingCount: 0,
      comments: [],
    })
    if (!isEdit) {
      setTitle(""); setDay(""); setTime(""); setPlace("")
      setDescription(""); setLink(""); setStation(userStation)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Etkinliği düzenle" : t("agenda.createEvent")}>
      <div className="flex flex-col gap-4">
        <Field label={t("agenda.eventTitle")}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder={t("agenda.eventTitlePlaceholder")} />
        </Field>

        {/* Gün + Saat — tailles fixes compactes */}
        <div className="flex gap-2">
          <div className="w-[145px] shrink-0">
            <Field label={t("agenda.day")}>
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={inputClass + " text-sm px-2"} />
            </Field>
          </div>
          <div className="w-[88px] shrink-0">
            <Field label={t("agenda.time")}>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass + " text-sm px-2"} />
            </Field>
          </div>
        </div>

        <Field label={t("agenda.place")}>
          <input value={place} onChange={(e) => setPlace(e.target.value)} className={inputClass} placeholder={t("agenda.placePlaceholder")} />
        </Field>
        <Field label="Açıklama">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${inputClass} h-auto py-2.5`}
            placeholder="Etkinlik açıklaması..."
          />
        </Field>
        <Field label="Bağlantı (Zoom vb.)">
          <input value={link} onChange={(e) => setLink(e.target.value)} className={inputClass} placeholder="https://zoom.us/..." />
        </Field>
        {isIntl ? (
          <Field label={t("agenda.station")}>
            <StationSelect value={station} onChange={setStation} />
          </Field>
        ) : (
          <Field label={t("agenda.station")}>
            <div className={inputClass + " flex items-center gap-2 bg-muted cursor-not-allowed"}>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ backgroundColor: `hsl(${getStation(station as StationId).color})` }}>
                {getStation(station as StationId).short}
              </span>
              <span className="font-medium text-foreground">{getStation(station as StationId).city}</span>
            </div>
          </Field>
        )}
        <Button onClick={submit} disabled={!title.trim() || !day || !time} className="mt-1 h-12">
          {isEdit ? "Kaydet" : t("agenda.create")}
        </Button>
      </div>
    </Modal>
  )
}

// Parse date string as local time (avoids UTC→local offset shifting the day)
function localDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00")
}

function formatLongDate(iso: string) {
  const d = localDate(iso)
  return `${WEEKDAYS_FULL[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`
}
