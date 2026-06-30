
import { createClient } from "@/lib/supabase/server"
import { DirectoryClient } from "./directory-client"

export default async function AnnuairePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, allProfilesRes] = await Promise.all([
    user
      ? supabase.from("profiles").select("id,station,name").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id,name,initials,station,role,phone,email,birthday,linkedin,memleket,photo_url,igem_egitimi"),
  ])

  const ROLE_MANAGERS = ["onur arslan", "feyza simsek", "feyza şimşek"]
  const currentUserName = ((profileRes.data as Record<string, unknown>)?.name as string ?? "").toLowerCase().trim()
  const canChangeRoles = ROLE_MANAGERS.includes(currentUserName)

  return (
    <DirectoryClient
      initialProfiles={(allProfilesRes.data ?? []) as Record<string, unknown>[]}
      canChangeRoles={canChangeRoles}
    />
  )
}
