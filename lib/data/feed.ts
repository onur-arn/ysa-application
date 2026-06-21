import type { StationId } from "./stations"

export type EventComment = {
  id: string
  author: string
  initials: string
  text: string
  time: string
}

export type EventItem = {
  id: string
  title: string
  date: string // ISO
  time: string
  place: string
  station: StationId
  past?: boolean
  description?: string
  link?: string
  image?: string
  likes: number
  participantsCount: number
  notAttendingCount: number
  comments: EventComment[]
}

export const EVENTS: EventItem[] = []

export type IdeaStatus = "trending" | "new" | "accepted" | "igem"

export type IdeaItem = {
  id: string
  title: string
  description: string
  author: string
  station: StationId
  up: number
  down: number
  status: IdeaStatus
}

export const IDEAS: IdeaItem[] = []

export const STORY_BG: Record<string, string> = {
  intl: "188 57% 48%",
  paris: "221 70% 55%",
  caen: "350 70% 55%",
  nancy: "28 85% 55%",
  strasbourg: "280 50% 55%",
  lyon: "150 55% 45%",
  hamburg: "200 70% 50%",
  bucarest: "45 90% 50%",
}
