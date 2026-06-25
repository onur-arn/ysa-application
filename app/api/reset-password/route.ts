import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const { email, birthday, code, password } = await request.json()

  if (!email || !birthday || !code) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify profile + birthday
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id, birthday")
    .eq("email", email.trim().toLowerCase())
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: "E-posta adresi bulunamadı." }, { status: 404 })
  }

  if (!profile.birthday || profile.birthday !== birthday) {
    return NextResponse.json({ error: "Date de naissance incorrecte." }, { status: 400 })
  }

  // Verify reset code
  const { data: token, error: tokenErr } = await admin
    .from("password_reset_tokens")
    .select("code, expires_at")
    .eq("email", email.trim().toLowerCase())
    .single()

  if (tokenErr || !token) {
    return NextResponse.json({ error: "Code invalide ou expiré." }, { status: 400 })
  }

  if (token.code !== code.trim()) {
    return NextResponse.json({ error: "Code incorrect." }, { status: 400 })
  }

  if (new Date(token.expires_at) < new Date()) {
    await admin.from("password_reset_tokens").delete().eq("email", email.trim().toLowerCase())
    return NextResponse.json({ error: "Code expiré. Veuillez refaire une demande." }, { status: 400 })
  }

  // Identity verified — step 1 only (no password yet)
  if (!password) {
    return NextResponse.json({ success: true })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Şifre en az 6 karakter olmalı." }, { status: 400 })
  }

  // Update password
  const { error: updateErr } = await admin.auth.admin.updateUserById(profile.id, { password })

  if (updateErr) {
    return NextResponse.json({ error: "Şifre güncellenemedi. Lütfen tekrar deneyin." }, { status: 500 })
  }

  // Delete the used token
  await admin.from("password_reset_tokens").delete().eq("email", email.trim().toLowerCase())

  return NextResponse.json({ success: true })
}
