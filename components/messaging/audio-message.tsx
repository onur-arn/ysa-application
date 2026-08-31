"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Square, Trash2 } from "lucide-react"

export function AudioMessage({ src, self }: { src: string; self?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => setProgress(el.currentTime)
    const onMeta = () => setDuration(el.duration || 0)
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
    if (playing) { el.pause(); setPlaying(false) }
    else { el.play(); setPlaying(true) }
  }

  const pct = duration > 0 ? (progress / duration) * 100 : 0

  return (
    <div className="flex min-w-[180px] items-center gap-2">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${self ? "bg-primary-foreground/20" : "bg-primary/10"}`}
      >
        {playing ? <Square className="size-3.5 fill-current" /> : <span className="text-xs">▶</span>}
      </button>
      <div className="flex-1">
        <div className={`h-1.5 overflow-hidden rounded-full ${self ? "bg-primary-foreground/25" : "bg-muted"}`}>
          <div className={`h-full rounded-full transition-all ${self ? "bg-primary-foreground" : "bg-primary"}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`mt-1 block text-[10px] ${self ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {formatTime(progress)} / {formatTime(duration)}
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
    <div className="mb-2 flex items-center gap-3 rounded-xl bg-destructive/10 px-3 py-2">
      <span className="size-2 animate-pulse rounded-full bg-destructive" />
      <span className="flex-1 text-sm font-medium text-destructive">Kayıt… {seconds}s</span>
      <button type="button" onClick={onCancel} className="rounded-full p-2 text-muted-foreground active:bg-secondary">
        <Trash2 className="size-4" />
      </button>
      <button type="button" onClick={onStop} className="rounded-full bg-primary p-2 text-primary-foreground">
        <Mic className="size-4" />
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
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"
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
    }
  }

  function cancel() {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop())
    mediaRef.current = null
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
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
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
