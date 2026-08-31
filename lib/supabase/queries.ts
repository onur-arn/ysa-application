"use client"

import { createClient } from "./client"
import { storyCutoffIso } from "@/lib/queries/stories"

export const supabaseEnabled = true

// ── Profile ───────────────────────────────────────────────────────────────────
export async function fetchProfile(userId: string) {
  const sb = createClient()
  const { data } = await sb.from("profiles").select("*").eq("id", userId).single()
  return data
}

export async function updateProfile(userId: string, updates: Record<string, unknown>) {
  const sb = createClient()
  await sb.from("profiles").update(updates).eq("id", userId)
}

// ── Posts ─────────────────────────────────────────────────────────────────────
export async function fetchPosts() {
  const sb = createClient()
  const { data: posts } = await sb
    .from("posts")
    .select(`*, post_comments(*), post_likes(*), polls(*, poll_options(*, poll_votes(*)))`)
    .order("created_at", { ascending: false })
  return posts ?? []
}

export async function insertPost(post: { author: string; initials: string; station: string; content: string; image_url?: string }) {
  const sb = createClient()
  const { data, error } = await sb.from("posts").insert(post).select().single()
  if (error) throw error
  return data
}

export async function insertPoll(postId: string, question: string, options: { id: string; text: string; position: number }[]) {
  const sb = createClient()
  const { data: poll, error } = await sb.from("polls").insert({ post_id: postId, question }).select().single()
  if (error) throw error
  await sb.from("poll_options").insert(options.map((o) => ({ ...o, poll_id: poll.id })))
}

export async function deletePost(postId: string) {
  const sb = createClient()
  await sb.from("posts").delete().eq("id", postId)
}

export async function toggleLike(postId: string, voterName: string, liked: boolean) {
  const sb = createClient()
  if (liked) {
    await sb.from("post_likes").delete().eq("post_id", postId).eq("voter_name", voterName)
  } else {
    await sb.from("post_likes").upsert({ post_id: postId, voter_name: voterName })
  }
}

export async function insertComment(comment: { post_id: string; author: string; initials: string; station: string; text: string }) {
  const sb = createClient()
  const { data, error } = await sb.from("post_comments").insert(comment).select().single()
  if (error) throw error
  return data
}

export async function toggleVote(optionId: string, voterName: string, hasVoted: boolean) {
  const sb = createClient()
  if (hasVoted) {
    await sb.from("poll_votes").delete().eq("option_id", optionId).eq("voter_name", voterName)
  } else {
    // Remove previous votes on same poll first
    const { data: opt } = await sb.from("poll_options").select("poll_id").eq("id", optionId).single()
    if (opt) {
      const { data: siblings } = await sb.from("poll_options").select("id").eq("poll_id", opt.poll_id)
      if (siblings) {
        for (const s of siblings) {
          await sb.from("poll_votes").delete().eq("option_id", s.id).eq("voter_name", voterName)
        }
      }
    }
    await sb.from("poll_votes").upsert({ option_id: optionId, voter_name: voterName })
  }
}

// ── Stories ───────────────────────────────────────────────────────────────────
export async function fetchStories() {
  const sb = createClient()
  const { data } = await sb
    .from("stories")
    .select("*")
    .gte("created_at", storyCutoffIso())
    .order("created_at", { ascending: true })
  return data ?? []
}

export async function insertStory(story: {
  id: string; station: string; author_name: string; initials: string
  image_url: string; music_preview_url?: string; fit_mode?: string
}) {
  const sb = createClient()
  await sb.from("stories").insert(story)
}

export async function deleteStory(id: string) {
  const sb = createClient()
  await sb.from("stories").delete().eq("id", id)
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export async function fetchTasks() {
  const sb = createClient()
  const { data } = await sb.from("tasks").select("*").order("created_at", { ascending: false })
  return data ?? []
}

export async function insertTask(task: {
  title: string; description?: string; status: string; priority: string
  station: string; assignee?: string; due_date?: string
}) {
  const sb = createClient()
  const { data, error } = await sb.from("tasks").insert(task).select().single()
  if (error) throw error
  return data
}

export async function updateTask(id: string, updates: Record<string, unknown>) {
  const sb = createClient()
  await sb.from("tasks").update(updates).eq("id", id)
}

// ── iGEM Requests ─────────────────────────────────────────────────────────────
export async function fetchIgemRequests() {
  const sb = createClient()
  const { data } = await sb.from("igem_requests").select("*").order("created_at", { ascending: false })
  return data ?? []
}

export async function insertIgemRequest(req: { author: string; initials: string; station: string; motivation: string }) {
  const sb = createClient()
  await sb.from("igem_requests").insert(req)
}

// ── Profiles (annuaire) ───────────────────────────────────────────────────────
export async function fetchProfiles() {
  const sb = createClient()
  const { data } = await sb.from("profiles").select("*").order("name")
  return data ?? []
}
