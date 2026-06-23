import type { StationId } from "./stations"

export type TaskStatus = "todo" | "in_progress" | "done"
export type TaskPriority = "urgent" | "normal" | "low"

export type TaskComment = {
  id: string
  author: string
  initials: string
  text: string
  time: string
}

export type Task = {
  id: string
  title: string
  description: string
  station: StationId
  priority: TaskPriority
  assignedBy: string
  assignedByInitials: string
  assignedByStation: StationId
  assignee: string
  assigneeInitials: string
  status: TaskStatus
  comments: TaskComment[]
  createdById?: string
}

export const TASKS: Task[] = []
