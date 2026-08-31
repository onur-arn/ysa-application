const DEFAULT_STUN: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

let cached: RTCIceServer[] | null = null
let cacheUntil = 0
let lastSource: "static" | "metered" | "openrelay" | "stun-only" | "none" = "none"
let lastError: string | null = null

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
  if (turnUrls.length === 0 || !username || !credential) return null

  const turn: RTCIceServer = { urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls }
  turn.username = username
  turn.credential = credential
  return [...DEFAULT_STUN, turn]
}

function hasTurnRelay(servers: RTCIceServer[]): boolean {
  return servers.some((s) => {
    const list = Array.isArray(s.urls) ? s.urls : [s.urls]
    return list.some((u) => typeof u === "string" && u.startsWith("turn"))
  })
}

/** ICE servers for WebRTC — static env, or fetched from /api/turn/ice-servers (Metered). */
export function getIceServers(): RTCIceServer[] {
  return iceFromStaticConfig() ?? cached ?? DEFAULT_STUN
}

export function isTurnConfigured(): boolean {
  return iceFromStaticConfig() !== null || (cached !== null && hasTurnRelay(cached))
}

export function getTurnLoadError(): string | null {
  return lastError
}

export function getTurnSource() {
  return lastSource
}

/** Prefetch TURN credentials in the background (e.g. on app load). */
export function prefetchIceServers() {
  void loadIceServers()
}

type IceApiResponse = {
  iceServers?: RTCIceServer[]
  source?: "static" | "metered" | "openrelay" | "stun-only" | "none"
  error?: string
  configured?: boolean
}

/** Load ICE servers before starting a call (Metered API or static TURN env). */
export async function loadIceServers(): Promise<RTCIceServer[]> {
  const staticIce = iceFromStaticConfig()
  if (staticIce) {
    lastSource = "static"
    lastError = null
    return staticIce
  }

  if (cached && Date.now() < cacheUntil && hasTurnRelay(cached)) {
    return cached
  }

  try {
    const res = await fetch("/api/turn/ice-servers", { credentials: "include" })
    const data = (await res.json().catch(() => ({}))) as IceApiResponse | RTCIceServer[]

    // Backward-compat: old API returned a bare array
    const servers = Array.isArray(data)
      ? data
      : Array.isArray(data.iceServers)
        ? data.iceServers
        : DEFAULT_STUN

    lastSource = Array.isArray(data)
      ? (hasTurnRelay(servers) ? "metered" : "stun-only")
      : (data.source ?? "stun-only")
    lastError = Array.isArray(data) ? null : (data.error ?? null)

    if (hasTurnRelay(servers)) {
      cached = servers
      cacheUntil = Date.now() + 12 * 60 * 60 * 1000
      lastError = null
      return servers
    }

    // STUN-only — do not cache as "configured TURN"
    cached = null
    cacheUntil = 0
    if (!lastError) {
      lastError = "TURN sunucusu bulunamadı. Sayfayı yenileyip tekrar deneyin."
    }
    return DEFAULT_STUN
  } catch {
    lastSource = "stun-only"
    lastError = "TURN servisine ulaşılamadı"
    return DEFAULT_STUN
  }
}
