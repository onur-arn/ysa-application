"use client"

import { StoriesBar } from "./stories-bar"
import { PostsFeed } from "./posts-feed"

export function FeedClient() {
  return (
    <>
      <StoriesBar />
      <div className="px-4 py-4">
        <PostsFeed />
      </div>
    </>
  )
}
