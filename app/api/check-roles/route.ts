import { NextResponse } from "next/server"
import { getOccupiedRoles } from "@/lib/roles"

export async function GET() {
  try {
    const occupied = await getOccupiedRoles()
    return NextResponse.json({ occupied })
  } catch (err) {
    console.error("[check-roles]", err)
    return NextResponse.json({ occupied: [] })
  }
}
