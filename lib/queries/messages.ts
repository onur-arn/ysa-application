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
  return {
    id: m.id,
    author: m.sender_name,
    initials: m.sender_initials,
    text: m.text ?? "",
    time: new Date(m.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    self: m.sender_name === senderName,
    image: m.image_url ?? undefined,
    gif: m.gif_url ?? undefined,
    audio: m.audio_url ?? undefined,
    messageType: (m.message_type as ChatMessage["messageType"]) ?? undefined,
    system: m.is_system,
    poll,
  }
}

export async function fetchChatMessages(conversationId: string, senderName: string): Promise<ChatMessage[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("chat_messages")
    .select("id,sender_name,sender_initials,text,image_url,gif_url,audio_url,message_type,is_system,created_at,message_polls(id,question,message_poll_options(id,text,position,message_poll_votes(option_id,voter_name)))")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(80)

  if (!data) return []
  return [...data].reverse().map((m) =>
    rowToChatMessage(
      m as RawMsg,
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
