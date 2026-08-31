"use client"

import { useEffect, useState } from "react"
import { Phone, PhoneOff, Video } from "lucide-react"
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

export function CallOverlay({
  userName,
  incoming,
  active,
  localStream,
  remoteStream,
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
  const isConnected = !isIncoming && (session?.status === "active" || !!remoteStream)

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
  const isVideo = session.callType === "video"
  const statusText = error
    ? error
    : isIncoming
      ? "Gelen arama…"
      : isConnected
        ? formatCallDuration(elapsed)
        : "Çalıyor…"

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-900 text-white">
      {isVideo && remoteStream && (
        <video
          autoPlay
          playsInline
          ref={(el) => { if (el) el.srcObject = remoteStream }}
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {isVideo && localStream && (
        <video
          autoPlay
          playsInline
          muted
          ref={(el) => { if (el) el.srcObject = localStream }}
          className="absolute right-4 top-16 z-10 h-36 w-28 rounded-2xl border-2 border-white/30 object-cover shadow-lg"
        />
      )}

      <div className="relative z-20 flex flex-1 flex-col items-center justify-center gap-3 px-6">
        <div className="flex size-24 items-center justify-center rounded-full bg-white/10 text-3xl font-bold">
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
              {isVideo ? <Video className="size-7" /> : <Phone className="size-7" />}
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
