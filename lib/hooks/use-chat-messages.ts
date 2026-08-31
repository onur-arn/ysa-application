"use client"

import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { subscribeChannel } from "@/lib/supabase/realtime"
import type { ChatMessage, ChatPoll } from "@/lib/data/messages"
import { fetchChatMessages, rowToChatMessage } from "@/lib/queries/messages"
import { messageKeys } from "@/lib/queries/keys"

export function useChatMessages(
  conversationId: string | undefined,
  senderName: string,
  initialMessages: ChatMessage[] = [],
) {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: messageKeys.thread(conversationId ?? ""),
    queryFn: () => fetchChatMessages(conversationId!, senderName),
    enabled: !!conversationId,
    staleTime: 30_000,
    initialData: initialMessages.length > 0 ? initialMessages : undefined,
    initialDataUpdatedAt: initialMessages.length > 0 ? Date.now() - 15_000 : undefined,
  })

  useEffect(() => {
    if (!conversationId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const m = payload.new as Parameters<typeof rowToChatMessage>[0] & { conversation_id: string }
        qc.setQueryData<ChatMessage[]>(messageKeys.thread(conversationId), (prev = []) => {
          if (prev.some((x) => x.id === m.id)) return prev
          const withoutTemp = prev.filter((x) => !(x.id.startsWith("temp-") && x.self && m.sender_name === senderName))
          return [...withoutTemp, rowToChatMessage(m, senderName)]
        })
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_poll_votes" }, (payload) => {
        const v = payload.new as { option_id: string; voter_name: string }
        qc.setQueryData<ChatMessage[]>(messageKeys.thread(conversationId), (prev = []) =>
          prev.map((msg) => {
            if (!msg.poll?.options.some((o) => o.id === v.option_id)) return msg
            return {
              ...msg,
              poll: {
                ...msg.poll,
                options: msg.poll.options.map((o) =>
                  o.id === v.option_id && !o.voters.includes(v.voter_name)
                    ? { ...o, voters: [...o.voters, v.voter_name] }
                    : o,
                ),
              },
            }
          }),
        )
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_poll_votes" }, (payload) => {
        const v = payload.old as { option_id: string; voter_name: string }
        qc.setQueryData<ChatMessage[]>(messageKeys.thread(conversationId), (prev = []) =>
          prev.map((msg) => {
            if (!msg.poll?.options.some((o) => o.id === v.option_id)) return msg
            return {
              ...msg,
              poll: {
                ...msg.poll,
                options: msg.poll.options.map((o) =>
                  o.id === v.option_id
                    ? { ...o, voters: o.voters.filter((vn) => vn !== v.voter_name) }
                    : o,
                ),
              },
            }
          }),
        )
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_polls" }, (payload) => {
        const poll = payload.new as { id: string; message_id: string }
        void (async () => {
          const { data } = await supabase
            .from("message_polls")
            .select("id,question,message_poll_options(id,text,position,message_poll_votes(option_id,voter_name))")
            .eq("id", poll.id)
            .single()
          if (!data) return
          const chatPoll: ChatPoll = {
            id: data.id,
            question: (data as Record<string, unknown>).question as string,
            options: ((data as Record<string, unknown>).message_poll_options as { id: string; text: string; position: number; message_poll_votes: { option_id: string; voter_name: string }[] }[] ?? [])
              .sort((a, b) => a.position - b.position)
              .map((o) => ({ id: o.id, text: o.text, voters: (o.message_poll_votes ?? []).map((v) => v.voter_name) })),
          }
          qc.setQueryData<ChatMessage[]>(messageKeys.thread(conversationId), (prev = []) =>
            prev.map((msg) => (msg.id === poll.message_id ? { ...msg, poll: chatPoll } : msg)),
          )
        })()
      })

    void subscribeChannel(supabase, channel)
    return () => { supabase.removeChannel(channel) }
  }, [conversationId, senderName, qc])

  function appendOptimistic(msg: ChatMessage) {
    if (!conversationId) return
    qc.setQueryData<ChatMessage[]>(messageKeys.thread(conversationId), (prev = []) => [...prev, msg])
  }

  function replaceOptimistic(tempId: string, msg: ChatMessage) {
    if (!conversationId) return
    qc.setQueryData<ChatMessage[]>(messageKeys.thread(conversationId), (prev = []) =>
      prev.map((m) => (m.id === tempId ? msg : m)),
    )
  }

  function removeOptimistic(tempId: string) {
    if (!conversationId) return
    qc.setQueryData<ChatMessage[]>(messageKeys.thread(conversationId), (prev = []) =>
      prev.filter((m) => m.id !== tempId),
    )
  }

  function patchMessage(messageId: string, updater: (m: ChatMessage) => ChatMessage) {
    if (!conversationId) return
    qc.setQueryData<ChatMessage[]>(messageKeys.thread(conversationId), (prev = []) =>
      prev.map((m) => (m.id === messageId ? updater(m) : m)),
    )
  }

  function setMessages(updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) {
    if (!conversationId) return
    qc.setQueryData<ChatMessage[]>(messageKeys.thread(conversationId), (prev = []) =>
      typeof updater === "function" ? updater(prev) : updater,
    )
  }

  return {
    messages: query.data ?? [],
    isLoading: query.isLoading && !query.data,
    appendOptimistic,
    replaceOptimistic,
    removeOptimistic,
    patchMessage,
    setMessages,
  }
}
