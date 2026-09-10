"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { subscribeChannel } from "@/lib/supabase/realtime"
import type { ChatMessage, ChatPoll } from "@/lib/data/messages"
import { fetchChatMessages, rowToChatMessage } from "@/lib/queries/messages"
import { messageKeys } from "@/lib/queries/keys"

/** Fallback poll when Realtime is unhealthy — keep light when subscribed. */
const POLL_FALLBACK_MS = 15_000

/** Long-lived broadcast channels opened by useChatMessages — reused by send helpers. */
const liveBroadcastChannels = new Map<string, RealtimeChannel>()

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

async function sendOnBroadcastChannel(
  conversationId: string,
  event: "new_message" | "poll_vote",
  payload: unknown,
) {
  if (!conversationId || conversationId.startsWith("pending-")) return

  const existing = liveBroadcastChannels.get(conversationId)
  if (existing) {
    await existing.send({ type: "broadcast", event, payload })
    return
  }

  // Peer may not have the thread open — open briefly, send, then drop
  const supabase = createClient()
  const channel = supabase.channel(`chat-broadcast-${conversationId}`)
  await new Promise<void>((resolve) => {
    void subscribeChannel(supabase, channel, (status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve()
    })
    setTimeout(resolve, 1500)
  })
  await channel.send({ type: "broadcast", event, payload })
  setTimeout(() => { void supabase.removeChannel(channel) }, 2000)
}

/** Broadcast helper — prefers the long-lived thread channel when open. */
export async function broadcastChatMessage(conversationId: string, msg: ChatMessage) {
  await sendOnBroadcastChannel(conversationId, "new_message", msg)
}

export type ChatPollVoteBroadcast = {
  optionId: string
  voterName: string
  previousOptionId?: string | null
  action: "add" | "remove"
}

export async function broadcastChatPollVote(conversationId: string, vote: ChatPollVoteBroadcast) {
  await sendOnBroadcastChannel(conversationId, "poll_vote", vote)
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
  const [realtimeHealthy, setRealtimeHealthy] = useState(false)

  const query = useQuery({
    queryKey: messageKeys.thread(conversationId ?? ""),
    queryFn: () => fetchChatMessages(conversationId!, senderName),
    enabled: !!conversationId && !conversationId.startsWith("pending-"),
    staleTime: 10_000,
    refetchInterval: realtimeHealthy ? false : POLL_FALLBACK_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
    initialData: initialMessages.length > 0 ? initialMessages : undefined,
    initialDataUpdatedAt: initialMessages.length > 0 ? Date.now() - 15_000 : undefined,
  })

  // postgres_changes + broadcast
  useEffect(() => {
    if (!conversationId || conversationId.startsWith("pending-")) {
      setRealtimeHealthy(false)
      return
    }
    const threadId = conversationId
    const supabase = createClient()
    let pgOk = false
    let bcOk = false

    function syncHealth() {
      setRealtimeHealthy(pgOk && bcOk)
    }

    function ingestRow(m: Parameters<typeof rowToChatMessage>[0]) {
      const me = senderRef.current
      const incoming = rowToChatMessage(m, me)
      qc.setQueryData<ChatMessage[]>(messageKeys.thread(threadId), (prev = []) =>
        mergeIncoming(prev, incoming, me),
      )
    }

    function ingestMessage(msg: ChatMessage) {
      const me = senderRef.current
      qc.setQueryData<ChatMessage[]>(messageKeys.thread(threadId), (prev = []) =>
        mergeIncoming(prev, { ...msg, self: msg.author === me }, me),
      )
    }

    const pgChannel = supabase
      .channel(`chat-pg-${threadId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${threadId}`,
      }, (payload: { new: Parameters<typeof rowToChatMessage>[0] }) => {
        ingestRow(payload.new)
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_poll_votes" }, (payload: { new: { option_id: string; voter_name: string } }) => {
        const v = payload.new
        qc.setQueryData<ChatMessage[]>(messageKeys.thread(threadId), (prev = []) =>
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
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_poll_votes" }, (payload: { old: { option_id: string; voter_name: string } }) => {
        const v = payload.old
        qc.setQueryData<ChatMessage[]>(messageKeys.thread(threadId), (prev = []) =>
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_polls" }, (payload: { new: { id: string; message_id: string } }) => {
        const poll = payload.new
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
          qc.setQueryData<ChatMessage[]>(messageKeys.thread(threadId), (prev = []) =>
            prev.map((msg) => (msg.id === poll.message_id ? { ...msg, poll: chatPoll } : msg)),
          )
        })()
      })

    const bcChannel = supabase
      .channel(`chat-broadcast-${threadId}`)
      .on("broadcast", { event: "new_message" }, ({ payload }: { payload: unknown }) => {
        if (!payload || typeof payload !== "object") return
        ingestMessage(payload as ChatMessage)
      })
      .on("broadcast", { event: "poll_vote" }, ({ payload }: { payload: unknown }) => {
        if (!payload || typeof payload !== "object") return
        const vote = payload as ChatPollVoteBroadcast
        qc.setQueryData<ChatMessage[]>(messageKeys.thread(threadId), (prev = []) =>
          applyPollVoteToMessages(prev, vote),
        )
      })

    liveBroadcastChannels.set(threadId, bcChannel)

    void subscribeChannel(supabase, pgChannel, (status) => {
      pgOk = status === "SUBSCRIBED"
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        pgOk = false
      }
      syncHealth()
    })
    void subscribeChannel(supabase, bcChannel, (status) => {
      bcOk = status === "SUBSCRIBED"
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        bcOk = false
      }
      syncHealth()
    })

    return () => {
      if (liveBroadcastChannels.get(threadId) === bcChannel) {
        liveBroadcastChannels.delete(threadId)
      }
      setRealtimeHealthy(false)
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
