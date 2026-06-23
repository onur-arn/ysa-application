import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) {
    console.error("[profile-update] no session:", authErr)
    return NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 })
  }

  const body = await req.json()

  // Password update
  if (body.password) {
    const { error: pwErr } = await supabase.auth.updateUser({ password: body.password })
    if (pwErr) {
      console.error("[profile-update] password:", pwErr)
      return NextResponse.json({ error: `Şifre güncellenemedi: ${pwErr.message}` }, { status: 400 })
    }
  }

  const name: string = body.name ?? ""
  const newInitials = name.trim().split(" ").filter(Boolean).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()

  const { error } = await supabase.from("profiles").update({
    name,
    phone: body.phone || null,
    birthday: body.birthday || null,
    linkedin: body.linkedin || null,
    memleket: body.memleket || null,
    photo_url: body.photoUrl || null,
    station: body.station || "paris",
    initials: newInitials,
    role: body.role || null,
    igem_egitimi: body.igemEgitimi || null,
    igem_tarihi: body.igemTarihi || null,
  }).eq("id", user.id)

  if (error) {
    console.error("[profile-update] update error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
