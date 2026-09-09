/**
 * Transactional email helper.
 * Prefer Brevo (verified youthstation.org), then Resend.
 */

export const ADMIN_TO = process.env.ADMIN_EMAIL || "secretaire@youthstation.org"

function resolveResendApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim()
  if (key) return key
  // Misconfigured deploy: API key was stored in RESEND_FROM
  const from = process.env.RESEND_FROM?.trim()
  if (from?.startsWith("re_")) return from
  return null
}

function resolveFromEmail(): { email: string; name: string } {
  const candidates = [
    process.env.BREVO_FROM_EMAIL,
    process.env.SENDGRID_FROM_EMAIL,
    process.env.RESEND_FROM,
    "secretaire@youthstation.org",
  ]
  for (const raw of candidates) {
    const v = raw?.trim()
    if (!v || v.startsWith("re_")) continue
    const email = v.includes("<") ? (v.match(/<([^>]+)>/)?.[1] ?? v) : v
    if (email.includes("@")) {
      return { email, name: "Youth Station Derneği Uygulaması" }
    }
  }
  return { email: "secretaire@youthstation.org", name: "Youth Station Derneği Uygulaması" }
}

async function sendViaBrevo(to: string, subject: string, html: string) {
  const apiKey = process.env.BREVO_API_KEY?.trim()
  if (!apiKey) throw new Error("BREVO_API_KEY manquant")

  const from = resolveFromEmail()
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: from.name, email: from.email },
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

async function sendViaResend(to: string, subject: string, html: string) {
  const apiKey = resolveResendApiKey()
  if (!apiKey) throw new Error("RESEND_API_KEY manquant")

  const from = resolveFromEmail()
  const fromHeader =
    from.email.endsWith("@resend.dev")
      ? `Youth Station Derneği Uygulaması <onboarding@resend.dev>`
      : `${from.name} <${from.email}>`

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromHeader,
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

export async function sendMail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const errors: string[] = []

  if (process.env.BREVO_API_KEY?.trim()) {
    try {
      await sendViaBrevo(to, subject, html)
      return
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  if (resolveResendApiKey()) {
    try {
      await sendViaResend(to, subject, html)
      return
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  throw new Error(
    errors.length > 0
      ? `Envoi email impossible: ${errors.join(" | ")}`
      : "Aucun fournisseur email configuré (BREVO_API_KEY / RESEND_API_KEY)",
  )
}

export const MAIL_FROM = resolveFromEmail().email
