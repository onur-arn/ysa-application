import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { archiveThenDelete } from "@/lib/admin-archive"
import { isAdminEmail } from "@/lib/admin"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { storyId, authorName } = await req.json()
  if (!storyId) return NextResponse.json({ error: "Missing storyId" }, { status: 400 })

  const admin = createAdminClient()
  const { data: story } = await admin.from("stories").select("id,author_name").eq("id", storyId).maybeSingle()
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single()
  const isOwner = story.author_name === profile?.name || story.author_name === authorName
  if (!isOwner && !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { error } = await archiveThenDelete("stories", storyId, user.email ?? user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
