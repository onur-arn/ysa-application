import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import type { StationId } from "@/lib/data/stations"

export type DmParticipant = {
  id: string
  name: string
  initials: string
  station?: StationId | string
}

/** @deprecated use DmParticipant */
export type DmMember = DmParticipant

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

  const [{ data: byUserId, error: userIdErr }, { data: byName }] = await Promise.all([
    supabase.from("conversation_members").select("conversation_id").eq("user_id", current.id),
    supabase.from("conversation_members").select("conversation_id").eq("member_name", meName),
  ])

  const myConvIds = [...new Set([
    ...(!userIdErr ? (byUserId ?? []) : []).map((m) => m.conversation_id as string),
    ...(byName ?? []).map((m) => m.conversation_id as string),
  ])]

  if (myConvIds.length > 0) {
    const { data: dmConvs, error: dmErr } = await supabase
      .from("conversations")
      .select("id")
      .in("id", myConvIds)
      .eq("type", "dm")

    if (dmErr) {
      console.error("[findOrCreateDM] dm convs:", dmErr.message)
    } else {
      const dmIds = (dmConvs ?? []).map((c) => c.id as string)
      if (dmIds.length > 0) {
        const [{ data: sharedById, error: idErr }, { data: sharedByName }] = await Promise.all([
          supabase.from("conversation_members").select("conversation_id").in("conversation_id", dmIds).eq("user_id", target.id).limit(1).maybeSingle(),
          supabase.from("conversation_members").select("conversation_id").in("conversation_id", dmIds).eq("member_name", themName).limit(1).maybeSingle(),
        ])
        const sharedId = (!idErr && sharedById?.conversation_id) ?? sharedByName?.conversation_id
        if (sharedId) return sharedId as string
      }
    }
  }

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
    return null
  }

  const { error: membersErr } = await supabase.from("conversation_members").insert([
    { conversation_id: conv.id, member_name: meName, user_id: current.id },
    { conversation_id: conv.id, member_name: themName, user_id: target.id },
  ])

  if (membersErr) {
    const legacy = await supabase.from("conversation_members").insert([
      { conversation_id: conv.id, member_name: meName },
      { conversation_id: conv.id, member_name: themName },
    ])
    if (legacy.error) {
      console.error("[findOrCreateDM] members:", legacy.error.message)
      await supabase.from("conversations").delete().eq("id", conv.id)
      return null
    }
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
