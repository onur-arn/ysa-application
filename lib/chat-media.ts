import { createClient } from "@/lib/supabase/client"

export async function uploadChatAudio(conversationId: string, blob: Blob): Promise<string | null> {
  const supabase = createClient()
  const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm"
  const path = `chat/${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from("chat-audio").upload(path, blob, {
    contentType: blob.type || "audio/webm",
    upsert: true,
  })
  if (error) {
    console.error("[uploadChatAudio]", error.message)
    return null
  }
  const { data } = supabase.storage.from("chat-audio").getPublicUrl(path)
  return data.publicUrl
}

export async function uploadChatImage(conversationId: string, file: File): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `chat/${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from("chat-images").upload(path, file, { upsert: true })
  if (error) {
    console.error("[uploadChatImage]", error.message)
    return null
  }
  const { data } = supabase.storage.from("chat-images").getPublicUrl(path)
  return data.publicUrl
}

export async function uploadPostImage(file: File): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from("chat-images").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  })
  if (error) {
    console.error("[uploadPostImage]", error.message)
    return null
  }
  const { data } = supabase.storage.from("chat-images").getPublicUrl(path)
  return data.publicUrl
}
