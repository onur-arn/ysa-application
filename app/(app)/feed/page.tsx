export const dynamic = 'force-dynamic'

import { createClient } from "@/lib/supabase/server"
import { FeedClient } from "./feed-client"

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [profileRes, allProfilesRes, postsRes, igemRes, storiesRes, igemCommentsRes] = await Promise.all([
    user
      ? supabase.from("profiles").select("name,initials,station,photo_url").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id,name,photo_url"),
    supabase
      .from("posts")
      .select("id,author,initials,station,content,image_url,created_at,created_by,post_likes(voter_name),post_comments(id,author,initials,station,text,created_at),polls(id,question,poll_options(id,text,position,poll_votes(option_id,voter_name)))")
      .order("created_at", { ascending: false }),
    supabase
      .from("igem_requests")
      .select("id,author,initials,station,motivation,created_at,created_by"),
    supabase
      .from("stories")
      .select("*")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true }),
    supabase
      .from("igem_comments")
      .select("id,igem_id,author,initials,station,text,created_at")
      .order("created_at", { ascending: true }),
  ])

  return (
    <FeedClient
      initialUserId={user?.id ?? ""}
      initialProfile={profileRes.data as { name: string; initials: string; station: string; photo_url: string | null } | null}
      initialProfiles={(allProfilesRes.data ?? []) as { id: string; name: string; photo_url: string | null }[]}
      initialPosts={(postsRes.data ?? []) as Record<string, unknown>[]}
      initialIgem={(igemRes.data ?? []) as Record<string, unknown>[]}
      initialStories={(storiesRes.data ?? []) as Record<string, unknown>[]}
      initialIgemComments={(igemCommentsRes.data ?? []) as Record<string, unknown>[]}
    />
  )
}
