import { NextResponse } from "next/server"
import { isAdminEmail } from "@/lib/admin"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { archiveThenDelete } from "@/lib/admin-archive"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { postId } = await req.json()
  if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 })

  const admin = createAdminClient()
  const { data: post } = await admin.from("posts").select("id,created_by").eq("id", postId).maybeSingle()
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isAdmin = isAdminEmail(user.email)
  const isOwner = post.created_by === user.id
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { error } = await archiveThenDelete("posts", postId, user.email ?? user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
