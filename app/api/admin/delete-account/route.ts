import { NextRequest, NextResponse } from "next/server"
import { isAdminEmail } from "@/lib/admin"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { archiveThenDelete } from "@/lib/admin-archive"

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

  // Archive full profile before removal
  await archiveThenDelete("profiles", userId, user.email ?? "admin")

  // Ban + remove auth so they cannot reconnect (profile already archived)
  try {
    await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" })
  } catch {}
  await admin.from("push_subscriptions").delete().eq("user_id", userId)
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
