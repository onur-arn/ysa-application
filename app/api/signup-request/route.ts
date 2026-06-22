import { NextRequest, NextResponse } from "next/server"
import { sendMail, ADMIN_TO } from "@/lib/mailer"
import { createAdminClient } from "@/lib/supabase/admin"

const SUPABASE_ENABLED = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    firstName, lastName, email, password,
    phone, birthday, linkedin, role, station,
    memleket, igemEgitimi, igemTarihi, photoUrl,
  } = body

  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 })
  }

  const admin = createAdminClient()

  // Check email not already registered
  const { data: authList } = await admin.auth.admin.listUsers()
  const emailTaken = authList?.users?.some((u) => u.email === email)
  if (emailTaken) {
    return NextResponse.json({ ok: false, error: "EMAIL_TAKEN" }, { status: 409 })
  }

  // Create auth user immediately
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authErr || !authData?.user) {
    console.error("[signup-request] createUser failed:", authErr)
    return NextResponse.json({ ok: false, error: authErr?.message ?? "Création compte échouée" }, { status: 500 })
  }

  const userId = authData.user.id
  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ""
  const fullName = `${cap(firstName)} ${cap(lastName)}`
  const initials = fullName.trim().split(" ").filter(Boolean).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()

  // Insert profile with all signup data
  const { error: profileErr } = await admin.from("profiles").insert({
    id: userId,
    name: fullName,
    email,
    initial_password: password,
    station: station ?? "paris",
    role: role ?? "Üye",
    phone: phone || null,
    birthday: birthday || null,
    linkedin: linkedin || null,
    memleket: memleket || null,
    photo_url: photoUrl || null,
    igem_egitimi: igemEgitimi || null,
    igem_tarihi: igemTarihi || null,
    initials,
  })
  if (profileErr) {
    console.error("[signup-request] profile insert failed:", profileErr.message)
    // Auth user created but profile failed — log and continue (user can fill profile later)
  }

  // Notify admin (informational only — account already created)
  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:7px 14px;color:#6b7280;font-size:13px;white-space:nowrap;border-bottom:1px solid #f3f4f6">${label}</td>
      <td style="padding:7px 14px;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6">${value || "—"}</td>
    </tr>`

  try {
    await sendMail({
      to: ADMIN_TO,
      subject: `[YSA] Nouveau membre inscrit — ${fullName}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
          <div style="background:#0e7490;padding:20px 24px">
            <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">Nouveau membre YSA inscrit</h1>
          </div>
          <div style="padding:24px">
            <p style="margin:0 0 16px;font-size:14px;color:#374151">Le compte a été créé automatiquement.</p>
            <table style="border-collapse:collapse;width:100%;background:#f9fafb;border-radius:8px;overflow:hidden">
              ${row("Ad Soyad", fullName)}
              ${row("E-posta", email)}
              ${row("Telefon", phone)}
              ${row("Doğum tarihi", birthday)}
              ${row("LinkedIn", linkedin ? `<a href="${linkedin}" style="color:#0e7490">${linkedin}</a>` : "—")}
              ${row("Görev", role)}
              ${row("İstasyon", station)}
              ${row("Memleket", memleket)}
              ${row("iGEM Eğitimi", igemEgitimi === "evet" ? `✅ Evet${igemTarihi ? ` — ${igemTarihi}` : ""}` : igemEgitimi === "hayır" ? "❌ Hayır" : "—")}
            </table>
          </div>
        </div>
      `,
    })
  } catch (err) {
    console.error("[signup-request] email notification failed:", err)
    // Don't fail the signup if email fails
  }

  return NextResponse.json({ ok: true })
}
