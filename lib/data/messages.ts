import type { StationId } from "./stations"

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
  self?: boolean
  image?: string
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
