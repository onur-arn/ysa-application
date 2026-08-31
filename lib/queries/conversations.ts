import type { SupabaseClient } from "@supabase/supabase-js"

const CONV_BASE =
  "id,type,name,initials,admin_name,created_at,conversation_members(member_name,is_admin)"
const CONV_WITH_UID =
  "id,type,name,initials,admin_name,created_at,conversation_members(member_name,is_admin,user_id)"
const CONV_WITH_AVATAR =
  "id,type,name,initials,admin_name,avatar_url,created_at,conversation_members(member_name,is_admin)"
const CONV_WITH_AVATAR_UID =
  "id,type,name,initials,admin_name,avatar_url,created_at,conversation_members(member_name,is_admin,user_id)"

const MSG_COLS_RICH =
  "id,conversation_id,sender_name,sender_initials,text,image_url,gif_url,message_type,is_system,created_at"
const MSG_COLS_MIN =
  "id,conversation_id,sender_name,sender_initials,text,image_url,is_system,created_at"

function isSchemaError(message?: string) {
  return !!message && /user_id|audio_url|gif_url|avatar_url|message_type|schema cache|42703|PGRST/i.test(message)
}

async function membershipIds(
  supabase: SupabaseClient,
  userId: string,
  userName: string,
): Promise<string[]> {
  const trimmedName = userName.trim()
  const ids = new Set<string>()

  // Name-based lookup is the reliable path (user_id column may be missing)
  if (trimmedName) {
    const byName = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("member_name", trimmedName)
    for (const r of byName.data ?? []) ids.add(r.conversation_id as string)
  }

  if (userId) {
    const byUid = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", userId)
    if (!byUid.error) {
      for (const r of byUid.data ?? []) ids.add(r.conversation_id as string)
    }
  }

  return [...ids]
}

async function latestMessageByConv(
  supabase: SupabaseClient,
  convIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>()
  if (convIds.length === 0) return map

  for (const cols of [MSG_COLS_RICH, MSG_COLS_MIN]) {
    const { data, error } = await supabase
      .from("chat_messages")
      .select(cols)
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false })
      .limit(Math.min(convIds.length * 3, 200))

    if (error) {
      if (isSchemaError(error.message)) continue
      console.error("[conversations] messages:", error.message)
      break
    }

    for (const row of data ?? []) {
      const cid = (row as { conversation_id: string }).conversation_id
      if (!map.has(cid)) map.set(cid, row as unknown as Record<string, unknown>)
    }
    break
  }

  return map
}

/** Load conversations for a user. Safe without user_id / audio_url columns. */
export async function fetchUserConversationRows(
  supabase: SupabaseClient,
  userId: string,
  userName: string,
): Promise<Record<string, unknown>[]> {
  const convIds = await membershipIds(supabase, userId, userName)
  if (convIds.length === 0) {
    console.warn("[conversations] no memberships for", userName || userId)
    return []
  }

  const chunks: string[][] = []
  for (let i = 0; i < convIds.length; i += 40) {
    chunks.push(convIds.slice(i, i + 40))
  }

  const all: Record<string, unknown>[] = []

  for (const chunk of chunks) {
    let rows: Record<string, unknown>[] | null = null
    let lastErr: string | undefined

    for (const select of [CONV_WITH_AVATAR_UID, CONV_WITH_AVATAR, CONV_WITH_UID, CONV_BASE]) {
      const res = await supabase.from("conversations").select(select).in("id", chunk)
      if (!res.error && res.data) {
        rows = res.data as Record<string, unknown>[]
        break
      }
      lastErr = res.error?.message
      if (res.error && isSchemaError(res.error.message)) continue
      break
    }

    if (!rows) {
      console.error("[conversations] load failed:", lastErr)
      continue
    }

    const latest = await latestMessageByConv(supabase, chunk)
    for (const conv of rows) {
      const id = conv.id as string
      const msg = latest.get(id)
      all.push({
        ...conv,
        chat_messages: msg ? [msg] : [],
      })
    }
  }

  return all
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

/** Insert members — prefer schema without user_id (prod may not have the column yet). */
export async function insertConversationMembers(
  supabase: SupabaseClient,
  rows: { conversation_id: string; member_name: string; user_id?: string | null; is_admin?: boolean }[],
): Promise<boolean> {
  if (rows.length === 0) return true

  const legacy = rows.map((r) => ({
    conversation_id: r.conversation_id,
    member_name: r.member_name,
    is_admin: r.is_admin ?? false,
  }))

  const legacyRes = await supabase.from("conversation_members").insert(legacy)
  if (!legacyRes.error) return true

  const withUid = rows.map((r) => ({
    conversation_id: r.conversation_id,
    member_name: r.member_name,
    is_admin: r.is_admin ?? false,
    user_id: r.user_id ?? null,
  }))
  const uidRes = await supabase.from("conversation_members").insert(withUid)
  if (!uidRes.error) return true

  console.error("[insertConversationMembers]", legacyRes.error.message, uidRes.error?.message)
  return false
}
