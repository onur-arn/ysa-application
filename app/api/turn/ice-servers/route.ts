import { createHmac } from "crypto"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DEFAULT_STUN: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

/** Open Relay (Metered) free TURN via shared-secret / time-limited credentials — no dashboard keys required. */
function openRelayIceServers(): RTCIceServer[] {
  const secret = process.env.OPENRELAY_SECRET?.trim() || "openrelayprojectsecret"
  const ttl = 24 * 3600
  const username = String(Math.floor(Date.now() / 1000) + ttl)
  const credential = createHmac("sha1", secret).update(username).digest("base64")
  return [
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
  if (!host.includes(".")) {
    host = `${host}.metered.live`
  }
  return `https://${host}`
}

function iceFromUsernamePassword(username: string, password: string): RTCIceServer[] {
  return [
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
  const iceServers = (await iceRes.json()) as RTCIceServer[]
  return Array.isArray(iceServers) && iceServers.length > 0 ? iceServers : null
}

async function tryMetered(userId: string): Promise<RTCIceServer[] | null> {
  const base = meteredBaseUrl()
  const secretKey = process.env.METERED_SECRET_KEY?.trim()?.replace(/^["']|["']$/g, "")
  const credentialApiKey = process.env.METERED_API_KEY?.trim()?.replace(/^["']|["']$/g, "")
  if (!base || (!secretKey && !credentialApiKey)) return null

  if (credentialApiKey) {
    const ice = await fetchIceWithApiKey(base, credentialApiKey)
    if (ice) return ice
  }

  if (!secretKey) return null

  const asApiKey = await fetchIceWithApiKey(base, secretKey)
  if (asApiKey) return asApiKey

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
    console.error("[turn] Metered create:", createRes.status, (await createRes.text()).slice(0, 200))
    return null
  }

  const created = (await createRes.json()) as {
    apiKey?: string
    username?: string
    password?: string
  }

  if (created.username && created.password) {
    return iceFromUsernamePassword(created.username, created.password)
  }
  if (created.apiKey) {
    return fetchIceWithApiKey(base, created.apiKey)
  }
  return null
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

  try {
    const metered = await tryMetered(user.id)
    if (metered) {
      return NextResponse.json({ iceServers: metered, source: "metered", configured: true })
    }
  } catch (err) {
    console.error("[turn] Metered error:", err)
  }

  // Free Open Relay — works without Metered dashboard keys (fixes 403)
  const openRelay = openRelayIceServers()
  return NextResponse.json({
    iceServers: openRelay,
    source: "openrelay",
    configured: true,
  })
}
