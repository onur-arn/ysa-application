import { NextResponse } from "next/server"
import { sendMail, ADMIN_TO } from "@/lib/mailer"

export async function GET() {
  if (!process.env.BREVO_API_KEY) {
    return NextResponse.json({ ok: false, error: "BREVO_API_KEY manquant dans les variables d'environnement" })
  }

  try {
    await sendMail({
      to: ADMIN_TO,
      subject: "[YSA] Test email depuis Next.js",
      html: `<p>Email envoyé depuis l'API Next.js via Brevo. To: ${ADMIN_TO}</p>`,
    })
    return NextResponse.json({ ok: true, to: ADMIN_TO })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message, to: ADMIN_TO })
  }
}
