import { NextRequest, NextResponse } from "next/server"

/** Proxy Deezer preview MP3 so playback isn't blocked by hotlink / CORS rules. */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")?.trim()
  if (!raw) return NextResponse.json({ error: "Missing url" }, { status: 400 })

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }

  const host = target.hostname.toLowerCase()
  const allowed =
    host.endsWith("dzcdn.net") ||
    host.endsWith("deezer.com") ||
    host === "cdns-preview-a.dzcdn.net" ||
    host.startsWith("cdnt-preview") ||
    host.startsWith("cdns-preview")
  if (!allowed) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 })
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { Accept: "audio/*,*/*" },
      next: { revalidate: 3600 },
    })
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Upstream failed" }, { status: 502 })
    }
    const contentType = upstream.headers.get("content-type") || "audio/mpeg"
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Accept-Ranges": "bytes",
      },
    })
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 })
  }
}
