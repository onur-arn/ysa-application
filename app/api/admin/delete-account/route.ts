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

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  if (userId === user.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: target } = await admin.from("profiles").select("email").eq("id", userId).maybeSingle()
  if (target?.email && isAdminEmail(target.email)) {
    return NextResponse.json({ error: "Cannot delete an admin" }, { status: 403 })
  }

  // Ban immediately — invalidates their JWT on Supabase auth server right now
  await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" })

  // Delete profile and auth user
  await admin.from("profiles").delete().eq("id", userId)
  await admin.from("push_subscriptions").delete().eq("user_id", userId)
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
