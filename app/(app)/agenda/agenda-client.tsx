"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, CalendarDays, List, MapPin, Clock, Plus, Link as LinkIcon, FileText, Trash2, Pencil } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { createClient } from "@/lib/supabase/client"
import { type EventItem } from "@/lib/data/feed"
import { STATIONS_SORTED, getStation, type StationId } from "@/lib/data/stations"
import { Modal } from "@/components/ui/modal"
import { StationSelect, Field, inputClass } from "@/components/form-fields"
import { Button } from "@/components/ui/button"

const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, "0")
  const m = String((i % 4) * 15).padStart(2, "0")
  return `${h}:${m}`
})

function currentRounded() {
  const now = new Date()
  const mins = now.getHours() * 60 + now.getMinutes()
  const rounded = Math.ceil(mins / 15) * 15
  const h = String(Math.floor(rounded / 60) % 24).padStart(2, "0")
  const m = String(rounded % 60).padStart(2, "0")
  return `${h}:${m}`
}

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
    time: ((e.time as string) ?? "18:00").slice(0, 5),
    place: (e.place as string) ?? "—",
    station: ((e.station as StationId) ?? "paris"),
    description: (e.description as string) ?? undefined,
    link: (e.link as string) ?? undefined,
    endDate: (e.end_date as string) ?? undefined,
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
  const [selectedDayEvents, setSelectedDayEvents] = useState<EventItem[] | null>(null)
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
            time: ((e.time as string) ?? "18:00").slice(0, 5),
            place: (e.place as string) ?? "—",
            station: ((e.station as StationId) ?? "paris"),
            description: (e.description as string) ?? undefined,
            link: (e.link as string) ?? undefined,
            endDate: (e.end_date as string) ?? undefined,
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
            time: ((e.time as string) ?? x.time).slice(0, 5),
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

  const year  = cursor.getFullYear()
  const month = cursor.getMonth()
  const today = new Date()

  const monthEvents = useMemo(() => {
    const mStart = new Date(year, month, 1)
    const mEnd   = new Date(year, month + 1, 0)
    return filtered
      .filter((e) => {
        const start = localDate(e.date)
        const end   = e.endDate ? localDate(e.endDate) : start
        return start <= mEnd && end >= mStart
      })
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))
  }, [filtered, year, month])

  const eventsByDay = useMemo(() => {
    const map: Record<number, EventItem[]> = {}
    monthEvents.filter((e) => !e.endDate).forEach((e) => {
      const d = localDate(e.date).getDate()
      map[d] = map[d] || []
      map[d].push(e)
    })
    return map
  }, [monthEvents])

  const periodByDay = useMemo(() => {
    const map: Record<number, { event: EventItem; type: "start" | "middle" | "end" | "only" }[]> = {}
    const mStart = new Date(year, month, 1)
    const mEnd   = new Date(year, month + 1, 0)
    monthEvents.filter((e) => e.endDate).forEach((e) => {
      const evStart = localDate(e.date)
      const evEnd   = localDate(e.endDate!)
      const visStart = evStart < mStart ? mStart : evStart
      const visEnd   = evEnd > mEnd ? mEnd : evEnd
      const cur = new Date(visStart)
      while (cur <= visEnd) {
        const dn = cur.getDate()
        const isFirst = cur.getTime() === visStart.getTime()
        const isLast  = cur.getTime() === visEnd.getTime()
        const type = isFirst && isLast ? "only" : isFirst ? "start" : isLast ? "end" : "middle"
        map[dn] = map[dn] || []
        map[dn].push({ event: e, type })
        cur.setDate(cur.getDate() + 1)
      }
    })
    return map
  }, [monthEvents, year, month])

  const firstDayIdx = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayDay    = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1

  function changeMonth(delta: number) {
    setCursor(new Date(year, month + delta, 1))
  }

  async function handleDelete(eventId: string) {
    const res = await fetch("/api/events/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    })
    if (res.ok) {
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
      end_date: updated.endDate ?? null,
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
              const dayEvents  = eventsByDay[day] || []
              const periodDays = periodByDay[day] || []
              const hasEvents  = dayEvents.length > 0
              const hasPeriod  = periodDays.length > 0
              const allClickable = hasEvents || hasPeriod
              const allDayItems = [...dayEvents, ...periodDays.map((p) => p.event)]
              const unique = allDayItems.filter((e, idx, arr) => arr.findIndex((x) => x.id === e.id) === idx)
              const allPast = unique.length > 0 && unique.every((e) => isEventPast(e))
              const hasUpcoming = unique.some((e) => !isEventPast(e))
              return (
                <button
                  key={day}
                  onClick={() => {
                    if (!allClickable) return
                    if (unique.length === 1) setSelected(unique[0])
                    else setSelectedDayEvents(unique)
                  }}
                  className={`relative flex aspect-square flex-col items-center justify-start rounded-xl pt-1.5 text-sm transition-colors ${
                    allClickable ? "font-semibold text-foreground" : "text-muted-foreground"
                  } ${hasEvents && !hasPeriod && day !== todayDay && hasUpcoming ? "bg-primary/10" : ""}
                  ${hasEvents && !hasPeriod && day !== todayDay && allPast ? "bg-muted/60" : ""}
                  ${allPast && allClickable ? "opacity-55" : ""}`}
                >
                  <span className={day === todayDay
                    ? "flex size-6 -mt-0.5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
                    : ""
                  }>{day}</span>
                  {hasEvents && (
                    <span className="mt-0.5 flex gap-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={`size-1.5 rounded-full ${isEventPast(e) ? "opacity-40 grayscale" : ""}`}
                          style={{ backgroundColor: `hsl(${getStation(e.station).color})` }}
                        />
                      ))}
                    </span>
                  )}
                  {hasPeriod && (
                    <div className="absolute bottom-1 left-0 right-0 flex flex-col gap-0.5">
                      {periodDays.slice(0, 2).map(({ event, type }) => (
                        <div key={event.id} className="relative h-1.5">
                          <div
                            className={`absolute inset-y-0 ${
                              type === "start"  ? "left-[38%] -right-1 rounded-l-full" :
                              type === "end"    ? "-left-1 right-[38%] rounded-r-full" :
                              type === "only"   ? "left-[15%] right-[15%] rounded-full" :
                              "-left-1 -right-1"
                            } ${isEventPast(event) ? "opacity-35 grayscale" : ""}`}
                            style={{ backgroundColor: `hsl(${getStation(event.station).color})` }}
                          />
                        </div>
                      ))}
                    </div>
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
            .filter((e) => !isEventPast(e))
            .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))
            .map((e) => (
              <EventRow key={e.id} event={e} onClick={() => setSelected(e)} showMonth />
            ))}
          {filtered.filter((e) => !isEventPast(e)).length === 0 && (
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

      {/* Day events list (multiple events on same day) */}
      <Modal
        open={!!selectedDayEvents}
        onClose={() => setSelectedDayEvents(null)}
        title={selectedDayEvents ? formatLongDate(selectedDayEvents[0].date) : ""}
      >
        {selectedDayEvents && (
          <div className="flex flex-col gap-2">
            {selectedDayEvents.map((e) => {
              const station = getStation(e.station)
              const past = isEventPast(e)
              const ongoing = isEventOngoing(e)
              return (
                <button
                  key={e.id}
                  onClick={() => { setSelectedDayEvents(null); setSelected(e) }}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors active:bg-secondary ${
                    past
                      ? "border-border/60 bg-muted/40 opacity-70"
                      : ongoing
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-card"
                  }`}
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-white ${past ? "grayscale" : ""}`}
                    style={{ backgroundColor: past ? "hsl(220 8% 55%)" : `hsl(${station.color})` }}
                  >
                    <CalendarDays className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`truncate font-semibold ${past ? "text-muted-foreground" : "text-foreground"}`}>{e.title}</p>
                      {past && (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          Geçmiş
                        </span>
                      )}
                      {ongoing && !past && (
                        <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          Güncel
                        </span>
                      )}
                    </div>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {e.endDate
                        ? <><CalendarDays className="size-3 shrink-0" /> {formatShortDate(e.date)} → {formatShortDate(e.endDate)}</>
                        : <><Clock className="size-3 shrink-0" /> {e.time}</>
                      }
                      {" · "}{station.name}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              )
            })}
          </div>
        )}
      </Modal>

      {/* Event detail */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={t("agenda.eventDetail")}>
        {selected && (() => {
          const past = isEventPast(selected)
          const ongoing = isEventOngoing(selected)
          const stationColor = past ? "220 8% 55%" : getStation(selected.station).color
          return (
          <div className={`flex flex-col gap-4 ${past ? "opacity-90" : ""}`}>
            <div
              className="rounded-2xl p-4 text-white"
              style={{
                background: `linear-gradient(135deg, hsl(${stationColor}), hsl(${stationColor} / 0.7))`,
              }}
            >
              <div className="mb-2 flex flex-wrap gap-1.5">
                {past && (
                  <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold">Geçmiş etkinlik</span>
                )}
                {ongoing && !past && (
                  <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-semibold">Güncel</span>
                )}
                {!past && !ongoing && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">Yaklaşan</span>
                )}
              </div>
              <h3 className="font-heading text-lg font-bold text-balance">{selected.title}</h3>
              <p className="mt-1 text-sm text-white/90">{getStation(selected.station).name}</p>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <CalendarDays className={`size-5 shrink-0 ${past ? "text-muted-foreground" : "text-primary"}`} />
              {selected.endDate ? (
                <span>{formatLongDate(selected.date)} — {formatLongDate(selected.endDate)}</span>
              ) : (
                <span>{formatLongDate(selected.date)}</span>
              )}
            </div>
            {!selected.endDate && (
              <div className="flex items-center gap-3 text-sm">
                <Clock className={`size-5 shrink-0 ${past ? "text-muted-foreground" : "text-primary"}`} />
                <span>{selected.time}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <MapPin className={`size-5 shrink-0 ${past ? "text-muted-foreground" : "text-primary"}`} />
              <span>{selected.place}</span>
            </div>
            {selected.description && (
              <div className="flex items-start gap-3 text-sm">
                <FileText className={`size-5 shrink-0 mt-0.5 ${past ? "text-muted-foreground" : "text-primary"}`} />
                <span className="text-foreground">{selected.description}</span>
              </div>
            )}
            {selected.link && (
              <div className="flex items-center gap-3 text-sm">
                <LinkIcon className={`size-5 shrink-0 ${past ? "text-muted-foreground" : "text-primary"}`} />
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

            {/* Author actions */}
            {selected.createdBy && selected.createdBy === currentUserId && (
              <div className="flex gap-2 self-end -mt-2">
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
          </div>
          )
        })()}
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
          const newId = e.id || crypto.randomUUID()
          const newEvent = { ...e, id: newId, createdBy: user?.id }

          setEvents((prev) => {
            if (prev.some((x) => x.id === newId)) return prev
            return [...prev, newEvent]
          })
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
            end_date: e.endDate ?? null,
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
  const past = isEventPast(event)
  const ongoing = isEventOngoing(event)
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors active:bg-secondary ${
        past
          ? "border-border/60 bg-muted/35 opacity-70"
          : ongoing
            ? "border-primary/35 bg-primary/5"
            : "border-border bg-card"
      }`}
    >
      <div
        className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-xl text-white ${past ? "grayscale" : ""}`}
        style={{ backgroundColor: past ? "hsl(220 8% 55%)" : `hsl(${station.color})` }}
      >
        <span className="text-base font-bold leading-none">{d.getDate()}</span>
        {showMonth && <span className="text-[10px] uppercase">{MONTHS_TR[d.getMonth()].slice(0, 3)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`truncate font-semibold ${past ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground"}`}>
            {event.title}
          </p>
          {past && (
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              Geçmiş
            </span>
          )}
          {ongoing && !past && (
            <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              Güncel
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
          {event.endDate ? (
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3 shrink-0" />
              {formatShortDate(event.date)} → {formatShortDate(event.endDate)}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock className="size-3 shrink-0" />
              {event.time}
            </span>
          )}
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
  const [endDay, setEndDay]     = useState(initialValues?.endDate ?? "")
  const [eventType, setEventType] = useState<"once" | "period">(initialValues?.endDate ? "period" : "once")
  const [time, setTime]         = useState(initialValues?.time ?? (initialValues?.endDate ? "" : currentRounded()))
  const [place, setPlace]       = useState(initialValues?.place === "—" ? "" : (initialValues?.place ?? ""))
  const [description, setDescription] = useState(initialValues?.description ?? "")
  const [link, setLink]         = useState(initialValues?.link ?? "")
  const [station, setStation]   = useState<string>(initialValues?.station ?? userStation)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    if (!initialValues) setStation(userStation)
  }, [userStation, initialValues])

  async function submit() {
    if (!title.trim() || !day) return
    if (eventType === "once" && !time) return
    if (eventType === "period" && !endDay) return
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      await onSubmit({
        id: initialValues?.id ?? crypto.randomUUID(),
        title: title.trim(),
        date: day,
        time: eventType === "period" ? "00:00" : time,
        place: place || "—",
        station: station as StationId,
        description: description.trim() || undefined,
        link: link.trim() || undefined,
        endDate: eventType === "period" ? endDay : undefined,
        likes: 0,
        participantsCount: 0,
        notAttendingCount: 0,
        comments: [],
      })
      if (!isEdit) {
        setTitle(""); setDay(""); setEndDay(""); setTime(currentRounded()); setPlace("")
        setDescription(""); setLink(""); setStation(userStation); setEventType("once")
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Etkinliği düzenle" : t("agenda.createEvent")}>
      <div className="flex flex-col gap-4">
        <Field label={t("agenda.eventTitle")}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder={t("agenda.eventTitlePlaceholder")} />
        </Field>

        {/* Etkinlik türü: Bir kez / Bir dönem */}
        <div className="flex gap-2 rounded-xl bg-secondary p-1">
          {(["once", "period"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setEventType(type)
                if (type === "once") { setEndDay(""); if (!time) setTime(currentRounded()) }
                else setTime("")
              }}
              className={`relative flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                eventType === type ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {type === "once" ? "Bir kez" : "Bir dönem"}
            </button>
          ))}
        </div>

        {/* Gün + Saat — tailles fixes compactes */}
        {eventType === "once" ? (
          <div className="flex gap-2">
            <div className="w-[145px] shrink-0">
              <Field label={t("agenda.day")}>
                <input type="date" lang="tr" value={day} onChange={(e) => setDay(e.target.value)} className={inputClass + " text-sm px-2"} />
              </Field>
            </div>
            <div className="w-[100px] shrink-0">
              <Field label={t("agenda.time")}>
                <select value={time} onChange={(e) => setTime(e.target.value)} className={inputClass + " text-sm px-2"}>
                  <option value="">--:--</option>
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="flex-1">
              <Field label="Başlangıç">
                <input type="date" lang="tr" value={day} onChange={(e) => setDay(e.target.value)} className={inputClass + " text-sm px-2"} />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Bitiş">
                <input type="date" lang="tr" value={endDay} onChange={(e) => setEndDay(e.target.value)} min={day || undefined} className={inputClass + " text-sm px-2"} />
              </Field>
            </div>
          </div>
        )}

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
        <Button
          type="button"
          onClick={submit}
          disabled={submitting || !title.trim() || !day || (eventType === "once" && !time) || (eventType === "period" && !endDay)}
          className="mt-1 h-12"
        >
          {submitting ? "Kaydediliyor…" : isEdit ? "Kaydet" : t("agenda.create")}
        </Button>
      </div>
    </Modal>
  )
}

// Parse date string as local time (avoids UTC→local offset shifting the day)
function localDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00")
}

/** True when the event has fully ended (period → end of endDate; once → date+time). */
function isEventPast(event: EventItem, now = new Date()): boolean {
  if (event.endDate) {
    const end = localDate(event.endDate)
    end.setHours(23, 59, 59, 999)
    return end.getTime() < now.getTime()
  }
  const start = localDate(event.date)
  const [hh, mm] = (event.time || "23:59").split(":").map((x) => Number(x) || 0)
  start.setHours(hh, mm, 0, 0)
  return start.getTime() < now.getTime()
}

function isEventOngoing(event: EventItem, now = new Date()): boolean {
  if (!event.endDate) {
    const start = localDate(event.date)
    return (
      start.getFullYear() === now.getFullYear() &&
      start.getMonth() === now.getMonth() &&
      start.getDate() === now.getDate() &&
      !isEventPast(event, now)
    )
  }
  const start = localDate(event.date)
  start.setHours(0, 0, 0, 0)
  const end = localDate(event.endDate)
  end.setHours(23, 59, 59, 999)
  return now.getTime() >= start.getTime() && now.getTime() <= end.getTime()
}

function formatLongDate(iso: string) {
  const d = localDate(iso)
  return `${WEEKDAYS_FULL[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`
}

function formatShortDate(iso: string) {
  const d = localDate(iso)
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()].slice(0, 3)}`
}
