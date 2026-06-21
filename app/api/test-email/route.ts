import { NextResponse } from "next/server"
import { sendMail, MAIL_FROM, ADMIN_TO } from "@/lib/mailer"

export async function GET() {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY manquant dans les variables d'environnement" })
  }

  try {
    await sendMail({
      from: MAIL_FROM,
      to: ADMIN_TO,
      subject: "[YSA] Test email depuis Next.js",
      html: `<p>Email envoyé depuis l'API Next.js via Resend. From: ${MAIL_FROM}, To: ${ADMIN_TO}</p>`,
    })
    return NextResponse.json({ ok: true, from: MAIL_FROM, to: ADMIN_TO })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message, from: MAIL_FROM, to: ADMIN_TO })
  }
}
