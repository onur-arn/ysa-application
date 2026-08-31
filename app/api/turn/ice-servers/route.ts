import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DEFAULT_STUN: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

const METERED_TURN_URLS = [
  "stun:stun.relay.metered.ca:80",
  "turn:global.relay.metered.ca:80",
  "turn:global.relay.metered.ca:80?transport=tcp",
  "turn:global.relay.metered.ca:443",
  "turns:global.relay.metered.ca:443?transport=tcp",
]

function iceFromEnv(): RTCIceServer[] | null {
  const urls = (process.env.TURN_URLS ?? "").split(",").map((u) => u.trim()).filter(Boolean)
  if (urls.length === 0) return null
  const username = process.env.TURN_USERNAME?.trim()
  const credential = process.env.TURN_CREDENTIAL?.trim()
  if (!username || !credential) return null
  const turn: RTCIceServer = { urls: urls.length === 1 ? urls[0] : urls, username, credential }
  return [...DEFAULT_STUN, turn]
}

/** Accepts `myapp`, `myapp.metered.live`, or full URL. */
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
    { urls: METERED_TURN_URLS[0] },
    ...METERED_TURN_URLS.slice(1).map((urls) => ({
      urls,
      username,
      credential: password,
    })),
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

/** Create a short-lived TURN credential via Metered REST API (server-side only). */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", iceServers: null, source: "none" }, { status: 401 })
  }

  const fromEnv = iceFromEnv()
  if (fromEnv) {
    return NextResponse.json({ iceServers: fromEnv, source: "static" })
  }

  const base = meteredBaseUrl()
  const secretKey = process.env.METERED_SECRET_KEY?.trim()?.replace(/^["']|["']$/g, "")
  const credentialApiKey = process.env.METERED_API_KEY?.trim()?.replace(/^["']|["']$/g, "")

  if (!base || (!secretKey && !credentialApiKey)) {
    return NextResponse.json({
      error: "TURN yapılandırılmamış. Vercel'de METERED_APP_NAME + METERED_SECRET_KEY doldurun ve redeploy edin.",
      iceServers: DEFAULT_STUN,
      source: "stun-only",
      configured: false,
      hint: {
        hasAppName: !!(process.env.METERED_APP_NAME?.trim() || process.env.METERED_DOMAIN?.trim()),
        hasSecret: !!secretKey,
        hasApiKey: !!credentialApiKey,
      },
    })
  }

  try {
    // Path A: static credential API key (Dashboard → TURN Credentials → Show API Key)
    if (credentialApiKey) {
      const ice = await fetchIceWithApiKey(base, credentialApiKey)
      if (ice) {
        return NextResponse.json({ iceServers: ice, source: "metered", configured: true })
      }
    }

    // Path B: maybe METERED_SECRET_KEY is actually a credential apiKey
    if (secretKey) {
      const asApiKey = await fetchIceWithApiKey(base, secretKey)
      if (asApiKey) {
        return NextResponse.json({ iceServers: asApiKey, source: "metered", configured: true })
      }

      // Path C: create ephemeral credential with account Secret Key
      const createRes = await fetch(
        `${base}/api/v1/turn/credential?secretKey=${encodeURIComponent(secretKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expiryInSeconds: 86_400,
            label: `ys-${user.id.slice(0, 8)}`,
          }),
          cache: "no-store",
        },
      )

      if (!createRes.ok) {
        const detail = await createRes.text()
        console.error("[turn] Metered create credential:", createRes.status, detail.slice(0, 300))
        return NextResponse.json({
          error:
            createRes.status === 403
              ? "Metered 403: Secret Key veya uygulama adı yanlış. Dashboard → Developers: Domain (örn. app.metered.live) ve Secret Key'i Vercel'e kopyalayıp redeploy edin. Alternatif: TURN Credential API Key → METERED_API_KEY."
              : `Metered credential hatası (${createRes.status}). METERED değerlerini kontrol edin.`,
          iceServers: DEFAULT_STUN,
          source: "stun-only",
          configured: true,
          meteredStatus: createRes.status,
        }, { status: 502 })
      }

      const created = (await createRes.json()) as {
        apiKey?: string
        username?: string
        password?: string
      }

      if (created.username && created.password) {
        return NextResponse.json({
          iceServers: iceFromUsernamePassword(created.username, created.password),
          source: "metered",
          configured: true,
        })
      }

      if (created.apiKey) {
        const ice = await fetchIceWithApiKey(base, created.apiKey)
        if (ice) {
          return NextResponse.json({ iceServers: ice, source: "metered", configured: true })
        }
      }

      return NextResponse.json({
        error: "Metered yanıtı eksik (username/apiKey yok)",
        iceServers: DEFAULT_STUN,
        source: "stun-only",
      }, { status: 502 })
    }

    return NextResponse.json({
      error: "Metered API Key geçersiz",
      iceServers: DEFAULT_STUN,
      source: "stun-only",
    }, { status: 502 })
  } catch (err) {
    console.error("[turn] Metered error:", err)
    return NextResponse.json({
      error: "TURN servisine ulaşılamadı",
      iceServers: DEFAULT_STUN,
      source: "stun-only",
    }, { status: 502 })
  }
}
