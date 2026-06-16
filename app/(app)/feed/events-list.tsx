"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, Clock, MapPin } from "lucide-react"
import { EVENTS, type EventItem } from "@/lib/data/feed"
import { station } from "@/lib/data/stations"
import { useI18n } from "@/lib/i18n/context"

function formatDate(iso: string, lang: string) {
  const map: Record<string, string> = { fr: "fr-FR", en: "en-GB", tr: "tr-TR", de: "de-DE", ro: "ro-RO" }
  return new Date(iso).toLocaleDateString(map[lang] ?? "fr-FR", { day: "numeric", month: "long" })
}

function EventCard({ event }: { event: EventItem }) {
  const { lang } = useI18n()
  const s = station(event.station)
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: `linear-gradient(110deg, hsl(${s.color}), hsl(${s.color} / 0.7))` }}
      >
        <div className="flex flex-col text-white">
          <span className="text-2xl font-bold leading-none">{new Date(event.date).getDate()}</span>
          <span className="text-xs font-medium uppercase opacity-90">{formatDate(event.date, lang).split(" ").slice(1).join(" ")}</span>
        </div>
        <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">{s.name}</span>
      </div>
      <div className="px-4 py-3">
        <h3 className="font-semibold text-foreground text-pretty">{event.title}</h3>
        <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> {event.time}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" /> {event.place}
          </span>
        </div>
      </div>
    </div>
  )
}

export function EventsList() {
  const { t } = useI18n()
  const [showPast, setShowPast] = useState(false)
  const upcoming = EVENTS.filter((e) => !e.past)
  const past = EVENTS.filter((e) => e.past)

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("feed.upcoming")}</h2>
      {upcoming.map((e) => (
        <EventCard key={e.id} event={e} />
      ))}

      <button
        onClick={() => setShowPast((v) => !v)}
        className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-muted-foreground"
      >
        {showPast ? t("feed.hidePast") : t("feed.showPast")}
        <ChevronDown className={`h-4 w-4 transition-transform ${showPast ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {showPast && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col gap-3 overflow-hidden"
          >
            {past.map((e) => (
              <div key={e.id} className="opacity-70">
                <EventCard event={e} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
