const DEFAULT_STUN: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

let cached: RTCIceServer[] | null = null
let cacheUntil = 0

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

function iceFromStaticConfig(): RTCIceServer[] | null {
  const { urls, username, credential } = readTurnConfig()
  const turnUrls = urls.split(",").map((u) => u.trim()).filter(Boolean)
  if (turnUrls.length === 0) return null

  const turn: RTCIceServer = { urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls }
  if (username) turn.username = username
  if (credential) turn.credential = credential
  return [...DEFAULT_STUN, turn]
}

/** ICE servers for WebRTC — static env, or fetched from /api/turn/ice-servers (Metered). */
export function getIceServers(): RTCIceServer[] {
  return iceFromStaticConfig() ?? cached ?? DEFAULT_STUN
}

export function isTurnConfigured(): boolean {
  return iceFromStaticConfig() !== null || cached !== null
}

/** Load ICE servers before starting a call (Metered API or static TURN env). */
export async function loadIceServers(): Promise<RTCIceServer[]> {
  const staticIce = iceFromStaticConfig()
  if (staticIce) return staticIce

  if (cached && Date.now() < cacheUntil) return cached

  try {
    const res = await fetch("/api/turn/ice-servers", { credentials: "include" })
    if (!res.ok) return DEFAULT_STUN
    const servers = (await res.json()) as RTCIceServer[]
    if (!Array.isArray(servers) || servers.length === 0) return DEFAULT_STUN
    cached = servers
    cacheUntil = Date.now() + 12 * 60 * 60 * 1000
    return servers
  } catch {
    return DEFAULT_STUN
  }
}
