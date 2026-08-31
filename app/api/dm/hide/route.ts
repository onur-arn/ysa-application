import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/** Remove current user from a conversation (hide DM/group from their list). */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { conversationId } = await req.json()
  if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 })

  const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single()
  const name = profile?.name?.trim()
  if (!name) return NextResponse.json({ error: "Profil incomplet" }, { status: 400 })

  const admin = createAdminClient()
  const { error: byIdErr } = await admin
    .from("conversation_members")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)

  if (byIdErr) {
    const { error: byNameErr } = await admin
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("member_name", name)
    if (byNameErr) return NextResponse.json({ error: byNameErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
