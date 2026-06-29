import { NextRequest, NextResponse } from "next/server"
import { sendMail } from "@/lib/mailer"
import { createAdminClient } from "@/lib/supabase/admin"
import { createHmac } from "crypto"
import { buildWelcomePost } from "@/lib/welcome-post"

const SUPABASE_ENABLED = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const TOKEN_SECRET = process.env.SIGNUP_TOKEN_SECRET ?? "change-me-signup-secret"

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

  let pendingId: string | null = null
  const parsed = verifyToken(token)
  if (!parsed) return new NextResponse("Token invalide", { status: 400 })
  pendingId = (parsed.pendingId as string) ?? null

  if (!pendingId) return new NextResponse("Token invalide", { status: 400 })

  if (!SUPABASE_ENABLED) {
    return new NextResponse(page("error", "Supabase non configuré."), { headers: { "Content-Type": "text/html; charset=utf-8" } })
  }

  const admin = createAdminClient()

  const { data: pending, error: fetchErr } = await admin
    .from("pending_members")
    .select("*")
    .eq("id", pendingId)
    .single()

  if (fetchErr || !pending) {
    return new NextResponse(
      page("error", "Demande introuvable. Elle a peut-être déjà été traitée."),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    )
  }

  // Create auth user
  let userId: string | null = null
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: pending.email,
    password: pending.password,
    email_confirm: true,
  })

  if (authErr) {
    if (authErr.code === "email_exists") {
      // Find existing auth user via profiles table
      const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", pending.email).maybeSingle()
      if (existingProfile) userId = existingProfile.id
    } else {
      console.error("[signup-approve] Auth user creation failed:", authErr)
      return new NextResponse(
        page("error", "Erreur lors de la création du compte."),
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      )
    }
  } else if (authUser.user) {
    userId = authUser.user.id
  }

  if (!userId) {
    return new NextResponse(page("error", "Impossible de créer le compte."), { headers: { "Content-Type": "text/html; charset=utf-8" } })
  }

  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ""
  const fullName = `${cap(pending.first_name)} ${cap(pending.last_name)}`
  const initials = fullName.trim().split(" ").filter(Boolean).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()

  // Move photo from pending/ to avatars/ if exists
  let photoUrl = pending.photo_url ?? null
  if (photoUrl && photoUrl.includes("/pending/")) {
    const filename = photoUrl.split("/").pop()?.split("?")[0] ?? ""
    const ext = filename.split(".").pop() ?? "jpg"
    const newPath = `avatars/${userId}.${ext}`
    const oldPath = `pending/${pendingId}.${ext}`
    const { error: copyErr } = await admin.storage.from("avatars").copy(oldPath, newPath)
    if (copyErr) {
      console.error("[signup-approve] photo copy error:", copyErr.message)
    } else {
      const { data: urlData } = admin.storage.from("avatars").getPublicUrl(newPath)
      photoUrl = urlData.publicUrl
      console.log("[signup-approve] photo moved to:", photoUrl)
      await admin.storage.from("avatars").remove([oldPath])
    }
  }

  // Create profile
  const { error: profileErr } = await admin.from("profiles").upsert({
    id: userId,
    name: fullName,
    email: pending.email,
    initial_password: pending.password,
    station: pending.station ?? "paris",
    role: pending.role ?? "Üye",
    phone: pending.phone ?? null,
    birthday: pending.birthday ?? null,
    linkedin: pending.linkedin ?? null,
    memleket: pending.memleket ?? null,
    photo_url: photoUrl,
    igem_egitimi: pending.igem_egitimi ?? null,
    igem_tarihi: pending.igem_tarihi ?? null,
    initials,
  })

  if (profileErr) {
    console.error("[signup-approve] Profile upsert failed:", profileErr.message)
  }

  // Delete pending record
  await admin.from("pending_members").delete().eq("id", pendingId)

  // Post automatic welcome message in the feed
  const welcomePost = buildWelcomePost(fullName, pending.memleket ?? null, pending.station ?? "paris")
  await admin.from("posts").insert({ ...welcomePost, created_by: userId })

  // Notify the user
  try {
    await sendMail({
      to: pending.email,
      subject: "YSA Uygulaması — Üyeliğiniz onaylandı 🎉",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
          <div style="background:#0e7490;padding:20px 24px">
            <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700">Üyeliğiniz onaylandı!</h1>
          </div>
          <div style="padding:24px">
            <p style="font-size:14px;color:#374151">Merhaba <strong>${fullName}</strong>,</p>
            <p style="font-size:14px;color:#374151">YSA uygulamasına üyeliğiniz onaylandı. Kayıt sırasında belirlediğiniz şifrenizle giriş yapabilirsiniz:</p>
            <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
              <p style="margin:4px 0;font-size:13px;color:#6b7280">E-posta: <strong style="color:#111827">${pending.email}</strong></p>
            </div>
            <a href="https://youthstation.vercel.app/auth/login" style="display:inline-block;padding:12px 28px;background:#0e7490;color:#fff;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none">
              Giriş yap →
            </a>
          </div>
        </div>
      `,
    })
  } catch (err) {
    console.error("[signup-approve] Welcome email failed:", err)
  }

  return new NextResponse(
    page("success", `Le compte de <strong>${fullName}</strong> a été créé avec succès. Un e-mail de confirmation lui a été envoyé.`),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  )
}

function page(type: "success" | "error", message: string) {
  const color = type === "success" ? "#16a34a" : "#dc2626"
  const icon  = type === "success" ? "&#10003;" : "&#10007;"
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb">
    <div style="text-align:center;padding:40px;background:#fff;border-radius:16px;border:1px solid #e5e7eb;max-width:420px;width:90%">
      <div style="font-size:52px;color:${color}">${icon}</div>
      <p style="font-size:15px;color:#374151;margin-top:16px;line-height:1.6">${message}</p>
    </div>
  </body></html>`
}
