import type { StationId } from "./stations"
import { parseCallEvent, callEventPreview } from "@/lib/call/call-event"

export type MessageType = "text" | "image" | "gif" | "audio" | "call" | "poll" | "file"

export type ChatPollOption = {
  id: string
  text: string
  voters: string[]
}

export type ChatPoll = {
  id: string
  question: string
  options: ChatPollOption[]
}

export type ChatMessage = {
  id: string
  author: string
  initials: string
  text: string
  time: string
  /** ISO timestamp for day separators */
  createdAt?: string
  self?: boolean
  image?: string
  gif?: string
  audio?: string
  /** Voice note length in seconds (hint for UI before metadata loads) */
  audioDuration?: number
  file?: { url: string; name: string; mime?: string; size?: number }
  messageType?: MessageType
  system?: boolean
  poll?: ChatPoll
}

export type GroupConversation = {
  id: StationId
  type: "group"
  lastMessage: string
  lastTime: string
  unread: number
  messages: ChatMessage[]
}

export type DMConversation = {
  id: string
  type: "dm"
  name: string
  initials: string
  color: string
  online: boolean
  lastMessage: string
  lastTime: string
  unread: number
  messages: ChatMessage[]
}

export const GROUP_CHATS: GroupConversation[] = []

export const DM_CHATS: DMConversation[] = []

export function messagePreview(msg: {
  text?: string
  messageType?: MessageType
  image?: string
  gif?: string
  audio?: string
  file?: { name?: string }
}): string {
  if (msg.messageType === "audio" || msg.audio) return "🎤 Sesli mesaj"
  if (msg.messageType === "file" || msg.file) return `📎 ${msg.file?.name || "Dosya"}`
  if (msg.messageType === "gif" || msg.gif) return "GIF"
  if (msg.messageType === "image" || msg.image) return "📷 Fotoğraf"
  if (msg.messageType === "call") {
    const event = parseCallEvent(msg.text)
    return event ? callEventPreview(event) : "📞 Arama"
  }
  if ((msg.text ?? "").startsWith("📎 ")) return msg.text || "📎 Dosya"
  return msg.text || ""
}
