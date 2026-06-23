export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error("RESEND_API_KEY manquant")

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Youth Station Derneği Uygulaması <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Resend ${res.status}: ${text}`)
  }
}

export const MAIL_FROM = "onboarding@resend.dev"
export const ADMIN_TO  = process.env.ADMIN_EMAIL ?? "secretaire@youthstation.org"
