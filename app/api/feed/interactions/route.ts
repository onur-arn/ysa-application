import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Full likes / comments / poll votes for posts.
 * Uses service role because RLS currently hides other users' votes/likes on SELECT.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const postIds = Array.isArray(body.postIds)
    ? (body.postIds as unknown[]).map((id) => String(id)).filter(Boolean).slice(0, 50)
    : []
  if (postIds.length === 0) return NextResponse.json({ posts: [] })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("posts")
    .select("id,post_likes(voter_name),post_comments(id,author,initials,station,text,created_at),polls(id,question,poll_options(id,text,position,poll_votes(option_id,voter_name)))")
    .in("id", postIds)

  if (error) {
    console.error("[feed/interactions]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ posts: data ?? [] })
}
