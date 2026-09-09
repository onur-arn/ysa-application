import { NextRequest, NextResponse } from "next/server"
import { isAdminEmail } from "@/lib/admin"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { archiveThenDelete } from "@/lib/admin-archive"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { eventId } = await req.json()
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 })

  const admin = createAdminClient()
  const { data: event } = await admin.from("events").select("id,created_by").eq("id", eventId).maybeSingle()
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isAdmin = isAdminEmail(user.email)
  const isOwner = event.created_by === user.id
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { error } = await archiveThenDelete("events", eventId, user.email ?? user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
