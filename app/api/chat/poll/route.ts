import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/** Create a chat poll (message + poll + options) via service role. */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const conversationId = body.conversationId as string | undefined
  const question = typeof body.question === "string" ? body.question.trim() : ""
  const options = Array.isArray(body.options)
    ? (body.options as unknown[]).map((o) => String(o).trim()).filter(Boolean)
    : []

  if (!conversationId || conversationId.startsWith("pending-")) {
    return NextResponse.json({ error: "Geçersiz sohbet" }, { status: 400 })
  }
  if (!question || options.length < 2) {
    return NextResponse.json({ error: "Soru ve en az 2 seçenek gerekli" }, { status: 400 })
  }
  if (options.length > 8) {
    return NextResponse.json({ error: "En fazla 8 seçenek" }, { status: 400 })
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

  const admin = createAdminClient()
  const { data: membership } = await admin
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("member_name", senderName)
    .maybeSingle()

  if (!membership) {
    const { data: byUid } = await admin
      .from("conversation_members")
      .select("conversation_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!byUid) {
      return NextResponse.json({ error: "Sohbete erişim yok" }, { status: 403 })
    }
  }

  const text = `📊 ${question}`
  const msgAttempts = [
    {
      conversation_id: conversationId,
      sender_name: senderName,
      sender_initials: senderInitials,
      text,
      message_type: "poll",
    },
    {
      conversation_id: conversationId,
      sender_name: senderName,
      sender_initials: senderInitials,
      text,
    },
  ]

  let message: { id: string; created_at?: string } | null = null
  let lastError = ""
  for (const row of msgAttempts) {
    const { data, error } = await admin.from("chat_messages").insert(row).select("id,created_at").single()
    if (!error && data) {
      message = data
      break
    }
    lastError = error?.message ?? "message insert failed"
    if (error && !/message_type|PGRST|42703|schema/i.test(error.message)) break
  }

  if (!message) {
    console.error("[api/chat/poll] message:", lastError)
    return NextResponse.json({ error: lastError || "Mesaj kaydedilemedi" }, { status: 500 })
  }

  const { data: poll, error: pollErr } = await admin
    .from("message_polls")
    .insert({ message_id: message.id, question })
    .select("id,question")
    .single()

  if (pollErr || !poll) {
    console.error("[api/chat/poll] poll:", pollErr?.message)
    await admin.from("chat_messages").delete().eq("id", message.id)
    return NextResponse.json({ error: pollErr?.message ?? "Anket kaydedilemedi" }, { status: 500 })
  }

  const optionRows = options.map((textOpt, i) => ({
    id: `${poll.id}-opt-${i}`,
    poll_id: poll.id,
    text: textOpt,
    position: i,
  }))

  const { error: optErr } = await admin.from("message_poll_options").insert(optionRows)
  if (optErr) {
    console.error("[api/chat/poll] options:", optErr.message)
    await admin.from("message_polls").delete().eq("id", poll.id)
    await admin.from("chat_messages").delete().eq("id", message.id)
    return NextResponse.json({ error: optErr.message }, { status: 500 })
  }

  return NextResponse.json({
    id: message.id,
    createdAt: message.created_at,
    senderName,
    senderInitials,
    text,
    poll: {
      id: poll.id,
      question: poll.question,
      options: optionRows.map((o) => ({ id: o.id, text: o.text, voters: [] as string[] })),
    },
  })
}

/** Vote / unvote on a message poll option. */
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const optionId = typeof body.optionId === "string" ? body.optionId : ""
  const previousOptionId = typeof body.previousOptionId === "string" ? body.previousOptionId : null
  const clearOnly = body.clearOnly === true

  const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single()
  const voterName = (profile?.name as string | undefined)?.trim()
  if (!voterName) return NextResponse.json({ error: "Profil adınız eksik" }, { status: 400 })
  if (!optionId && !previousOptionId) {
    return NextResponse.json({ error: "Seçenek gerekli" }, { status: 400 })
  }

  const admin = createAdminClient()

  if (previousOptionId) {
    await admin
      .from("message_poll_votes")
      .delete()
      .eq("option_id", previousOptionId)
      .eq("voter_name", voterName)
  }

  if (!clearOnly && optionId) {
    const { error } = await admin
      .from("message_poll_votes")
      .upsert({ option_id: optionId, voter_name: voterName })
    if (error) {
      console.error("[api/chat/poll] vote:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, voterName })
}
