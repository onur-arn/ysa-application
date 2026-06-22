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

  // Create Supabase auth user + profile if Supabase is enabled
  if (SUPABASE_ENABLED && pendingId) {
    try {
      const admin = createAdminClient()

      // Get pending member data
      const { data: pending, error: fetchErr } = await admin
        .from("pending_members")
        .select("*")
        .eq("id", pendingId)
        .single()

      if (fetchErr || !pending) {
        console.error("[signup-approve] Pending member not found:", fetchErr)
      } else {
        // Create auth user
        const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
          email: pending.email,
          password: pending.password,
          email_confirm: true,
        })

        if (authErr) {
          console.error("[signup-approve] Auth user creation failed:", authErr)
        } else if (authUser.user) {
          const fullName = `${pending.first_name} ${pending.last_name}`
          const initials = fullName.trim().split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()

          // Create profile
          await admin.from("profiles").upsert({
            id: authUser.user.id,
            name: fullName,
            email: pending.email,
            initial_password: pending.password,
            station: pending.station ?? "paris",
            role: pending.role ?? "Üye",
            phone: pending.phone,
            birthday: pending.birthday,
            linkedin: pending.linkedin,
            memleket: pending.memleket,
            photo_url: pending.photo_url,
            igem_egitimi: pending.igem_egitimi,
            igem_tarihi: pending.igem_tarihi,
            initials,
          })

          // Clean up pending record
          await admin.from("pending_members").delete().eq("id", pendingId)
        }
      }
    } catch (err) {
      console.error("[signup-approve] Supabase error:", err)
    }
  }

  return new NextResponse(
    page("success", `<strong>${firstName} ${lastName}</strong> kabul edildi.`),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  )
}

function page(type: "success" | "error", message: string) {
  const color = type === "success" ? "#16a34a" : "#dc2626"
  const icon  = type === "success" ? "&#10003;" : "&#10007;"
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
  <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb">
    <div style="text-align:center;padding:40px;background:#fff;border-radius:16px;border:1px solid #e5e7eb;max-width:400px">
      <div style="font-size:48px;color:${color}">${icon}</div>
      <p style="font-size:15px;color:#374151;margin-top:16px">${message}</p>
    </div>
  </body></html>`
}
