import { NextResponse } from "next/server"
import { sendMail, ADMIN_TO } from "@/lib/mailer"

export async function GET() {
  try {
    await sendMail({
      to: ADMIN_TO,
      subject: "[YSA] Test email depuis Next.js",
      html: `<p>Email de test YouthStation. Destinataire: ${ADMIN_TO}</p>`,
    })
    return NextResponse.json({ ok: true, to: ADMIN_TO })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message, to: ADMIN_TO })
  }
}
