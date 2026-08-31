import { NextRequest, NextResponse } from "next/server"

const TENOR_KEY = process.env.TENOR_API_KEY

const FALLBACK_GIFS = [
  { id: "fb1", url: "https://media.tenor.com/bAYxihrelHkAAAAC/thumbs-up.gif", preview: "https://media.tenor.com/bAYxihrelHkAAAAD/thumbs-up.gif" },
  { id: "fb2", url: "https://media.tenor.com/9h3z3P0bN8sAAAAC/happy.gif", preview: "https://media.tenor.com/9h3z3P0bN8sAAAAD/happy.gif" },
  { id: "fb3", url: "https://media.tenor.com/3o7abKhOpu0NwenH3O/yes.gif", preview: "https://media.tenor.com/3o7abKhOpu0NwenH3O/yes.gif" },
  { id: "fb4", url: "https://media.tenor.com/gUiu1zyxfzYAAAAC/applause.gif", preview: "https://media.tenor.com/gUiu1zyxfzYAAAAD/applause.gif" },
]

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 30)

  if (!TENOR_KEY) {
    const filtered = q
      ? FALLBACK_GIFS.filter((g) => g.id.includes(q.toLowerCase()))
      : FALLBACK_GIFS
    return NextResponse.json({
      gifs: filtered,
      fallback: true,
      hint: "TENOR_API_KEY non configuré — GIFs limités",
    })
  }

  const endpoint = q
    ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&client_key=ysa&limit=${limit}`
    : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&client_key=ysa&limit=${limit}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(endpoint, { signal: controller.signal, cache: "no-store" })
    clearTimeout(timeout)

    if (!res.ok) return NextResponse.json({ gifs: FALLBACK_GIFS, fallback: true })
    const data = await res.json()
    const gifs = (data.results ?? []).map((item: {
      id: string
      media_formats: { gif?: { url: string }; tinygif?: { url: string }; nanogif?: { url: string } }
    }) => ({
      id: item.id,
      url: item.media_formats?.gif?.url ?? item.media_formats?.tinygif?.url ?? "",
      preview: item.media_formats?.nanogif?.url ?? item.media_formats?.tinygif?.url ?? "",
    })).filter((g: { url: string }) => g.url)

    return NextResponse.json({ gifs: gifs.length > 0 ? gifs : FALLBACK_GIFS, fallback: gifs.length === 0 })
  } catch {
    return NextResponse.json({ gifs: FALLBACK_GIFS, fallback: true })
  }
}
