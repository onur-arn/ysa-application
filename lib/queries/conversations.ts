import type { SupabaseClient } from "@supabase/supabase-js"

const CHAT_MSG_FULL =
  "id,sender_name,sender_initials,text,image_url,gif_url,audio_url,message_type,is_system,created_at"
const CHAT_MSG_NO_AUDIO =
  "id,sender_name,sender_initials,text,image_url,gif_url,message_type,is_system,created_at"
const CHAT_MSG_MIN = "id,sender_name,sender_initials,text,image_url,is_system,created_at"

const CONV_SELECTS = [
  "id,type,name,initials,admin_name,created_at,conversation_members(member_name,is_admin,user_id)",
  "id,type,name,initials,admin_name,created_at,conversation_members(member_name,is_admin)",
] as const

const MSG_SELECTS = [CHAT_MSG_FULL, CHAT_MSG_NO_AUDIO, CHAT_MSG_MIN] as const

function isSchemaError(message?: string) {
  return !!message && /user_id|audio_url|gif_url|message_type|schema cache|42703|PGRST/i.test(message)
}

export async function fetchUserConversationRows(
  supabase: SupabaseClient,
  userId: string,
  userName: string,
): Promise<Record<string, unknown>[]> {
  const trimmedName = userName.trim()

  const [{ data: byUid }, { data: byName }] = await Promise.all([
    userId
      ? supabase.from("conversation_members").select("conversation_id").eq("user_id", userId)
      : Promise.resolve({ data: null as { conversation_id: string }[] | null, error: null }),
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

  let data: Record<string, unknown>[] | null = null
  let error: { message: string } | null = null

  outer: for (const convSelect of CONV_SELECTS) {
    for (const msgSelect of MSG_SELECTS) {
      const res = await supabase
        .from("conversations")
        .select(`${convSelect},chat_messages(${msgSelect})`)
        .in("id", convIds)
      if (!res.error && res.data) {
        data = res.data as Record<string, unknown>[]
        error = null
        break outer
      }
      error = res.error
      if (res.error && isSchemaError(res.error.message)) continue
      break
    }
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

/** Backfill user_id on legacy membership rows (no-op if column missing). */
export async function syncConversationMembership(
  supabase: SupabaseClient,
  userId: string,
  userName: string,
) {
  const name = userName.trim()
  if (!userId || !name) return
  const { error } = await supabase
    .from("conversation_members")
    .update({ user_id: userId })
    .eq("member_name", name)
    .is("user_id", null)
  if (error && !isSchemaError(error.message)) {
    console.warn("[syncConversationMembership]", error.message)
  }
}

/** Insert members — tries with user_id, falls back if the column is absent. */
export async function insertConversationMembers(
  supabase: SupabaseClient,
  rows: { conversation_id: string; member_name: string; user_id?: string | null; is_admin?: boolean }[],
): Promise<boolean> {
  if (rows.length === 0) return true

  const withUid = rows.map((r) => ({
    conversation_id: r.conversation_id,
    member_name: r.member_name,
    is_admin: r.is_admin ?? false,
    ...(r.user_id ? { user_id: r.user_id } : {}),
  }))

  const primary = await supabase.from("conversation_members").insert(withUid)
  if (!primary.error) return true

  if (!isSchemaError(primary.error.message) && !/user_id/i.test(primary.error.message)) {
    console.error("[insertConversationMembers]", primary.error.message)
    return false
  }

  const legacy = rows.map((r) => ({
    conversation_id: r.conversation_id,
    member_name: r.member_name,
    is_admin: r.is_admin ?? false,
  }))
  const fallback = await supabase.from("conversation_members").insert(legacy)
  if (fallback.error) {
    console.error("[insertConversationMembers] legacy:", fallback.error.message)
    return false
  }
  return true
}
