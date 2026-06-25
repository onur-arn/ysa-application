import { createAdminClient } from "@/lib/supabase/admin"
import { sendMail } from "@/lib/mailer"
import { signature } from "@/lib/email-signature"
import { NextRequest, NextResponse } from "next/server"

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: NextRequest) {
  const { email, appUrl } = await request.json()

  if (!email) {
    return NextResponse.json({ error: "Email requis." }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from("profiles")
    .select("id, name")
    .eq("email", email.trim().toLowerCase())
    .single()

  if (profile) {
    const code      = generateCode()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    await admin.from("password_reset_tokens").upsert({
      email: email.trim().toLowerCase(),
      code,
      expires_at: expiresAt,
    })

    const resetUrl = `${appUrl}/auth/reset-password?email=${encodeURIComponent(email.trim())}&code=${code}`

    await sendMail({
      to: email.trim(),
      subject: "YouthStation — Şifre sıfırlama kodunuz",
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
          <h2 style="color:#111827;font-size:20px;margin:0 0 16px">Şifre Sıfırlama</h2>
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">
            Merhaba${profile.name ? ` ${profile.name}` : ""},<br><br>
            YouthStation uygulaması için şifre sıfırlama talebinde bulundunuz.
          </p>

          <p style="color:#374151;font-size:14px;margin:0 0 8px">Doğrulama kodunuz :</p>
          <div style="display:inline-block;background:#f3f4f6;border:2px dashed #d1d5db;border-radius:12px;padding:16px 32px;margin-bottom:24px">
            <span style="font-size:32px;font-weight:700;letter-spacing:0.2em;color:#111827;font-family:monospace">
              ${code}
            </span>
          </div>

          <p style="color:#6b7280;font-size:13px;margin:0 0 24px">
            Ce code est valable <strong>15 minutes</strong>.
          </p>

          <a href="${resetUrl}"
             style="display:inline-block;background:#3B62E8;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:600;font-size:15px;margin-bottom:24px">
            Şifremi sıfırla →
          </a>

          <p style="color:#6b7280;font-size:13px;margin:16px 0 0">
            Lien alternatif (cliquez le bouton ci-dessus ou copiez-collez) :<br>
            <span style="color:#3B62E8">${resetUrl}</span>
          </p>
          <p style="color:#9ca3af;font-size:12px;margin:12px 0 0">
            Bu talebi siz yapmadıysanız, bu e-postayı dikkate almayınız.
          </p>
          ${signature(appUrl)}
        </div>
      `,
    }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
