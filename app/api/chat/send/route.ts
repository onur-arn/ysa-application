import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/** Persist a chat message via service role (avoids client schema/RLS flakiness). */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const conversationId = body.conversationId as string | undefined
  const text = typeof body.text === "string" ? body.text : ""
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : null
  const gifUrl = typeof body.gifUrl === "string" ? body.gifUrl : null
  const audioUrl = typeof body.audioUrl === "string" ? body.audioUrl : null
  const messageType = (body.messageType as string | undefined) ?? "text"

  if (!conversationId || conversationId.startsWith("pending-")) {
    return NextResponse.json({ error: "Geçersiz sohbet" }, { status: 400 })
  }
  if (!text.trim() && !imageUrl && !gifUrl && !audioUrl) {
    return NextResponse.json({ error: "Boş mesaj" }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name,initials")
    .eq("id", user.id)
    .single()

  const senderName = (profile?.name as string | undefined)?.trim()
  const senderInitials = ((profile?.initials as string | undefined) || "?").trim() || "?"
  if (!senderName) {
    return NextResponse.json({ error: "Profil adınız eksik" }, { status: 400 })
  }

  // Ensure sender is a member (by name — user_id column may be absent)
  const admin = createAdminClient()
  const { data: membership } = await admin
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("member_name", senderName)
    .maybeSingle()

  if (!membership) {
    const { error: memErr } = await admin.from("conversation_members").insert({
      conversation_id: conversationId,
      member_name: senderName,
      is_admin: false,
    })
    if (memErr) {
      console.error("[api/chat/send] membership:", memErr.message)
      return NextResponse.json({ error: "Sohbete erişim yok" }, { status: 403 })
    }
  }

  const base = {
    conversation_id: conversationId,
    sender_name: senderName,
    sender_initials: senderInitials,
    text: text.trim() || null,
    image_url: imageUrl,
    message_type: messageType,
  }

  // Try rich columns, then lean insert if schema is older
  let inserted: { id: string; created_at?: string } | null = null
  const attempts = [
    { ...base, gif_url: gifUrl, audio_url: audioUrl },
    { ...base, gif_url: gifUrl },
    { ...base, image_url: imageUrl ?? gifUrl ?? audioUrl },
    {
      conversation_id: conversationId,
      sender_name: senderName,
      sender_initials: senderInitials,
      text: text.trim() || (audioUrl ? "🎤 Sesli mesaj" : gifUrl ? "GIF" : null),
      image_url: imageUrl ?? gifUrl ?? audioUrl,
    },
  ]

  let lastError = ""
  for (const row of attempts) {
    const { data, error } = await admin.from("chat_messages").insert(row).select("id,created_at").single()
    if (!error && data) {
      inserted = data
      break
    }
    lastError = error?.message ?? "insert failed"
    if (error && !/audio_url|gif_url|message_type|PGRST|42703|schema/i.test(error.message)) {
      break
    }
  }

  if (!inserted) {
    console.error("[api/chat/send]", lastError)
    return NextResponse.json({ error: lastError || "Mesaj kaydedilemedi" }, { status: 500 })
  }

  return NextResponse.json({
    id: inserted.id,
    createdAt: inserted.created_at,
    senderName,
    senderInitials,
  })
}
