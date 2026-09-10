"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { subscribeChannel } from "@/lib/supabase/realtime"
import { CallOverlay } from "@/components/messaging/call-overlay"
import { loadIceServers, prefetchIceServers, getTurnLoadError, getTurnSource, getTurnWarning, isTurnConfigured, hasTurnRelay } from "@/lib/call/ice-servers"
import { encodeCallEvent, type CallOutcome } from "@/lib/call/call-event"
import { GROUP_CALL_CALLEE } from "@/lib/group-avatar"

export type CallType = "audio" | "video"

type CallSession = {
  id: string
  conversationId: string
  callerName: string
  calleeName: string
  callType: CallType
  status: string
  isGroup?: boolean
}

type StartCallOpts = {
  conversationId: string
  peerName: string
  callType?: CallType
  /** Ring all group members instead of a single peer */
  isGroup?: boolean
}

type CallContextValue = {
  startCall: (opts: StartCallOpts) => Promise<void>
  incoming: CallSession | null
  active: CallSession | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  callError: string | null
  muted: boolean
  speakerOn: boolean
  toggleMute: () => void
  toggleSpeaker: () => Promise<void>
  answerCall: () => Promise<void>
  declineCall: () => Promise<void>
  endCall: () => Promise<void>
}

const CallContext = createContext<CallContextValue | null>(null)
const RING_TIMEOUT_MS = 45_000
const CONNECTING_TIMEOUT_MS = 35_000
const ICE_POLL_MS = 900

export function useCallOptional() {
  return useContext(CallContext)
}

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error("useCall must be used within CallProvider")
  return ctx
}

async function acquireMedia(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  })
  for (const track of stream.getAudioTracks()) {
    track.enabled = true
  }
  return stream
}

export function CallProvider({ userName, children }: { userName: string; children: ReactNode }) {
  const [incoming, setIncoming] = useState<CallSession | null>(null)
  const [active, setActive] = useState<CallSession | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [callError, setCallError] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [speakerOn, setSpeakerOn] = useState(true)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const sessionRef = useRef<CallSession | null>(null)
  const isCallerRef = useRef(false)
  const localStreamRef = useRef<MediaStream | null>(null)
  const activeRef = useRef<CallSession | null>(null)
  const incomingRef = useRef<CallSession | null>(null)
  const iceBatchRef = useRef<RTCIceCandidateInit[]>([])
  const iceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectedAtRef = useRef<number | null>(null)
  const postedEventRef = useRef(false)
  const iceRestartAttemptedRef = useRef(false)
  /** ICE that arrived before remote description / PC was ready */
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())

  useEffect(() => { activeRef.current = active }, [active])
  useEffect(() => { incomingRef.current = incoming }, [incoming])

  useEffect(() => {
    if (userName) void prefetchIceServers()
  }, [userName])

  const clearRingTimer = useCallback(() => {
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current)
    ringTimerRef.current = null
  }, [])

  const clearConnectingTimer = useCallback(() => {
    if (connectingTimerRef.current) clearTimeout(connectingTimerRef.current)
    connectingTimerRef.current = null
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

  /** Send one ICE candidate immediately (trickle) — avoids batch races across NATs. */
  const sendIceCandidate = useCallback((sessionId: string, candidate: RTCIceCandidateInit) => {
    if (!userName) return
    const supabase = createClient()
    void supabase.from("call_signals").insert({
      session_id: sessionId,
      sender_name: userName,
      signal_type: "ice",
      payload: candidate,
    })
  }, [userName])

  const resetPc = useCallback(() => {
    if (iceTimerRef.current) clearTimeout(iceTimerRef.current)
    iceTimerRef.current = null
    iceBatchRef.current = []
    iceRestartAttemptedRef.current = false
    pcRef.current?.close()
    pcRef.current = null
  }, [])

  const cleanup = useCallback(() => {
    clearRingTimer()
    clearConnectingTimer()
    resetPc()
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    sessionRef.current = null
    isCallerRef.current = false
    connectedAtRef.current = null
    postedEventRef.current = false
    pendingIceRef.current.clear()
    setMuted(false)
    setSpeakerOn(true)
    setActive(null)
    setIncoming(null)
    setCallError(null)
  }, [clearRingTimer, clearConnectingTimer, resetPc])

  const markMediaConnected = useCallback(() => {
    clearConnectingTimer()
    if (connectedAtRef.current) return
    connectedAtRef.current = Date.now()
    const session = sessionRef.current ?? activeRef.current
    if (!session) return
    const live = { ...session, status: "active" }
    sessionRef.current = live
    setActive(live)
  }, [clearConnectingTimer])

  const failConnection = useCallback(async (message = "Bağlantı kurulamadı") => {
    const src = getTurnSource()
    const warn = getTurnWarning()
    const detail = warn
      ? `${message} (TURN: ${src}). ${warn}`
      : `${message} (TURN: ${src})`
    const session = sessionRef.current ?? activeRef.current
    if (!session || session.id.startsWith("pending-")) {
      cleanup()
      setCallError(detail)
      return
    }
    const hadMedia = connectedAtRef.current != null
    const supabase = createClient()
    await supabase.from("call_sessions").update({
      status: "ended",
      ended_at: new Date().toISOString(),
    }).eq("id", session.id)
    if (userName) {
      await supabase.from("call_signals").insert({
        session_id: session.id,
        sender_name: userName,
        signal_type: "hangup",
        payload: {},
      })
    }
    await postCallEventRef.current?.(session, hadMedia ? "ended" : "missed")
    cleanup()
    setCallError(detail)
  }, [cleanup, userName])

  // Wired after postCallEvent is defined
  const postCallEventRef = useRef<((
    session: CallSession,
    outcome: CallOutcome,
    durationSec?: number,
  ) => Promise<void>) | null>(null)

  const armConnectingTimeout = useCallback((sessionId: string) => {
    clearConnectingTimer()
    connectingTimerRef.current = setTimeout(() => {
      const current = sessionRef.current
      if (!current || current.id !== sessionId || connectedAtRef.current) return
      void failConnection("Bağlantı zaman aşımı. Tekrar deneyin.")
    }, CONNECTING_TIMEOUT_MS)
  }, [clearConnectingTimer, failConnection])

  const queueOrAddIce = useCallback(async (sessionId: string, candidate: RTCIceCandidateInit | null | undefined) => {
    if (!candidate || typeof candidate !== "object") return
    if (candidate.candidate === "") return
    const pc = pcRef.current
    const session = sessionRef.current ?? activeRef.current ?? incomingRef.current
    if (pc && pc.remoteDescription && session && session.id === sessionId) {
      try {
        await pc.addIceCandidate(candidate)
      } catch { /* ignore stale */ }
      return
    }
    const q = pendingIceRef.current.get(sessionId) ?? []
    q.push(candidate)
    pendingIceRef.current.set(sessionId, q)
  }, [])

  const flushPendingIce = useCallback(async (sessionId: string, pc: RTCPeerConnection) => {
    const q = pendingIceRef.current.get(sessionId) ?? []
    pendingIceRef.current.delete(sessionId)
    for (const candidate of q) {
      try {
        await pc.addIceCandidate(candidate)
      } catch { /* ignore */ }
    }
  }, [])

  const loadStoredIce = useCallback(async (sessionId: string, pc: RTCPeerConnection) => {
    const supabase = createClient()
    const { data } = await supabase
      .from("call_signals")
      .select("payload")
      .eq("session_id", sessionId)
      .eq("signal_type", "ice")
      .order("created_at", { ascending: true })
    for (const row of data ?? []) {
      try {
        await pc.addIceCandidate(row.payload as RTCIceCandidateInit)
      } catch { /* ignore */ }
    }
    await flushPendingIce(sessionId, pc)
  }, [flushPendingIce])

  const toggleMute = useCallback(() => {
    const next = !muted
    setMuted(next)
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next
    })
  }, [muted])

  const toggleSpeaker = useCallback(async () => {
    setSpeakerOn((prev) => !prev)
  }, [])

  const postCallEvent = useCallback(async (
    session: CallSession,
    outcome: CallOutcome,
    durationSec?: number,
  ) => {
    if (postedEventRef.current || !session.conversationId || !userName) return
    postedEventRef.current = true
    const payload = {
      conversationId: session.conversationId,
      text: encodeCallEvent({ v: 1, outcome, callType: session.callType, durationSec }),
      messageType: "call",
    }
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) return
      console.warn("[call] post via API failed, falling back", await res.text())
    } catch (e) {
      console.warn("[call] post via API error", e)
    }
    const supabase = createClient()
    await supabase.from("chat_messages").insert({
      conversation_id: session.conversationId,
      sender_name: userName,
      sender_initials: userName.slice(0, 2).toUpperCase(),
      text: payload.text,
      message_type: "call",
      is_system: false,
    })
  }, [userName])

  useEffect(() => {
    postCallEventRef.current = postCallEvent
  }, [postCallEvent])

  async function buildPc(sessionId: string, stream: MediaStream) {
    resetPc()

    const iceServers = await loadIceServers()
    const useRelay = hasTurnRelay(iceServers)
    console.info("[call] ICE source", getTurnSource(), "relayPreferred", useRelay, "servers", iceServers.length)
    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 8,
      // Force TURN when available — host/srflx often fail on 4G↔4G / CGNAT
      iceTransportPolicy: useRelay ? "relay" : "all",
    })
    pc.ontrack = (e) => {
      e.track.enabled = true
      const streamFromEvent = e.streams[0] ?? new MediaStream([e.track])
      for (const track of streamFromEvent.getAudioTracks()) {
        track.enabled = true
      }
      setRemoteStream(streamFromEvent)
      if (e.track.kind === "audio") markMediaConnected()
    }
    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        flushIce(sessionId)
        return
      }
      sendIceCandidate(sessionId, e.candidate.toJSON())
    }
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      console.info("[call] connectionState", state)
      if (state === "connected") {
        iceRestartAttemptedRef.current = false
        markMediaConnected()
        return
      }
      if (state === "failed") {
        console.warn("[call] connection failed")
        if (!iceRestartAttemptedRef.current && useRelay) {
          iceRestartAttemptedRef.current = true
          try {
            pc.restartIce()
            return
          } catch (err) {
            console.warn("[call] restartIce failed", err)
          }
        }
        void failConnection("Bağlantı koptu. Tekrar deneyin.")
      }
    }
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      console.info("[call] iceConnectionState", state)
      if (state === "connected" || state === "completed") {
        markMediaConnected()
      } else if (state === "failed") {
        void failConnection("ICE başarısız. TURN ayarlarını kontrol edin.")
      }
    }

    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length > 0) {
      for (const track of audioTracks) {
        track.enabled = true
        pc.addTrack(track, stream)
      }
    } else {
      pc.addTransceiver("audio", { direction: "recvonly" })
    }

    localStreamRef.current = stream
    setLocalStream(stream)
    pcRef.current = pc
    return pc
  }

  // While "connecting", re-pull ICE from DB in case Realtime missed candidates
  useEffect(() => {
    if (active?.status !== "connecting" || !active.id) return
    const sessionId = active.id
    const tick = () => {
      const pc = pcRef.current
      if (!pc?.remoteDescription || connectedAtRef.current) return
      void loadStoredIce(sessionId, pc)
    }
    tick()
    const t = setInterval(tick, ICE_POLL_MS)
    return () => clearInterval(t)
  }, [active?.status, active?.id, loadStoredIce])

  async function startCall({ conversationId, peerName, isGroup }: StartCallOpts) {
    const callType: CallType = "audio"
    if (!userName) {
      setCallError("Profil yükleniyor, tekrar deneyin.")
      return
    }
    if (activeRef.current || incomingRef.current) return

    setCallError(null)
    resetPc()

    if (!isTurnConfigured()) {
      await loadIceServers()
      if (!isTurnConfigured()) {
        // Still leave a missed-call mark in the thread when the attempt fails
        postedEventRef.current = false
        await postCallEvent(
          {
            id: "failed",
            conversationId,
            callerName: userName,
            calleeName: isGroup ? GROUP_CALL_CALLEE : peerName,
            callType,
            status: "missed",
            isGroup,
          },
          "missed",
        )
        setCallError(
          getTurnLoadError() ??
            "TURN sunucusu hazır değil. Sayfayı yenileyip tekrar deneyin.",
        )
        return
      }
    }

    let stream: MediaStream
    try {
      stream = await acquireMedia()
    } catch {
      postedEventRef.current = false
      await postCallEvent(
        {
          id: "failed",
          conversationId,
          callerName: userName,
          calleeName: isGroup ? GROUP_CALL_CALLEE : peerName,
          callType,
          status: "missed",
          isGroup,
        },
        "missed",
      )
      setCallError("Mikrofon izni gerekli. Tarayıcı ayarlarından izin verin.")
      return
    }

    const calleeName = isGroup ? GROUP_CALL_CALLEE : peerName
    const placeholder: CallSession = {
      id: `pending-${Date.now()}`,
      conversationId,
      callerName: userName,
      calleeName,
      callType,
      status: "ringing",
      isGroup: !!isGroup,
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
        callee_name: calleeName,
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
        calleeName,
        callType,
        status: "ringing",
        isGroup: !!isGroup,
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
      const current = sessionRef.current
      if (current?.conversationId) {
        await postCallEvent(current, "missed")
      }
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
    // DB "active" stops other group members from ringing; local UI stays "connecting" until media up
    await supabase.from("call_sessions").update({ status: "active" }).eq("id", session.id)
    const live = { ...session, status: "connecting", callType: "audio" as CallType }
    sessionRef.current = live
    isCallerRef.current = false
    connectedAtRef.current = null
    postedEventRef.current = false
    setActive(live)
    setIncoming(null)
    clearRingTimer()
    armConnectingTimeout(session.id)

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
        // Apply ICE that arrived while we were ringing / from DB
        await loadStoredIce(session.id, pc)
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
        flushIce(session.id)
      } else {
        throw new Error("Teklif bulunamadı")
      }
    } catch (err) {
      console.error("[call] answer failed:", err)
      stream.getTracks().forEach((t) => t.stop())
      await failConnection("Bağlantı kurulamadı")
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

    const connected = connectedAtRef.current != null
    const outcome: CallOutcome = connected ? "ended" : "missed"
    const durationSec = connected && connectedAtRef.current
      ? Math.round((Date.now() - connectedAtRef.current) / 1000)
      : undefined

    // Pending placeholder — still record missed call in chat
    if (session.id.startsWith("pending-")) {
      await postCallEvent(session, "missed")
      cleanup()
      return
    }

    const supabase = createClient()
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
        void (async () => {
          const row = payload.new as {
            id: string
            conversation_id: string
            caller_name: string
            callee_name: string
            call_type: CallType
            status: string
          }
          if (row.status !== "ringing") return
          if (row.caller_name === userName) return
          if (activeRef.current || incomingRef.current) return

          const isDirect = row.callee_name === userName
          const isGroup = row.callee_name === GROUP_CALL_CALLEE
          if (!isDirect && !isGroup) return

          if (isGroup) {
            const { data: mem } = await supabase
              .from("conversation_members")
              .select("conversation_id")
              .eq("conversation_id", row.conversation_id)
              .eq("member_name", userName)
              .maybeSingle()
            if (!mem) return
          }

          setIncoming({
            id: row.id,
            conversationId: row.conversation_id,
            callerName: row.caller_name,
            calleeName: row.callee_name,
            callType: row.call_type,
            status: row.status,
            isGroup,
          })
        })()
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "call_sessions" }, (payload) => {
        const row = payload.new as { id: string; status: string }
        const incoming = incomingRef.current
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

        // Another member answered a group call — stop ringing for others
        if (incoming && incoming.id === sig.session_id && sig.signal_type === "answer" && incoming.isGroup) {
          setIncoming(null)
          return
        }

        // Buffer ICE for ringing incoming call (PC not ready yet)
        if (sig.signal_type === "ice" && incoming && incoming.id === sig.session_id) {
          await queueOrAddIce(sig.session_id, sig.payload as RTCIceCandidateInit)
          return
        }

        const session = sessionRef.current ?? activeRef.current
        if (!session || session.id !== sig.session_id) return
        const pc = pcRef.current

        if (sig.signal_type === "answer" && isCallerRef.current) {
          clearRingTimer()
          const live = { ...session, status: "connecting" }
          sessionRef.current = live
          setActive(live)
          armConnectingTimeout(session.id)
          try {
            const remote = sig.payload as RTCSessionDescriptionInit
            if (pc && remote?.type === "answer" && remote.sdp && pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription({ type: "answer", sdp: remote.sdp })
              await loadStoredIce(session.id, pc)
            }
          } catch (err) {
            console.error("[call] setRemoteDescription failed:", err)
            void failConnection("Bağlantı kurulamadı")
          }
        } else if (sig.signal_type === "ice") {
          await queueOrAddIce(sig.session_id, sig.payload as RTCIceCandidateInit)
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
  }, [userName, cleanup, clearRingTimer, queueOrAddIce, loadStoredIce, armConnectingTimeout, failConnection])

  return (
    <CallContext.Provider value={{
      startCall, incoming, active, localStream, remoteStream, callError,
      muted, speakerOn, toggleMute, toggleSpeaker,
      answerCall, declineCall, endCall,
    }}>
      {children}
      <CallOverlay
        userName={userName}
        incoming={incoming}
        active={active}
        localStream={localStream}
        remoteStream={remoteStream}
        error={callError}
        muted={muted}
        speakerOn={speakerOn}
        onToggleMute={toggleMute}
        onToggleSpeaker={() => { void toggleSpeaker() }}
        onAnswer={answerCall}
        onDecline={declineCall}
        onEnd={endCall}
        onDismissError={() => { setCallError(null); cleanup() }}
      />
    </CallContext.Provider>
  )
}
