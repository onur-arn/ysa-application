"use client"

import { useState, useRef, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Plus, X, ChevronLeft, ChevronRight, Music, Heart } from "lucide-react"
import { STATIONS_SORTED } from "@/lib/data/stations"
import { STORY_BG } from "@/lib/data/feed"
import { useI18n } from "@/lib/i18n/context"
import { StoryEditor } from "./story-editor"
import { createClient } from "@/lib/supabase/client"

const SEEN_KEY = "ys-seen-story-ids"

function storyTimeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return "şimdi"
  if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa önce`
  return `${Math.floor(diff / 86400)}g önce`
}

type Story = {
  id: string
  station: string
  authorName: string
  initials: string
  imageUrl: string
  createdAt: string
  fitMode?: "cover" | "contain"
  musicPreviewUrl?: string
  musicLabel?: string
}

interface StoriesBarProps {
  initialUser?: { name: string; station: string; initials: string; photoUrl?: string }
  initialStories?: Record<string, unknown>[]
  initialPhotoMap?: { id: string; name: string; photo_url: string | null }[]
}

function mapStoriesFromRaw(raw: Record<string, unknown>[]): Story[] {
  return raw.map((s) => ({
    id: s.id as string,
    station: s.station as string,
    authorName: s.author_name as string,
    initials: s.initials as string,
    imageUrl: s.image_url as string,
    createdAt: s.created_at as string,
    fitMode: ((s.fit_mode as "cover" | "contain") ?? "cover"),
    musicPreviewUrl: (s.music_preview_url as string) ?? undefined,
    musicLabel: (s.music_label as string) ?? undefined,
  }))
}

export function StoriesBar({
  initialUser,
  initialStories = [],
  initialPhotoMap = [],
}: StoriesBarProps) {
  const { t } = useI18n()
  const [stories, setStories]         = useState<Story[]>(() => mapStoriesFromRaw(initialStories))
  const [active, setActive]           = useState<string | null>(null)
  const [storyIdx, setStoryIdx]       = useState(0)
  const [fromMyButton, setFromMyButton] = useState(false)
  const [editingImage, setEditingImage] = useState<string | null>(null)
  const [user, setUser] = useState<{ name: string; station: string; initials: string; photoUrl?: string }>(
    initialUser ?? { name: "", station: "paris", initials: "" }
  )
  const photoMap = useState<Map<string, string>>(
    () => new Map(initialPhotoMap.filter(p => p.photo_url).map(p => [p.name, p.photo_url as string]))
  )[0]
  const [seenIds, setSeenIds]             = useState<Set<string>>(new Set())
  const [reactionCounts, setReactionCounts] = useState<Map<string, number>>(new Map())
  const [myReactions, setMyReactions]       = useState<Set<string>>(new Set())
  const [reactionDetails, setReactionDetails] = useState<Map<string, string[]>>(new Map())
  const fileRef = useRef<HTMLInputElement>(null)
  const storyAudioRef = useRef<HTMLAudioElement | null>(null)

  // Load seen IDs from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY)
      if (raw) setSeenIds(new Set(JSON.parse(raw) as string[]))
    } catch {}
  }, [])

  function markStationSeen(stationId: string, currentStories: Story[]) {
    const ids = currentStories.filter(s => s.station === stationId).map(s => s.id)
    setSeenIds(prev => {
      const next = new Set([...prev, ...ids])
      try { localStorage.setItem(SEEN_KEY, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  // Only the current user's own stories appear in the "my story" circle
  const myStories = stories.filter((s) => s.authorName === user.name)

  function openStation(stationId: string, startIdx = 0, myBtn = false) {
    setActive(stationId)
    setStoryIdx(startIdx)
    setFromMyButton(myBtn)
    markStationSeen(stationId, stories)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setEditingImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  async function publishStory(flatUrl: string, fitMode: "cover" | "contain", musicPreviewUrl?: string, musicLabel?: string) {
    const newId = `story-${Date.now()}`
    const newStory: Story = {
      id: newId,
      station: user.station,
      authorName: user.name,
      initials: user.initials,
      imageUrl: flatUrl,
      createdAt: new Date().toISOString(),
      fitMode,
      musicPreviewUrl,
      musicLabel,
    }
    const updated = [...stories, newStory]
    setStories(updated)
    setEditingImage(null)
    try {
      const supabase = createClient()
      await supabase.from("stories").insert({
        id: newId,
        station: user.station,
        author_name: user.name,
        initials: user.initials,
        image_url: flatUrl,
        fit_mode: fitMode,
        music_preview_url: musicPreviewUrl ?? null,
        music_label: musicLabel ?? null,
      })
    } catch {}
    const stationStories = updated.filter((s) => s.station === user.station)
    openStation(user.station, stationStories.length - 1, true)
  }

  async function deleteStory(id: string) {
    const updated = stories.filter((s) => s.id !== id)
    setStories(updated)
    try {
      const supabase = createClient()
      await supabase.from("stories").delete().eq("id", id)
    } catch {}
    const remaining = updated.filter((s) => s.station === active)
    if (remaining.length === 0) {
      setActive(null)
    } else {
      setStoryIdx((i) => Math.min(i, remaining.length - 1))
    }
  }

  function stationHasStory(stationId: string) {
    return stories.some((s) => s.station === stationId)
  }

  function hasUnseenStory(stationId: string) {
    return stories.some(s => s.station === stationId && !seenIds.has(s.id))
  }

  // Load reactions for all visible stories
  useEffect(() => {
    if (stories.length === 0 || !user.name) return
    async function loadReactions() {
      const supabase = createClient()
      const ids = stories.map(s => s.id)
      const { data } = await supabase.from("story_reactions").select("story_id, user_name").in("story_id", ids)
      if (!data) return
      const counts  = new Map<string, number>()
      const mine    = new Set<string>()
      const details = new Map<string, string[]>()
      for (const r of data) {
        counts.set(r.story_id, (counts.get(r.story_id) ?? 0) + 1)
        if (r.user_name === user.name) mine.add(r.story_id)
        const arr = details.get(r.story_id) ?? []
        if (!arr.includes(r.user_name)) arr.push(r.user_name)
        details.set(r.story_id, arr)
      }
      setReactionCounts(counts)
      setMyReactions(mine)
      setReactionDetails(details)
    }
    loadReactions()
  }, [stories.length, user.name])

  async function toggleLike(storyId: string) {
    const isLiked = myReactions.has(storyId)
    const supabase = createClient()
    if (isLiked) {
      setMyReactions(prev  => { const n = new Set(prev); n.delete(storyId); return n })
      setReactionCounts(prev => { const n = new Map(prev); n.set(storyId, Math.max(0, (n.get(storyId) ?? 1) - 1)); return n })
      await supabase.from("story_reactions").delete().eq("story_id", storyId).eq("user_name", user.name)
    } else {
      setMyReactions(prev  => new Set([...prev, storyId]))
      setReactionCounts(prev => { const n = new Map(prev); n.set(storyId, (n.get(storyId) ?? 0) + 1); return n })
      await supabase.from("story_reactions").insert({ story_id: storyId, user_name: user.name })
    }
  }

  // When opened from "my story" button, show only the user's own stories; otherwise show all station stories
  const activeStories = active
    ? (fromMyButton && active === user.station
        ? stories.filter((s) => s.station === active && s.authorName === user.name)
        : stories.filter((s) => s.station === active))
    : []
  const currentStory  = activeStories[storyIdx] ?? null
  const activeStation = STATIONS_SORTED.find((s) => s.id === active)

  // Play/stop music when the viewed story changes
  useEffect(() => {
    storyAudioRef.current?.pause()
    storyAudioRef.current = null
    if (active && currentStory?.musicPreviewUrl) {
      const audio = new Audio(currentStory.musicPreviewUrl)
      audio.loop = true
      audio.volume = 0.7
      audio.play().catch(() => {})
      storyAudioRef.current = audio
    }
    return () => { storyAudioRef.current?.pause() }
  }, [active, currentStory?.id])

  function goNext() {
    if (storyIdx < activeStories.length - 1) {
      setStoryIdx(storyIdx + 1)
    } else {
      setActive(null)
    }
  }

  function goPrev() {
    if (storyIdx > 0) setStoryIdx(storyIdx - 1)
  }

  // Sort stations: unseen first, then seen-with-stories, then no stories
  const sortedStations = [...STATIONS_SORTED].sort((a, b) => {
    const aUnseen = hasUnseenStory(a.id)
    const bUnseen = hasUnseenStory(b.id)
    const aHas    = stationHasStory(a.id)
    const bHas    = stationHasStory(b.id)
    if (aUnseen && !bUnseen) return -1
    if (!aUnseen && bUnseen) return 1
    if (aHas && !bHas) return -1
    if (!aHas && bHas) return 1
    return 0
  })

  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* My story button */}
        <button
          className="flex shrink-0 flex-col items-center gap-1.5"
          aria-label={t("feed.yourStory")}
          onClick={() => {
            if (myStories.length > 0) {
              openStation(user.station, 0, true)
            } else {
              fileRef.current?.click()
            }
          }}
        >
          <span className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full overflow-hidden ${
            myStories.length > 0
              ? "ring-[2.5px] ring-primary ring-offset-2 ring-offset-background"
              : "border-2 border-dashed border-primary/50 bg-primary/5"
          }`}>
            {myStories.length > 0 ? (
              <img src={myStories[myStories.length - 1].imageUrl} alt="Ma story" className="h-full w-full object-cover" />
            ) : user.photoUrl ? (
              <img src={user.photoUrl} alt="Mon profil" className="h-full w-full object-cover" />
            ) : (
              <Plus className="h-6 w-6 text-primary" />
            )}
            {myStories.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); fileRef.current?.click() } }}
                className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-white shadow"
              >
                <Plus className="size-3" />
              </span>
            )}
          </span>
          <span className="max-w-16 truncate text-[11px] font-medium text-muted-foreground">
            {myStories.length > 0 ? `${myStories.length} story` : t("feed.yourStory")}
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />

        {/* Station circles — unseen first, seen after */}
        {sortedStations.map((s) => {
          const hasStory  = stationHasStory(s.id)
          const isUnseen  = hasUnseenStory(s.id)
          const count     = stories.filter((x) => x.station === s.id).length

          const ringStyle = !hasStory
            ? "bg-muted"
            : isUnseen
              ? "bg-primary"
              : "bg-border"

          return (
            <button
              key={s.id}
              onClick={() => hasStory && openStation(s.id, 0)}
              disabled={!hasStory}
              className={`flex shrink-0 flex-col items-center gap-1.5 ${!hasStory ? "opacity-40 cursor-default" : ""}`}
            >
              <span className={`relative rounded-full p-[2.5px] ${ringStyle}`}>
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-card font-heading text-[11px] font-bold tracking-wide text-white"
                  style={{ backgroundColor: `hsl(${STORY_BG[s.id]})` }}
                >
                  {s.short}
                </span>
                {count > 1 && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow">
                    {count}
                  </span>
                )}
              </span>
              <span className={`max-w-16 truncate text-[11px] font-medium ${hasStory ? (isUnseen ? "text-foreground font-semibold" : "text-muted-foreground") : "text-foreground"}`}>
                {s.city}
              </span>
            </button>
          )
        })}
      </div>

      {/* Story viewer */}
      <AnimatePresence>
        {active && activeStation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 mx-auto flex w-full max-w-md flex-col bg-black"
          >
            {/* Progress bars */}
            <div className="absolute inset-x-4 top-4 z-10 flex gap-1">
              {activeStories.map((_, i) => (
                <span key={i} className="h-1 flex-1 rounded-full bg-white/30">
                  {i === storyIdx && (
                    <motion.span
                      key={`${active}-${storyIdx}`}
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 10, ease: "linear" }}
                      onAnimationComplete={goNext}
                      className="block h-full rounded-full bg-white"
                    />
                  )}
                  {i < storyIdx && <span className="block h-full w-full rounded-full bg-white" />}
                </span>
              ))}
            </div>

            {/* Close */}
            <button
              onClick={() => setActive(null)}
              className="absolute right-4 top-8 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {currentStory ? (
              <div className="relative flex h-full w-full flex-col">
                <img
                  src={currentStory.imageUrl}
                  alt=""
                  className="h-full w-full"
                  style={{ objectFit: currentStory.fitMode ?? "cover", backgroundColor: "#000" }}
                />

                {/* Prev / Next tap zones */}
                <div className="absolute inset-0 flex">
                  <div className="flex-1" onClick={goPrev} />
                  <div className="flex-1" onClick={goNext} />
                </div>

                {/* Nav arrows (desktop hint) */}
                {storyIdx > 0 && (
                  <button onClick={goPrev} className="absolute left-2 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white">
                    <ChevronLeft className="size-5" />
                  </button>
                )}
                {storyIdx < activeStories.length - 1 && (
                  <button onClick={goNext} className="absolute right-2 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white">
                    <ChevronRight className="size-5" />
                  </button>
                )}

                {/* Like button */}
                <div className="pointer-events-auto absolute bottom-36 right-5 flex flex-col items-center gap-1.5">
                  <button
                    onClick={() => toggleLike(currentStory.id)}
                    className="flex size-12 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm active:scale-110 transition-transform"
                  >
                    <Heart
                      className="size-6 transition-colors"
                      style={{
                        fill: myReactions.has(currentStory.id) ? "#ef4444" : "transparent",
                        color: myReactions.has(currentStory.id) ? "#ef4444" : "white",
                      }}
                    />
                  </button>
                  {(reactionCounts.get(currentStory.id) ?? 0) > 0 && (
                    <span className="text-xs font-bold text-white drop-shadow">
                      {reactionCounts.get(currentStory.id)}
                    </span>
                  )}
                </div>

                {/* Author overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-5 pb-10 pt-20 pointer-events-none">
                  <div className="flex items-center gap-3">
                    {photoMap.get(currentStory.authorName) ? (
                      <img
                        src={photoMap.get(currentStory.authorName)}
                        alt={currentStory.initials}
                        className="size-10 shrink-0 rounded-full object-cover border border-white/30"
                      />
                    ) : (
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: `hsl(${STORY_BG[currentStory.station]})` }}
                      >
                        {currentStory.initials}
                      </span>
                    )}
                    <div>
                      <p className="font-semibold text-white">{currentStory.authorName}</p>
                      <p className="text-xs text-white/70">
                        {activeStation.name} · {storyTimeAgo(currentStory.createdAt)}
                      </p>
                      {currentStory.musicLabel && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-white/80">
                          <Music className="size-3 shrink-0" />
                          {currentStory.musicLabel}
                        </p>
                      )}
                    </div>
                    {activeStories.length > 1 && (
                      <span className="ml-auto text-xs text-white/50">
                        {storyIdx + 1} / {activeStories.length}
                      </span>
                    )}
                  </div>
                  {currentStory.authorName === user.name && (reactionDetails.get(currentStory.id) ?? []).length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      <Heart className="size-3 shrink-0 fill-red-400 text-red-400" />
                      <span className="text-xs text-white/80">
                        {(reactionDetails.get(currentStory.id) ?? []).join(", ")}
                      </span>
                    </div>
                  )}
                  {currentStory.authorName === user.name && (
                    <div className="pointer-events-auto mt-4 flex gap-2">
                      <button
                        onClick={() => { setActive(null); fileRef.current?.click() }}
                        className="flex-1 rounded-xl bg-white/90 py-2.5 text-sm font-semibold text-black backdrop-blur"
                      >
                        + Ajouter
                      </button>
                      <button
                        onClick={() => deleteStory(currentStory.id)}
                        className="flex-1 rounded-xl bg-white/20 py-2.5 text-sm font-semibold text-white backdrop-blur"
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* No story — station card */
              <div className="flex h-full w-full items-center justify-center p-4">
                <div
                  className="flex aspect-[9/16] w-full max-w-xs flex-col items-center justify-center rounded-3xl text-center"
                  style={{ backgroundColor: `hsl(${STORY_BG[activeStation.id]})` }}
                >
                  <span className="font-heading text-5xl font-bold text-white">{activeStation.short}</span>
                  <span className="mt-3 px-6 text-lg font-semibold text-white text-pretty">{activeStation.name}</span>
                  <span className="mt-1 text-sm text-white/80">{activeStation.city}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story editor */}
      <AnimatePresence>
        {editingImage && (
          <StoryEditor
            imageUrl={editingImage}
            onCancel={() => setEditingImage(null)}
            onPublish={publishStory}
          />
        )}
      </AnimatePresence>
    </>
  )
}
