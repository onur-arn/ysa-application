import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const MAX_BYTES = 20 * 1024 * 1024

const ALLOWED = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
])

function extFromName(name: string, mime: string): string {
  const fromName = name.split(".").pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName
  if (mime === "application/pdf") return "pdf"
  if (mime.includes("wordprocessingml")) return "docx"
  if (mime.includes("spreadsheetml")) return "xlsx"
  if (mime.includes("presentationml")) return "pptx"
  if (mime === "text/plain") return "txt"
  if (mime === "text/csv") return "csv"
  if (mime.includes("zip")) return "zip"
  if (mime.includes("msword")) return "doc"
  return "bin"
}

/** Upload chat document via service role. */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Geçersiz form" }, { status: 400 })
  }

  const file = form.get("file")
  const conversationId = String(form.get("conversationId") ?? "")
  if (!(file instanceof Blob) || file.size < 1 || !conversationId || conversationId.startsWith("pending-")) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Dosya 20 MB'den büyük olamaz" }, { status: 413 })
  }

  const fileName = (file instanceof File ? file.name : "document").slice(0, 180)
  const mime = (file.type || "application/octet-stream").split(";")[0].trim().toLowerCase()
  if (!ALLOWED.has(mime) && !mime.startsWith("text/")) {
    return NextResponse.json({ error: "Bu dosya türü desteklenmiyor (PDF, Word, Excel, PPT, TXT, ZIP…)" }, { status: 415 })
  }

  const admin = createAdminClient()
  const ext = extFromName(fileName, mime)
  const path = `chat/${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage.from("chat-files").upload(path, buffer, {
    contentType: mime,
    upsert: true,
  })

  if (error) {
    console.error("[upload-file]", error.message)
    return NextResponse.json({ error: "Dosya yüklenemedi", detail: error.message }, { status: 500 })
  }

  const { data } = admin.storage.from("chat-files").getPublicUrl(path)
  return NextResponse.json({
    url: data.publicUrl,
    name: fileName,
    mime,
    size: file.size,
  })
}
