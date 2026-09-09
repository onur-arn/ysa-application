import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Enrich message polls with ALL voters (RLS otherwise returns only own votes).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const messageIds = Array.isArray(body.messageIds)
    ? (body.messageIds as unknown[]).map((id) => String(id)).filter(Boolean).slice(0, 100)
    : []
  if (messageIds.length === 0) return NextResponse.json({ polls: {} })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("message_polls")
    .select("id,message_id,question,message_poll_options(id,text,position,message_poll_votes(option_id,voter_name))")
    .in("message_id", messageIds)

  if (error) {
    console.error("[chat/poll-state]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const polls: Record<string, {
    id: string
    question: string
    options: { id: string; text: string; voters: string[] }[]
  }> = {}

  for (const row of data ?? []) {
    const options = ((row.message_poll_options as {
      id: string; text: string; position: number
      message_poll_votes: { voter_name: string }[]
    }[] | null) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((o) => ({
        id: o.id,
        text: o.text,
        voters: (o.message_poll_votes ?? []).map((v) => v.voter_name),
      }))
    polls[row.message_id as string] = {
      id: row.id as string,
      question: row.question as string,
      options,
    }
  }

  return NextResponse.json({ polls })
}
