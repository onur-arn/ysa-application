import { ROLES } from "@/lib/data/stations"
import { createAdminClient } from "@/lib/supabase/admin"

/** Board roles that can only be held by one person per station */
export async function getOccupiedRoles(station: string): Promise<string[]> {
  const all = await getOccupiedRolesByStation()
  return all[station] ?? []
}

/** Occupied board roles grouped by station — one DB round-trip for signup UI */
export async function getOccupiedRolesByStation(): Promise<Record<string, string[]>> {
  const admin = createAdminClient()
  const roleSet = new Set<string>(ROLES as unknown as string[])

  const [profilesRes, pendingRes] = await Promise.all([
    admin.from("profiles").select("role, station"),
    admin.from("pending_members").select("role, station"),
  ])

  const byStation: Record<string, Set<string>> = {}

  for (const row of [...(profilesRes.data ?? []), ...(pendingRes.data ?? [])]) {
    const role = row.role as string | null
    const st = row.station as string | null
    if (!st || !role || !roleSet.has(role)) continue
    if (!byStation[st]) byStation[st] = new Set()
    byStation[st].add(role)
  }

  const result: Record<string, string[]> = {}
  for (const [st, roles] of Object.entries(byStation)) {
    result[st] = [...roles]
  }
  return result
}

export async function isRoleAvailable(
  role: string,
  station: string,
  excludePendingId?: string,
): Promise<boolean> {
  if (!(ROLES as readonly string[]).includes(role)) return true
  if (!station) return false

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("role", role)
    .eq("station", station)
    .maybeSingle()
  if (profile) return false

  const { data: pendingList } = await admin
    .from("pending_members")
    .select("id")
    .eq("role", role)
    .eq("station", station)

  const conflicting = (pendingList ?? []).filter((p) => p.id !== excludePendingId)
  return conflicting.length === 0
}
