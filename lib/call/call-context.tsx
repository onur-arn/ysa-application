"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { subscribeChannel } from "@/lib/supabase/realtime"
import { CallOverlay } from "@/components/messaging/call-overlay"
import { loadIceServers, prefetchIceServers, getTurnLoadError, isTurnConfigured } from "@/lib/call/ice-servers"
import { encodeCallEvent, type CallOutcome } from "@/lib/call/call-event"

export type CallType = "audio" | "video"

type CallSession = {
  id: string
  conversationId: string
  callerName: string
  calleeName: string
  callType: CallType
  status: string
}

type CallContextValue = {
  startCall: (opts: { conversationId: string; peerName: string; callType?: CallType }) => Promise<void>
  incoming: CallSession | null
  active: CallSession | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  callError: string | null
  answerCall: () => Promise<void>
  declineCall: () => Promise<void>
  endCall: () => Promise<void>
}

const CallContext = createContext<CallContextValue | null>(null)
const RING_TIMEOUT_MS = 10_000

export function useCallOptional() {
  return useContext(CallContext)
}

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error("useCall must be used within CallProvider")
  return ctx
}

async function acquireMedia(): Promise<MediaStream> {
  return await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
}

export function CallProvider({ userName, children }: { userName: string; children: ReactNode }) {
  const [incoming, setIncoming] = useState<CallSession | null>(null)
  const [active, setActive] = useState<CallSession | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [callError, setCallError] = useState<string | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const sessionRef = useRef<CallSession | null>(null)
  const isCallerRef = useRef(false)
  const localStreamRef = useRef<MediaStream | null>(null)
  const activeRef = useRef<CallSession | null>(null)
  const incomingRef = useRef<CallSession | null>(null)
  const iceBatchRef = useRef<RTCIceCandidateInit[]>([])
  const iceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectedAtRef = useRef<number | null>(null)
  const postedEventRef = useRef(false)

  useEffect(() => { activeRef.current = active }, [active])
  useEffect(() => { incomingRef.current = incoming }, [incoming])

  // Prefetch TURN so getUserMedia can stay in the user-gesture chain
  useEffect(() => {
    if (userName) void prefetchIceServers()
  }, [userName])

  const clearRingTimer = useCallback(() => {
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current)
    ringTimerRef.current = null
  }, [])

  const flushIce = useCallback((sessionId: string) => {
    const batch = iceBatchRef.current.splice(0)
    if (batch.length === 0) return
    if (!userName) return
    const supabase = createClient()
    void supabase.from("call_signals").insert(
      batch.map((payload) => ({
        session_id: sessionId,
        sender_name: userName,
        signal_type: "ice",
        payload,
      })),
    )
  }, [userName])

  const resetPc = useCallback(() => {
    if (iceTimerRef.current) clearTimeout(iceTimerRef.current)
    iceTimerRef.current = null
    iceBatchRef.current = []
    pcRef.current?.close()
    pcRef.current = null
  }, [])

  const cleanup = useCallback(() => {
    clearRingTimer()
    resetPc()
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    sessionRef.current = null
    isCallerRef.current = false
    connectedAtRef.current = null
    postedEventRef.current = false
    setActive(null)
    setIncoming(null)
    setCallError(null)
  }, [clearRingTimer, resetPc])

  const postCallEvent = useCallback(async (
    session: CallSession,
    outcome: CallOutcome,
    durationSec?: number,
  ) => {
    if (postedEventRef.current || !session.conversationId || !userName) return
    postedEventRef.current = true
    const supabase = createClient()
    await supabase.from("chat_messages").insert({
      conversation_id: session.conversationId,
      sender_name: userName,
      sender_initials: userName.slice(0, 2).toUpperCase(),
      text: encodeCallEvent({ v: 1, outcome, callType: session.callType, durationSec }),
      message_type: "call",
      is_system: false,
    })
  }, [userName])

  /** Always create a fresh PC; audio-only transceiver. */
  async function buildPc(sessionId: string, stream: MediaStream) {
    resetPc()

    const iceServers = await loadIceServers()
    const pc = new RTCPeerConnection({ iceServers })
    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0] ?? null)
    }
    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        flushIce(sessionId)
        return
      }
      iceBatchRef.current.push(e.candidate.toJSON())
      if (!iceTimerRef.current) {
        iceTimerRef.current = setTimeout(() => {
          iceTimerRef.current = null
          flushIce(sessionId)
        }, 150)
      }
    }

    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      pc.addTransceiver(audioTrack, { direction: "sendrecv", streams: [stream] })
    } else {
      pc.addTransceiver("audio", { direction: "recvonly" })
    }

    localStreamRef.current = stream
    setLocalStream(stream)
    pcRef.current = pc
    return pc
  }

  async function startCall({ conversationId, peerName }: { conversationId: string; peerName: string; callType?: CallType }) {
    const callType: CallType = "audio"
    if (!userName) {
      setCallError("Profil yükleniyor, tekrar deneyin.")
      return
    }
    if (activeRef.current || incomingRef.current) return

    setCallError(null)
    resetPc()

    // TURN/Metered check (usually already prefetched — avoid long await before getUserMedia)
    if (!isTurnConfigured()) {
      await loadIceServers()
      if (!isTurnConfigured()) {
        setCallError(
          getTurnLoadError() ??
            "TURN sunucusu hazır değil. Sayfayı yenileyip tekrar deneyin.",
        )
        return
      }
    }

    // Media FIRST — must stay close to the click (Safari / iOS)
    let stream: MediaStream
    try {
      stream = await acquireMedia()
    } catch {
      setCallError("Mikrofon izni gerekli. Tarayıcı ayarlarından izin verin.")
      return
    }

    // Show overlay immediately
    const placeholder: CallSession = {
      id: `pending-${Date.now()}`,
      conversationId,
      callerName: userName,
      calleeName: peerName,
      callType,
      status: "ringing",
    }
    sessionRef.current = placeholder
    isCallerRef.current = true
    postedEventRef.current = false
    connectedAtRef.current = null
    localStreamRef.current = stream
    setLocalStream(stream)
    setActive(placeholder)

    const supabase = createClient()

    try {
      const { data: session, error } = await supabase.from("call_sessions").insert({
        conversation_id: conversationId,
        caller_name: userName,
        callee_name: peerName,
        call_type: callType,
        status: "ringing",
      }).select().single()

      if (error || !session) {
        throw new Error(error?.message ?? "Oturum oluşturulamadı")
      }

      const s: CallSession = {
        id: session.id,
        conversationId,
        callerName: userName,
        calleeName: peerName,
        callType,
        status: "ringing",
      }
      sessionRef.current = s
      setActive(s)

      const pc = await buildPc(session.id, stream)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await supabase.from("call_signals").insert({
        session_id: session.id,
        sender_name: userName,
        signal_type: "offer",
        payload: {
          type: offer.type,
          sdp: offer.sdp,
        },
      })

      // No answer → missed voice call in chat, then hang up
      ringTimerRef.current = setTimeout(() => {
        void (async () => {
          const current = sessionRef.current
          if (!current || current.id !== s.id || connectedAtRef.current) return
          const sb = createClient()
          await sb.from("call_sessions").update({ status: "missed", ended_at: new Date().toISOString() }).eq("id", s.id)
          await sb.from("call_signals").insert({
            session_id: s.id,
            sender_name: userName,
            signal_type: "hangup",
            payload: {},
          })
          await postCallEvent(current, "missed")
          cleanup()
        })()
      }, RING_TIMEOUT_MS)
    } catch (err) {
      console.error("[call] start failed:", err)
      const message = err instanceof Error ? err.message : "Arama başlatılamadı"
      resetPc()
      stream.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
      setLocalStream(null)
      sessionRef.current = null
      isCallerRef.current = false
      setActive(null)
      setCallError(message)
    }
  }

  async function answerCall() {
    const session = incomingRef.current
    if (!session || !userName) return

    setCallError(null)

    let stream: MediaStream
    try {
      stream = await acquireMedia()
    } catch {
      setCallError("Mikrofon izni gerekli.")
      return
    }

    const supabase = createClient()
    await supabase.from("call_sessions").update({ status: "active" }).eq("id", session.id)
    const live = { ...session, status: "active", callType: "audio" as CallType }
    sessionRef.current = live
    isCallerRef.current = false
    connectedAtRef.current = Date.now()
    postedEventRef.current = false
    setActive(live)
    setIncoming(null)
    clearRingTimer()

    try {
      const pc = await buildPc(session.id, stream)

      const { data: offerSig } = await supabase
        .from("call_signals")
        .select("payload")
        .eq("session_id", session.id)
        .eq("signal_type", "offer")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()

      const remote = offerSig?.payload as RTCSessionDescriptionInit | undefined
      if (remote?.type === "offer" && remote.sdp) {
        await pc.setRemoteDescription({ type: "offer", sdp: remote.sdp })
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await supabase.from("call_signals").insert({
          session_id: session.id,
          sender_name: userName,
          signal_type: "answer",
          payload: {
            type: answer.type,
            sdp: answer.sdp,
          },
        })
      } else {
        throw new Error("Teklif bulunamadı")
      }
    } catch (err) {
      console.error("[call] answer failed:", err)
      resetPc()
      stream.getTracks().forEach((t) => t.stop())
      setCallError("Bağlantı kurulamadı")
    }
  }

  async function declineCall() {
    const session = incomingRef.current
    if (!session) return
    const supabase = createClient()
    await supabase.from("call_sessions").update({ status: "declined", ended_at: new Date().toISOString() }).eq("id", session.id)
    await supabase.from("call_signals").insert({
      session_id: session.id,
      sender_name: userName,
      signal_type: "decline",
      payload: {},
    })
    await postCallEvent(session, "declined")
    cleanup()
  }

  async function endCall() {
    const session = sessionRef.current ?? activeRef.current ?? incomingRef.current
    if (!session) { cleanup(); return }

    // Pending placeholder (DB insert not done yet)
    if (session.id.startsWith("pending-")) {
      cleanup()
      return
    }

    const supabase = createClient()
    const connected = connectedAtRef.current != null || session.status === "active"
    const outcome: CallOutcome = connected ? "ended" : "missed"
    const durationSec = connected && connectedAtRef.current
      ? Math.round((Date.now() - connectedAtRef.current) / 1000)
      : undefined

    await supabase.from("call_sessions").update({
      status: outcome === "missed" ? "missed" : "ended",
      ended_at: new Date().toISOString(),
    }).eq("id", session.id)
    await supabase.from("call_signals").insert({
      session_id: session.id,
      sender_name: userName,
      signal_type: "hangup",
      payload: {},
    })
    await postCallEvent(session, outcome, durationSec)
    cleanup()
  }

  useEffect(() => {
    if (!userName) return
    const supabase = createClient()

    const sessionsChannel = supabase
      .channel(`calls-in-${userName}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_sessions" }, (payload) => {
        const row = payload.new as { id: string; conversation_id: string; caller_name: string; callee_name: string; call_type: CallType; status: string }
        if (row.callee_name !== userName || row.status !== "ringing") return
        if (activeRef.current || incomingRef.current) return
        setIncoming({
          id: row.id,
          conversationId: row.conversation_id,
          callerName: row.caller_name,
          calleeName: row.callee_name,
          callType: row.call_type,
          status: row.status,
        })
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "call_sessions" }, (payload) => {
        const row = payload.new as { id: string; status: string }
        const incoming = incomingRef.current
        // Only clear incoming ring UI — never tear down an active caller session on status updates
        if (incoming?.id === row.id && row.status !== "ringing") {
          setIncoming(null)
        }
      })

    const signalsChannel = supabase
      .channel(`call-signals-${userName}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals" }, async (payload) => {
        const sig = payload.new as { session_id: string; sender_name: string; signal_type: string; payload: RTCSessionDescriptionInit | RTCIceCandidateInit }
        if (sig.sender_name === userName) return

        const incoming = incomingRef.current
        if (incoming && incoming.id === sig.session_id && (sig.signal_type === "hangup" || sig.signal_type === "decline")) {
          setIncoming(null)
          return
        }

        const session = sessionRef.current ?? activeRef.current
        if (!session || session.id !== sig.session_id) return
        const pc = pcRef.current

        if (sig.signal_type === "answer" && isCallerRef.current) {
          clearRingTimer()
          connectedAtRef.current = Date.now()
          const live = { ...session, status: "active" }
          sessionRef.current = live
          setActive(live)
          try {
            const remote = sig.payload as RTCSessionDescriptionInit
            if (pc && remote?.type === "answer" && remote.sdp && pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription({ type: "answer", sdp: remote.sdp })
            }
          } catch (err) {
            console.error("[call] setRemoteDescription failed:", err)
          }
        } else if (sig.signal_type === "ice") {
          try {
            if (pc) await pc.addIceCandidate(sig.payload as RTCIceCandidateInit)
          } catch { /* ignore */ }
        } else if (sig.signal_type === "hangup" || sig.signal_type === "decline") {
          cleanup()
        }
      })

    void subscribeChannel(supabase, sessionsChannel)
    void subscribeChannel(supabase, signalsChannel)

    return () => {
      supabase.removeChannel(sessionsChannel)
      supabase.removeChannel(signalsChannel)
    }
  }, [userName, cleanup, clearRingTimer])

  return (
    <CallContext.Provider value={{ startCall, incoming, active, localStream, remoteStream, callError, answerCall, declineCall, endCall }}>
      {children}
      <CallOverlay
        userName={userName}
        incoming={incoming}
        active={active}
        localStream={localStream}
        remoteStream={remoteStream}
        error={callError}
        onAnswer={answerCall}
        onDecline={declineCall}
        onEnd={endCall}
        onDismissError={() => { setCallError(null); cleanup() }}
      />
    </CallContext.Provider>
  )
}
