import { NextResponse } from "next/server"
import { isAdminEmail } from "@/lib/admin"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/** Hard-delete a conversation everywhere (messages, members, polls cascade). */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const conversationId = body.conversationId as string | undefined
  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: conv, error: loadErr } = await admin
    .from("conversations")
    .select("*,conversation_members(member_name,is_admin,user_id)")
    .eq("id", conversationId)
    .maybeSingle()

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 })
  }
  if (!conv) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { data: recentMsgs, count: msgCount } = await admin
    .from("chat_messages")
    .select("id,sender_name,text,image_url,gif_url,audio_url,message_type,is_system,created_at", { count: "exact" })
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(200)

  // Archive snapshot (full history may be huge — keep members + last 200 messages)
  try {
    const { data: buckets } = await admin.storage.listBuckets()
    if (!buckets?.some((b) => b.name === "admin-archive")) {
      await admin.storage.createBucket("admin-archive", { public: false, fileSizeLimit: 20_000_000 })
    }
    const payload = {
      table: "conversations",
      id: conversationId,
      deletedBy: user.email ?? user.id,
      deletedAt: new Date().toISOString(),
      row: {
        ...conv,
        message_count: msgCount ?? (recentMsgs?.length ?? 0),
        chat_messages_sample: recentMsgs ?? [],
      },
    }
    const path = `conversations/${conversationId}-${Date.now()}.json`
    const { error: upErr } = await admin.storage
      .from("admin-archive")
      .upload(path, JSON.stringify(payload), { contentType: "application/json", upsert: true })
    if (upErr) console.error("[delete-conversation] archive:", upErr.message)
  } catch (err) {
    console.error("[delete-conversation] archive failed:", err)
  }

  const { error } = await admin.from("conversations").delete().eq("id", conversationId)
  if (error) {
    console.error("[delete-conversation]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Cleanup leftovers if any FK lacks ON DELETE CASCADE
  await Promise.all([
    admin.from("chat_messages").delete().eq("conversation_id", conversationId),
    admin.from("conversation_members").delete().eq("conversation_id", conversationId),
    admin.from("call_sessions").delete().eq("conversation_id", conversationId),
  ])

  return NextResponse.json({ ok: true })
}
