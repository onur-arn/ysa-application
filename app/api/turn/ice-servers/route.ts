import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DEFAULT_STUN: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

function iceFromEnv(): RTCIceServer[] | null {
  const urls = (process.env.TURN_URLS ?? "").split(",").map((u) => u.trim()).filter(Boolean)
  if (urls.length === 0) return null
  const turn: RTCIceServer = { urls: urls.length === 1 ? urls[0] : urls }
  const username = process.env.TURN_USERNAME?.trim()
  const credential = process.env.TURN_CREDENTIAL?.trim()
  // Incomplete static TURN (URLs without auth) → ignore, fall through to Metered
  if (!username || !credential) return null
  turn.username = username
  turn.credential = credential
  return [...DEFAULT_STUN, turn]
}

/** Accepts `myapp`, `myapp.metered.live`, or full URL. */
function meteredBaseUrl(): string | null {
  const domain = process.env.METERED_DOMAIN?.trim()
  const app = process.env.METERED_APP_NAME?.trim()
  const raw = domain || app
  if (!raw) return null

  let host = raw.replace(/^https?:\/\//i, "").replace(/\/$/, "")
  if (!host.includes(".")) {
    host = `${host}.metered.live`
  }
  return `https://${host}`
}

function hasMeteredConfig(): boolean {
  return !!(meteredBaseUrl() && process.env.METERED_SECRET_KEY?.trim())
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
  const secretKey = process.env.METERED_SECRET_KEY?.trim()
  if (!base || !secretKey) {
    return NextResponse.json({
      error: "TURN yapılandırılmamış. Vercel'de METERED_APP_NAME + METERED_SECRET_KEY değerlerini doldurun (boş olmamalı) ve yeniden deploy edin.",
      iceServers: DEFAULT_STUN,
      source: "stun-only",
      configured: false,
      hint: {
        hasAppName: !!(process.env.METERED_APP_NAME?.trim() || process.env.METERED_DOMAIN?.trim()),
        hasSecret: !!process.env.METERED_SECRET_KEY?.trim(),
        hasStaticTurn: !!(process.env.TURN_URLS?.trim()),
      },
    })
  }

  try {
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
      console.error("[turn] Metered create credential:", createRes.status, detail)
      return NextResponse.json({
        error: `Metered credential hatası (${createRes.status}). METERED_APP_NAME / METERED_SECRET_KEY değerlerini kontrol edin.`,
        iceServers: DEFAULT_STUN,
        source: "stun-only",
        configured: hasMeteredConfig(),
      }, { status: 502 })
    }

    const created = (await createRes.json()) as { apiKey?: string }
    if (!created.apiKey) {
      return NextResponse.json({
        error: "Metered yanıtında apiKey yok",
        iceServers: DEFAULT_STUN,
        source: "stun-only",
      }, { status: 502 })
    }

    const iceRes = await fetch(
      `${base}/api/v1/turn/credentials?apiKey=${encodeURIComponent(created.apiKey)}`,
      { cache: "no-store" },
    )

    if (!iceRes.ok) {
      const detail = await iceRes.text()
      console.error("[turn] Metered get credentials:", iceRes.status, detail)
      return NextResponse.json({
        error: "Metered ICE sunucuları alınamadı",
        iceServers: DEFAULT_STUN,
        source: "stun-only",
      }, { status: 502 })
    }

    const iceServers = (await iceRes.json()) as RTCIceServer[]
    if (!Array.isArray(iceServers) || iceServers.length === 0) {
      return NextResponse.json({
        error: "Metered boş ICE listesi döndü",
        iceServers: DEFAULT_STUN,
        source: "stun-only",
      }, { status: 502 })
    }

    return NextResponse.json({ iceServers, source: "metered", configured: true })
  } catch (err) {
    console.error("[turn] Metered error:", err)
    return NextResponse.json({
      error: "TURN servisine ulaşılamadı",
      iceServers: DEFAULT_STUN,
      source: "stun-only",
    }, { status: 502 })
  }
}
