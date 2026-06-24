import { NextResponse } from "next/server"

// Endpoint désactivé — ne jamais exposer en production
export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}
