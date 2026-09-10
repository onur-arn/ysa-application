const DEFAULT_STUN: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

let cached: RTCIceServer[] | null = null
let cacheUntil = 0
let lastSource: "static" | "metered" | "openrelay" | "stun-only" | "none" = "none"
let lastError: string | null = null
let lastWarning: string | null = null

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

/** Normalize Metered / misc ICE payloads (`url` → `urls`). */
export function normalizeIceServers(raw: unknown): RTCIceServer[] {
  if (!Array.isArray(raw)) return []
  const out: RTCIceServer[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const urls = row.urls ?? row.url
    if (!urls) continue
    const server: RTCIceServer = { urls: urls as string | string[] }
    if (typeof row.username === "string") server.username = row.username
    if (typeof row.credential === "string") server.credential = row.credential
    out.push(server)
  }
  return out
}

export function hasTurnRelay(servers: RTCIceServer[]): boolean {
  return servers.some((s) => {
    const list = Array.isArray(s.urls) ? s.urls : [s.urls]
    return list.some((u) => typeof u === "string" && (u.startsWith("turn:") || u.startsWith("turns:")))
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

export function getTurnWarning(): string | null {
  return lastWarning
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
  warning?: string
  configured?: boolean
}

/** Load ICE servers before starting a call (Metered API or static TURN env). */
export async function loadIceServers(): Promise<RTCIceServer[]> {
  const staticIce = iceFromStaticConfig()
  if (staticIce) {
    lastSource = "static"
    lastError = null
    lastWarning = null
    return staticIce
  }

  if (cached && Date.now() < cacheUntil && hasTurnRelay(cached)) {
    return cached
  }

  try {
    const res = await fetch("/api/turn/ice-servers", { credentials: "include" })
    const data = (await res.json().catch(() => ({}))) as IceApiResponse | RTCIceServer[]

    const rawServers = Array.isArray(data)
      ? data
      : Array.isArray(data.iceServers)
        ? data.iceServers
        : []
    const servers = normalizeIceServers(rawServers)
    const withStun = servers.length > 0 ? servers : DEFAULT_STUN

    lastSource = Array.isArray(data)
      ? (hasTurnRelay(withStun) ? "metered" : "stun-only")
      : (data.source ?? "stun-only")
    lastError = Array.isArray(data) ? null : (data.error ?? null)
    lastWarning = Array.isArray(data) ? null : (data.warning ?? null)

    if (hasTurnRelay(withStun)) {
      // Only treat Metered/static as durable cache — openrelay is flaky
      if (lastSource === "metered" || lastSource === "static") {
        cached = withStun
        cacheUntil = Date.now() + 12 * 60 * 60 * 1000
      } else {
        cached = withStun
        cacheUntil = Date.now() + 5 * 60 * 1000
      }
      if (lastSource === "openrelay") {
        lastWarning =
          lastWarning ??
          "TURN Open Relay (fallback). Configurez METERED_APP_NAME + METERED_SECRET_KEY sur Vercel."
      } else {
        lastError = null
      }
      return withStun
    }

    cached = null
    cacheUntil = 0
    if (!lastError) {
      lastError = "TURN sunucusu bulunamadı. Sayfayı yenileyip tekrar deneyin."
    }
    return DEFAULT_STUN
  } catch {
    lastSource = "stun-only"
    lastError = "TURN servisine ulaşılamadı"
    lastWarning = null
    return DEFAULT_STUN
  }
}
