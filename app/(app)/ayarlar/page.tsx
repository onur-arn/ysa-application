import { SettingsClient } from "./settings-client"

export default async function SettingsPage() {
  let email = ""
  let fullName = ""
  let stationId = "paris"
  let phone = ""
  let birthday = ""
  let linkedin = ""
  let memleket = ""
  let photoUrl: string | null = null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (url && key) {
    try {
      const { createClient } = await import("@/lib/supabase/server")
      const { redirect } = await import("next/navigation")
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        redirect("/auth/login")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      email = user.email ?? ""
      fullName = profile?.full_name ?? ""
      stationId = profile?.station ?? "paris"
      phone = profile?.phone ?? ""
      birthday = profile?.birthday ?? ""
      linkedin = profile?.linkedin ?? ""
      memleket = profile?.memleket ?? ""
      photoUrl = profile?.photo_url ?? null
    } catch {
      // Supabase not configured — show settings with empty profile
    }
  }

  return (
    <SettingsClient
      email={email}
      fullName={fullName}
      station={stationId}
      phone={phone}
      birthday={birthday}
      linkedin={linkedin}
      memleket={memleket}
      photoUrl={photoUrl}
    />
  )
}
