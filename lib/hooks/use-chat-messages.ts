"use client"

import { useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { subscribeChannel } from "@/lib/supabase/realtime"
import type { ChatMessage, ChatPoll } from "@/lib/data/messages"
import { fetchChatMessages, rowToChatMessage } from "@/lib/queries/messages"
import { messageKeys } from "@/lib/queries/keys"

const POLL_MS = 4_000

function mergeIncoming(
  prev: ChatMessage[],
  incoming: ChatMessage,
  senderName: string,
): ChatMessage[] {
  if (prev.some((x) => x.id === incoming.id)) return prev
  const withoutTemp = prev.filter(
    (x) => !(x.id.startsWith("temp-") && x.self && incoming.author === senderName),
  )
  return [...withoutTemp, incoming]
}

/** Broadcast helper — works without DB publication (instant peer delivery). */
export async function broadcastChatMessage(conversationId: string, msg: ChatMessage) {
  if (!conversationId || conversationId.startsWith("pending-")) return
  const supabase = createClient()
  const channel = supabase.channel(`chat-broadcast-${conversationId}`)
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve()
    })
    // safety timeout
    setTimeout(resolve, 1500)
  })
  await channel.send({
    type: "broadcast",
    event: "new_message",
    payload: msg,
  })
  // Keep channel briefly so peers can receive, then drop
  setTimeout(() => { void supabase.removeChannel(channel) }, 2000)
}

export type ChatPollVoteBroadcast = {
  optionId: string
  voterName: string
  previousOptionId?: string | null
  action: "add" | "remove"
}

export async function broadcastChatPollVote(conversationId: string, vote: ChatPollVoteBroadcast) {
  if (!conversationId || conversationId.startsWith("pending-")) return
  const supabase = createClient()
  const channel = supabase.channel(`chat-broadcast-${conversationId}`)
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve()
    })
    setTimeout(resolve, 1500)
  })
  await channel.send({
    type: "broadcast",
    event: "poll_vote",
    payload: vote,
  })
  setTimeout(() => { void supabase.removeChannel(channel) }, 2000)
}

function applyPollVoteToMessages(
  prev: ChatMessage[],
  vote: ChatPollVoteBroadcast,
): ChatMessage[] {
  return prev.map((msg) => {
    if (!msg.poll?.options.some((o) => o.id === vote.optionId || o.id === vote.previousOptionId)) {
      return msg
    }
    return {
      ...msg,
      poll: {
        ...msg.poll,
        options: msg.poll.options.map((o) => {
          let voters = o.voters.filter((n) => n !== vote.voterName)
          if (vote.action === "add" && o.id === vote.optionId && !voters.includes(vote.voterName)) {
            voters = [...voters, vote.voterName]
          }
          return { ...o, voters }
        }),
      },
    }
  })
}

export function useChatMessages(
  conversationId: string | undefined,
  senderName: string,
  initialMessages: ChatMessage[] = [],
) {
  const qc = useQueryClient()
  const senderRef = useRef(senderName)
  senderRef.current = senderName

  const query = useQuery({
    queryKey: messageKeys.thread(conversationId ?? ""),
    queryFn: () => fetchChatMessages(conversationId!, senderName),
    enabled: !!conversationId && !conversationId.startsWith("pending-"),
    staleTime: 10_000,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
    initialData: initialMessages.length > 0 ? initialMessages : undefined,
    initialDataUpdatedAt: initialMessages.length > 0 ? Date.now() - 15_000 : undefined,
  })

  // postgres_changes + broadcast
  useEffect(() => {
    if (!conversationId || conversationId.startsWith("pending-")) return
    const supabase = createClient()

    function ingestRow(m: Parameters<typeof rowToChatMessage>[0]) {
      const me = senderRef.current
      const incoming = rowToChatMessage(m, me)
      qc.setQueryData<ChatMessage[]>(messageKeys.thread(conversationId), (prev = []) =>
        mergeIncoming(prev, incoming, me),
      )
    }

    function ingestMessage(msg: ChatMessage) {
      const me = senderRef.current
      qc.setQueryData<ChatMessage[]>(messageKeys.thread(conversationId), (prev = []) =>
        mergeIncoming(prev, { ...msg, self: msg.author === me }, me),
      )
    }

    const pgChannel = supabase
      .channel(`chat-pg-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        ingestRow(payload.new as Parameters<typeof rowToChatMessage>[0])
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

    const bcChannel = supabase
      .channel(`chat-broadcast-${conversationId}`)
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        if (!payload || typeof payload !== "object") return
        ingestMessage(payload as ChatMessage)
      })
      .on("broadcast", { event: "poll_vote" }, ({ payload }) => {
        if (!payload || typeof payload !== "object") return
        const vote = payload as ChatPollVoteBroadcast
        qc.setQueryData<ChatMessage[]>(messageKeys.thread(conversationId), (prev = []) =>
          applyPollVoteToMessages(prev, vote),
        )
      })

    void subscribeChannel(supabase, pgChannel)
    void subscribeChannel(supabase, bcChannel)

    return () => {
      supabase.removeChannel(pgChannel)
      supabase.removeChannel(bcChannel)
    }
  }, [conversationId, qc])

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
