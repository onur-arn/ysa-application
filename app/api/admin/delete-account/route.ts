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

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

  const admin = createAdminClient()

  // Ban immediately — invalidates their JWT on Supabase auth server right now
  await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" })

  // Delete profile and auth user
  await admin.from("profiles").delete().eq("id", userId)
  await admin.from("push_subscriptions").delete().eq("user_id", userId)
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
