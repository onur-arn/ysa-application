import { NextRequest, NextResponse } from "next/server"
import { isAdminEmail } from "@/lib/admin"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { requestId, igemDate } = await req.json()
  if (!requestId) return NextResponse.json({ error: "Missing requestId" }, { status: 400 })

  const admin = createAdminClient()
  const { data: req_ } = await admin.from("igem_requests").select("author").eq("id", requestId).single()
  if (!req_) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: profile } = await admin.from("profiles").select("id").eq("name", req_.author).maybeSingle()
  if (profile) {
    await admin.from("profiles").update({ igem_egitimi: "evet", igem_tarihi: igemDate ?? null }).eq("id", profile.id)
  }
  await admin.from("igem_requests").delete().eq("id", requestId)

  return NextResponse.json({ ok: true })
}
