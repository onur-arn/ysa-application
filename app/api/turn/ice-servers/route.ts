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
  if (username) turn.username = username
  if (credential) turn.credential = credential
  return [...DEFAULT_STUN, turn]
}

function meteredBaseUrl(): string | null {
  const domain = process.env.METERED_DOMAIN?.trim()
  if (domain) {
    const host = domain.replace(/^https?:\/\//, "").replace(/\/$/, "")
    return `https://${host}`
  }
  const app = process.env.METERED_APP_NAME?.trim()
  if (app) return `https://${app}.metered.live`
  return null
}

/** Create a short-lived TURN credential via Metered REST API (server-side only). */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const fromEnv = iceFromEnv()
  if (fromEnv) return NextResponse.json(fromEnv)

  const base = meteredBaseUrl()
  const secretKey = process.env.METERED_SECRET_KEY?.trim()
  if (!base || !secretKey) {
    return NextResponse.json(DEFAULT_STUN)
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
      return NextResponse.json({ error: "Metered credential creation failed" }, { status: 502 })
    }

    const created = (await createRes.json()) as { apiKey?: string }
    if (!created.apiKey) {
      return NextResponse.json({ error: "Metered response missing apiKey" }, { status: 502 })
    }

    const iceRes = await fetch(
      `${base}/api/v1/turn/credentials?apiKey=${encodeURIComponent(created.apiKey)}`,
      { cache: "no-store" },
    )

    if (!iceRes.ok) {
      const detail = await iceRes.text()
      console.error("[turn] Metered get credentials:", iceRes.status, detail)
      return NextResponse.json({ error: "Metered ICE fetch failed" }, { status: 502 })
    }

    const iceServers = (await iceRes.json()) as RTCIceServer[]
    return NextResponse.json(iceServers)
  } catch (err) {
    console.error("[turn] Metered error:", err)
    return NextResponse.json({ error: "TURN service unavailable" }, { status: 502 })
  }
}
