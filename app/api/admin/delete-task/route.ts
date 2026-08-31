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

  const { taskId } = await req.json()
  if (!taskId) return NextResponse.json({ error: "Missing taskId" }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from("tasks").delete().eq("id", taskId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
