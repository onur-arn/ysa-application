import { createClient } from "@/lib/supabase/client"
import type { StationId } from "@/lib/data/stations"

export type DmMember = {
  name: string
  initials: string
  station: StationId | string
}

/** Find an existing DM with `member`, or create one. Returns conversation id. */
export async function findOrCreateDM(
  currentUserName: string,
  member: DmMember,
): Promise<string | null> {
  if (!currentUserName || !member.name || currentUserName === member.name) return null

  const supabase = createClient()

  const { data: myMemberships } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("member_name", currentUserName)

  const convIds = (myMemberships ?? []).map((m) => m.conversation_id as string)

  if (convIds.length > 0) {
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, type, conversation_members(member_name)")
      .in("id", convIds)
      .eq("type", "dm")

    for (const conv of convs ?? []) {
      const names = ((conv.conversation_members as { member_name: string }[]) ?? []).map((m) => m.member_name)
      if (names.includes(member.name) && names.includes(currentUserName)) {
        return conv.id as string
      }
    }
  }

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ type: "dm", name: member.name, initials: member.initials })
    .select("id")
    .single()

  if (error || !conv) {
    console.error("[findOrCreateDM]", error?.message)
    return null
  }

  await supabase.from("conversation_members").insert([
    { conversation_id: conv.id, member_name: currentUserName },
    { conversation_id: conv.id, member_name: member.name },
  ])

  return conv.id as string
}
