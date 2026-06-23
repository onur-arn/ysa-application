export const dynamic = 'force-dynamic'

import { createClient } from "@/lib/supabase/server"
import { DirectoryClient } from "./directory-client"

export default async function AnnuairePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, allProfilesRes] = await Promise.all([
    user
      ? supabase.from("profiles").select("id,station").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id,name,initials,station,role,phone,email,birthday,linkedin,memleket,photo_url,igem_egitimi"),
  ])

  return (
    <DirectoryClient
      initialCurrentUserId={user?.id ?? ""}
      initialCurrentUserStation={(profileRes.data?.station as string) ?? "paris"}
      initialProfiles={(allProfilesRes.data ?? []) as Record<string, unknown>[]}
    />
  )
}
