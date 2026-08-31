"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Search, X } from "lucide-react"

type GifItem = { id: string; url: string; preview: string }

export function GifPicker({ open, onClose, onSelect }: {
  open: boolean
  onClose: () => void
  onSelect: (url: string) => void
}) {
  const [inputValue, setInputValue] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [gifs, setGifs] = useState<GifItem[]>([])
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setHint(null)

    fetch(`/api/gifs/search?q=${encodeURIComponent(searchQuery)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        setGifs(d.gifs ?? [])
        setProvider(d.provider ?? null)
        if (d.hint) setHint(d.hint)
        else if (d.fallback) setHint("GIF limités — ajoutez GIPHY_API_KEY sur Vercel")
      })
      .catch((err) => {
        if (err.name !== "AbortError") setGifs([])
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [open, searchQuery])

  useEffect(() => {
    if (!open) {
      setInputValue("")
      setSearchQuery("")
      setGifs([])
      setHint(null)
      setProvider(null)
    }
  }, [open])

  if (!open) return null

  function pick(url: string) {
    if (!url) return
    onSelect(url)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex max-h-[70dvh] w-full max-w-md flex-col rounded-t-3xl border border-border bg-card"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-semibold text-foreground">GIF</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1 active:bg-secondary">
            <X className="size-5" />
          </button>
        </div>
        <div className="relative border-b border-border px-3 py-2">
          <Search className="absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={inputValue}
            onChange={(e) => {
              const v = e.target.value
              setInputValue(v)
              if (debounce.current) clearTimeout(debounce.current)
              debounce.current = setTimeout(() => setSearchQuery(v), 200)
            }}
            placeholder="GIF ara…"
            className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-ring"
          />
        </div>
        {hint && (
          <p className="px-3 py-1.5 text-center text-[11px] text-muted-foreground">{hint}</p>
        )}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : gifs.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {searchQuery ? "Sonuç yok" : "GIF yüklenemedi"}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {gifs.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => pick(g.url)}
                  className="overflow-hidden rounded-xl active:scale-[0.98] active:opacity-80"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.preview || g.url}
                    alt=""
                    className="pointer-events-none aspect-square w-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        {provider === "giphy" && (
          <p className="border-t border-border py-2 text-center text-[10px] font-medium tracking-wide text-muted-foreground">
            Powered by GIPHY
          </p>
        )}
      </div>
    </div>
  )
}
