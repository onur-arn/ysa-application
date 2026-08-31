import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

function normalizeAudioContentType(raw?: string | null): string {
  const t = (raw || "audio/webm").toLowerCase().split(";")[0].trim()
  if (t.includes("mp4") || t.includes("m4a")) return "audio/mp4"
  if (t.includes("ogg")) return "audio/ogg"
  if (t.includes("mpeg") || t.includes("mp3")) return "audio/mpeg"
  if (t.includes("wav")) return "audio/wav"
  if (t.includes("aac")) return "audio/aac"
  return "audio/webm"
}

/** Upload voice note via service role. */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch (e) {
    console.error("[upload-audio] formData:", e)
    return NextResponse.json({ error: "Geçersiz form" }, { status: 400 })
  }

  const file = form.get("file")
  const conversationId = String(form.get("conversationId") ?? "")
  if (!(file instanceof Blob) || file.size < 1 || !conversationId || conversationId.startsWith("pending-")) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 })
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[upload-audio] missing supabase admin env")
    return NextResponse.json({ error: "Sunucu yapılandırması eksik" }, { status: 500 })
  }

  const admin = createAdminClient()
  const contentType = normalizeAudioContentType(file.type)
  const ext = contentType === "audio/mp4" ? "m4a"
    : contentType === "audio/ogg" ? "ogg"
    : contentType === "audio/mpeg" ? "mp3"
    : "webm"
  const path = `chat/${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  // Never send "audio/webm;codecs=opus" — Storage reject with 415
  const { error } = await admin.storage.from("chat-audio").upload(path, buffer, {
    contentType,
    upsert: true,
  })

  if (error) {
    console.error("[upload-audio]", error.message, { contentType, size: buffer.length })
    // Retry once with plain audio/webm
    if (contentType !== "audio/webm") {
      const path2 = `chat/${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.webm`
      const retry = await admin.storage.from("chat-audio").upload(path2, buffer, {
        contentType: "audio/webm",
        upsert: true,
      })
      if (!retry.error) {
        const { data } = admin.storage.from("chat-audio").getPublicUrl(path2)
        return NextResponse.json({ url: data.publicUrl })
      }
      console.error("[upload-audio] retry:", retry.error.message)
    }
    return NextResponse.json({ error: "Ses yüklenemedi", detail: error.message }, { status: 500 })
  }

  const { data } = admin.storage.from("chat-audio").getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
