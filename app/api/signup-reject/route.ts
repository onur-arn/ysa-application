import { NextRequest, NextResponse } from "next/server"
import { sendMail } from "@/lib/mailer"
import { createAdminClient } from "@/lib/supabase/admin"
import { createHmac } from "crypto"

const SUPABASE_ENABLED = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const TOKEN_SECRET = process.env.SIGNUP_TOKEN_SECRET
if (!TOKEN_SECRET) throw new Error("SIGNUP_TOKEN_SECRET manquant dans les variables d'environnement")

function verifyToken(token: string): Record<string, unknown> | null {
  const dot = token.lastIndexOf(".")
  if (dot < 0) return null
  const data = token.slice(0, dot)
  const sig  = token.slice(dot + 1)
  const expected = createHmac("sha256", TOKEN_SECRET).update(data).digest("base64url")
  if (expected !== sig) return null
  try { return JSON.parse(Buffer.from(data, "base64url").toString()) } catch { return null }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (!token) return new NextResponse("Token manquant", { status: 400 })

  const parsed = verifyToken(token)
  if (!parsed) return new NextResponse("Token invalide", { status: 400 })

  let pendingId: string | null = (parsed.pendingId as string) ?? null
  let email = ""
  let firstName = ""
  let lastName = ""

  if (SUPABASE_ENABLED) {
    try {
      const admin = createAdminClient()

      // Get pending record for full name before deleting
      if (pendingId) {
        const { data: pending } = await admin.from("pending_members").select("photo_url,email,first_name,last_name").eq("id", pendingId).single()

        // Remove pending photo from storage
        if (pending?.photo_url) {
          const path = pending.photo_url.split("/avatars/").pop()
          if (path) await admin.storage.from("avatars").remove([path])
        }

        if (pending) {
          email     = pending.email || email
          firstName = pending.first_name || firstName
          lastName  = pending.last_name || lastName
        }

        await admin.from("pending_members").delete().eq("id", pendingId)
      }
    } catch (err) {
      console.error("[signup-reject] Supabase error:", err)
    }
  }

  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ""
  const fullName = `${cap(firstName)} ${cap(lastName)}`

  // Notify the user of rejection
  if (email) {
    try {
      await sendMail({
        to: email,
        subject: "YSA Uygulaması — Üyelik talebiniz hakkında",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
            <div style="background:#6b7280;padding:20px 24px">
              <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">Üyelik talebi</h1>
            </div>
            <div style="padding:24px">
              <p style="font-size:14px;color:#374151">Merhaba${fullName ? ` <strong>${fullName}</strong>` : ""},</p>
              <p style="font-size:14px;color:#374151">Üyelik talebiniz şu an için onaylanamamıştır. Daha fazla bilgi için dernek yönetimiyle iletişime geçebilirsiniz.</p>
              <p style="font-size:13px;color:#9ca3af;margin-top:24px">Youth Station Derneği</p>
            </div>
          </div>
        `,
      })
    } catch (err) {
      console.error("[signup-reject] Rejection email failed:", err)
    }
  }

  return new NextResponse(
    page(`La demande de <strong>${fullName || email}</strong> a été refusée. Un e-mail de notification lui a été envoyé.`),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  )
}

function page(message: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb">
    <div style="text-align:center;padding:40px;background:#fff;border-radius:16px;border:1px solid #e5e7eb;max-width:420px;width:90%">
      <div style="font-size:52px;color:#6b7280">&#10007;</div>
      <p style="font-size:15px;color:#374151;margin-top:16px;line-height:1.6">${message}</p>
    </div>
  </body></html>`
}
