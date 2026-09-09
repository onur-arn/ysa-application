import { NextResponse } from "next/server"
import { isAdminEmail } from "@/lib/admin"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/** Hard-delete a conversation everywhere — no archive. */
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

  const { data: existing, error: loadErr } = await admin
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .maybeSingle()

  if (loadErr) {
    console.error("[delete-conversation] load:", loadErr.message)
    return NextResponse.json({ error: loadErr.message }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ ok: true, alreadyGone: true })
  }

  // Delete dependents first (in case some FKs lack CASCADE), then the conversation
  const steps: Array<{ label: string; run: () => Promise<{ error: { message: string } | null }> }> = [
    {
      label: "call_signals",
      run: async () => {
        const { data: sessions } = await admin
          .from("call_sessions")
          .select("id")
          .eq("conversation_id", conversationId)
        const ids = (sessions ?? []).map((s) => s.id as string)
        if (ids.length === 0) return { error: null }
        return admin.from("call_signals").delete().in("session_id", ids)
      },
    },
    {
      label: "call_sessions",
      run: () => admin.from("call_sessions").delete().eq("conversation_id", conversationId),
    },
    {
      label: "message_polls via messages",
      run: async () => {
        // message_polls cascade from chat_messages; delete messages after polls if needed
        const { data: msgs } = await admin
          .from("chat_messages")
          .select("id")
          .eq("conversation_id", conversationId)
        const ids = (msgs ?? []).map((m) => m.id as string)
        if (ids.length === 0) return { error: null }
        await admin.from("message_polls").delete().in("message_id", ids)
        return { error: null }
      },
    },
    {
      label: "chat_messages",
      run: () => admin.from("chat_messages").delete().eq("conversation_id", conversationId),
    },
    {
      label: "conversation_members",
      run: () => admin.from("conversation_members").delete().eq("conversation_id", conversationId),
    },
    {
      label: "conversations",
      run: () => admin.from("conversations").delete().eq("id", conversationId),
    },
  ]

  for (const step of steps) {
    const { error } = await step.run()
    if (error) {
      console.error(`[delete-conversation] ${step.label}:`, error.message)
      return NextResponse.json({ error: `${step.label}: ${error.message}` }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
