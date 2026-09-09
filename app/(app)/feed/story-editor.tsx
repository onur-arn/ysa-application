"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { X, Music, Search, Play, Pause, Loader2, Expand, Minimize2 } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useI18n } from "@/lib/i18n/context"

const FILTERS = [
  { name: "Normal",  value: "none" },
  { name: "Chaud",   value: "sepia(0.3) saturate(1.4) brightness(1.05)" },
  { name: "Froid",   value: "saturate(0.8) hue-rotate(20deg) brightness(1.05)" },
  { name: "N&B",     value: "grayscale(1)" },
  { name: "Vintage", value: "sepia(0.5) contrast(0.85) brightness(0.9)" },
  { name: "Vif",     value: "saturate(1.8) contrast(1.1)" },
]

const FONTS = [
  { name: "Normal", family: "-apple-system, BlinkMacSystemFont, sans-serif" },
  { name: "Serif",  family: "Georgia, 'Times New Roman', serif" },
  { name: "Mono",   family: "'Courier New', Courier, monospace" },
  { name: "Script", family: "cursive" },
  { name: "Impact", family: "Impact, Haettenschweiler, fantasy" },
]

type DeezerTrack = {
  id: number
  title: string
  artist: { name: string }
  album: { cover_small: string }
  preview: string
}

const TEXT_COLORS = ["#ffffff", "#000000", "#f59e0b", "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#ff69b4"]

type Layer = {
  id: string
  text: string
  color: string
  fontFamily: string
  fontSize: number
  x: number
  y: number
}

type Track = { name: string; artist: string; previewUrl: string }
type Tool = "filter" | "text" | "music" | null

export function StoryEditor({
  imageUrl,
  onCancel,
  onPublish,
}: {
  imageUrl: string
  onCancel: () => void
  onPublish: (flatUrl: string, fitMode: "cover" | "contain", musicPreviewUrl?: string, musicLabel?: string) => void
}) {
  const { t } = useI18n()
  const [filter, setFilter]         = useState("none")
  const [layers, setLayers]         = useState<Layer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool]             = useState<Tool>(null)
  const [textInput, setTextInput]   = useState("")
  const [textColor, setTextColor]   = useState("#ffffff")
  const [fontFamily, setFontFamily] = useState(FONTS[0].family)
  const [music, setMusic]           = useState<Track | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [fitMode, setFitMode]       = useState<"cover" | "contain">("cover")

  const [musicQuery, setMusicQuery]     = useState("")
  const [musicResults, setMusicResults] = useState<DeezerTrack[]>([])
  const [musicLoading, setMusicLoading] = useState(false)
  const [playingId, setPlayingId]       = useState<number | null>(null)
  const audioRef                        = useRef<HTMLAudioElement | null>(null)
  const searchTimer                     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textInputRef                    = useRef<HTMLInputElement>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const dragging     = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null)
  const moved        = useRef(false)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      setFitMode(img.naturalWidth > img.naturalHeight ? "contain" : "cover")
    }
    img.src = imageUrl
  }, [imageUrl])

  useEffect(() => () => { audioRef.current?.pause() }, [])

  useEffect(() => {
    if (tool === "text") {
      const id = requestAnimationFrame(() => textInputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [tool])

  const searchDeezer = useCallback((q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!q.trim()) { setMusicResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setMusicLoading(true)
      try {
        const res  = await fetch(`/api/deezer-search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        setMusicResults(json.data ?? [])
      } catch {}
      setMusicLoading(false)
    }, 400)
  }, [])

  function toggleTool(next: Tool) {
    setTool((prev) => (prev === next ? null : next))
    setSelectedId(null)
    if (next !== "music") {
      audioRef.current?.pause()
      setPlayingId(null)
    }
  }

  function togglePreview(track: DeezerTrack) {
    if (playingId === track.id) {
      audioRef.current?.pause()
      setPlayingId(null)
    } else {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = "" }
      const audio = new Audio(track.preview)
      audio.onended = () => setPlayingId(null)
      audio.play()
      audioRef.current = audio
      setPlayingId(track.id)
    }
  }

  function selectTrack(track: DeezerTrack) {
    audioRef.current?.pause()
    setPlayingId(null)
    setMusic({ name: track.title, artist: track.artist.name, previewUrl: track.preview })
    setTool(null)
  }

  function addText() {
    if (!textInput.trim()) return
    const c = containerRef.current
    setLayers((l) => [
      ...l,
      {
        id: `t-${Date.now()}`,
        text: textInput.trim(),
        color: textColor,
        fontFamily,
        fontSize: 30,
        x: (c?.clientWidth  ?? 300) / 2,
        y: (c?.clientHeight ?? 500) / 2,
      },
    ])
    setTextInput("")
    setSelectedId(null)
    setTool(null)
  }

  function deleteLayer(id: string) {
    setLayers((l) => l.filter((x) => x.id !== id))
    setSelectedId(null)
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    e.currentTarget.setPointerCapture(e.pointerId)
    e.stopPropagation()
    moved.current = false
    const layer = layers.find((l) => l.id === id)!
    dragging.current = { id, sx: e.clientX, sy: e.clientY, ox: layer.x, oy: layer.y }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return
    const { id, sx, sy, ox, oy } = dragging.current
    const dx = e.clientX - sx
    const dy = e.clientY - sy
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true
    setLayers((prev) => prev.map((l) => l.id === id ? { ...l, x: ox + dx, y: oy + dy } : l))
  }

  function onLayerPointerUp(id: string) {
    if (!moved.current) setSelectedId((prev) => (prev === id ? null : id))
    dragging.current = null
  }

  async function publish() {
    setPublishing(true)
    const c   = containerRef.current!
    const w   = c.clientWidth
    const h   = c.clientHeight
    const dpr = window.devicePixelRatio || 1

    const canvas = document.createElement("canvas")
    canvas.width  = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext("2d")!
    ctx.scale(dpr, dpr)

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = imageUrl
    await new Promise((r) => { img.onload = r })

    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, w, h)

    if (filter !== "none") ctx.filter = filter
    if (fitMode === "cover") {
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
      const dw = img.naturalWidth  * scale
      const dh = img.naturalHeight * scale
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
    } else {
      const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight)
      const dw = img.naturalWidth  * scale
      const dh = img.naturalHeight * scale
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
    }
    ctx.filter = "none"

    for (const layer of layers) {
      ctx.font         = `bold ${layer.fontSize}px ${layer.fontFamily}`
      ctx.textAlign    = "center"
      ctx.textBaseline = "middle"
      ctx.shadowColor  = "rgba(0,0,0,0.55)"
      ctx.shadowBlur   = 8
      ctx.fillStyle    = layer.color
      ctx.fillText(layer.text, layer.x, layer.y)
      ctx.shadowBlur   = 0
    }

    onPublish(
      canvas.toDataURL("image/jpeg", 0.88),
      fitMode,
      music?.previewUrl,
      music ? `${music.name} — ${music.artist}` : undefined,
    )
  }

  const sideTools = [
    { id: "text" as const, label: "Aa", isText: true },
    { id: "filter" as const, label: "Filtre" },
    { id: "music" as const, label: "Musique", Icon: Music },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] overflow-hidden bg-black"
    >
      {/* Full-bleed canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        onPointerMove={onPointerMove}
        onPointerUp={() => { dragging.current = null }}
        onClick={() => {
          setSelectedId(null)
          if (tool === "filter" || tool === "text") setTool(null)
        }}
      >
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full select-none"
          style={{ filter, objectFit: fitMode, backgroundColor: "#000" }}
          draggable={false}
        />

        {layers.map((layer) => {
          const isSelected = selectedId === layer.id
          return (
            <div
              key={layer.id}
              style={{
                position: "absolute",
                left: layer.x,
                top: layer.y,
                transform: "translate(-50%, -50%)",
                touchAction: "none",
                cursor: isSelected ? "default" : "grab",
                userSelect: "none",
              }}
              onPointerDown={(e) => onPointerDown(e, layer.id)}
              onPointerUp={() => onLayerPointerUp(layer.id)}
              onClick={(e) => e.stopPropagation()}
            >
              {isSelected && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id) }}
                  className="absolute -right-3 -top-3 flex size-6 items-center justify-center rounded-full bg-red-500 text-white shadow"
                  style={{ zIndex: 10 }}
                >
                  <X className="size-3.5" />
                </button>
              )}
              <span
                style={{
                  color: layer.color,
                  fontSize: layer.fontSize,
                  fontFamily: layer.fontFamily,
                  fontWeight: "bold",
                  textShadow: "0 2px 10px rgba(0,0,0,0.6)",
                  whiteSpace: "nowrap",
                  display: "block",
                  outline: isSelected ? "2px dashed rgba(255,255,255,0.7)" : "none",
                  borderRadius: 4,
                  padding: "0 4px",
                }}
              >
                {layer.text}
              </span>
            </div>
          )
        })}
      </div>

      {/* Top controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md"
            aria-label="Fermer"
          >
            <X className="size-5" />
          </button>
          <button
            onClick={() => setFitMode((m) => m === "cover" ? "contain" : "cover")}
            className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md"
          >
            {fitMode === "cover"
              ? <><Minimize2 className="size-3.5" /> Remplir</>
              : <><Expand className="size-3.5" /> Ajuster</>}
          </button>
        </div>
      </div>

      {/* Right tool column — Instagram style */}
      {tool !== "music" && (
        <div className="pointer-events-none absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-5">
          {sideTools.map((item) => {
            const active = tool === item.id
            return (
              <button
                key={item.id}
                onClick={(e) => { e.stopPropagation(); toggleTool(item.id) }}
                className="pointer-events-auto flex flex-col items-center gap-1"
              >
                <span className={`flex size-11 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
                  active ? "bg-white text-black" : "bg-black/40 text-white"
                }`}>
                  {"isText" in item && item.isText ? (
                    <span className="text-lg font-bold leading-none">Aa</span>
                  ) : item.id === "filter" ? (
                    <span className="text-[11px] font-bold tracking-wide">Fx</span>
                  ) : item.Icon ? (
                    <item.Icon className="size-5" />
                  ) : null}
                </span>
                <span className={`text-[10px] font-semibold drop-shadow ${active ? "text-white" : "text-white/80"}`}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Bottom: music badge + publish CTA */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {music && tool !== "music" && tool !== "filter" && tool !== "text" && (
          <div className="pointer-events-auto mx-auto flex max-w-full items-center gap-2 rounded-full bg-black/55 px-3.5 py-2 backdrop-blur-md">
            <Music className="size-3.5 shrink-0 text-white" />
            <span className="max-w-[220px] truncate text-xs font-semibold text-white">
              {music.name} — {music.artist}
            </span>
            <button
              onClick={() => setMusic(null)}
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-white"
              aria-label="Retirer la musique"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        {tool !== "music" && tool !== "filter" && tool !== "text" && (
          <button
            onClick={publish}
            disabled={publishing}
            className="pointer-events-auto mx-auto flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-bold text-black shadow-lg disabled:opacity-60"
          >
            {publishing ? <Loader2 className="size-4 animate-spin" /> : t("feed.yourStory")}
          </button>
        )}
      </div>

      {/* Filter strip */}
      <AnimatePresence>
        {tool === "filter" && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/80 via-black/40 to-transparent pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FILTERS.map((f) => (
                <button
                  key={f.name}
                  onClick={() => setFilter(f.value)}
                  className="flex shrink-0 flex-col items-center gap-1.5"
                >
                  <div
                    className="size-[72px] overflow-hidden rounded-xl border-2 transition-all"
                    style={{ borderColor: filter === f.value ? "white" : "transparent" }}
                  >
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" style={{ filter: f.value }} />
                  </div>
                  <span className={`text-[11px] font-semibold ${filter === f.value ? "text-white" : "text-white/50"}`}>
                    {f.name}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-center px-4">
              <button
                onClick={() => setTool(null)}
                className="rounded-full bg-white px-8 py-2.5 text-sm font-bold text-black"
              >
                OK
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Text overlay */}
      <AnimatePresence>
        {tool === "text" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-12"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FONTS.map((f) => (
                <button
                  key={f.name}
                  onClick={() => setFontFamily(f.family)}
                  className={`flex shrink-0 flex-col items-center gap-1 rounded-xl border px-3.5 py-2 transition-colors ${
                    fontFamily === f.family ? "border-white bg-white/15" : "border-white/15 bg-white/5"
                  }`}
                >
                  <span style={{ fontFamily: f.family, fontSize: 18, color: "white", fontWeight: "bold" }}>Aa</span>
                  <span className={`text-[10px] font-medium ${fontFamily === f.family ? "text-white" : "text-white/40"}`}>
                    {f.name}
                  </span>
                </button>
              ))}
            </div>

            <div className="mb-3 flex gap-2.5">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setTextColor(c)}
                  className="size-8 shrink-0 rounded-full border-2 transition-transform active:scale-90"
                  style={{
                    backgroundColor: c,
                    borderColor: textColor === c ? "white" : "rgba(255,255,255,0.15)",
                    transform: textColor === c ? "scale(1.25)" : "scale(1)",
                  }}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <input
                ref={textInputRef}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addText()}
                placeholder="Écris quelque chose…"
                className="flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/40"
                style={{ fontFamily }}
              />
              <button
                onClick={addText}
                disabled={!textInput.trim()}
                className="rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"
              >
                OK
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Music sheet */}
      <AnimatePresence>
        {tool === "music" && (
          <>
            <motion.button
              type="button"
              aria-label="Fermer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-black/45"
              onClick={() => {
                audioRef.current?.pause()
                setPlayingId(null)
                setTool(null)
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="absolute inset-x-0 bottom-0 z-40 max-h-[70vh] rounded-t-[24px] bg-[#1a1a1a] pb-[env(safe-area-inset-bottom)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pb-1 pt-3">
                <div className="h-1 w-10 rounded-full bg-white/20" />
              </div>

              <div className="flex items-center justify-between px-4 pb-3">
                <p className="text-base font-bold text-white">Musique</p>
                <button
                  onClick={() => {
                    audioRef.current?.pause()
                    setPlayingId(null)
                    setTool(null)
                  }}
                  className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex flex-col gap-2.5 px-4 pb-4">
                {music && (
                  <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2.5">
                    <Music className="size-4 shrink-0 text-white" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white">{music.name}</p>
                      <p className="truncate text-[10px] text-white/55">{music.artist}</p>
                    </div>
                    <button onClick={() => setMusic(null)} className="shrink-0 text-white/50 active:text-white">
                      <X className="size-4" />
                    </button>
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
                  <input
                    value={musicQuery}
                    onChange={(e) => { setMusicQuery(e.target.value); searchDeezer(e.target.value) }}
                    placeholder="Rechercher une chanson…"
                    autoFocus
                    className="h-11 w-full rounded-2xl border border-white/15 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/35 outline-none"
                  />
                  {musicLoading && (
                    <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-white/50" />
                  )}
                </div>

                <div className="flex flex-col gap-0.5 overflow-y-auto" style={{ maxHeight: "42vh" }}>
                  {musicResults.length === 0 && !musicLoading && musicQuery && (
                    <p className="py-6 text-center text-xs text-white/40">Aucun résultat</p>
                  )}
                  {musicResults.length === 0 && !musicQuery && (
                    <p className="py-6 text-center text-xs text-white/30">Tape le nom d&apos;une chanson ou d&apos;un artiste</p>
                  )}
                  {musicResults.map((track) => {
                    const isPlaying = playingId === track.id
                    const isSelected = music?.name === track.title && music?.artist === track.artist.name
                    return (
                      <div
                        key={track.id}
                        className={`flex items-center gap-3 rounded-xl px-2 py-2 transition-colors ${
                          isSelected ? "bg-white/15" : "active:bg-white/10"
                        }`}
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          onClick={() => selectTrack(track)}
                        >
                          <img src={track.album.cover_small} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">{track.title}</p>
                            <p className="truncate text-xs text-white/55">{track.artist.name}</p>
                          </div>
                          {isSelected && <span className="shrink-0 text-sm font-bold text-white">✓</span>}
                        </button>
                        <button
                          onClick={() => togglePreview(track)}
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/30"
                        >
                          {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 translate-x-px" />}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
