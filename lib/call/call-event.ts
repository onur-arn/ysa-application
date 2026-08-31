export type CallType = "audio" | "video"
export type CallOutcome = "missed" | "declined" | "ended"

export type CallEventPayload = {
  v: 1
  outcome: CallOutcome
  callType: CallType
  durationSec?: number
}

export function encodeCallEvent(p: CallEventPayload): string {
  return JSON.stringify(p)
}

export function parseCallEvent(text: string | undefined | null): CallEventPayload | null {
  if (!text) return null
  try {
    const p = JSON.parse(text) as CallEventPayload
    if (p?.v === 1 && p.outcome && p.callType) return p
  } catch { /* legacy plain text */ }
  if (/görüntülü|sesli|arama/i.test(text)) {
    return {
      v: 1,
      outcome: /cevapsız|missed|redded/i.test(text) ? "missed" : "ended",
      callType: /görüntülü|video/i.test(text) ? "video" : "audio",
    }
  }
  return null
}

export function formatCallDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, "0")}`
}

export function callEventLabel(p: CallEventPayload, isSelf: boolean): string {
  const kind = p.callType === "video" ? "görüntülü arama" : "sesli arama"
  if (p.outcome === "missed") {
    return isSelf ? `Cevapsız ${kind}` : `Cevapsız ${kind}`
  }
  if (p.outcome === "declined") {
    return isSelf ? "Arama reddedildi" : "Reddedilen arama"
  }
  const dur = p.durationSec != null ? ` · ${formatCallDuration(p.durationSec)}` : ""
  return `${p.callType === "video" ? "Görüntülü arama" : "Sesli arama"}${dur}`
}

export function callEventPreview(p: CallEventPayload): string {
  if (p.outcome === "missed") return "📞 Cevapsız arama"
  if (p.outcome === "declined") return "📞 Reddedilen arama"
  if (p.durationSec != null) {
    return `📞 ${p.callType === "video" ? "Görüntülü" : "Sesli"} arama · ${formatCallDuration(p.durationSec)}`
  }
  return p.callType === "video" ? "📞 Görüntülü arama" : "📞 Sesli arama"
}
