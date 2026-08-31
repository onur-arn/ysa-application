import { NextRequest, NextResponse } from "next/server"

const GIPHY_KEY = process.env.GIPHY_API_KEY
const TENOR_KEY = process.env.TENOR_API_KEY

const FALLBACK_GIFS = [
  { id: "fb1", url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif", preview: "https://media.giphy.com/media/111ebonMs90YLu/200_s.gif" },
  { id: "fb2", url: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif", preview: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/200_s.gif" },
  { id: "fb3", url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif", preview: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200_s.gif" },
  { id: "fb4", url: "https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif", preview: "https://media.giphy.com/media/26u4cqiYI30juCOGY/200_s.gif" },
  { id: "fb5", url: "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif", preview: "https://media.giphy.com/media/artj92V8o75VPL7AeQ/200_s.gif" },
  { id: "fb6", url: "https://media.giphy.com/media/3orieUe6ejxSFxYCWr/giphy.gif", preview: "https://media.giphy.com/media/3orieUe6ejxSFxYCWr/200_s.gif" },
]

async function fetchGiphy(q: string, limit: number) {
  if (!GIPHY_KEY) return null
  const endpoint = q
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=${limit}&rating=pg-13&lang=tr`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=${limit}&rating=pg-13`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  const res = await fetch(endpoint, { signal: controller.signal, cache: "no-store" })
  clearTimeout(timeout)
  if (!res.ok) return null

  const data = await res.json()
  const gifs = (data.data ?? []).map((item: {
    id: string
    images?: {
      original?: { url?: string }
      downsized?: { url?: string }
      fixed_height_small?: { url?: string }
      preview_gif?: { url?: string }
    }
  }) => ({
    id: item.id,
    url: item.images?.downsized?.url ?? item.images?.original?.url ?? "",
    preview: item.images?.fixed_height_small?.url ?? item.images?.preview_gif?.url ?? "",
  })).filter((g: { url: string }) => g.url)

  return gifs.length > 0 ? gifs : null
}

async function fetchTenor(q: string, limit: number) {
  if (!TENOR_KEY) return null
  const endpoint = q
    ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&client_key=ysa&limit=${limit}`
    : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&client_key=ysa&limit=${limit}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  const res = await fetch(endpoint, { signal: controller.signal, cache: "no-store" })
  clearTimeout(timeout)
  if (!res.ok) return null

  const data = await res.json()
  const gifs = (data.results ?? []).map((item: {
    id: string
    media_formats: { gif?: { url: string }; tinygif?: { url: string }; nanogif?: { url: string } }
  }) => ({
    id: item.id,
    url: item.media_formats?.gif?.url ?? item.media_formats?.tinygif?.url ?? "",
    preview: item.media_formats?.nanogif?.url ?? item.media_formats?.tinygif?.url ?? "",
  })).filter((g: { url: string }) => g.url)

  return gifs.length > 0 ? gifs : null
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 24), 30)

  try {
    const giphy = await fetchGiphy(q, limit)
    if (giphy) return NextResponse.json({ gifs: giphy, provider: "giphy" })

    const tenor = await fetchTenor(q, limit)
    if (tenor) return NextResponse.json({ gifs: tenor, provider: "tenor" })
  } catch {
    /* fall through */
  }

  return NextResponse.json({
    gifs: FALLBACK_GIFS,
    fallback: true,
    provider: "fallback",
    hint: "Ajoutez GIPHY_API_KEY sur Vercel pour la recherche GIF",
  })
}
