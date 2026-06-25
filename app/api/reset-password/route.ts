import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const { email, birthday, password } = await request.json()

  if (!email || !birthday) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check if email exists in profiles
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id, birthday")
    .eq("email", email.trim().toLowerCase())
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: "mail non connu" }, { status: 404 })
  }

  // Check birthday
  if (!profile.birthday || profile.birthday !== birthday) {
    return NextResponse.json({ error: "Date de naissance incorrecte." }, { status: 400 })
  }

  // Identity verified — if no password, just return success (step 1)
  if (!password) {
    return NextResponse.json({ success: true })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Şifre en az 6 karakter olmalı." }, { status: 400 })
  }

  // Update password via admin
  const { error: updateErr } = await admin.auth.admin.updateUserById(profile.id, { password })

  if (updateErr) {
    return NextResponse.json({ error: "Şifre güncellenemedi. Lütfen tekrar deneyin." }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
