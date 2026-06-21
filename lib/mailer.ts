import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendMail({
  from,
  to,
  subject,
  html,
}: {
  from: string
  to: string
  subject: string
  html: string
}) {
  const { error } = await resend.emails.send({ from, to, subject, html })
  if (error) throw new Error(error.message)
}

export const MAIL_FROM = process.env.RESEND_FROM ?? "YSA <noreply@youthstation.org>"
export const ADMIN_TO  = process.env.ADMIN_EMAIL ?? "secretaire@youthstation.org"
