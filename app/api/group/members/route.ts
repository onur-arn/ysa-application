import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/** Add or remove group members as admin (service role). */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const conversationId = body.conversationId as string | undefined
  const action = body.action as "add" | "remove" | undefined
  const memberNames = Array.isArray(body.memberNames)
    ? (body.memberNames as unknown[]).map((n) => String(n).trim()).filter(Boolean)
    : []

  if (!conversationId || (action !== "add" && action !== "remove") || memberNames.length === 0) {
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

  if (action === "remove") {
    const { error } = await admin
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conversationId)
      .in("member_name", memberNames)
    if (error) {
      console.error("[group/members] remove:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, memberNames })
  }

  // action === "add"
  const { data: profiles } = await admin
    .from("profiles")
    .select("id,name")
    .in("name", memberNames)
  const idByName = new Map((profiles ?? []).map((p) => [p.name as string, p.id as string]))

  const { data: existing } = await admin
    .from("conversation_members")
    .select("member_name")
    .eq("conversation_id", conversationId)
    .in("member_name", memberNames)

  const already = new Set((existing ?? []).map((r) => r.member_name as string))
  const toInsert = memberNames.filter((n) => !already.has(n))

  if (toInsert.length > 0) {
    const rowsLegacy = toInsert.map((member_name) => ({
      conversation_id: conversationId,
      member_name,
      is_admin: false,
    }))
    let { error } = await admin.from("conversation_members").insert(rowsLegacy)
    if (error) {
      const rowsUid = toInsert.map((member_name) => ({
        conversation_id: conversationId,
        member_name,
        is_admin: false,
        user_id: idByName.get(member_name) ?? null,
      }))
      const retry = await admin.from("conversation_members").insert(rowsUid)
      if (retry.error) {
        console.error("[group/members] add:", error.message, retry.error.message)
        return NextResponse.json({ error: retry.error.message }, { status: 500 })
      }
    }
  }

  // Return all requested names (including already present) so UI can still log the add
  return NextResponse.json({
    ok: true,
    memberNames,
    added: toInsert,
    already: [...already],
  })
}
