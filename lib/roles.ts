import { ROLES } from "@/lib/data/stations"
import { createAdminClient } from "@/lib/supabase/admin"

/** Board roles that can only be held by one person per station */
export async function getOccupiedRoles(station: string): Promise<string[]> {
  if (!station) return []

  const admin = createAdminClient()
  const roleSet = new Set<string>(ROLES as unknown as string[])

  const [profilesRes, pendingRes] = await Promise.all([
    admin.from("profiles").select("role, station").eq("station", station),
    admin.from("pending_members").select("role, station").eq("station", station),
  ])

  const occupied = new Set<string>()
  for (const row of [...(profilesRes.data ?? []), ...(pendingRes.data ?? [])]) {
    const role = row.role as string | null
    if (role && roleSet.has(role)) occupied.add(role)
  }
  return [...occupied]
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
