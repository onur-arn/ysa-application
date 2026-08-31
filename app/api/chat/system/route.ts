import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/** Insert a system line into a group chat (add/remove member, create group, etc.). */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const conversationId = body.conversationId as string | undefined
  const text = typeof body.text === "string" ? body.text.trim() : ""
  if (!conversationId || !text) {
    return NextResponse.json({ error: "Eksik veri" }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name,initials")
    .eq("id", user.id)
    .single()
  const userName = (profile?.name as string | undefined)?.trim()
  if (!userName) return NextResponse.json({ error: "Profil eksik" }, { status: 400 })

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("member_name", userName)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: "Sohbete erişim yok" }, { status: 403 })
  }

  const { data, error } = await admin
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      sender_name: userName,
      sender_initials: ((profile?.initials as string) || userName.slice(0, 2)).toUpperCase(),
      text,
      is_system: true,
      message_type: "text",
    })
    .select("id,created_at")
    .single()

  if (error || !data) {
    console.error("[chat/system]", error?.message)
    // Retry without message_type if column missing
    const retry = await admin
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        sender_name: userName,
        sender_initials: ((profile?.initials as string) || userName.slice(0, 2)).toUpperCase(),
        text,
        is_system: true,
      })
      .select("id,created_at")
      .single()
    if (retry.error || !retry.data) {
      console.error("[chat/system] retry:", retry.error?.message)
      return NextResponse.json({ error: retry.error?.message || error?.message || "Kayıt başarısız" }, { status: 500 })
    }
    return NextResponse.json({ id: retry.data.id, createdAt: retry.data.created_at })
  }

  return NextResponse.json({ id: data.id, createdAt: data.created_at })
}
