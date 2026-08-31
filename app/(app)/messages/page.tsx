
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { MessagesClient } from "./messages-client"

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, allProfilesRes] = await Promise.all([
    user
      ? supabase.from("profiles").select("name,initials,station").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id,name,photo_url"),
  ])

  const userName = (profileRes.data?.name as string) ?? ""

  let convRows: Record<string, unknown>[] = []
  if (user?.id) {
    const { data: memberRows, error: memberErr } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id)

    let convIds = memberErr
      ? []
      : (memberRows ?? []).map((r: Record<string, unknown>) => r.conversation_id as string)

    if (convIds.length === 0 && userName) {
      const { data: legacyRows } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("member_name", userName)
      convIds = (legacyRows ?? []).map((r: Record<string, unknown>) => r.conversation_id as string)
    }

    if (convIds.length > 0) {
      const { data } = await supabase
        .from("conversations")
        .select("id,type,name,initials,admin_name,created_at,conversation_members(member_name,is_admin),chat_messages(id,sender_name,sender_initials,text,image_url,gif_url,audio_url,message_type,is_system,created_at)")
        .in("id", convIds)
        .order("created_at", { foreignTable: "chat_messages", ascending: false })
        .limit(1, { foreignTable: "chat_messages" })
      convRows = (data ?? []) as Record<string, unknown>[]
    }
  }

  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">Yükleniyor…</div>}>
      <MessagesClient
        initialUserId={user?.id ?? ""}
        initialProfile={profileRes.data as { name: string; initials: string; station: string } | null}
        initialProfiles={(allProfilesRes.data ?? []) as { id: string; name: string; photo_url: string | null }[]}
        initialConversations={convRows}
      />
    </Suspense>
  )
}
