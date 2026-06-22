export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey) throw new Error("SENDGRID_API_KEY manquant")

  const from = process.env.SENDGRID_FROM_EMAIL ?? "secretaire@youthstation.org"

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from, name: "Youth Station Derneği Uygulaması" },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`SendGrid ${res.status}: ${text}`)
  }
}

export const MAIL_FROM = process.env.SENDGRID_FROM_EMAIL ?? "secretaire@youthstation.org"
export const ADMIN_TO  = process.env.ADMIN_EMAIL ?? "secretaire@youthstation.org"
