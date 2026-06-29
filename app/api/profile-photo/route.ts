import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { photoBase64, photoExt } = await req.json()
  if (!photoBase64) return NextResponse.json({ error: "Missing photo" }, { status: 400 })

  const admin = createAdminClient()
  const ext = (photoExt ?? "jpg").replace(/^\./, "")
  const path = `avatars/${user.id}.${ext}`
  const buffer = Buffer.from(photoBase64, "base64")

  const { error } = await admin.storage.from("avatars").upload(path, buffer, {
    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
    upsert: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: urlData } = admin.storage.from("avatars").getPublicUrl(path)
  return NextResponse.json({ url: `${urlData.publicUrl}?t=${Date.now()}` })
}
