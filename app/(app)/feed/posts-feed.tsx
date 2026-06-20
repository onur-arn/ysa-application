"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Heart, MessageCircle, Send, X, Plus, Rocket, ImagePlus, Trash2, Archive, ChevronDown, ChevronUp } from "lucide-react"
import { POSTS, type Post, type PostComment } from "@/lib/data/posts"
import { getStation } from "@/lib/data/stations"

const STORAGE_KEY = "ysa-posts"
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return "şimdi"
  if (diff < 3600) return `${Math.floor(diff / 60)}dk`
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa`
  return `${Math.floor(diff / 86400)}g`
}

function Avatar({ initials, station, size = 10 }: { initials: string; station: string; size?: number }) {
  const s = getStation(station as never)
  return (
    <span
      className={`flex size-${size} shrink-0 items-center justify-center rounded-full text-xs font-bold text-white`}
      style={{ backgroundColor: `hsl(${s.color})` }}
    >
      {initials}
    </span>
  )
}

function PostCard({ post, onUpdate, onDelete }: { post: Post; onUpdate: (p: Post) => void; onDelete?: () => void }) {
  const ME = "Moi"
  const isOwn = post.author === ME
  const [liked, setLiked] = useState(() => (post.likedBy ?? []).includes(ME))
  const [showComments, setShowComments] = useState(false)
  const [showLikers, setShowLikers] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [commentText, setCommentText] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const s = getStation(post.station as never)

  function toggleLike() {
    const current = post.likedBy ?? []
    const newLikedBy = liked ? current.filter(n => n !== ME) : [...current, ME]
    setLiked(!liked)
    onUpdate({ ...post, likedBy: newLikedBy })
  }

  function submitComment() {
    if (!commentText.trim()) return
    const newComment: PostComment = {
      id: `c-${Date.now()}`,
      author: ME,
      initials: "ME",
      station: "paris" as never,
      text: commentText.trim(),
      time: "şimdi",
    }
    onUpdate({ ...post, comments: [...post.comments, newComment] })
    setCommentText("")
  }

  return (
    <div className="rounded-2xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4">
        <Avatar initials={post.initials} station={post.station} size={10} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{post.author}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: `hsl(${s.color})` }}>{s.name}</span>
            <span className="text-xs text-muted-foreground">· {timeAgo(post.createdAt)}</span>
          </div>
        </div>
        {isOwn && !confirmDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-secondary"
          >
            <Trash2 className="size-4" />
          </button>
        )}
        {isOwn && confirmDelete && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onDelete?.()}
              className="rounded-lg bg-destructive px-2.5 py-1 text-xs font-semibold text-white"
            >
              Sil
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground"
            >
              İptal
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <p className="px-4 py-3 text-sm leading-relaxed text-foreground">{post.content}</p>

      {/* Image */}
      {post.imageUrl && (
        <div className="px-4 pb-3">
          <img
            src={post.imageUrl}
            alt=""
            className="w-full rounded-xl object-cover"
            style={{ maxHeight: 320 }}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 border-t border-border/60 px-3 py-2">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
            liked ? "text-rose-500" : "text-muted-foreground"
          }`}
        >
          <motion.div whileTap={{ scale: 0.75 }} transition={{ type: "spring", stiffness: 600, damping: 15 }}>
            <Heart className={`size-4 ${liked ? "fill-rose-500" : ""}`} />
          </motion.div>
          {(post.likedBy ?? []).length > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setShowLikers(v => !v) }}
              className="font-medium underline-offset-2 hover:underline"
            >
              {(post.likedBy ?? []).length}
            </button>
          )}
        </button>
        <button
          onClick={() => { setShowComments(v => !v); setTimeout(() => inputRef.current?.focus(), 100) }}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors"
        >
          <MessageCircle className="size-4" />
          {post.comments.length > 0 && post.comments.length}
        </button>
      </div>

      {/* Likers list */}
      <AnimatePresence>
        {showLikers && (post.likedBy ?? []).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
          >
            <div className="border-t border-border/60 px-4 py-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Beğenenler</p>
              <div className="flex flex-wrap gap-1.5">
                {(post.likedBy ?? []).map(name => (
                  <span key={name} className="rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-600">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
          >
            <div className="border-t border-border/60 px-4 pb-3 pt-2">
              {post.comments.map(c => (
                <div key={c.id} className="flex gap-2.5 py-2">
                  <Avatar initials={c.initials} station={c.station} size={7} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-semibold text-foreground">{c.author}</span>
                      <span className="text-[10px] text-muted-foreground">{c.time}</span>
                    </div>
                    <p className="text-xs text-foreground/80">{c.text}</p>
                  </div>
                </div>
              ))}

              {/* Input */}
              <div className="mt-2 flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submitComment()}
                  placeholder="Yorum yaz…"
                  className="h-9 flex-1 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
                <button
                  onClick={submitComment}
                  disabled={!commentText.trim()}
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Compose modal ─────────────────────────────────────────────────────────────
function ComposeModal({ onClose, onPost }: { onClose: () => void; onPost: (content: string, imageUrl?: string) => void }) {
  const [content, setContent] = useState("")
  const [imageUrl, setImageUrl] = useState<string | undefined>()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <h2 className="font-heading text-base font-bold text-foreground">Yeni paylaşım</h2>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground active:bg-secondary">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-4">
          <textarea
            autoFocus
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Ne paylaşmak istiyorsunuz?"
            rows={4}
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />

          {/* Image preview */}
          {imageUrl && (
            <div className="relative mt-3">
              <img src={imageUrl} alt="" className="w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
              <button
                onClick={() => setImageUrl(undefined)}
                className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors active:bg-secondary"
            >
              <ImagePlus className="size-4" />
              Fotoğraf
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button
              onClick={() => { if (content.trim()) { onPost(content.trim(), imageUrl); onClose() } }}
              disabled={!content.trim()}
              className="ml-auto rounded-xl bg-primary px-6 py-2.5 font-semibold text-primary-foreground transition-colors active:bg-primary/80 disabled:opacity-40"
            >
              Paylaş
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── iGEM card ─────────────────────────────────────────────────────────────────
function IgemCard({ author, initials, station, motivation, date }: {
  author: string; initials: string; station: string; motivation: string; date: string
}) {
  const s = getStation(station as never)
  return (
    <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-purple-500/15 px-2.5 py-1 text-xs font-semibold text-purple-600">
          <Rocket className="size-3.5" /> iGEM Talebi
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: `hsl(${s.color})` }}
        >
          {initials}
        </span>
        <div>
          <p className="font-semibold text-foreground">{author}</p>
          <p className="text-xs font-medium" style={{ color: `hsl(${s.color})` }}>{s.name}</p>
        </div>
        <span className="ml-auto text-xs text-muted-foreground">{timeAgo(date)}</span>
      </div>
      {motivation && (
        <p className="mt-3 text-sm leading-relaxed text-foreground/80">{motivation}</p>
      )}
    </div>
  )
}

// ── Main feed ─────────────────────────────────────────────────────────────────
export function PostsFeed() {
  const [igemRequests, setIgemRequests] = useState<{ author: string; initials: string; station: string; motivation: string; date: string }[]>([])
  const [showArchive, setShowArchive] = useState(false)
  const [isIntl, setIsIntl] = useState(false)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("igem-requests") ?? "[]")
      setIgemRequests(stored)
    } catch {}

    try {
      const email = localStorage.getItem("ysa-current-user-email")
      if (!email) { setIsIntl(true); return }
      const registered = JSON.parse(localStorage.getItem("ysa-registered-members") ?? "[]")
      const me = registered.find((m: { email: string }) => m.email === email)
      setIsIntl(!me || me.station === "intl")
    } catch { setIsIntl(true) }
  }, [])

  const [posts, setPosts] = useState<Post[]>(() => {
    if (typeof window === "undefined") return POSTS
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? [...JSON.parse(saved), ...POSTS] : POSTS
    } catch { return POSTS }
  })
  const [composeOpen, setComposeOpen] = useState(false)

  function updatePost(updated: Post) {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  function deletePost(id: string) {
    setPosts(prev => {
      const updated = prev.filter(p => p.id !== id)
      try {
        const userPosts = updated.filter(p => p.id.startsWith("user-"))
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userPosts))
      } catch {}
      return updated
    })
  }

  function addPost(content: string, imageUrl?: string) {
    const newPost: Post = {
      id: `user-${Date.now()}`,
      author: "Moi",
      initials: "ME",
      station: "paris",
      content,
      imageUrl,
      createdAt: new Date().toISOString(),
      likedBy: [],
      comments: [],
    }
    const updated = [newPost, ...posts]
    setPosts(updated)
    try {
      const userPosts = updated.filter(p => p.id.startsWith("user-"))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userPosts))
    } catch {}
  }

  const cutoff = Date.now() - SEVEN_DAYS_MS

  type FeedItem =
    | { kind: "post"; data: Post; date: string }
    | { kind: "igem"; data: typeof igemRequests[number]; idx: number; date: string }

  const allItems: FeedItem[] = [
    ...posts.map(p => ({ kind: "post" as const, data: p, date: p.createdAt })),
    ...igemRequests.map((r, i) => ({ kind: "igem" as const, data: r, idx: i, date: r.date })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const freshItems   = allItems.filter(item => new Date(item.date).getTime() > cutoff)
  const archivedItems = allItems.filter(item => new Date(item.date).getTime() <= cutoff)

  function renderItem(item: FeedItem) {
    if (item.kind === "igem") {
      return (
        <IgemCard
          key={`igem-${item.idx}`}
          author={item.data.author}
          initials={item.data.initials ?? "?"}
          station={item.data.station ?? "intl"}
          motivation={item.data.motivation}
          date={item.data.date}
        />
      )
    }
    return (
      <PostCard
        key={item.data.id}
        post={item.data}
        onUpdate={updatePost}
        onDelete={() => deletePost(item.data.id)}
      />
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {freshItems.map(renderItem)}

        {/* Archives section — intl only */}
        {isIntl && archivedItems.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowArchive(v => !v)}
              className="flex w-full items-center gap-2 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors active:bg-muted"
            >
              <Archive className="size-4 shrink-0" />
              <span className="flex-1 text-left">Archives</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{archivedItems.length}</span>
              {showArchive ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
            </button>

            <AnimatePresence>
              {showArchive && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-3 pt-3 opacity-70">
                    {archivedItems.map(renderItem)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Compose button */}
      <button
        onClick={() => setComposeOpen(true)}
        className="fixed bottom-20 right-1/2 z-30 flex h-14 w-14 translate-x-[calc(min(50vw,224px)-1.5rem)] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90"
      >
        <Plus className="h-7 w-7" />
      </button>

      <AnimatePresence>
        {composeOpen && (
          <ComposeModal onClose={() => setComposeOpen(false)} onPost={addPost} />
        )}
      </AnimatePresence>
    </>
  )
}
