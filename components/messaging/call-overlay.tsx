"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from "lucide-react"
import type { CallType } from "@/lib/call/call-context"
import { formatCallDuration } from "@/lib/call/call-event"

type Session = {
  id: string
  conversationId: string
  callerName: string
  calleeName: string
  callType: CallType
  status: string
  isGroup?: boolean
}

/** Outgoing ring: bip-bip … pause … bip-bip */
function useOutgoingRingtone(playing: boolean) {
  useEffect(() => {
    if (!playing) return

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    let cancelled = false
    let loopTimer: ReturnType<typeof setTimeout> | null = null

    function tone(freq: number, start: number, duration: number) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + duration + 0.02)
    }

    function playCycle() {
      if (cancelled) return
      const t0 = ctx.currentTime
      tone(880, t0, 0.14)
      tone(700, t0, 0.14)
      tone(880, t0 + 0.22, 0.14)
      tone(700, t0 + 0.22, 0.14)
      loopTimer = setTimeout(playCycle, 1400)
    }

    void ctx.resume().then(() => {
      if (!cancelled) playCycle()
    })

    return () => {
      cancelled = true
      if (loopTimer) clearTimeout(loopTimer)
      void ctx.close()
    }
  }, [playing])
}

async function applySpeakerOutput(el: HTMLAudioElement, speakerOn: boolean) {
  // setSinkId: Chrome/Android — pick loudspeaker vs default (often earpiece on mobile)
  const mediaEl = el as HTMLAudioElement & {
    setSinkId?: (id: string) => Promise<void>
  }
  if (typeof mediaEl.setSinkId !== "function") return

  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const outputs = devices.filter((d) => d.kind === "audiooutput")
    if (outputs.length === 0) return

    if (speakerOn) {
      // Prefer a non-earpiece / communications device when labeled
      const speaker =
        outputs.find((d) => /speaker|haut|loud|speakerphone/i.test(d.label)) ??
        outputs.find((d) => d.deviceId === "default") ??
        outputs[0]
      await mediaEl.setSinkId(speaker.deviceId)
    } else {
      const ear =
        outputs.find((d) => /earpiece|receiver|phone|écouteur|communication/i.test(d.label)) ??
        outputs.find((d) => d.deviceId === "default") ??
        outputs[0]
      await mediaEl.setSinkId(ear.deviceId)
    }
  } catch (err) {
    console.warn("[call] setSinkId failed", err)
  }
}

export function CallOverlay({
  userName,
  incoming,
  active,
  remoteStream,
  error,
  muted = false,
  speakerOn = true,
  onToggleMute,
  onToggleSpeaker,
  onAnswer,
  onDecline,
  onEnd,
  onDismissError,
}: {
  userName: string
  incoming: Session | null
  active: Session | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  error?: string | null
  muted?: boolean
  speakerOn?: boolean
  onToggleMute?: () => void
  onToggleSpeaker?: () => void
  onAnswer: () => void
  onDecline: () => void
  onEnd: () => void
  onDismissError?: () => void
}) {
  const session = incoming ?? active
  const [elapsed, setElapsed] = useState(0)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  const isIncoming = !!incoming
  const isConnecting = !isIncoming && session?.status === "connecting"
  const isConnected = !isIncoming && session?.status === "active"
  const isOutgoingRinging = !!session && !isIncoming && !isConnecting && !isConnected && !error

  useOutgoingRingtone(isOutgoingRinging)

  // Attach remote WebRTC audio — without this, neither side hears the other
  useEffect(() => {
    const el = remoteAudioRef.current
    if (!el) return
    if (!remoteStream) {
      el.srcObject = null
      setAudioBlocked(false)
      return
    }
    for (const track of remoteStream.getAudioTracks()) {
      track.enabled = true
    }
    el.srcObject = remoteStream
    el.muted = false
    el.defaultMuted = false
    el.volume = 1

    const tryPlay = () => {
      void el.play()
        .then(() => setAudioBlocked(false))
        .catch((err) => {
          console.warn("[call] remote audio play", err)
          setAudioBlocked(true)
        })
    }
    tryPlay()
    const t1 = setTimeout(tryPlay, 200)
    const t2 = setTimeout(tryPlay, 800)
    const onUnmute = () => tryPlay()
    remoteStream.getAudioTracks().forEach((t) => {
      t.addEventListener("unmute", onUnmute)
      t.enabled = true
    })
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      remoteStream.getAudioTracks().forEach((t) => t.removeEventListener("unmute", onUnmute))
    }
  }, [remoteStream, isConnected, isConnecting])

  // Speakerphone routing
  useEffect(() => {
    const el = remoteAudioRef.current
    if (!el) return
    void applySpeakerOutput(el, speakerOn)
  }, [speakerOn, remoteStream, isConnected])

  useEffect(() => {
    if (!isConnected) {
      setElapsed(0)
      return
    }
    const started = Date.now()
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(t)
  }, [isConnected, session?.id])

  if (error && !session) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-zinc-900 px-6 text-white">
        <p className="text-center text-sm text-white/80">{error}</p>
        <button
          type="button"
          onClick={onDismissError}
          className="rounded-full bg-white/15 px-6 py-3 text-sm font-semibold"
        >
          Kapat
        </button>
      </div>
    )
  }

  if (!session) return null

  const isGroup = !!session.isGroup || session.calleeName === "__group__"
  const peerName = isIncoming
    ? session.callerName
    : isGroup
      ? "Grup araması"
      : session.callerName === userName
        ? session.calleeName
        : session.callerName
  const statusText = error
    ? error
    : isIncoming
      ? (isGroup ? "Gelen grup araması…" : "Gelen sesli arama…")
      : isConnected
        ? formatCallDuration(elapsed)
        : isConnecting
          ? "Bağlanıyor…"
          : "Çalıyor…"

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-900 text-white">
      {/* Remote peer audio — keep in layout (not opacity-0) so mobile browsers play */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        controls={false}
        className="absolute left-[-9999px] top-0 h-px w-px"
      />

      <div className="relative z-20 flex flex-1 flex-col items-center justify-center gap-3 px-6">
        <div
          className={`flex size-24 items-center justify-center rounded-full bg-white/10 text-3xl font-bold ${
            isOutgoingRinging || isIncoming ? "animate-pulse" : ""
          }`}
        >
          {(isIncoming ? session.callerName : peerName).slice(0, 2).toUpperCase()}
        </div>
        <h2 className="text-xl font-bold">{peerName}</h2>
        {isGroup && isIncoming && (
          <p className="text-xs text-white/50">Grup araması</p>
        )}
        <p className={`text-sm ${error ? "text-red-300" : "text-white/70"}`}>{statusText}</p>
        {audioBlocked && (isConnected || isConnecting) && (
          <button
            type="button"
            onClick={() => {
              const el = remoteAudioRef.current
              if (!el) return
              void el.play()
                .then(() => setAudioBlocked(false))
                .catch(() => setAudioBlocked(true))
            }}
            className="rounded-full bg-amber-500/90 px-4 py-2 text-xs font-semibold text-zinc-900"
          >
            Sesi aç (dokun)
          </button>
        )}
        {isConnected && muted && (
          <p className="text-xs text-amber-300">Mikrofon kapalı</p>
        )}
      </div>

      <div className="relative z-20 flex flex-col items-center gap-8 pb-12 pt-6">
        {isIncoming ? (
          <div className="flex items-center justify-center gap-8">
            <button
              type="button"
              onClick={onDecline}
              className="flex size-16 items-center justify-center rounded-full bg-red-500 shadow-lg"
              aria-label="Reddet"
            >
              <PhoneOff className="size-7" />
            </button>
            <button
              type="button"
              onClick={onAnswer}
              className="flex size-16 items-center justify-center rounded-full bg-emerald-500 shadow-lg"
              aria-label="Cevapla"
            >
              <Phone className="size-7" />
            </button>
          </div>
        ) : (
          <>
            {(isConnected || isOutgoingRinging) && (
              <div className="flex items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`flex size-14 flex-col items-center justify-center rounded-full ${
                    muted ? "bg-white text-zinc-900" : "bg-white/15 text-white"
                  }`}
                  aria-label={muted ? "Mikrofonu aç" : "Mikrofonu kapat"}
                >
                  {muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
                </button>
                <button
                  type="button"
                  onClick={onToggleSpeaker}
                  className={`flex size-14 flex-col items-center justify-center rounded-full ${
                    speakerOn ? "bg-white text-zinc-900" : "bg-white/15 text-white"
                  }`}
                  aria-label={speakerOn ? "Hoparlörü kapat" : "Hoparlörü aç"}
                >
                  {speakerOn ? <Volume2 className="size-6" /> : <VolumeX className="size-6" />}
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onEnd}
              className="flex size-16 items-center justify-center rounded-full bg-red-500 shadow-lg"
              aria-label="Kapat"
            >
              <PhoneOff className="size-7" />
            </button>
            {(isConnected || isOutgoingRinging) && (
              <p className="text-[11px] text-white/45">
                {speakerOn ? "Hoparlör açık" : "Kulaklık / ahize"}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
