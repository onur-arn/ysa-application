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

  // Get all conversations where user is member, with their messages
  let convRows: Record<string, unknown>[] = []
  if (userName) {
    const { data: memberRows } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("member_name", userName)

    const convIds = (memberRows ?? []).map((r: Record<string, unknown>) => r.conversation_id as string)

    if (convIds.length > 0) {
      const { data } = await supabase
        .from("conversations")
        .select("id,type,name,initials,created_at,conversation_members(member_name),chat_messages(id,sender_name,sender_initials,text,image_url,is_system,created_at)")
        .in("id", convIds)
        .order("created_at", { ascending: false })
      convRows = (data ?? []) as Record<string, unknown>[]
    }
  }

  return (
    <MessagesClient
      initialUserId={user?.id ?? ""}
      initialProfile={profileRes.data as { name: string; initials: string; station: string } | null}
      initialProfiles={(allProfilesRes.data ?? []) as { id: string; name: string; photo_url: string | null }[]}
      initialConversations={convRows}
    />
  )
}
