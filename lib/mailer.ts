export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const apiKey    = process.env.MAILJET_API_KEY
  const secretKey = process.env.MAILJET_SECRET_KEY
  if (!apiKey || !secretKey) throw new Error("MAILJET_API_KEY / MAILJET_SECRET_KEY manquants")

  const from = process.env.MAILJET_FROM_EMAIL ?? "secretaire@youthstation.org"

  const res = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Messages: [{
        From: { Email: from, Name: "Youth Station Derneği Uygulaması" },
        To: [{ Email: to }],
        Subject: subject,
        HTMLPart: html,
      }],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Mailjet ${res.status}: ${text}`)
  }
}

export const MAIL_FROM = process.env.MAILJET_FROM_EMAIL ?? "secretaire@youthstation.org"
export const ADMIN_TO  = process.env.ADMIN_EMAIL ?? "secretaire@youthstation.org"
