"use client"

import { useEffect, useState } from "react"
import { Phone, PhoneOff } from "lucide-react"
import type { CallType } from "@/lib/call/call-context"
import { formatCallDuration } from "@/lib/call/call-event"

type Session = {
  id: string
  conversationId: string
  callerName: string
  calleeName: string
  callType: CallType
  status: string
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
      // bip
      tone(880, t0, 0.14)
      tone(700, t0, 0.14)
      // bip
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

export function CallOverlay({
  userName,
  incoming,
  active,
  error,
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
  onAnswer: () => void
  onDecline: () => void
  onEnd: () => void
  onDismissError?: () => void
}) {
  const session = incoming ?? active
  const [elapsed, setElapsed] = useState(0)

  const isIncoming = !!incoming
  const isConnected = !isIncoming && (session?.status === "active")
  const isOutgoingRinging = !!session && !isIncoming && !isConnected && !error

  useOutgoingRingtone(isOutgoingRinging)

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

  const peerName = session.callerName === userName ? session.calleeName : session.callerName
  const statusText = error
    ? error
    : isIncoming
      ? "Gelen sesli arama…"
      : isConnected
        ? formatCallDuration(elapsed)
        : "Çalıyor…"

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-900 text-white">
      <div className="relative z-20 flex flex-1 flex-col items-center justify-center gap-3 px-6">
        <div
          className={`flex size-24 items-center justify-center rounded-full bg-white/10 text-3xl font-bold ${
            isOutgoingRinging || isIncoming ? "animate-pulse" : ""
          }`}
        >
          {peerName.slice(0, 2).toUpperCase()}
        </div>
        <h2 className="text-xl font-bold">{peerName}</h2>
        <p className={`text-sm ${error ? "text-red-300" : "text-white/70"}`}>{statusText}</p>
      </div>

      <div className="relative z-20 flex items-center justify-center gap-8 pb-12 pt-6">
        {isIncoming ? (
          <>
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
          </>
        ) : (
          <button
            type="button"
            onClick={onEnd}
            className="flex size-16 items-center justify-center rounded-full bg-red-500 shadow-lg"
            aria-label="Kapat"
          >
            <PhoneOff className="size-7" />
          </button>
        )}
      </div>
    </div>
  )
}
