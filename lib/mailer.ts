import nodemailer from "nodemailer"
import { Resend } from "resend"

type MailAttachment = { filename: string; content: Buffer | string }

export type MailOptions = {
  from: string
  to: string | string[]
  subject: string
  html?: string
  text?: string
  attachments?: MailAttachment[]
}

const RESEND_API_KEY = process.env.RESEND_API_KEY
const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD

/** True if at least one email provider is configured. */
export function isEmailConfigured() {
  return !!RESEND_API_KEY || !!(GMAIL_USER && GMAIL_APP_PASSWORD)
}

/**
 * Sends an email using Resend when RESEND_API_KEY is set, otherwise falls
 * back to Gmail SMTP. Provider-specific failures throw an Error.
 */
export async function sendMail(options: MailOptions) {
  if (RESEND_API_KEY) {
    const resend = new Resend(RESEND_API_KEY)
    // RESEND_FROM must use a domain verified in Resend (e.g. "YSA <noreply@votredomaine.com>").
    // Until a domain is verified, Resend's shared sender works for testing.
    const from = process.env.RESEND_FROM || options.from
    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text ?? "",
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    })
    if (error) {
      throw new Error(typeof error === "string" ? error : error.message || JSON.stringify(error))
    }
    return data
  }

  // Fallback: Gmail SMTP (port 465 / SSL is the most reliable; 587 is often blocked)
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: GMAIL_USER,
      // Gmail app passwords are shown with spaces ("abcd efgh ijkl mnop") but must be sent without them
      pass: GMAIL_APP_PASSWORD?.replace(/\s/g, ""),
    },
  })

  try {
    return await transporter.sendMail(options)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("BadCredentials") || message.includes("535")) {
      throw new Error(
        "GMAIL_AUTH_REJECTED: Google a refusé les identifiants. Vérifiez que la validation en 2 étapes est activée sur le compte et que GMAIL_APP_PASSWORD est un mot de passe d'application valide (16 caractères).",
      )
    }
    throw err
  }
}

/**
 * Backwards-compatible wrapper so existing routes can keep calling
 * `getTransporter().sendMail(...)` unchanged.
 */
export function getTransporter() {
  return { sendMail }
}
