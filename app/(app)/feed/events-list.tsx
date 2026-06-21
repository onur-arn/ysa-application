"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, Clock, MapPin, ThumbsUp, ThumbsDown, Heart, MessageSquare, Send } from "lucide-react"
import { EVENTS, type EventItem } from "@/lib/data/feed"
import { station } from "@/lib/data/stations"
import { useI18n } from "@/lib/i18n/context"
import { createClient } from "@/lib/supabase/client"

function EventCard({ event, authorName, authorInitials }: { event: EventItem; authorName: string; authorInitials: string }) {
  const { lang } = useI18n()
  const s = station(event.station)
  const [liked, setLiked] = useState(false)
  const [participation, setParticipation] = useState<"yes" | "no" | null>(null)
  const [likes, setLikes] = useState(event.likes)
  const [participants, setParticipants] = useState(event.participantsCount)
  const [notAttending, setNotAttending] = useState(event.notAttendingCount)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState(event.comments)
  const [draft, setDraft] = useState("")

  function handleLike() {
    if (liked) {
      setLikes((n) => n - 1)
    } else {
      setLikes((n) => n + 1)
    }
    setLiked((v) => !v)
  }

  function handleParticipate(val: "yes" | "no") {
    if (participation === val) {
      if (val === "yes") setParticipants((n) => n - 1)
      else setNotAttending((n) => n - 1)
      setParticipation(null)
    } else {
      if (participation === "yes") setParticipants((n) => n - 1)
      if (participation === "no") setNotAttending((n) => n - 1)
      if (val === "yes") setParticipants((n) => n + 1)
      else setNotAttending((n) => n + 1)
      setParticipation(val)
    }
  }

  function sendComment() {
    if (!draft.trim()) return
    setComments((prev) => [
      ...prev,
      { id: String(Date.now()), author: authorName, initials: authorInitials, text: draft.trim(), time: "Şimdi" },
    ])
    setDraft("")
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {event.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.image} alt={event.title} className="h-36 w-full object-cover" />
      )}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: `linear-gradient(110deg, hsl(${s.color}), hsl(${s.color} / 0.7))` }}
      >
        <div className="flex flex-col text-white">
          <span className="text-2xl font-bold leading-none">{new Date(event.date).getDate()}</span>
          <span className="text-xs font-medium uppercase opacity-90">
            {new Date(event.date).toLocaleDateString("tr-TR", { month: "long" })}
          </span>
        </div>
        <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">{s.name}</span>
      </div>
      <div className="px-4 py-3">
        <h3 className="font-semibold text-foreground text-pretty">{event.title}</h3>
        <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 shrink-0" /> {event.time}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0" /> {event.place}
          </span>
        </div>

        {/* Action row */}
        <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
          <button
            onClick={() => handleParticipate("yes")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
              participation === "yes"
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            <ThumbsUp className="size-3.5" />
            <span>{participants}</span>
          </button>
          <button
            onClick={() => handleParticipate("no")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
              participation === "no"
                ? "bg-destructive/10 text-destructive"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            <ThumbsDown className="size-3.5" />
            <span>{notAttending}</span>
          </button>
          <button
            onClick={handleLike}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
              liked ? "bg-rose-500/10 text-rose-500" : "bg-secondary text-muted-foreground"
            }`}
          >
            <Heart className={`size-3.5 ${liked ? "fill-rose-500" : ""}`} />
            <span>{likes}</span>
          </button>
          <button
            onClick={() => setShowComments((v) => !v)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-secondary py-2 text-xs font-semibold text-muted-foreground"
          >
            <MessageSquare className="size-3.5" />
            <span>{comments.length}</span>
          </button>
        </div>
      </div>

      {/* Comments section */}
      <AnimatePresence initial={false}>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-secondary/30"
          >
            <div className="flex flex-col gap-2 p-3">
              {comments.map((c) => (
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
              {comments.length === 0 && (
                <p className="py-1 text-center text-xs text-muted-foreground">Henüz yorum yok</p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && draft.trim()) {
                      sendComment()
                    }
                  }}
                  placeholder="Yorum yaz..."
                  className="h-9 flex-1 rounded-full border border-input bg-card px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
                <button
                  onClick={sendComment}
                  disabled={!draft.trim()}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function EventsList() {
  const { t } = useI18n()
  const [showPast, setShowPast] = useState(false)
  const [authorName, setAuthorName] = useState("")
  const [authorInitials, setAuthorInitials] = useState("")
  const upcoming = EVENTS.filter((e) => !e.past)
  const past = EVENTS.filter((e) => e.past)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("name,initials").eq("id", user.id).single()
        if (profile) {
          setAuthorName(profile.name ?? "")
          setAuthorInitials(profile.initials ?? profile.name?.trim().split(" ").filter(Boolean).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() ?? "")
        }
      }
    }
    load()
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("feed.upcoming")}</h2>
      {upcoming.map((e) => (
        <EventCard key={e.id} event={e} authorName={authorName} authorInitials={authorInitials} />
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
                <EventCard event={e} authorName={authorName} authorInitials={authorInitials} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
