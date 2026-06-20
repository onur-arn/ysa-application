import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim()
  if (!q) return NextResponse.json({ data: [] })

  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=20&output=json`,
      { next: { revalidate: 60 } },
    )
    const json = await res.json()
    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ data: [] }, { status: 502 })
  }
}
