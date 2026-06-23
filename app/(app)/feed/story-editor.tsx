"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { X, Type, Music, Sliders, Trash2, Expand, Minimize2, Search, Play, Pause, Loader2 } from "lucide-react"
import { motion } from "framer-motion"

const FILTERS = [
  { name: "Normal",  value: "none" },
  { name: "Chaud",   value: "sepia(0.3) saturate(1.4) brightness(1.05)" },
  { name: "Froid",   value: "saturate(0.8) hue-rotate(20deg) brightness(1.05)" },
  { name: "N&B",     value: "grayscale(1)" },
  { name: "Vintage", value: "sepia(0.5) contrast(0.85) brightness(0.9)" },
  { name: "Vif",     value: "saturate(1.8) contrast(1.1)" },
]

const FONTS = [
  { name: "Normal",  family: "-apple-system, BlinkMacSystemFont, sans-serif", label: "Aa" },
  { name: "Serif",   family: "Georgia, 'Times New Roman', serif",             label: "Aa" },
  { name: "Mono",    family: "'Courier New', Courier, monospace",             label: "Aa" },
  { name: "Script",  family: "cursive",                                       label: "Aa" },
  { name: "Impact",  family: "Impact, Haettenschweiler, fantasy",             label: "Aa" },
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

export function StoryEditor({
  imageUrl,
  onCancel,
  onPublish,
}: {
  imageUrl: string
  onCancel: () => void
  onPublish: (flatUrl: string, fitMode: "cover" | "contain", musicPreviewUrl?: string, musicLabel?: string) => void
}) {
  const [filter, setFilter]         = useState("none")
  const [layers, setLayers]         = useState<Layer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab]               = useState<"filter" | "text" | "music">("filter")
  const [textInput, setTextInput]   = useState("")
  const [textColor, setTextColor]   = useState("#ffffff")
  const [fontFamily, setFontFamily] = useState(FONTS[0].family)
  const [music, setMusic]           = useState<Track | null>(null)
  const [pendingTrack, setPendingTrack] = useState<DeezerTrack | null>(null)
  const [publishing, setPublishing] = useState(false)

  // Music search
  const [musicQuery, setMusicQuery]     = useState("")
  const [musicResults, setMusicResults] = useState<DeezerTrack[]>([])
  const [musicLoading, setMusicLoading] = useState(false)
  const [playingId, setPlayingId]       = useState<number | null>(null)
  const audioRef                        = useRef<HTMLAudioElement | null>(null)
  const searchTimer                     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [fitMode, setFitMode]       = useState<"cover" | "contain">("cover")
  const [imgNaturalW, setImgNaturalW] = useState(0)
  const [imgNaturalH, setImgNaturalH] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)

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
    setPendingTrack((prev) => prev?.id === track.id ? null : track)
  }

  function confirmTrack() {
    if (!pendingTrack) return
    audioRef.current?.pause()
    setPlayingId(null)
    setMusic({ name: pendingTrack.title, artist: pendingTrack.artist.name, previewUrl: pendingTrack.preview })
    setPendingTrack(null)
  }

  useEffect(() => {
    return () => { audioRef.current?.pause() }
  }, [])

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      setImgNaturalW(img.naturalWidth)
      setImgNaturalH(img.naturalHeight)
      // auto: landscape → contain, portrait → cover
      setFitMode(img.naturalWidth > img.naturalHeight ? "contain" : "cover")
    }
    img.src = imageUrl
  }, [imageUrl])
  const dragging     = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null)
  const moved        = useRef(false)

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

    // background
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, w, h)

    if (filter !== "none") ctx.filter = filter
    if (fitMode === "cover") {
      // crop to fill
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
      const dw = img.naturalWidth  * scale
      const dh = img.naturalHeight * scale
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
    } else {
      // letterbox
      const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight)
      const dw = img.naturalWidth  * scale
      const dh = img.naturalHeight * scale
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
    }
    ctx.filter = "none"

    for (const layer of layers) {
      ctx.font          = `bold ${layer.fontSize}px ${layer.fontFamily}`
      ctx.textAlign     = "center"
      ctx.textBaseline  = "middle"
      ctx.shadowColor   = "rgba(0,0,0,0.55)"
      ctx.shadowBlur    = 8
      ctx.fillStyle     = layer.color
      ctx.fillText(layer.text, layer.x, layer.y)
      ctx.shadowBlur    = 0
    }

    if (music) {
      const badgeText = `♪  ${music.name} — ${music.artist}`
      const badgePad  = 14
      const badgeH    = 34
      const badgeY    = h - 52
      ctx.font        = `bold 13px -apple-system, sans-serif`
      const textW     = ctx.measureText(badgeText).width
      const badgeW    = textW + badgePad * 2
      const badgeX    = 20

      ctx.fillStyle   = "rgba(0,0,0,0.55)"
      ctx.beginPath()
      const r = badgeH / 2
      ctx.moveTo(badgeX + r, badgeY)
      ctx.arcTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeH, r)
      ctx.arcTo(badgeX + badgeW, badgeY + badgeH, badgeX, badgeY + badgeH, r)
      ctx.arcTo(badgeX, badgeY + badgeH, badgeX, badgeY, r)
      ctx.arcTo(badgeX, badgeY, badgeX + badgeW, badgeY, r)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle   = "white"
      ctx.textAlign   = "left"
      ctx.textBaseline = "middle"
      ctx.fillText(badgeText, badgeX + badgePad, badgeY + badgeH / 2)
    }

    onPublish(
      canvas.toDataURL("image/jpeg", 0.88),
      fitMode,
      music?.previewUrl,
      music ? `${music.name} — ${music.artist}` : undefined,
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex flex-col bg-black"
    >
      {/* Photo + layers */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
        onPointerMove={onPointerMove}
        onPointerUp={() => { dragging.current = null }}
        onClick={() => setSelectedId(null)}
      >
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full select-none"
          style={{ filter, objectFit: fitMode, backgroundColor: "#000" }}
          draggable={false}
        />

        {/* Text layers */}
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

        {/* Music badge preview */}
        {music && (
          <div className="absolute bottom-6 left-4 flex items-center gap-2 rounded-full bg-black/55 px-3.5 py-2 backdrop-blur">
            <Music className="size-3.5 text-white" />
            <span className="text-xs font-semibold text-white">{music.name} — {music.artist}</span>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-4">
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur">
              <X className="size-5" />
            </button>
            <button
              onClick={() => setFitMode((m) => m === "cover" ? "contain" : "cover")}
              className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-2 text-xs font-semibold text-white backdrop-blur"
              title={fitMode === "cover" ? "Passer en mode ajusté" : "Passer en mode remplissage"}
            >
              {fitMode === "cover"
                ? <><Minimize2 className="size-3.5" /> Remplir</>
                : <><Expand    className="size-3.5" /> Ajuster</>}
            </button>
          </div>
          <button
            onClick={publish}
            disabled={publishing}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg disabled:opacity-60"
          >
            {publishing ? "…" : "Partager →"}
          </button>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="shrink-0 bg-black pb-safe pt-3">
        {/* Tabs */}
        <div className="mb-3 flex justify-center gap-10">
          {([
            { id: "filter", Icon: Sliders, label: "Filtre" },
            { id: "text",   Icon: Type,    label: "Texte"  },
            { id: "music",  Icon: Music,   label: "Musique" },
          ] as const).map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-1 text-xs font-semibold transition-colors ${tab === id ? "text-white" : "text-white/35"}`}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>

        {/* Filter panel */}
        {tab === "filter" && (
          <div className="flex gap-3 overflow-x-auto px-4 pb-4 [scrollbar-width:none]">
            {FILTERS.map((f) => (
              <button key={f.name} onClick={() => setFilter(f.value)} className="flex shrink-0 flex-col items-center gap-1.5">
                <div className="size-16 overflow-hidden rounded-xl border-2 transition-colors" style={{ borderColor: filter === f.value ? "white" : "transparent" }}>
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" style={{ filter: f.value }} />
                </div>
                <span className={`text-[10px] font-medium ${filter === f.value ? "text-white" : "text-white/45"}`}>{f.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Text panel */}
        {tab === "text" && (
          <div className="flex flex-col gap-3 px-4 pb-4">
            {/* Font picker */}
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
              {FONTS.map((f) => (
                <button
                  key={f.name}
                  onClick={() => setFontFamily(f.family)}
                  className={`flex shrink-0 flex-col items-center gap-1 rounded-xl border px-3 py-2 transition-colors ${fontFamily === f.family ? "border-white bg-white/15" : "border-white/20"}`}
                >
                  <span style={{ fontFamily: f.family, fontSize: 20, color: "white", fontWeight: "bold" }}>{f.label}</span>
                  <span className={`text-[10px] font-medium ${fontFamily === f.family ? "text-white" : "text-white/45"}`}>{f.name}</span>
                </button>
              ))}
            </div>

            {/* Color picker */}
            <div className="flex gap-2.5">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setTextColor(c)}
                  className="size-8 shrink-0 rounded-full border-2 transition-transform active:scale-90"
                  style={{
                    backgroundColor: c,
                    borderColor: textColor === c ? "white" : "rgba(255,255,255,0.2)",
                    transform: textColor === c ? "scale(1.25)" : "scale(1)",
                  }}
                />
              ))}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addText()}
                placeholder="Écris quelque chose…"
                className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none"
                style={{ fontFamily }}
              />
              <button
                onClick={addText}
                disabled={!textInput.trim()}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                OK
              </button>
            </div>
            {layers.length > 0 && (
              <p className="text-center text-[10px] text-white/40">Appuie sur un texte pour le sélectionner · ✕ pour supprimer</p>
            )}
          </div>
        )}

        {/* Music panel */}
        {tab === "music" && (
          <div className="flex flex-col gap-2 px-4 pb-4">
            {/* Current selection */}
            {music && (
              <div className="flex items-center gap-2 rounded-xl bg-primary/20 px-3 py-2">
                <Music className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">{music.name}</p>
                  <p className="truncate text-[10px] text-white/60">{music.artist}</p>
                </div>
                <button onClick={() => setMusic(null)} className="shrink-0 text-white/50 active:text-white">
                  <X className="size-4" />
                </button>
              </div>
            )}

            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
              <input
                value={musicQuery}
                onChange={(e) => { setMusicQuery(e.target.value); searchDeezer(e.target.value) }}
                placeholder="Rechercher une chanson…"
                className="h-10 w-full rounded-xl border border-white/20 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/35 outline-none"
              />
              {musicLoading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-white/50" />}
            </div>

            {/* Results */}
            <div className="flex flex-col gap-0.5 overflow-y-auto" style={{ maxHeight: 180 }}>
              {musicResults.length === 0 && !musicLoading && musicQuery && (
                <p className="py-4 text-center text-xs text-white/40">Aucun résultat</p>
              )}
              {musicResults.length === 0 && !musicQuery && (
                <p className="py-4 text-center text-xs text-white/30">Tape le nom d'une chanson ou d'un artiste</p>
              )}
              {musicResults.map((track) => {
                const isPlaying  = playingId === track.id
                const isPending  = pendingTrack?.id === track.id
                const isConfirmed = music?.name === track.title && music?.artist === track.artist.name
                return (
                  <div
                    key={track.id}
                    className={`flex items-center gap-3 rounded-xl px-2 py-2 transition-colors ${isPending ? "bg-white/15 ring-1 ring-white/30" : isConfirmed ? "bg-primary/20" : "active:bg-white/10"}`}
                  >
                    <img src={track.album.cover_small} alt="" className="size-10 shrink-0 rounded-lg object-cover" />

                    <div className="min-w-0 flex-1" onClick={() => selectTrack(track)}>
                      <p className="truncate text-sm font-semibold text-white">{track.title}</p>
                      <p className="truncate text-xs text-white/55">{track.artist.name}</p>
                    </div>

                    <button
                      onClick={() => togglePreview(track)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/30"
                    >
                      {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 translate-x-px" />}
                    </button>

                    {isConfirmed && !isPending && <span className="shrink-0 text-sm font-bold text-primary">✓</span>}
                  </div>
                )
              })}

              {/* Validate button — sticky at bottom of results */}
              {pendingTrack && (
                <div className="sticky bottom-0 pt-2">
                  <button
                    onClick={confirmTrack}
                    className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow-lg"
                  >
                    ✓ Valider « {pendingTrack.title} »
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
