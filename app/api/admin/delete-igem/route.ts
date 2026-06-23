import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const ADMIN_EMAIL = "secretaire@youthstation.org"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { requestId } = await req.json()
  if (!requestId) return NextResponse.json({ error: "Missing requestId" }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from("igem_requests").delete().eq("id", requestId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
