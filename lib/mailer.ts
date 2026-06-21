export async function sendMail({
  from,
  fromName,
  to,
  subject,
  html,
}: {
  from?: string
  fromName?: string
  to: string
  subject: string
  html: string
}) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error("BREVO_API_KEY manquant")

  const senderEmail = from ?? process.env.BREVO_FROM_EMAIL ?? "noreply@youthstation.org"
  const senderName  = fromName ?? "Youth Station Derneği Uygulaması"

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Brevo ${res.status}: ${text}`)
  }
}

export const MAIL_FROM = process.env.BREVO_FROM_EMAIL ?? "noreply@youthstation.org"
export const ADMIN_TO  = process.env.ADMIN_EMAIL ?? "secretaire@youthstation.org"
