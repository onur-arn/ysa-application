export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
  const from         = process.env.GMAIL_USER

  if (!clientId || !clientSecret || !refreshToken || !from) {
    throw new Error("Variables Gmail OAuth2 manquantes (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GMAIL_USER)")
  }

  // 1. Obtenir un access token depuis le refresh token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) throw new Error(`OAuth2 token error: ${JSON.stringify(tokenData)}`)

  // 2. Construire l'email brut (RFC 2822)
  const mime = [
    `From: "Youth Station Derneği Uygulaması" <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    html,
  ].join("\r\n")

  const raw = Buffer.from(mime)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  // 3. Envoyer via Gmail API (HTTPS)
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Gmail API ${res.status}: ${text}`)
  }
}

export const MAIL_FROM = process.env.GMAIL_USER ?? "secretaire@youthstation.org"
export const ADMIN_TO  = process.env.ADMIN_EMAIL ?? "secretaire@youthstation.org"
