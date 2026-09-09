import { NextRequest, NextResponse } from "next/server"
import { isAdminEmail } from "@/lib/admin"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { archiveThenDelete } from "@/lib/admin-archive"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { taskId } = await req.json()
  if (!taskId) {
    return NextResponse.json({ error: "Missing taskId" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: task } = await admin
    .from("tasks")
    .select("created_by")
    .eq("id", taskId)
    .maybeSingle()

  if (!task) {
    return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 })
  }

  const isAdmin = isAdminEmail(user.email)
  const isCreator = task.created_by === user.id

  if (!isAdmin && !isCreator) {
    return NextResponse.json({ error: "Bu görevi silme yetkiniz yok" }, { status: 403 })
  }

  const { error } = await archiveThenDelete("tasks", taskId, user.email ?? user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
