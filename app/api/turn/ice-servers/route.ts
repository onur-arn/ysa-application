import { createHmac } from "crypto"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DEFAULT_STUN: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

function normalizeIceServers(raw: unknown): RTCIceServer[] {
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

function hasTurnRelay(servers: RTCIceServer[]): boolean {
  return servers.some((s) => {
    const list = Array.isArray(s.urls) ? s.urls : [s.urls]
    return list.some((u) => typeof u === "string" && (u.startsWith("turn:") || u.startsWith("turns:")))
  })
}

/** Open Relay free TURN — unreliable fallback only when Metered is missing. */
function openRelayIceServers(): RTCIceServer[] {
  const secret = process.env.OPENRELAY_SECRET?.trim() || "openrelayprojectsecret"
  const ttl = 24 * 3600
  const username = String(Math.floor(Date.now() / 1000) + ttl)
  const credential = createHmac("sha1", secret).update(username).digest("base64")
  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
    { urls: "turn:staticauth.openrelay.metered.ca:80", username, credential },
    { urls: "turn:staticauth.openrelay.metered.ca:80?transport=tcp", username, credential },
    { urls: "turn:staticauth.openrelay.metered.ca:443", username, credential },
    { urls: "turns:staticauth.openrelay.metered.ca:443?transport=tcp", username, credential },
  ]
}

function iceFromEnv(): RTCIceServer[] | null {
  const urls = (process.env.TURN_URLS ?? "").split(",").map((u) => u.trim()).filter(Boolean)
  if (urls.length === 0) return null
  const username = process.env.TURN_USERNAME?.trim()
  const credential = process.env.TURN_CREDENTIAL?.trim()
  if (!username || !credential) return null
  const turn: RTCIceServer = { urls: urls.length === 1 ? urls[0] : urls, username, credential }
  return [...DEFAULT_STUN, turn]
}

function meteredBaseUrl(): string | null {
  const domain = process.env.METERED_DOMAIN?.trim()
  const app = process.env.METERED_APP_NAME?.trim()
  const raw = domain || app
  if (!raw) return null

  let host = raw
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .replace(/^["']|["']$/g, "")
  if (!host) return null
  if (!host.includes(".")) {
    host = `${host}.metered.live`
  }
  return `https://${host}`
}

function iceFromUsernamePassword(username: string, password: string): RTCIceServer[] {
  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: [
        "turn:global.relay.metered.ca:80",
        "turn:global.relay.metered.ca:80?transport=tcp",
        "turn:global.relay.metered.ca:443",
        "turns:global.relay.metered.ca:443?transport=tcp",
      ],
      username,
      credential: password,
    },
  ]
}

async function fetchIceWithApiKey(base: string, apiKey: string): Promise<RTCIceServer[] | null> {
  const iceRes = await fetch(
    `${base}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`,
    { cache: "no-store" },
  )
  if (!iceRes.ok) {
    console.error("[turn] Metered get credentials:", iceRes.status, await iceRes.text())
    return null
  }
  const raw = await iceRes.json()
  const iceServers = normalizeIceServers(raw)
  return hasTurnRelay(iceServers) ? iceServers : null
}

async function tryMetered(userId: string): Promise<{ servers: RTCIceServer[] | null; detail: string }> {
  const base = meteredBaseUrl()
  const secretKey = process.env.METERED_SECRET_KEY?.trim()?.replace(/^["']|["']$/g, "")
  const credentialApiKey = process.env.METERED_API_KEY?.trim()?.replace(/^["']|["']$/g, "")
  if (!base) {
    return { servers: null, detail: "METERED_APP_NAME (ou METERED_DOMAIN) manquant / vide" }
  }
  if (!secretKey && !credentialApiKey) {
    return { servers: null, detail: "METERED_SECRET_KEY / METERED_API_KEY manquant / vide" }
  }

  if (credentialApiKey) {
    const ice = await fetchIceWithApiKey(base, credentialApiKey)
    if (ice) return { servers: ice, detail: "apiKey" }
  }

  if (!secretKey) {
    return { servers: null, detail: "METERED_SECRET_KEY manquant après échec API key" }
  }

  const asApiKey = await fetchIceWithApiKey(base, secretKey)
  if (asApiKey) return { servers: asApiKey, detail: "secretAsApiKey" }

  const createRes = await fetch(
    `${base}/api/v1/turn/credential?secretKey=${encodeURIComponent(secretKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expiryInSeconds: 86_400,
        label: `ys-${userId.slice(0, 8)}`,
      }),
      cache: "no-store",
    },
  )

  if (!createRes.ok) {
    const body = (await createRes.text()).slice(0, 200)
    console.error("[turn] Metered create:", createRes.status, body)
    return { servers: null, detail: `Metered create ${createRes.status}: ${body}` }
  }

  const created = (await createRes.json()) as {
    apiKey?: string
    username?: string
    password?: string
  }

  if (created.username && created.password) {
    return { servers: iceFromUsernamePassword(created.username, created.password), detail: "createdUserPass" }
  }
  if (created.apiKey) {
    const ice = await fetchIceWithApiKey(base, created.apiKey)
    return { servers: ice, detail: ice ? "createdApiKey" : "createdApiKeyFetchFailed" }
  }
  return { servers: null, detail: "Metered create sans username/password/apiKey" }
}

/** ICE servers for WebRTC calls — static TURN, Metered, or Open Relay free fallback. */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", iceServers: null, source: "none" }, { status: 401 })
  }

  const fromEnv = iceFromEnv()
  if (fromEnv) {
    return NextResponse.json({ iceServers: fromEnv, source: "static", configured: true })
  }

  let meteredDetail = ""
  try {
    const metered = await tryMetered(user.id)
    meteredDetail = metered.detail
    if (metered.servers && hasTurnRelay(metered.servers)) {
      return NextResponse.json({
        iceServers: metered.servers,
        source: "metered",
        configured: true,
        via: metered.detail,
      })
    }
  } catch (err) {
    meteredDetail = err instanceof Error ? err.message : String(err)
    console.error("[turn] Metered error:", err)
  }

  const openRelay = openRelayIceServers()
  return NextResponse.json({
    iceServers: openRelay,
    source: "openrelay",
    configured: true,
    warning:
      `Metered indisponible (${meteredDetail || "inconnu"}). Fallback Open Relay — appels 4G souvent bloqués. ` +
      "Renseignez METERED_APP_NAME + METERED_SECRET_KEY (valeurs non vides) sur Vercel Production.",
  })
}
