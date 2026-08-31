import { NextRequest, NextResponse } from "next/server"
import { getOccupiedRoles } from "@/lib/roles"

export async function GET(req: NextRequest) {
  const station = req.nextUrl.searchParams.get("station") ?? ""
  if (!station) {
    return NextResponse.json({ occupied: [] })
  }

  try {
    const occupied = await getOccupiedRoles(station)
    return NextResponse.json({ occupied })
  } catch (err) {
    console.error("[check-roles]", err)
    return NextResponse.json({ occupied: [] })
  }
}
