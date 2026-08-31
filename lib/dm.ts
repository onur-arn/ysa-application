import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import type { StationId } from "@/lib/data/stations"

export type DmMember = {
  name: string
  initials: string
  station: StationId | string
}

/** Find an existing DM with `member`, or create one. Returns conversation id. */
export async function findOrCreateDM(
  supabase: SupabaseClient,
  currentUserName: string,
  member: DmMember,
): Promise<string | null> {
  const me = currentUserName.trim()
  const them = member.name.trim()
  if (!me || !them || me === them) return null

  const { data: myMemberships, error: memErr } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("member_name", me)

  if (memErr) {
    console.error("[findOrCreateDM] memberships:", memErr.message)
    return null
  }

  const convIds = (myMemberships ?? []).map((m) => m.conversation_id as string)

  if (convIds.length > 0) {
    const { data: convs, error: convErr } = await supabase
      .from("conversations")
      .select("id, type, conversation_members(member_name)")
      .in("id", convIds)
      .eq("type", "dm")

    if (convErr) {
      console.error("[findOrCreateDM] convs:", convErr.message)
    } else {
      for (const conv of convs ?? []) {
        const names = ((conv.conversation_members as { member_name: string }[]) ?? []).map((m) => m.member_name)
        if (names.includes(them) && names.includes(me)) {
          return conv.id as string
        }
      }
    }
  }

  const initials = member.initials?.trim() || them.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?"

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ type: "dm", name: them, initials })
    .select("id")
    .single()

  if (error || !conv) {
    console.error("[findOrCreateDM] insert:", error?.message)
    return null
  }

  const { error: membersErr } = await supabase.from("conversation_members").insert([
    { conversation_id: conv.id, member_name: me },
    { conversation_id: conv.id, member_name: them },
  ])

  if (membersErr) {
    console.error("[findOrCreateDM] members:", membersErr.message)
    await supabase.from("conversations").delete().eq("id", conv.id)
    return null
  }

  return conv.id as string
}

/** Browser convenience wrapper */
export async function findOrCreateDMFromBrowser(
  currentUserName: string,
  member: DmMember,
): Promise<string | null> {
  return findOrCreateDM(createClient(), currentUserName, member)
}
