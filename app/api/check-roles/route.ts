import { NextRequest, NextResponse } from "next/server"
import { getOccupiedRoles, getOccupiedRolesByStation } from "@/lib/roles"

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("all") === "1") {
    try {
      const byStation = await getOccupiedRolesByStation()
      return NextResponse.json({ byStation })
    } catch (err) {
      console.error("[check-roles]", err)
      return NextResponse.json({ byStation: {} })
    }
  }

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
