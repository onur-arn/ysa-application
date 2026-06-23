import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { requestId } = await req.json()
  if (!requestId) return NextResponse.json({ error: "Missing requestId" }, { status: 400 })

  // Verify the request belongs to this user (by created_by OR by author name match)
  const admin = createAdminClient()
  const { data: igem } = await admin
    .from("igem_requests")
    .select("id,created_by,author")
    .eq("id", requestId)
    .single()

  if (!igem) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Allow if created_by matches, or if created_by is null (legacy row)
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single()

  const isOwner = igem.created_by === user.id || (igem.created_by == null && igem.author === profile?.name)
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { error } = await admin.from("igem_requests").delete().eq("id", requestId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
