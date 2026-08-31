import { NextRequest, NextResponse } from "next/server"

const TENOR_KEY = process.env.TENOR_API_KEY

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 30)

  if (!TENOR_KEY) {
    return NextResponse.json({
      gifs: [],
      error: "TENOR_API_KEY not configured",
    })
  }

  const endpoint = q
    ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&client_key=ysa&limit=${limit}`
    : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&client_key=ysa&limit=${limit}`

  try {
    const res = await fetch(endpoint, { next: { revalidate: 3600 } })
    if (!res.ok) return NextResponse.json({ gifs: [] })
    const data = await res.json()
    const gifs = (data.results ?? []).map((item: {
      id: string
      media_formats: { gif?: { url: string }; tinygif?: { url: string }; nanogif?: { url: string } }
    }) => ({
      id: item.id,
      url: item.media_formats?.gif?.url ?? item.media_formats?.tinygif?.url ?? "",
      preview: item.media_formats?.nanogif?.url ?? item.media_formats?.tinygif?.url ?? "",
    })).filter((g: { url: string }) => g.url)

    return NextResponse.json({ gifs })
  } catch {
    return NextResponse.json({ gifs: [] })
  }
}
