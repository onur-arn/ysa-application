import { NextRequest, NextResponse } from "next/server"
import { sendMail, MAIL_FROM, ADMIN_TO } from "@/lib/mailer"
import { createAdminClient } from "@/lib/supabase/admin"

const SUPABASE_ENABLED = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { firstName, lastName, email, password, phone, birthday, linkedin, role, station, memleket, igemEgitimi, igemTarihi } = body

  // Store in Supabase pending_members if available
  let pendingId: string | null = null
  if (SUPABASE_ENABLED) {
    try {
      const admin = createAdminClient()

      // Only block if already an approved member (profiles) — rejected/pending can re-apply
      const { data: existingProfile } = await admin.from("profiles").select("email").eq("email", email).maybeSingle()
      if (existingProfile) {
        return NextResponse.json({ ok: false, error: "EMAIL_TAKEN" }, { status: 409 })
      }

      const { data, error } = await admin.from("pending_members").upsert({
        first_name: firstName, last_name: lastName, email, password,
        phone, birthday, linkedin, role, station, memleket,
        igem_egitimi: igemEgitimi, igem_tarihi: igemTarihi,
      }, { onConflict: "email" }).select("id").single()
      if (!error && data) pendingId = data.id
    } catch (err) {
      console.error("[signup-request] Supabase insert failed:", err)
      // Supabase failure must NOT block the notification email — fall through
    }
  }

  // Build token — prefer Supabase pending ID, fallback to base64 payload
  const token = pendingId
    ? Buffer.from(JSON.stringify({ pendingId, firstName, lastName, email })).toString("base64url")
    : Buffer.from(JSON.stringify({ firstName, lastName, email })).toString("base64url")

  const base = process.env.NEXT_PUBLIC_APP_URL ?? `${req.nextUrl.protocol}//${req.headers.get("host")}`
  const approveUrl = `${base}/api/signup-approve?token=${token}`
  const rejectUrl  = `${base}/api/signup-reject?token=${token}`

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:7px 14px;color:#6b7280;font-size:13px;white-space:nowrap;border-bottom:1px solid #f3f4f6">${label}</td>
      <td style="padding:7px 14px;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6">${value || "—"}</td>
    </tr>`

  try {
    await sendMail({
      from: MAIL_FROM,
      to: ADMIN_TO,
      subject: `[YSA] Nouvelle demande — ${firstName} ${lastName}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
          <div style="background:#0e7490;padding:20px 24px">
            <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">Nouvelle demande d'inscription YSA</h1>
          </div>
          <div style="padding:24px">
            <table style="border-collapse:collapse;width:100%;background:#f9fafb;border-radius:8px;overflow:hidden">
              ${row("Ad Soyad", `${firstName} ${lastName}`)}
              ${row("E-posta", email)}
              ${row("Telefon", phone)}
              ${row("Doğum tarihi", birthday)}
              ${row("LinkedIn", linkedin ? `<a href="${linkedin}" style="color:#0e7490">${linkedin}</a>` : "—")}
              ${row("Görev", role)}
              ${row("İstasyon", station)}
              ${row("Memleket", memleket)}
              ${row("iGEM Eğitimi", igemEgitimi === "evet" ? `✅ Evet${igemTarihi ? ` — ${igemTarihi}` : ""}` : igemEgitimi === "hayır" ? "❌ Hayır" : "—")}
            </table>
            <div style="margin-top:28px">
              <a href="${approveUrl}" style="display:inline-block;padding:12px 28px;background:#16a34a;color:#fff;font-weight:700;font-size:14px;border-radius:8px;text-decoration:none">✓ Accepter</a>
              <a href="${rejectUrl}"  style="display:inline-block;padding:12px 28px;background:#dc2626;color:#fff;font-weight:700;font-size:14px;border-radius:8px;text-decoration:none;margin-left:12px">✗ Refuser</a>
            </div>
            <p style="margin-top:16px;font-size:11px;color:#9ca3af">Ces liens enverront automatiquement un e-mail de confirmation ou de refus à ${email}.</p>
          </div>
        </div>
      `,
    })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[signup-request] Email send failed:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
