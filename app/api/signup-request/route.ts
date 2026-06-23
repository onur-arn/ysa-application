import { NextRequest, NextResponse } from "next/server"
import { sendMail, ADMIN_TO } from "@/lib/mailer"
import { createAdminClient } from "@/lib/supabase/admin"

const SUPABASE_ENABLED = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://youthstation.vercel.app"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    firstName, lastName, email, password,
    phone, birthday, linkedin, role, station,
    memleket, igemEgitimi, igemTarihi, photoBase64, photoExt,
  } = body

  if (!SUPABASE_ENABLED) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 })
  }

  const admin = createAdminClient()

  // Check email not already registered (query profiles table — avoids listUsers() 50-user limit)
  const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle()
  if (existingProfile) {
    return NextResponse.json({ ok: false, error: "EMAIL_TAKEN" }, { status: 409 })
  }

  // Check email not already pending
  const { data: existing } = await admin.from("pending_members").select("id").eq("email", email).maybeSingle()
  if (existing) {
    return NextResponse.json({ ok: false, error: "EMAIL_TAKEN" }, { status: 409 })
  }

  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ""
  const fullName = `${cap(firstName)} ${cap(lastName)}`

  // Insert into pending_members
  const { data: pending, error: insertErr } = await admin.from("pending_members").insert({
    first_name: firstName,
    last_name: lastName,
    email,
    password,
    phone: phone || null,
    birthday: birthday || null,
    linkedin: linkedin || null,
    role: role || "Üye",
    station: station || "paris",
    memleket: memleket || null,
    igem_egitimi: igemEgitimi || null,
    igem_tarihi: igemTarihi || null,
  }).select().single()

  if (insertErr || !pending) {
    console.error("[signup-request] pending insert failed:", insertErr)
    return NextResponse.json({ ok: false, error: "Kayıt oluşturulamadı" }, { status: 500 })
  }

  const pendingId = pending.id

  // Upload photo via admin client
  if (photoBase64 && photoExt) {
    try {
      const buffer = Buffer.from(photoBase64, "base64")
      const path = `pending/${pendingId}.${photoExt}`
      const { error: upErr } = await admin.storage.from("avatars").upload(path, buffer, {
        contentType: `image/${photoExt}`,
        upsert: true,
      })
      if (!upErr) {
        const { data: urlData } = admin.storage.from("avatars").getPublicUrl(path)
        await admin.from("pending_members").update({ photo_url: urlData.publicUrl }).eq("id", pendingId)
      }
    } catch (err) {
      console.error("[signup-request] photo upload error:", err)
    }
  }

  // Build approve / reject tokens
  const token = Buffer.from(JSON.stringify({ pendingId, firstName, lastName, email })).toString("base64url")
  const approveUrl = `${APP_URL}/api/signup-approve?token=${token}`
  const rejectUrl  = `${APP_URL}/api/signup-reject?token=${token}`

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:7px 14px;color:#6b7280;font-size:13px;white-space:nowrap;border-bottom:1px solid #f3f4f6">${label}</td>
      <td style="padding:7px 14px;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6">${value || "—"}</td>
    </tr>`

  try {
    await sendMail({
      to: ADMIN_TO,
      subject: `[YSA] Nouvelle demande d'inscription — ${fullName}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
          <div style="background:#0e7490;padding:20px 24px">
            <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">Nouvelle demande d'inscription YSA</h1>
            <p style="margin:4px 0 0;color:#e0f2fe;font-size:13px">En attente de votre approbation</p>
          </div>
          <div style="padding:24px">
            <table style="border-collapse:collapse;width:100%;background:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:24px">
              ${row("Ad Soyad", fullName)}
              ${row("E-posta", email)}
              ${row("Telefon", phone || "—")}
              ${row("Doğum tarihi", birthday || "—")}
              ${row("LinkedIn", linkedin ? linkedin : "—")}
              ${row("Görev", role || "—")}
              ${row("İstasyon", station || "—")}
              ${row("Memleket", memleket || "—")}
              ${row("iGEM Eğitimi", igemEgitimi === "evet" ? `✅ Evet${igemTarihi ? ` — ${igemTarihi}` : ""}` : igemEgitimi === "hayır" ? "❌ Hayır" : "—")}
            </table>
            <div style="display:flex;gap:12px;justify-content:center">
              <a href="${approveUrl}" style="display:inline-block;padding:12px 32px;background:#16a34a;color:#fff;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none">
                ✅ Kabul et
              </a>
              <a href="${rejectUrl}" style="display:inline-block;padding:12px 32px;background:#dc2626;color:#fff;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none">
                ❌ Reddet
              </a>
            </div>
            <p style="margin-top:20px;font-size:11px;color:#9ca3af;text-align:center">Ces liens sont à usage unique. Le compte ne sera créé qu'après approbation.</p>
          </div>
        </div>
      `,
    })
  } catch (err) {
    console.error("[signup-request] email notification failed:", err)
    // Don't fail the signup if email fails — admin can check pending_members manually
  }

  return NextResponse.json({ ok: true })
}
