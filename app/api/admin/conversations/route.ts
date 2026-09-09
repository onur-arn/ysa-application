import { NextRequest, NextResponse } from "next/server"
import { isAdminEmail } from "@/lib/admin"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/** List all conversations + members for Yönetici (service role). */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: convs, error } = await admin
    .from("conversations")
    .select("id,type,name,created_at,conversation_members(member_name)")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const conversationRows = convs ?? []
  const ids = conversationRows.map((c) => c.id as string)
  const counts: Record<string, number> = {}
  const previews: Record<string, string> = {}

  if (ids.length > 0) {
    const { data: recent } = await admin
      .from("chat_messages")
      .select("conversation_id,text,image_url,gif_url,audio_url,created_at")
      .in("conversation_id", ids)
      .eq("is_system", false)
      .order("created_at", { ascending: false })

    for (const row of recent ?? []) {
      const cid = row.conversation_id as string
      counts[cid] = (counts[cid] ?? 0) + 1
      if (!previews[cid]) {
        if (row.text) previews[cid] = row.text
        else if (row.image_url) previews[cid] = "📷 Fotoğraf"
        else if (row.gif_url) previews[cid] = "GIF"
        else if (row.audio_url) previews[cid] = "🎤 Sesli mesaj"
        else previews[cid] = "Mesaj"
      }
    }
  }

  return NextResponse.json({
    conversations: conversationRows,
    msgCounts: counts,
    lastPreviews: previews,
  })
}

/** Load messages for one conversation (admin only). */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { conversationId } = await req.json().catch(() => ({}))
  if (!conversationId || typeof conversationId !== "string") {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("chat_messages")
    .select("id,conversation_id,sender_name,sender_initials,text,image_url,gif_url,audio_url,message_type,is_system,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(5000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ messages: data ?? [] })
}
