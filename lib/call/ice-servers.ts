const DEFAULT_STUN: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

function readTurnConfig() {
  if (typeof window !== "undefined" && window.__YS_CONFIG__) {
    return {
      urls: window.__YS_CONFIG__.turnUrls ?? "",
      username: window.__YS_CONFIG__.turnUsername ?? "",
      credential: window.__YS_CONFIG__.turnCredential ?? "",
    }
  }
  return {
    urls: process.env.TURN_URLS ?? process.env.NEXT_PUBLIC_TURN_URLS ?? "",
    username: process.env.TURN_USERNAME ?? process.env.NEXT_PUBLIC_TURN_USERNAME ?? "",
    credential: process.env.TURN_CREDENTIAL ?? process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? "",
  }
}

/** ICE servers for WebRTC — STUN always, TURN when env vars are set. */
export function getIceServers(): RTCIceServer[] {
  const { urls, username, credential } = readTurnConfig()
  const turnUrls = urls.split(",").map((u) => u.trim()).filter(Boolean)
  if (turnUrls.length === 0) return DEFAULT_STUN

  const turn: RTCIceServer = { urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls }
  if (username) turn.username = username
  if (credential) turn.credential = credential

  return [...DEFAULT_STUN, turn]
}

export function isTurnConfigured(): boolean {
  const { urls } = readTurnConfig()
  return urls.trim().length > 0
}
