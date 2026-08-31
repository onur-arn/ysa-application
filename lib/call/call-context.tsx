"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { subscribeChannel } from "@/lib/supabase/realtime"
import { CallOverlay } from "@/components/messaging/call-overlay"

import { loadIceServers } from "@/lib/call/ice-servers"

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
  startCall: (opts: { conversationId: string; peerName: string; callType: CallType }) => Promise<void>
  incoming: CallSession | null
  active: CallSession | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  answerCall: () => Promise<void>
  declineCall: () => Promise<void>
  endCall: () => Promise<void>
}

const CallContext = createContext<CallContextValue | null>(null)

export function useCallOptional() {
  return useContext(CallContext)
}

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error("useCall must be used within CallProvider")
  return ctx
}

export function CallProvider({ userName, children }: { userName: string; children: ReactNode }) {
  const [incoming, setIncoming] = useState<CallSession | null>(null)
  const [active, setActive] = useState<CallSession | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const sessionRef = useRef<CallSession | null>(null)
  const isCallerRef = useRef(false)
  const localStreamRef = useRef<MediaStream | null>(null)
  const activeRef = useRef<CallSession | null>(null)
  const incomingRef = useRef<CallSession | null>(null)
  const iceBatchRef = useRef<RTCIceCandidateInit[]>([])
  const iceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { activeRef.current = active }, [active])
  useEffect(() => { incomingRef.current = incoming }, [incoming])

  const flushIce = useCallback((sessionId: string) => {
    const batch = iceBatchRef.current.splice(0)
    if (batch.length === 0) return
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

  const cleanup = useCallback(() => {
    if (iceTimerRef.current) clearTimeout(iceTimerRef.current)
    iceTimerRef.current = null
    iceBatchRef.current = []
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    setLocalStream(null)
    setRemoteStream(null)
    sessionRef.current = null
    isCallerRef.current = false
    setActive(null)
    setIncoming(null)
  }, [])

  async function ensurePc(sessionId: string, withVideo: boolean) {
    if (pcRef.current) return pcRef.current

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

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo })
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
    localStreamRef.current = stream
    setLocalStream(stream)
    pcRef.current = pc
    return pc
  }

  async function startCall({ conversationId, peerName, callType }: { conversationId: string; peerName: string; callType: CallType }) {
    if (!userName) return
    const supabase = createClient()

    const { data: session } = await supabase.from("call_sessions").insert({
      conversation_id: conversationId,
      caller_name: userName,
      callee_name: peerName,
      call_type: callType,
      status: "ringing",
    }).select().single()
    if (!session) return

    const s: CallSession = {
      id: session.id,
      conversationId,
      callerName: userName,
      calleeName: peerName,
      callType,
      status: "ringing",
    }
    sessionRef.current = s
    isCallerRef.current = true
    setActive(s)

    const pc = await ensurePc(session.id, callType === "video")
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await supabase.from("call_signals").insert({
      session_id: session.id,
      sender_name: userName,
      signal_type: "offer",
      payload: offer,
    })
  }

  async function answerCall() {
    const session = incomingRef.current
    if (!session || !userName) return
    const supabase = createClient()
    await supabase.from("call_sessions").update({ status: "active" }).eq("id", session.id)
    sessionRef.current = session
    isCallerRef.current = false
    setActive(session)
    setIncoming(null)

    const pc = await ensurePc(session.id, session.callType === "video")

    const { data: offerSig } = await supabase
      .from("call_signals")
      .select("payload")
      .eq("session_id", session.id)
      .eq("signal_type", "offer")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (offerSig?.payload) {
      await pc.setRemoteDescription(offerSig.payload as RTCSessionDescriptionInit)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await supabase.from("call_signals").insert({
        session_id: session.id,
        sender_name: userName,
        signal_type: "answer",
        payload: answer,
      })
    }
  }

  async function declineCall() {
    const session = incomingRef.current
    if (!session) return
    const supabase = createClient()
    await supabase.from("call_sessions").update({ status: "declined", ended_at: new Date().toISOString() }).eq("id", session.id)
    setIncoming(null)
  }

  async function endCall() {
    const session = sessionRef.current ?? activeRef.current ?? incomingRef.current
    if (!session) { cleanup(); return }
    const supabase = createClient()
    await supabase.from("call_sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", session.id)
    await supabase.from("call_signals").insert({
      session_id: session.id,
      sender_name: userName,
      signal_type: "hangup",
      payload: {},
    })
    if (session.conversationId) {
      void supabase.from("chat_messages").insert({
        conversation_id: session.conversationId,
        sender_name: userName,
        sender_initials: userName.slice(0, 2).toUpperCase(),
        text: `📞 ${session.callType === "video" ? "Görüntülü" : "Sesli"} arama`,
        message_type: "call",
        is_system: true,
      })
    }
    cleanup()
  }

  // Stable subscription — only depends on userName
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

    const signalsChannel = supabase
      .channel(`call-signals-${userName}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals" }, async (payload) => {
        const sig = payload.new as { session_id: string; sender_name: string; signal_type: string; payload: RTCSessionDescriptionInit | RTCIceCandidateInit }
        if (sig.sender_name === userName) return
        const session = sessionRef.current ?? activeRef.current
        if (!session || session.id !== sig.session_id) return
        const pc = pcRef.current
        if (!pc) return

        if (sig.signal_type === "answer" && isCallerRef.current) {
          await pc.setRemoteDescription(sig.payload as RTCSessionDescriptionInit)
        } else if (sig.signal_type === "ice") {
          try {
            await pc.addIceCandidate(sig.payload as RTCIceCandidateInit)
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
  }, [userName, cleanup])

  return (
    <CallContext.Provider value={{ startCall, incoming, active, localStream, remoteStream, answerCall, declineCall, endCall }}>
      {children}
      <CallOverlay
        userName={userName}
        incoming={incoming}
        active={active}
        localStream={localStream}
        remoteStream={remoteStream}
        onAnswer={answerCall}
        onDecline={declineCall}
        onEnd={endCall}
      />
    </CallContext.Provider>
  )
}
