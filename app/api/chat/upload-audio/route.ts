import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/** Upload voice note via service role (bucket policies may be missing for anon clients). */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await req.formData()
  const file = form.get("file")
  const conversationId = String(form.get("conversationId") ?? "")
  if (!(file instanceof Blob) || !conversationId || conversationId.startsWith("pending-")) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 })
  }

  const admin = createAdminClient()
  const ext = (file.type.includes("mp4") || file.type.includes("m4a")) ? "m4a"
    : file.type.includes("ogg") ? "ogg"
    : "webm"
  const path = `chat/${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  let uploadedPath = path
  let { error } = await admin.storage.from("chat-audio").upload(path, buffer, {
    contentType: file.type || "audio/webm",
    upsert: true,
  })

  if (error) {
    console.warn("[upload-audio] chat-audio failed:", error.message)
    // Fallback to chat-images bucket
    const imgPath = `chat/${conversationId}/audio-${Date.now()}.${ext}`
    const fallback = await admin.storage.from("chat-images").upload(imgPath, buffer, {
      contentType: file.type || "audio/webm",
      upsert: true,
    })
    if (fallback.error) {
      console.error("[upload-audio]", fallback.error.message)
      return NextResponse.json({ error: "Ses yüklenemedi" }, { status: 500 })
    }
    uploadedPath = imgPath
    const { data } = admin.storage.from("chat-images").getPublicUrl(imgPath)
    return NextResponse.json({ url: data.publicUrl })
  }

  const { data } = admin.storage.from("chat-audio").getPublicUrl(uploadedPath)
  return NextResponse.json({ url: data.publicUrl })
}
