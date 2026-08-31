import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import type { StationId } from "@/lib/data/stations"
import { insertConversationMembers } from "@/lib/queries/conversations"

export type DmParticipant = {
  id: string
  name: string
  initials: string
  station?: StationId | string
}

/** @deprecated use DmParticipant */
export type DmMember = DmParticipant

async function findExistingSharedDmId(
  supabase: SupabaseClient,
  myConvIds: string[],
  targetId: string,
  themName: string,
): Promise<string | null> {
  if (myConvIds.length === 0) return null

  const { data: dmConvs, error: dmErr } = await supabase
    .from("conversations")
    .select("id,created_at")
    .in("id", myConvIds)
    .eq("type", "dm")
    .order("created_at", { ascending: true })

  if (dmErr || !dmConvs?.length) {
    if (dmErr) console.error("[findOrCreateDM] dm convs:", dmErr.message)
    return null
  }

  const dmIds = dmConvs.map((c) => c.id as string)

  const [{ data: byId }, { data: byName }] = await Promise.all([
    targetId
      ? supabase
          .from("conversation_members")
          .select("conversation_id")
          .in("conversation_id", dmIds)
          .eq("user_id", targetId)
      : Promise.resolve({ data: null as { conversation_id: string }[] | null }),
    supabase
      .from("conversation_members")
      .select("conversation_id")
      .in("conversation_id", dmIds)
      .eq("member_name", themName),
  ])

  const shared = new Set([
    ...(byId ?? []).map((r) => r.conversation_id as string),
    ...(byName ?? []).map((r) => r.conversation_id as string),
  ])

  for (const c of dmConvs) {
    if (shared.has(c.id as string)) return c.id as string
  }
  return null
}

async function membershipConvIds(
  supabase: SupabaseClient,
  userId: string,
  userName: string,
): Promise<string[]> {
  const [{ data: byUserId }, { data: byName }] = await Promise.all([
    userId
      ? supabase.from("conversation_members").select("conversation_id").eq("user_id", userId)
      : Promise.resolve({ data: null as { conversation_id: string }[] | null }),
    userName
      ? supabase.from("conversation_members").select("conversation_id").eq("member_name", userName)
      : Promise.resolve({ data: [] as { conversation_id: string }[] }),
  ])
  return [...new Set([
    ...(byUserId ?? []).map((m) => m.conversation_id as string),
    ...(byName ?? []).map((m) => m.conversation_id as string),
  ])]
}

/** Find an existing DM with `target`, or create one. Returns conversation id. */
export async function findOrCreateDM(
  supabase: SupabaseClient,
  current: DmParticipant,
  target: DmParticipant,
): Promise<string | null> {
  const meName = current.name.trim()
  const themName = target.name.trim()
  if (!current.id || !target.id || current.id === target.id) return null
  if (!meName || !themName) return null

  const myConvIds = await membershipConvIds(supabase, current.id, meName)

  const existing = await findExistingSharedDmId(supabase, myConvIds, target.id, themName)
  if (existing) return existing

  const initials =
    target.initials?.trim() ||
    themName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() ||
    "?"

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ type: "dm", name: themName, initials })
    .select("id")
    .single()

  if (error || !conv) {
    console.error("[findOrCreateDM] insert:", error?.message)
    const retryIds = await membershipConvIds(supabase, current.id, meName)
    return findExistingSharedDmId(supabase, retryIds, target.id, themName)
  }

  const membersOk = await insertConversationMembers(supabase, [
    { conversation_id: conv.id, member_name: meName, user_id: current.id },
    { conversation_id: conv.id, member_name: themName, user_id: target.id },
  ])

  if (!membersOk) {
    await supabase.from("conversations").delete().eq("id", conv.id)
    const retryIds = await membershipConvIds(supabase, current.id, meName)
    return findExistingSharedDmId(supabase, retryIds, target.id, themName)
  }

  const afterIds = [...new Set([...myConvIds, conv.id as string])]
  const winner = await findExistingSharedDmId(supabase, afterIds, target.id, themName)
  if (winner && winner !== conv.id) {
    const { count } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conv.id)
    if (!count) {
      await supabase.from("conversations").delete().eq("id", conv.id)
    }
    return winner
  }

  return conv.id as string
}

/** Open or create a DM via server API (admin client, most reliable). */
export async function openDMViaApi(targetUserId: string): Promise<string | null> {
  const res = await fetch("/api/dm/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.convId) {
    console.error("[openDMViaApi]", data.error ?? res.status)
    return null
  }
  return data.convId as string
}

/** Browser convenience wrapper */
export async function findOrCreateDMFromBrowser(
  current: DmParticipant,
  target: DmParticipant,
): Promise<string | null> {
  return findOrCreateDM(createClient(), current, target)
}
