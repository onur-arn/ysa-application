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

  const colsList = [MSG_COLS_RICH, MSG_COLS_MIN]
  let cols = colsList[0]

  // One latest message per conversation (parallel) — reliable sort by recency
  async function fetchOne(id: string, select: string) {
    const { data, error } = await supabase
      .from("chat_messages")
      .select(select)
      .eq("conversation_id", id)
      .eq("is_system", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      if (isSchemaError(error.message)) return "schema" as const
      console.error("[conversations] messages:", error.message)
      return "error" as const
    }
    if (data) map.set(id, data as unknown as Record<string, unknown>)
    return "ok" as const
  }

  for (const select of colsList) {
    cols = select
    const results = await Promise.all(convIds.map((id) => fetchOne(id, select)))
    if (results.some((r) => r === "schema")) {
      map.clear()
      continue
    }
    break
  }

  // Fallback for conversations with only system messages
  const missing = convIds.filter((id) => !map.has(id))
  if (missing.length > 0) {
    await Promise.all(missing.map(async (id) => {
      const { data } = await supabase
        .from("chat_messages")
        .select(cols)
        .eq("conversation_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) map.set(id, data as unknown as Record<string, unknown>)
    }))
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

/** Insert members — prefer schema without user_id (prod may not have the column yet).
 *  Inserts self-row first when possible so RLS membership checks succeed for the rest. */
export async function insertConversationMembers(
  supabase: SupabaseClient,
  rows: { conversation_id: string; member_name: string; user_id?: string | null; is_admin?: boolean }[],
): Promise<boolean> {
  if (rows.length === 0) return true

  const { data: { user } } = await supabase.auth.getUser()
  const myId = user?.id
  const ordered = [...rows].sort((a, b) => {
    const aMine = myId && a.user_id === myId ? 0 : 1
    const bMine = myId && b.user_id === myId ? 0 : 1
    return aMine - bMine
  })

  for (const r of ordered) {
    const legacy = {
      conversation_id: r.conversation_id,
      member_name: r.member_name,
      is_admin: r.is_admin ?? false,
    }
    let { error } = await supabase.from("conversation_members").insert(legacy)
    if (error) {
      const withUid = {
        ...legacy,
        user_id: r.user_id ?? null,
      }
      const retry = await supabase.from("conversation_members").insert(withUid)
      if (retry.error) {
        // Ignore duplicate (already member)
        if (!/duplicate|unique/i.test(retry.error.message) && !/duplicate|unique/i.test(error.message)) {
          console.error("[insertConversationMembers]", error.message, retry.error?.message)
          return false
        }
      }
    }
  }
  return true
}
