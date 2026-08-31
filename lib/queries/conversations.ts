import type { SupabaseClient } from "@supabase/supabase-js"

const CHAT_MSG_FULL =
  "id,sender_name,sender_initials,text,image_url,gif_url,audio_url,message_type,is_system,created_at"
const CHAT_MSG_MIN = "id,sender_name,sender_initials,text,image_url,is_system,created_at"

const CONV_SELECT = `id,type,name,initials,admin_name,created_at,conversation_members(member_name,is_admin,user_id)`

export async function fetchUserConversationRows(
  supabase: SupabaseClient,
  userId: string,
  userName: string,
): Promise<Record<string, unknown>[]> {
  const trimmedName = userName.trim()

  const [{ data: byUid }, { data: byName }] = await Promise.all([
    supabase.from("conversation_members").select("conversation_id").eq("user_id", userId),
    trimmedName
      ? supabase.from("conversation_members").select("conversation_id").eq("member_name", trimmedName)
      : Promise.resolve({ data: [] as { conversation_id: string }[] }),
  ])

  const convIds = [
    ...new Set([
      ...(byUid ?? []).map((r) => r.conversation_id as string),
      ...(byName ?? []).map((r) => r.conversation_id as string),
    ]),
  ]

  if (convIds.length === 0) return []

  let { data, error } = await supabase
    .from("conversations")
    .select(`${CONV_SELECT},chat_messages(${CHAT_MSG_FULL})`)
    .in("id", convIds)

  if (error) {
    const fallback = await supabase
      .from("conversations")
      .select(`${CONV_SELECT},chat_messages(${CHAT_MSG_MIN})`)
      .in("id", convIds)
    data = fallback.data
    error = fallback.error
  }

  if (error || !data) {
    console.error("[conversations] load failed:", error?.message)
    return []
  }

  return data.map((conv) => {
    const msgs = (conv.chat_messages as { created_at: string }[]) ?? []
    const sorted = [...msgs].sort((a, b) => b.created_at.localeCompare(a.created_at))
    return { ...conv, chat_messages: sorted.slice(0, 1) }
  }) as Record<string, unknown>[]
}

/** Backfill user_id on legacy membership rows for the signed-in user. */
export async function syncConversationMembership(
  supabase: SupabaseClient,
  userId: string,
  userName: string,
) {
  const name = userName.trim()
  if (!userId || !name) return
  await supabase
    .from("conversation_members")
    .update({ user_id: userId })
    .eq("member_name", name)
    .is("user_id", null)
}
