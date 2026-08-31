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
  }

  const myConvIds = (myMemberships ?? []).map((m) => m.conversation_id as string)

  if (!memErr && myConvIds.length > 0) {
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
        const { data: shared, error: sharedErr } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("member_name", them)
          .in("conversation_id", dmIds)
          .limit(1)
          .maybeSingle()

        if (sharedErr) {
          console.error("[findOrCreateDM] shared lookup:", sharedErr.message)
        } else if (shared?.conversation_id) {
          return shared.conversation_id as string
        }
      }
    }
  }

  const initials =
    member.initials?.trim() ||
    them.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() ||
    "?"

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
