import { NextRequest, NextResponse } from "next/server"
import { getTransporter } from "@/lib/mailer"
import { createAdminClient } from "@/lib/supabase/admin"

const SUPABASE_ENABLED = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (!token) return new NextResponse("Token manquant", { status: 400 })

  let firstName = "", lastName = "", email = "", pendingId: string | null = null
  try {
    const parsed = JSON.parse(Buffer.from(token, "base64url").toString())
    firstName = parsed.firstName
    lastName  = parsed.lastName
    email     = parsed.email
    pendingId = parsed.pendingId ?? null
  } catch {
    return new NextResponse("Token invalide", { status: 400 })
  }

  // Delete from pending_members so the person can re-apply later
  if (SUPABASE_ENABLED) {
    try {
      const admin = createAdminClient()
      if (pendingId) {
        await admin.from("pending_members").delete().eq("id", pendingId)
      } else {
        await admin.from("pending_members").delete().eq("email", email)
      }
    } catch (err) {
      console.error("[signup-reject] Supabase delete failed:", err)
    }
  }

  try {
    const transporter = getTransporter()
    await transporter.sendMail({
      from: `"Youth Station Derneği Uygulaması" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Youth Station Derneği Uygulaması – Üyelik başvurunuz hakkında",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <p style="font-size:15px;color:#111827">Merhaba <strong>${firstName} ${lastName}</strong>,</p>
          <p style="font-size:14px;color:#374151;line-height:1.7">
            <strong>Youth Station Derneği Uygulaması</strong>'na üyelik başvurunuzu inceledik. Maalesef şu an için başvurunuzu kabul edemiyoruz.
          </p>
          <p style="font-size:14px;color:#374151;line-height:1.7">
            Herhangi bir sorunuz olursa bizimle iletişime geçebilirsiniz.
          </p>
        </div>
      `,
    })
  } catch (err) {
    console.error("Rejection email failed:", err)
    return new NextResponse(page("E-posta gönderilirken hata oluştu."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }

  return new NextResponse(
    page(`<strong>${firstName} ${lastName}</strong> reddedildi. Bilgilendirme e-postası <strong>${email}</strong> adresine gönderildi.`),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  )
}

function page(message: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
  <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb">
    <div style="text-align:center;padding:40px;background:#fff;border-radius:16px;border:1px solid #e5e7eb;max-width:400px">
      <div style="font-size:48px;color:#6b7280">&#10007;</div>
      <p style="font-size:15px;color:#374151;margin-top:16px">${message}</p>
    </div>
  </body></html>`
}
