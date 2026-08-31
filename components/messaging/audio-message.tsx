"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, Pause, Play, Send, X } from "lucide-react"

function formatTime(s: number) {
  if (!s || !isFinite(s) || s < 0) return "0:00"
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

/** WebM often reports duration=Infinity until we seek near the end. */
async function resolveDuration(el: HTMLAudioElement): Promise<number> {
  if (Number.isFinite(el.duration) && el.duration > 0 && el.duration < 1e6) {
    return el.duration
  }
  return new Promise((resolve) => {
    let done = false
    const finish = (v: number) => {
      if (done) return
      done = true
      el.removeEventListener("timeupdate", onTime)
      el.removeEventListener("loadedmetadata", onMeta)
      try {
        if (el.currentTime > 0.05) el.currentTime = 0
      } catch { /* ignore */ }
      resolve(v > 0 && v < 1e6 ? v : 0)
    }
    const onTime = () => {
      if (Number.isFinite(el.duration) && el.duration > 0 && el.duration < 1e6) {
        finish(el.duration)
      }
    }
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0 && el.duration < 1e6) {
        finish(el.duration)
      }
    }
    el.addEventListener("timeupdate", onTime)
    el.addEventListener("loadedmetadata", onMeta)
    try {
      el.currentTime = 1e101
    } catch {
      finish(0)
      return
    }
    window.setTimeout(() => {
      const d = el.duration
      finish(Number.isFinite(d) && d < 1e6 ? d : 0)
    }, 1200)
  })
}

export function AudioMessage({
  src,
  self,
  durationHint,
}: {
  src: string
  self?: boolean
  /** Known length in seconds (e.g. from recorder) — shown before metadata loads */
  durationHint?: number
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(durationHint && durationHint > 0 ? durationHint : 0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    setProgress(0)
    setPlaying(false)
    setReady(false)
    if (durationHint && durationHint > 0) setDuration(durationHint)

    let cancelled = false
    const onTime = () => setProgress(el.currentTime)
    const onEnd = () => {
      setPlaying(false)
      setProgress(0)
      try { el.currentTime = 0 } catch { /* ignore */ }
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)

    el.addEventListener("timeupdate", onTime)
    el.addEventListener("ended", onEnd)
    el.addEventListener("play", onPlay)
    el.addEventListener("pause", onPause)

    const boot = async () => {
      try {
        el.load()
        await new Promise<void>((resolve) => {
          if (el.readyState >= 1) { resolve(); return }
          const done = () => { el.removeEventListener("loadedmetadata", done); resolve() }
          el.addEventListener("loadedmetadata", done)
          window.setTimeout(done, 800)
        })
        if (cancelled) return
        const d = await resolveDuration(el)
        if (cancelled) return
        if (d > 0) setDuration(d)
        setReady(true)
      } catch {
        if (!cancelled) setReady(true)
      }
    }
    void boot()

    return () => {
      cancelled = true
      el.removeEventListener("timeupdate", onTime)
      el.removeEventListener("ended", onEnd)
      el.removeEventListener("play", onPlay)
      el.removeEventListener("pause", onPause)
    }
  }, [src, durationHint])

  const toggle = useCallback(async () => {
    const el = audioRef.current
    if (!el) return
    if (!el.paused) {
      el.pause()
      return
    }
    try {
      if (el.readyState < 2) {
        el.load()
        await new Promise<void>((resolve, reject) => {
          const ok = () => { cleanup(); resolve() }
          const fail = () => { cleanup(); reject(new Error("load")) }
          const cleanup = () => {
            el.removeEventListener("canplay", ok)
            el.removeEventListener("error", fail)
          }
          el.addEventListener("canplay", ok, { once: true })
          el.addEventListener("error", fail, { once: true })
          window.setTimeout(ok, 1500)
        })
      }
      if (!duration || duration <= 0) {
        const d = await resolveDuration(el)
        if (d > 0) setDuration(d)
      }
      await el.play()
      setReady(true)
    } catch {
      try {
        el.load()
        await el.play()
      } catch {
        setPlaying(false)
      }
    }
  }, [duration])

  function seek(clientX: number) {
    const el = audioRef.current
    const bar = barRef.current
    if (!el || !bar || duration <= 0) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    el.currentTime = ratio * duration
    setProgress(el.currentTime)
  }

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0
  const display = playing || progress > 0.05 ? progress : duration

  return (
    <div className="flex min-w-[210px] max-w-[280px] items-center gap-2.5 px-0.5 py-0.5">
      <audio ref={audioRef} src={src} preload="auto" playsInline />
      <button
        type="button"
        onClick={() => void toggle()}
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
        <div
          ref={barRef}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(progress)}
          tabIndex={0}
          onClick={(e) => seek(e.clientX)}
          onKeyDown={(e) => {
            if (!audioRef.current || duration <= 0) return
            const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0
            if (!step) return
            e.preventDefault()
            audioRef.current.currentTime = Math.min(duration, Math.max(0, audioRef.current.currentTime + step))
            setProgress(audioRef.current.currentTime)
          }}
          className={`relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full ${
            self ? "bg-primary-foreground/25" : "bg-muted-foreground/25"
          }`}
        >
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-75 ${
              self ? "bg-white" : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className={`text-[11px] tabular-nums ${self ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
            {formatTime(display)}
          </span>
          {!playing && duration > 0 && progress < 0.05 && (
            <span className={`text-[10px] tabular-nums ${self ? "text-primary-foreground/55" : "text-muted-foreground/70"}`}>
              {ready ? "" : "…"}
            </span>
          )}
        </div>
      </div>
    </div>
  )
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
  const secondsRef = useRef(0)

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
      secondsRef.current = 0
      setSeconds(0)
      timerRef.current = setInterval(() => {
        secondsRef.current += 1
        setSeconds(secondsRef.current)
      }, 1000)
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
    secondsRef.current = 0
  }

  function stop(): Promise<{ blob: Blob; durationSec: number } | null> {
    return new Promise((resolve) => {
      const recorder = mediaRef.current
      if (!recorder) { resolve(null); return }
      if (timerRef.current) clearInterval(timerRef.current)
      const durationSec = Math.max(1, secondsRef.current)
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop())
        const cleanType = (recorder.mimeType || "audio/webm").split(";")[0].trim() || "audio/webm"
        const blob = new Blob(chunksRef.current, { type: cleanType })
        mediaRef.current = null
        setRecording(false)
        setSeconds(0)
        secondsRef.current = 0
        resolve(blob.size > 0 ? { blob, durationSec } : null)
      }
      recorder.stop()
    })
  }

  return { recording, seconds, start, stop, cancel }
}
