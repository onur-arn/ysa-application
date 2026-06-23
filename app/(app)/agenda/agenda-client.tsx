"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, CalendarDays, List, MapPin, Clock, Plus, Link as LinkIcon, FileText, Trash2 } from "lucide-react"
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

export function AgendaClient() {
  const { t } = useI18n()
  const [view, setView] = useState<View>("calendar")
  const [filter, setFilter] = useState<Filter>("all")
  const [cursor, setCursor] = useState(new Date(2026, 5, 1))
  const [events, setEvents] = useState<EventItem[]>([])
  const [selected, setSelected] = useState<EventItem | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [userStation, setUserStation] = useState<string>("paris")
  const [isIntl, setIsIntl] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      const { data: p } = await supabase.from("profiles").select("station").eq("id", user.id).single()
      if (p?.station) {
        setUserStation(p.station)
        setIsIntl(p.station === "intl")
      }
    }
    loadUser()
  }, [])

  useEffect(() => {
    const supabase = createClient()

    async function loadEvents() {
      const { data } = await supabase
        .from("events")
        .select("id,title,date,time,place,station,description,link,created_by")
        .order("date", { ascending: true })
      if (data) {
        setEvents(data.map((e) => ({
          id: e.id,
          title: e.title ?? "",
          date: e.date ?? "",
          time: e.time ?? "18:00",
          place: e.place ?? "—",
          station: (e.station as StationId) ?? "paris",
          description: e.description ?? undefined,
          link: e.link ?? undefined,
          likes: 0,
          participantsCount: 0,
          notAttendingCount: 0,
          comments: [],
          createdBy: e.created_by ?? undefined,
        })))
      }
    }
    loadEvents()

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

          {/* No event list under calendar — only dots on days */}
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
        className="fixed bottom-20 right-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90"
        aria-label={t("agenda.createEvent")}
      >
        <Plus className="size-6" />
      </button>

      {/* Event detail */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={t("agenda.eventDetail")}>
        {selected && (
          <div className="flex flex-col gap-4">
            {selected.createdBy && selected.createdBy === currentUserId && (
              <button
                onClick={async () => {
                  const supabase = createClient()
                  await supabase.from("events").delete().eq("id", selected.id)
                  setEvents((prev) => prev.filter((e) => e.id !== selected.id))
                  setSelected(null)
                }}
                className="flex items-center gap-2 self-end rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive transition-colors active:bg-destructive/10"
              >
                <Trash2 className="size-4" /> Sil
              </button>
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

      {/* Create event */}
      <CreateEventModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        userStation={userStation}
        isIntl={isIntl}
        onCreate={async (e) => {
          setCreateOpen(false)
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()

          const base = {
            title: e.title,
            date: e.date,
            time: e.time,
            place: e.place !== "—" ? e.place : null,
            station: e.station,
            description: e.description ?? null,
            link: e.link ?? null,
          }

          // Try with created_by first; fall back without if column missing
          let result = await supabase.from("events").insert({ ...base, created_by: user?.id ?? null }).select().single()
          if (result.error) {
            result = await supabase.from("events").insert(base).select().single()
          }
          if (!result.error && result.data) {
            setEvents((prev) => [...prev, { ...e, id: result.data!.id, createdBy: user?.id }])
          }
        }}
      />
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

function CreateEventModal({
  open,
  onClose,
  onCreate,
  userStation = "paris",
  isIntl = false,
}: {
  open: boolean
  onClose: () => void
  onCreate: (e: EventItem) => void | Promise<void>
  userStation?: string
  isIntl?: boolean
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState("")
  const [day, setDay] = useState("")
  const [time, setTime] = useState("")
  const [place, setPlace] = useState("")
  const [description, setDescription] = useState("")
  const [link, setLink] = useState("")
  const [station, setStation] = useState<string>(userStation)

  useEffect(() => { setStation(userStation) }, [userStation])

  function submit() {
    if (!title.trim() || !day || !time) return
    onCreate({
      id: String(Date.now()),
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
    setTitle("")
    setDay("")
    setTime("")
    setPlace("")
    setDescription("")
    setLink("")
    setStation(userStation)
  }

  return (
    <Modal open={open} onClose={onClose} title={t("agenda.createEvent")}>
      <div className="flex flex-col gap-4">
        <Field label={t("agenda.eventTitle")}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder={t("agenda.eventTitlePlaceholder")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 overflow-hidden">
            <Field label={t("agenda.day")}>
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={inputClass + " w-full min-w-0 max-w-full text-sm px-2"} />
            </Field>
          </div>
          <div className="min-w-0 overflow-hidden">
            <Field label={t("agenda.time")}>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass + " w-full min-w-0 max-w-full text-sm px-2"} />
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
          {t("agenda.create")}
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
