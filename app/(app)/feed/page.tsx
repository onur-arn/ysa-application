
import { createClient } from "@/lib/supabase/server"
import { FEED_RETENTION_MS } from "@/lib/monthly-export"
import { storyCutoffIso } from "@/lib/queries/stories"
import { FeedClient } from "./feed-client"

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const postsCutoff = new Date(Date.now() - FEED_RETENTION_MS).toISOString()
  const storiesCutoff = storyCutoffIso()

  // Keep all content in DB for yönetici / export — only hide by date in the feed UI
  const [profileRes, allProfilesRes, postsRes, igemRes, storiesRes, igemCommentsRes] = await Promise.all([
    user
      ? supabase.from("profiles").select("name,initials,station,photo_url").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id,name,photo_url"),
    supabase
      .from("posts")
      .select("id,author,initials,station,content,image_url,created_at,created_by,post_likes(voter_name),post_comments(id,author,initials,station,text,created_at),polls(id,question,poll_options(id,text,position,poll_votes(option_id,voter_name)))")
      .gte("created_at", postsCutoff)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("igem_requests")
      .select("id,author,initials,station,motivation,created_at,created_by")
      .gte("created_at", postsCutoff)
      .order("created_at", { ascending: false }),
    supabase
      .from("stories")
      .select("*")
      .gte("created_at", storiesCutoff)
      .order("created_at", { ascending: true }),
    supabase
      .from("igem_comments")
      .select("id,igem_id,author,initials,station,text,created_at")
      .order("created_at", { ascending: true }),
  ])

  const igemIds = new Set((igemRes.data ?? []).map((r) => r.id as string))
  const filteredComments = (igemCommentsRes.data ?? []).filter((c) => igemIds.has(c.igem_id as string))

  return (
    <FeedClient
      initialUserId={user?.id ?? ""}
      initialProfile={profileRes.data as { name: string; initials: string; station: string; photo_url: string | null } | null}
      initialProfiles={(allProfilesRes.data ?? []) as { id: string; name: string; photo_url: string | null }[]}
      initialPosts={(postsRes.data ?? []) as Record<string, unknown>[]}
      initialIgem={(igemRes.data ?? []) as Record<string, unknown>[]}
      initialStories={(storiesRes.data ?? []) as Record<string, unknown>[]}
      initialIgemComments={filteredComments as Record<string, unknown>[]}
    />
  )
}
