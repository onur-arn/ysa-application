export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const apiKey  = process.env.BREVO_API_KEY
  const from    = process.env.BREVO_FROM_EMAIL ?? "secretaire@youthstation.org"

  if (!apiKey) throw new Error("BREVO_API_KEY manquant")

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Youth Station Derneği", email: from },
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

export const MAIL_FROM = process.env.BREVO_FROM_EMAIL ?? "secretaire@youthstation.org"
export const ADMIN_TO  = process.env.ADMIN_EMAIL ?? "secretaire@youthstation.org"
