import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchUserConversationRows } from "@/lib/queries/conversations"

/** Reliable conversation list (service role after auth check). */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", conversations: [] }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name,initials,station")
    .eq("id", user.id)
    .single()

  const userName = (profile?.name as string | undefined)?.trim() ?? ""
  if (!userName) {
    return NextResponse.json({
      error: "Profil adınız eksik",
      conversations: [],
      userName: "",
      profile,
    }, { status: 200 })
  }

  try {
    const admin = createAdminClient()
    const conversations = await fetchUserConversationRows(admin, user.id, userName)
    return NextResponse.json({
      conversations,
      userName,
      count: conversations.length,
    })
  } catch (e) {
    console.error("[api/conversations/list]", e)
    return NextResponse.json({ error: "Liste yüklenemedi", conversations: [] }, { status: 500 })
  }
}
