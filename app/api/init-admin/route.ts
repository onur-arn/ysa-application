import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const ADMIN_EMAIL = "admin@youthstation.org"

export async function POST() {
  const admin = createAdminClient()

  // Check if admin already exists
  const { data: existing } = await admin.auth.admin.listUsers()
  const alreadyExists = existing?.users?.some(u => u.email === ADMIN_EMAIL)
  if (alreadyExists) {
    return NextResponse.json({ ok: true, existed: true })
  }

  // Create admin auth account with a temporary password
  const tempPassword = crypto.randomUUID()
  const { data, error } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: tempPassword,
    email_confirm: true,
  })
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 })
  }

  // Create admin profile
  await admin.from("profiles").upsert({
    id: data.user.id,
    name: "Administrateur",
    email: ADMIN_EMAIL,
    station: "intl",
    role: "Admin",
    initials: "AD",
  })

  return NextResponse.json({ ok: true, existed: false, tempPassword })
}
