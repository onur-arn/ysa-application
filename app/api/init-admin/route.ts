import { NextResponse } from "next/server"

// Endpoint désactivé — initialiser le compte admin directement via le dashboard Supabase
export async function POST() {
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}
