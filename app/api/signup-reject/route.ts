import { NextRequest, NextResponse } from "next/server"
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

  return new NextResponse(
    page(`<strong>${firstName} ${lastName}</strong> reddedildi.`),
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
