import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { archiveThenDelete } from "@/lib/admin-archive"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { requestId } = await req.json()
  if (!requestId) return NextResponse.json({ error: "Missing requestId" }, { status: 400 })

  const admin = createAdminClient()
  const { data: igem } = await admin
    .from("igem_requests")
    .select("id,created_by,author")
    .eq("id", requestId)
    .single()

  if (!igem) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single()

  const isOwner = igem.created_by === user.id || (igem.created_by == null && igem.author === profile?.name)
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { error } = await archiveThenDelete("igem_requests", requestId, user.email ?? user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
