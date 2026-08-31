import type { QueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { storyKeys } from "./keys"

export type StoryRow = {
  id: string
  station: string
  authorName: string
  initials: string
  imageUrl: string
  createdAt: string
  fitMode?: "cover" | "contain"
  musicPreviewUrl?: string
  musicLabel?: string
}

export function mapStoryRow(s: Record<string, unknown>): StoryRow {
  return {
    id: s.id as string,
    station: s.station as string,
    authorName: s.author_name as string,
    initials: s.initials as string,
    imageUrl: s.image_url as string,
    createdAt: s.created_at as string,
    fitMode: ((s.fit_mode as "cover" | "contain") ?? "cover"),
    musicPreviewUrl: (s.music_preview_url as string) ?? undefined,
    musicLabel: (s.music_label as string) ?? undefined,
  }
}

export async function fetchStories(): Promise<StoryRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("stories")
    .select("id,station,author_name,initials,image_url,created_at,fit_mode,music_preview_url,music_label")
    .order("created_at", { ascending: true })
  return (data ?? []).map((s) => mapStoryRow(s as Record<string, unknown>))
}

export function prefetchStories(qc: QueryClient) {
  return qc.prefetchQuery({
    queryKey: storyKeys.list(),
    queryFn: fetchStories,
    staleTime: 60_000,
  })
}
