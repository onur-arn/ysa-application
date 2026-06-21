import { NextResponse } from "next/server"
import { getTransporter } from "@/lib/mailer"

export async function GET() {
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD
  const adminEmail = process.env.ADMIN_EMAIL

  if (!gmailUser || !gmailPass) {
    return NextResponse.json({ ok: false, error: "GMAIL_USER ou GMAIL_APP_PASSWORD manquant dans .env.local" })
  }

  try {
    const transporter = getTransporter()
    const info = await transporter.sendMail({
      from: `"YSA Test" <${gmailUser}>`,
      to: adminEmail ?? gmailUser,
      subject: "[YSA] Test email depuis Next.js",
      text: `Email envoyé depuis l'API Next.js. GMAIL_USER=${gmailUser} ADMIN_EMAIL=${adminEmail}`,
    })
    return NextResponse.json({ ok: true, messageId: info.messageId, from: gmailUser, to: adminEmail ?? gmailUser })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message, from: gmailUser, to: adminEmail ?? gmailUser })
  }
}
