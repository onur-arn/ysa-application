"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Pause, Play, Send, X } from "lucide-react"

export function AudioMessage({ src, self }: { src: string; self?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => setProgress(el.currentTime)
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0)
    const onEnd = () => { setPlaying(false); setProgress(0) }
    el.addEventListener("timeupdate", onTime)
    el.addEventListener("loadedmetadata", onMeta)
    el.addEventListener("ended", onEnd)
    return () => {
      el.removeEventListener("timeupdate", onTime)
      el.removeEventListener("loadedmetadata", onMeta)
      el.removeEventListener("ended", onEnd)
    }
  }, [src])

  function toggle() {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0

  return (
    <div className={`flex min-w-[200px] max-w-[260px] items-center gap-2.5 rounded-2xl px-1 py-0.5 ${self ? "" : ""}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Duraklat" : "Oynat"}
        className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors ${
          self
            ? "bg-primary-foreground/20 text-primary-foreground active:bg-primary-foreground/30"
            : "bg-primary text-primary-foreground active:opacity-90"
        }`}
      >
        {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current translate-x-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-8 items-center gap-0.5">
          {Array.from({ length: 24 }).map((_, i) => {
            const h = 4 + ((i * 7) % 14)
            const active = pct > (i / 24) * 100
            return (
              <span
                key={i}
                className={`w-[3px] rounded-full transition-colors ${
                  active
                    ? self ? "bg-primary-foreground" : "bg-primary"
                    : self ? "bg-primary-foreground/30" : "bg-muted-foreground/30"
                }`}
                style={{ height: h }}
              />
            )
          })}
        </div>
        <span className={`mt-0.5 block text-[11px] tabular-nums ${self ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
          {formatTime(playing || progress > 0 ? progress : duration)}
        </span>
      </div>
    </div>
  )
}

function formatTime(s: number) {
  if (!s || !isFinite(s)) return "0:00"
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

export function VoiceRecorderBar({ recording, seconds, onStop, onCancel }: {
  recording: boolean
  seconds: number
  onStop: () => void
  onCancel: () => void
}) {
  if (!recording) return null
  return (
    <div className="mb-2 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2.5">
      <span className="relative flex size-3">
        <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/60" />
        <span className="relative size-3 rounded-full bg-rose-500" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Ses kaydı</p>
        <p className="text-xs tabular-nums text-muted-foreground">{formatTime(seconds)}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="İptal"
        className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground active:bg-secondary/80"
      >
        <X className="size-4" />
      </button>
      <button
        type="button"
        onClick={onStop}
        aria-label="Gönder"
        className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm active:scale-95"
      >
        <Send className="size-4" />
      </button>
    </div>
  )
}

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4"
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start(200)
      mediaRef.current = recorder
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch (err) {
      console.error("[voice]", err)
      window.alert("Mikrofona erişilemedi. Tarayıcı izinlerini kontrol edin.")
    }
  }

  function cancel() {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop())
    mediaRef.current = null
    chunksRef.current = []
    setRecording(false)
    setSeconds(0)
  }

  function stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const recorder = mediaRef.current
      if (!recorder) { resolve(null); return }
      if (timerRef.current) clearInterval(timerRef.current)
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop())
        // Strip ";codecs=…" — Supabase Storage rejects that Content-Type (415)
        const cleanType = (recorder.mimeType || "audio/webm").split(";")[0].trim() || "audio/webm"
        const blob = new Blob(chunksRef.current, { type: cleanType })
        mediaRef.current = null
        setRecording(false)
        setSeconds(0)
        resolve(blob.size > 0 ? blob : null)
      }
      recorder.stop()
    })
  }

  return { recording, seconds, start, stop, cancel }
}
