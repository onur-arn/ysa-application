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

  // Fallback: Gmail SMTP
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  })
  return transporter.sendMail(options)
}

/**
 * Backwards-compatible wrapper so existing routes can keep calling
 * `getTransporter().sendMail(...)` unchanged.
 */
export function getTransporter() {
  return { sendMail }
}
