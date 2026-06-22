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
  let role = ""
  let igemEgitimi = ""
  let igemTarihi = ""

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (url && key) {
    try {
      const { createClient } = await import("@/lib/supabase/server")
      const { createAdminClient } = await import("@/lib/supabase/admin")
      const { redirect } = await import("next/navigation")
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        redirect("/auth/login")
        return
      }

      let { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      // Auto-create profile if missing (account created outside approval flow)
      if (!profile) {
        const admin = createAdminClient()
        const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ""
        const raw = user.user_metadata?.full_name ?? ""
        const name = raw ? raw.split(" ").map(cap).join(" ") : ""
        const initials = name.trim().split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?"
        await admin.from("profiles").insert({
          id: user.id,
          name,
          email: user.email ?? "",
          station: "paris",
          role: "Üye",
          initials,
        })
        profile = { id: user.id, name, email: user.email ?? "", station: "paris", role: "Üye", initials, phone: null, birthday: null, linkedin: null, memleket: null, photo_url: null, igem_egitimi: null, igem_tarihi: null, initial_password: null }
      }

      email = user.email ?? ""
      fullName = profile?.name ?? ""
      stationId = profile?.station ?? "paris"
      phone = profile?.phone ?? ""
      birthday = profile?.birthday ?? ""
      linkedin = profile?.linkedin ?? ""
      memleket = profile?.memleket ?? ""
      photoUrl = profile?.photo_url ?? null
      role = profile?.role ?? ""
      igemEgitimi = profile?.igem_egitimi ?? ""
      igemTarihi = profile?.igem_tarihi ?? ""
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
      role={role}
      igemEgitimi={igemEgitimi}
      igemTarihi={igemTarihi}
    />
  )
}
