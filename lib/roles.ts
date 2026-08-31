import { ROLES } from "@/lib/data/stations"
import { createAdminClient } from "@/lib/supabase/admin"

/** Board roles that can only be held by one person at a time */
export async function getOccupiedRoles(): Promise<string[]> {
  const admin = createAdminClient()
  const roleSet = new Set<string>(ROLES as unknown as string[])

  const [profilesRes, pendingRes] = await Promise.all([
    admin.from("profiles").select("role"),
    admin.from("pending_members").select("role"),
  ])

  const occupied = new Set<string>()
  for (const row of [...(profilesRes.data ?? []), ...(pendingRes.data ?? [])]) {
    const role = row.role as string | null
    if (role && roleSet.has(role)) occupied.add(role)
  }
  return [...occupied]
}

export async function isRoleAvailable(role: string, excludePendingId?: string): Promise<boolean> {
  if (!(ROLES as readonly string[]).includes(role)) return true

  const admin = createAdminClient()
  const { data: profile } = await admin.from("profiles").select("id").eq("role", role).maybeSingle()
  if (profile) return false

  const { data: pendingList } = await admin.from("pending_members").select("id").eq("role", role)
  const conflicting = (pendingList ?? []).filter((p) => p.id !== excludePendingId)
  return conflicting.length === 0
}
