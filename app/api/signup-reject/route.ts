import { NextRequest, NextResponse } from "next/server"
import { transporter } from "@/lib/mailer"
import { signature } from "@/lib/email-signature"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (!token) return new NextResponse("Token manquant", { status: 400 })

  let firstName = "", lastName = "", email = ""
  try {
    const parsed = JSON.parse(Buffer.from(token, "base64url").toString())
    firstName = parsed.firstName
    lastName  = parsed.lastName
    email     = parsed.email
  } catch {
    return new NextResponse("Token invalide", { status: 400 })
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? `${req.nextUrl.protocol}//${req.headers.get("host")}`

  try {
    await transporter.sendMail({
      from: `"Onur Arslan – YouthStation" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "YSA üyelik başvurunuz hakkında",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <p style="font-size:15px;color:#111827">Merhaba <strong>${firstName} ${lastName}</strong>,</p>
          <p style="font-size:14px;color:#374151;line-height:1.7">
            YouthStation Derneği'ne üyelik başvurunuzu inceledik. Maalesef şu an için başvurunuzu kabul edemiyoruz.
          </p>
          <p style="font-size:14px;color:#374151;line-height:1.7">
            Herhangi bir sorunuz olursa bizimle iletişime geçebilirsiniz.
          </p>
          ${signature(base)}
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
