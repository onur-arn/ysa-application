import type { StationId } from "./stations"

export type PostComment = {
  id: string
  author: string
  initials: string
  station: StationId
  text: string
  time: string
}

export type PollOption = {
  id: string
  text: string
  voters: string[]
}

export type Poll = {
  question: string
  options: PollOption[]
}

export type Post = {
  id: string
  author: string
  initials: string
  station: StationId
  content: string
  imageUrl?: string
  poll?: Poll
  createdAt: string
  createdBy?: string
  likedBy: string[]
  comments: PostComment[]
}

export const POSTS: Post[] = []
