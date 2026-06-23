"use client"

import { StoriesBar } from "./stories-bar"
import { PostsFeed } from "./posts-feed"

interface FeedClientProps {
  initialUserId?: string
  initialProfile?: { name: string; initials: string; station: string; photo_url: string | null } | null
  initialProfiles?: { id: string; name: string; photo_url: string | null }[]
  initialPosts?: Record<string, unknown>[]
  initialIgem?: Record<string, unknown>[]
  initialStories?: Record<string, unknown>[]
}

export function FeedClient({
  initialUserId = "",
  initialProfile = null,
  initialProfiles = [],
  initialPosts = [],
  initialIgem = [],
  initialStories = [],
}: FeedClientProps) {
  return (
    <>
      <StoriesBar
        initialUser={initialProfile ? {
          name: initialProfile.name ?? "",
          station: initialProfile.station ?? "paris",
          initials: initialProfile.initials ?? "",
        } : undefined}
        initialStories={initialStories}
      />
      <div className="px-4 py-4">
        <PostsFeed
          initialMe={initialUserId ? {
            id: initialUserId,
            name: initialProfile?.name ?? "",
            initials: initialProfile?.initials ?? "",
            station: initialProfile?.station ?? "paris",
            photoUrl: initialProfile?.photo_url ?? null,
          } : undefined}
          initialPosts={initialPosts}
          initialIgem={initialIgem}
          initialPhotoMap={initialProfiles}
        />
      </div>
    </>
  )
}
