import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/** Upload / replace group avatar (admin only). */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const conversationId = body.conversationId as string | undefined
  const photoBase64 = body.photoBase64 as string | undefined
  const photoExt = ((body.photoExt as string | undefined) ?? "jpg").replace(/^\./, "")

  if (!conversationId || !photoBase64) {
    return NextResponse.json({ error: "Eksik veri" }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single()
  const userName = (profile?.name as string | undefined)?.trim()
  if (!userName) return NextResponse.json({ error: "Profil eksik" }, { status: 400 })

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from("conversation_members")
    .select("is_admin")
    .eq("conversation_id", conversationId)
    .eq("member_name", userName)
    .maybeSingle()

  const { data: conv } = await admin
    .from("conversations")
    .select("admin_name,type")
    .eq("id", conversationId)
    .maybeSingle()

  const isAdmin =
    membership?.is_admin === true ||
    (conv?.admin_name && conv.admin_name === userName)

  if (!isAdmin || conv?.type !== "group") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 })
  }

  const rawExt = photoExt.toLowerCase().replace("jpeg", "jpg")
  const contentType =
    rawExt === "png" ? "image/png"
    : rawExt === "webp" ? "image/webp"
    : rawExt === "gif" ? "image/gif"
    : "image/jpeg"
  const path = `${conversationId}/avatar.jpg`
  const buffer = Buffer.from(photoBase64, "base64")

  const { error: upErr } = await admin.storage.from("group-avatars").upload(path, buffer, {
    contentType,
    upsert: true,
  })
  if (upErr) {
    console.error("[group-avatar]", upErr.message)
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  const { data: urlData } = admin.storage.from("group-avatars").getPublicUrl(path)
  const url = `${urlData.publicUrl}?t=${Date.now()}`

  // Best-effort DB column (may be missing until SQL migration is run)
  const { error: updErr } = await admin
    .from("conversations")
    .update({ avatar_url: url })
    .eq("id", conversationId)
  if (updErr) {
    console.warn("[group-avatar] avatar_url column?", updErr.message)
  }

  return NextResponse.json({ url })
}
