import type { QueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { ChatMessage, ChatPoll } from "@/lib/data/messages"
import { messageKeys } from "./keys"

type RawPollOption = { id: string; text: string; position: number; message_poll_votes: { option_id: string; voter_name: string }[] }
type RawPoll = { id: string; question: string; message_poll_options: RawPollOption[] } | null

type RawMsg = {
  id: string
  sender_name: string
  sender_initials: string
  text: string | null
  image_url: string | null
  gif_url?: string | null
  audio_url?: string | null
  message_type?: string | null
  is_system: boolean
  created_at: string
}

const SELECT_FULL =
  "id,sender_name,sender_initials,text,image_url,gif_url,audio_url,message_type,is_system,created_at,message_polls(id,question,message_poll_options(id,text,position,message_poll_votes(option_id,voter_name)))"
const SELECT_NO_AUDIO =
  "id,sender_name,sender_initials,text,image_url,gif_url,message_type,is_system,created_at,message_polls(id,question,message_poll_options(id,text,position,message_poll_votes(option_id,voter_name)))"
const SELECT_MIN =
  "id,sender_name,sender_initials,text,image_url,is_system,created_at"

function parsePoll(rawPoll: RawPoll): ChatPoll | undefined {
  if (!rawPoll) return undefined
  return {
    id: rawPoll.id,
    question: rawPoll.question,
    options: (rawPoll.message_poll_options ?? [])
      .sort((a, b) => a.position - b.position)
      .map((o) => ({
        id: o.id,
        text: o.text,
        voters: (o.message_poll_votes ?? []).map((v) => v.voter_name),
      })),
  }
}

export function rowToChatMessage(m: RawMsg, senderName: string, poll?: ChatPoll): ChatMessage {
  // Legacy fallback: audio stored in image_url when audio_url column was missing
  const audio =
    m.audio_url ??
    (m.message_type === "audio" ? m.image_url : undefined) ??
    undefined
  return {
    id: m.id,
    author: m.sender_name,
    initials: m.sender_initials,
    text: m.text ?? "",
    time: new Date(m.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    self: m.sender_name === senderName,
    image: m.message_type === "audio" ? undefined : (m.image_url ?? undefined),
    gif: m.gif_url ?? undefined,
    audio: audio ?? undefined,
    messageType: (m.message_type as ChatMessage["messageType"]) ?? undefined,
    system: m.is_system,
    poll,
  }
}

export async function fetchChatMessages(conversationId: string, senderName: string): Promise<ChatMessage[]> {
  const supabase = createClient()

  let data: Record<string, unknown>[] | null = null
  let errorMessage: string | undefined

  for (const select of [SELECT_FULL, SELECT_NO_AUDIO, SELECT_MIN]) {
    const res = await supabase
      .from("chat_messages")
      .select(select)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(80)

    if (!res.error && res.data) {
      data = res.data as Record<string, unknown>[]
      break
    }
    errorMessage = res.error?.message
    // Missing column / schema cache — try a leaner select
    if (res.error && /audio_url|gif_url|message_type|schema cache|42703|PGRST/i.test(res.error.message)) {
      continue
    }
    break
  }

  if (!data) {
    console.error("[chat] fetch failed:", errorMessage)
    throw new Error(errorMessage || "Mesajlar yüklenemedi")
  }

  return [...data].reverse().map((m) =>
    rowToChatMessage(
      m as unknown as RawMsg,
      senderName,
      parsePoll((m as Record<string, unknown>).message_polls as RawPoll),
    ),
  )
}

export function prefetchChatMessages(qc: QueryClient, conversationId: string, senderName: string) {
  return qc.prefetchQuery({
    queryKey: messageKeys.thread(conversationId),
    queryFn: () => fetchChatMessages(conversationId, senderName),
    staleTime: 60_000,
  })
}
