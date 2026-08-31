"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Heart, MessageCircle, Send, X, Plus, Rocket, ImagePlus, Trash2, BarChart2, Check, Users, ChevronDown as CommentsToggle, Sparkles } from "lucide-react"
import { type Post, type PostComment, type Poll, type PollOption } from "@/lib/data/posts"
import { getStation, type StationId } from "@/lib/data/stations"
import { FEED_RETENTION_MS } from "@/lib/monthly-export"
import { createClient } from "@/lib/supabase/client"
import { Modal } from "@/components/ui/modal"
import { uploadPostImage } from "@/lib/chat-media"


function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return "şimdi"
  if (diff < 3600) return `${Math.floor(diff / 60)}dk`
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa`
  return `${Math.floor(diff / 86400)}g`
}

function Avatar({ initials, station, size = 10, photoUrl }: { initials: string; station: string; size?: number; photoUrl?: string | null }) {
  const s = getStation(station as never)
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={initials}
        className={`size-${size} shrink-0 rounded-full object-cover`}
      />
    )
  }
  return (
    <span
      className={`flex size-${size} shrink-0 items-center justify-center rounded-full text-xs font-bold text-white`}
      style={{ backgroundColor: `hsl(${s.color})` }}
    >
      {initials}
    </span>
  )
}

function PostCard({ post, onUpdate, onDelete, me, photoMap }: {
  post: Post
  onUpdate: (p: Post) => void
  onDelete?: () => void
  me: { id: string; name: string; initials: string; station: string; photoUrl?: string | null }
  photoMap: Map<string, string>
}) {
  const ME = me.name
  const isOwn = !!post.createdBy && post.createdBy === me.id
  const [liked, setLiked] = useState(() => (post.likedBy ?? []).includes(ME))
  const [showComments, setShowComments] = useState(false)
  const [showLikers, setShowLikers] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [commentText, setCommentText] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const s = getStation(post.station as never)
  const [imgFit, setImgFit] = useState<"cover" | "contain">("cover")
  const [imgMaxH, setImgMaxH] = useState(320)

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    const ratio = img.naturalWidth / img.naturalHeight
    if (ratio < 0.85) {
      // Portrait: show full image
      setImgFit("contain")
      setImgMaxH(480)
    } else if (ratio > 1.4) {
      // Landscape: constrain height, no crop
      setImgFit("contain")
      setImgMaxH(260)
    } else {
      // Square-ish: cover
      setImgFit("cover")
      setImgMaxH(320)
    }
  }

  const myVote = post.poll
    ? (post.poll.options.find(o => o.voters.includes(ME))?.id ?? null)
    : null

  async function vote(optionId: string) {
    if (!post.poll) return
    const alreadyMine = post.poll.options.find(o => o.id === optionId)?.voters.includes(ME)
    const previousVotedId = post.poll.options.find(o => o.voters.includes(ME))?.id
    const newOptions = post.poll.options.map(o => {
      const without = o.voters.filter(v => v !== ME)
      return o.id === optionId && !alreadyMine
        ? { ...o, voters: [...without, ME] }
        : { ...o, voters: without }
    })
    onUpdate({ ...post, poll: { ...post.poll, options: newOptions } })
    const supabase = createClient()
    if (previousVotedId) {
      await supabase.from("poll_votes").delete().eq("option_id", previousVotedId).eq("voter_name", ME)
    }
    if (!alreadyMine) {
      await supabase.from("poll_votes").insert({ option_id: optionId, voter_name: ME })
    }
  }

  async function toggleLike() {
    const current = post.likedBy ?? []
    const nowLiked = !liked
    const newLikedBy = nowLiked ? [...current, ME] : current.filter((n) => n !== ME)
    setLiked(nowLiked)
    onUpdate({ ...post, likedBy: newLikedBy })
    const supabase = createClient()
    if (nowLiked) {
      await supabase.from("post_likes").insert({ post_id: post.id, voter_name: ME })
    } else {
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("voter_name", ME)
    }
  }

  async function submitComment() {
    if (!commentText.trim()) return
    const text = commentText.trim()
    setCommentText("")
    const supabase = createClient()
    await supabase.from("post_comments").insert({
      post_id: post.id,
      author: me.name,
      initials: me.initials,
      station: me.station,
      text,
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4">
        <Avatar initials={post.initials} station={post.station} size={10} photoUrl={photoMap.get(post.createdBy ?? post.author)} />
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

      {/* Poll */}
      {post.poll && <PollBlock poll={post.poll} myVote={myVote} onVote={vote} />}

      {/* Image */}
      {post.imageUrl && (
        <div className="px-4 pb-3">
          <img
            src={post.imageUrl}
            alt=""
            onLoad={handleImgLoad}
            className="w-full rounded-xl bg-muted"
            style={{ objectFit: imgFit, maxHeight: imgMaxH }}
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
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); setShowLikers(v => !v) }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setShowLikers(v => !v) } }}
              className="font-medium underline-offset-2 hover:underline cursor-pointer"
            >
              {(post.likedBy ?? []).length}
            </span>
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
                  <Avatar initials={c.initials} station={c.station} size={7} photoUrl={photoMap.get(c.author)} />
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
function ComposeModal({ open, onClose, onPost }: {
  open: boolean
  onClose: () => void
  onPost: (content: string, imageFile?: File, poll?: Poll) => void | Promise<void>
}) {
  const [tab, setTab] = useState<"post" | "poll">("post")
  const [content, setContent] = useState("")
  const [imageFile, setImageFile] = useState<File | undefined>()
  const [imagePreview, setImagePreview] = useState<string | undefined>()
  const [posting, setPosting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(undefined)
    setImagePreview(undefined)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    clearImage()
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    e.target.value = ""
  }

  function setOption(i: number, v: string) {
    setOptions(p => p.map((o, idx) => idx === i ? v : o))
  }
  function addOption() { setOptions(p => [...p, ""]) }
  function removeOption(i: number) {
    if (options.length <= 2) return
    setOptions(p => p.filter((_, idx) => idx !== i))
  }

  const validOptions = options.filter(o => o.trim())
  const canPost = content.trim()
  const canPoll = question.trim() && validOptions.length >= 2

  async function submitPost() {
    if (!canPost || posting) return
    setPosting(true)
    try {
      await onPost(content.trim(), imageFile)
      setContent("")
      clearImage()
      onClose()
    } catch {
      // keep modal open on failure
    } finally {
      setPosting(false)
    }
  }

  async function submitPoll() {
    if (!canPoll || posting) return
    const pollOptions: PollOption[] = validOptions.map((text, i) => ({
      id: `opt-${i}`,
      text: text.trim(),
      voters: [],
    }))
    setPosting(true)
    try {
      await onPost(question.trim(), undefined, { question: question.trim(), options: pollOptions })
      setQuestion("")
      setOptions(["", ""])
      onClose()
    } catch {
      // keep modal open on failure
    } finally {
      setPosting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Yeni paylaşım">
      <div className="-mx-5 -mt-5 mb-5 flex gap-2 border-b border-border px-5 pb-3 pt-1">
        <button
          onClick={() => setTab("post")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
            tab === "post" ? "bg-primary/10 text-primary" : "text-muted-foreground"
          }`}
        >
          <MessageCircle className="size-3.5" /> Paylaşım
        </button>
        <button
          onClick={() => setTab("poll")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
            tab === "poll" ? "bg-primary/10 text-primary" : "text-muted-foreground"
          }`}
        >
          <BarChart2 className="size-3.5" /> Anket
        </button>
      </div>

      {tab === "post" ? (
        <div className="flex flex-col gap-4">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Ne paylaşmak istiyorsunuz?"
            rows={4}
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          {imagePreview && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="" className="w-full rounded-xl object-cover" style={{ maxHeight: 220 }} />
              <button
                onClick={clearImage}
                className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors active:bg-secondary"
            >
              <ImagePlus className="size-4" /> Fotoğraf
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button
              onClick={() => void submitPost()}
              disabled={!canPost || posting}
              className="ml-auto rounded-xl bg-primary px-6 py-2.5 font-semibold text-primary-foreground transition-colors active:bg-primary/80 disabled:opacity-40"
            >
              {posting ? "Gönderiliyor…" : "Paylaş"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Soru</label>
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Sorunuzu yazın…"
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Seçenekler</label>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={e => setOption(i, e.target.value)}
                  placeholder={`Seçenek ${i + 1}`}
                  className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
                {options.length > 2 && (
                  <button
                    onClick={() => removeOption(i)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-secondary"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <button
                onClick={addOption}
                className="flex items-center gap-1.5 self-start rounded-xl border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors active:bg-secondary"
              >
                <Plus className="size-3.5" /> Seçenek ekle
              </button>
            )}
          </div>
          <button
            onClick={() => void submitPoll()}
            disabled={!canPoll || posting}
            className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors active:bg-primary/80 disabled:opacity-40"
          >
            {posting ? "Gönderiliyor…" : "Anketi paylaş"}
          </button>
        </div>
      )}
    </Modal>
  )
}

// ── Poll block ────────────────────────────────────────────────────────────────
function PollBlock({ poll, myVote, onVote }: { poll: Poll; myVote: string | null; onVote: (id: string) => void }) {
  const total = poll.options.reduce((s, o) => s + o.voters.length, 0)

  return (
    <div className="mx-4 mb-3 flex flex-col gap-2 rounded-xl border border-border bg-secondary/30 p-3">
      {poll.options.map(opt => {
        const pct = total > 0 ? Math.round((opt.voters.length / total) * 100) : 0
        const isMyVote = myVote === opt.id
        return (
          <div key={opt.id}>
            <button
              onClick={() => onVote(opt.id)}
              className={`relative w-full overflow-hidden rounded-xl border text-left transition-all ${
                isMyVote ? "border-primary" : "border-border/70"
              }`}
            >
              {/* Progress bar */}
              <div
                className={`absolute inset-y-0 left-0 rounded-xl transition-all duration-500 ${
                  isMyVote ? "bg-primary/20" : "bg-muted"
                }`}
                style={{ width: total > 0 ? `${pct}%` : "0%" }}
              />
              <div className="relative flex items-center gap-2 px-3 py-2.5">
                <span className={`flex-1 text-sm font-medium ${isMyVote ? "text-primary" : "text-foreground"}`}>
                  {opt.text}
                </span>
                {isMyVote && <Check className="size-3.5 shrink-0 text-primary" />}
                <span className="shrink-0 text-xs font-bold text-muted-foreground">{pct}%</span>
              </div>
            </button>

            {/* Voters */}
            {opt.voters.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 px-1">
                <Users className="size-3 shrink-0 text-muted-foreground/50" />
                {opt.voters.map((v, i) => (
                  <span key={v} className="text-xs text-muted-foreground">
                    {v}{i < opt.voters.length - 1 ? "," : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <p className="mt-0.5 text-right text-[11px] text-muted-foreground">{total} oy</p>
    </div>
  )
}

// ── iGEM card ─────────────────────────────────────────────────────────────────
function WelcomeCard({ post }: { post: Post }) {
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5">
      <div className="p-4">
        <div className="mb-3 flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 w-fit">
          <Sparkles className="size-3.5 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-600">Yeni Üye</span>
        </div>
        <p className="text-sm leading-relaxed text-foreground">{post.content}</p>
        <p className="mt-2 text-xs text-muted-foreground">{timeAgo(post.createdAt)}</p>
      </div>
    </div>
  )
}

type IgemComment = { id: string; author: string; initials: string; station: string; text: string; time: string }

function IgemCard({ id, author, initials, station, motivation, date, photoMap, me, onDelete }: {
  id: string; author: string; initials: string; station: string; motivation: string; date: string
  photoMap: Map<string, string>
  me: { id: string; name: string; initials: string; station: string }
  onDelete?: () => void
}) {
  const s = getStation(station as never)
  const photo = photoMap.get(author)
  const isOwn = author === me.name
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5">
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-purple-500/15 px-2.5 py-1 text-xs font-semibold text-purple-600">
            <Rocket className="size-3.5" /> iGEM Talebi
          </span>
          {isOwn && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)} className="flex size-7 items-center justify-center rounded-full text-muted-foreground active:bg-purple-500/10">
              <Trash2 className="size-3.5" />
            </button>
          )}
          {isOwn && confirmDelete && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => onDelete?.()} className="rounded-lg bg-destructive px-2.5 py-1 text-xs font-semibold text-white">Sil</button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">İptal</button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {photo ? (
            <img src={photo} alt={initials} className="size-10 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: `hsl(${s.color})` }}>
              {initials}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{author}</p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium" style={{ color: `hsl(${s.color})` }}>{s.name}</span>
              <span className="text-xs text-muted-foreground">· {timeAgo(date)}</span>
            </div>
          </div>
        </div>
        {motivation && <p className="mt-3 text-sm leading-relaxed text-foreground/80">{motivation}</p>}
      </div>
    </div>
  )
}

// ── Main feed ─────────────────────────────────────────────────────────────────
interface PostsFeedProps {
  initialMe?: { id: string; name: string; initials: string; station: string; photoUrl?: string | null }
  initialPosts?: Record<string, unknown>[]
  initialIgem?: Record<string, unknown>[]
  initialPhotoMap?: { id: string; name: string; photo_url: string | null }[]
  initialIgemComments?: Record<string, unknown>[]
}

function mapPostsFromRaw(postsRaw: Record<string, unknown>[]): Post[] {
  return postsRaw.map((p) => {
    // polls is returned as a single object (not array) because post_id has UNIQUE constraint
    const rawPoll = (p.polls as { id: string; question: string; poll_options: { id: string; text: string; position: number; poll_votes: { option_id: string; voter_name: string }[] }[] } | null) ?? null
    const poll: Poll | undefined = rawPoll ? {
      question: rawPoll.question,
      options: (rawPoll.poll_options ?? [])
        .sort((a, b) => a.position - b.position)
        .map(opt => ({
          id: opt.id,
          text: opt.text,
          voters: (opt.poll_votes ?? []).map(v => v.voter_name),
        })),
    } : undefined

    return {
      id: p.id as string,
      author: (p.author as string) ?? "",
      initials: (p.initials as string) ?? "?",
      station: ((p.station ?? "paris") as StationId),
      content: (p.content as string) ?? "",
      imageUrl: (p.image_url as string) ?? undefined,
      createdAt: p.created_at as string,
      createdBy: (p.created_by as string) ?? undefined,
      likedBy: ((p.post_likes as { voter_name: string }[]) ?? []).map((l) => l.voter_name),
      poll,
      comments: ((p.post_comments as { id: string; author: string; initials: string; station: string; text: string; created_at: string }[]) ?? []).map((c) => ({
        id: c.id,
        author: c.author ?? "",
        initials: c.initials ?? "?",
        station: ((c.station ?? "paris") as StationId),
        text: c.text ?? "",
        time: timeAgo(c.created_at),
      })),
    }
  })
}

export function PostsFeed({
  initialMe,
  initialPosts = [],
  initialIgem = [],
  initialPhotoMap = [],
  initialIgemComments = [],
}: PostsFeedProps) {
  const [igemRequests, setIgemRequests] = useState<{ id: string; author: string; initials: string; station: string; motivation: string; date: string; createdBy?: string; comments: IgemComment[] }[]>(() =>
    initialIgem.map((r) => ({
      id: (r.id as string) ?? "",
      author: (r.author as string) ?? "",
      initials: (r.initials as string) ?? "?",
      station: (r.station as string) ?? "intl",
      motivation: (r.motivation as string) ?? "",
      date: r.created_at as string,
      createdBy: (r.created_by as string) ?? undefined,
      comments: initialIgemComments
        .filter(c => c.igem_id === r.id)
        .map(c => ({
          id: c.id as string,
          author: (c.author as string) ?? "",
          initials: (c.initials as string) ?? "?",
          station: (c.station as string) ?? "intl",
          text: (c.text as string) ?? "",
          time: timeAgo(c.created_at as string),
        })),
    }))
  )
  const [photoMap, setPhotoMap] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>()
    initialPhotoMap.forEach(p => {
      if (p.photo_url) {
        map.set(p.id, p.photo_url)
        map.set(p.name, p.photo_url)
      }
    })
    return map
  })
  const [me, setMe] = useState<{ id: string; name: string; initials: string; station: string; photoUrl?: string | null }>(
    initialMe ?? { id: "", name: "", initials: "", station: "paris" }
  )

  const [posts, setPosts] = useState<Post[]>(() => mapPostsFromRaw(initialPosts))
  const [composeOpen, setComposeOpen] = useState(false)
  const latestPostTimeRef = useRef<string>("")

  // Keep latestPostTimeRef in sync so polling can fetch only new posts
  useEffect(() => {
    if (posts.length > 0) latestPostTimeRef.current = posts[0].createdAt
  }, [posts])

  // Polling fallback: fetch posts newer than what we have
  useEffect(() => {
    async function refetchNew() {
      const since = latestPostTimeRef.current
      if (!since) return
      const supabase = createClient()
      const { data } = await supabase
        .from("posts")
        .select("id,author,initials,station,content,image_url,created_at,created_by,post_likes(voter_name),post_comments(id,author,initials,station,text,created_at),polls(id,question,poll_options(id,text,position,poll_votes(option_id,voter_name)))")
        .gt("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10)
      if (data && data.length > 0) {
        const incoming = mapPostsFromRaw(data as Record<string, unknown>[])
        setPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id))
          const toAdd = incoming.filter((p) => !ids.has(p.id))
          return toAdd.length > 0 ? [...toAdd, ...prev] : prev
        })
      }
    }

    const interval = setInterval(refetchNew, 30_000)
    const onVisible = () => { if (document.visibilityState === "visible") refetchNew() }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()

    // Realtime: new posts appear instantly for all users
    const channel = supabase
      .channel("posts-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (payload) => {
        const p = payload.new as { id: string; author?: string; initials?: string; station?: string; content: string; image_url?: string | null; created_at: string }
        setPosts((prev) => {
          if (prev.some((x) => x.id === p.id)) return prev
          return [{
            id: p.id,
            author: p.author ?? "",
            initials: p.initials ?? "?",
            station: (p.station ?? "paris") as StationId,
            content: p.content ?? "",
            imageUrl: p.image_url ?? undefined,
            createdAt: p.created_at,
            likedBy: [],
            comments: [],
          }, ...prev]
        })
        // Fetch full post with poll data after a short delay (poll_options inserted after the post)
        setTimeout(async () => {
          const sb = createClient()
          const { data: full } = await sb
            .from("posts")
            .select("id,author,initials,station,content,image_url,created_at,created_by,post_likes(voter_name),post_comments(id,author,initials,station,text,created_at),polls(id,question,poll_options(id,text,position,poll_votes(option_id,voter_name)))")
            .eq("id", p.id)
            .single()
          if (full) {
            const mapped = mapPostsFromRaw([full as Record<string, unknown>])[0]
            setPosts(prev => prev.map(x => {
              if (x.id !== p.id) return x
              // Prefer whichever version has actual options (DB > optimistic)
              const bestPoll = mapped.poll?.options?.length ? mapped.poll : x.poll
              return { ...mapped, poll: bestPoll }
            }))
          }
        }, 2500)
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, (payload) => {
        setPosts((prev) => prev.filter((p) => p.id !== payload.old.id))
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_comments" }, (payload) => {
        const c = payload.new as { id: string; post_id: string; author: string; initials: string; station: string; text: string; created_at: string }
        setPosts((prev) => prev.map((p) => {
          if (p.id !== c.post_id) return p
          if (p.comments.some((x) => x.id === c.id)) return p
          return {
            ...p,
            comments: [...p.comments, {
              id: c.id,
              author: c.author ?? "",
              initials: c.initials ?? "?",
              station: (c.station ?? "paris") as never,
              text: c.text ?? "",
              time: timeAgo(c.created_at),
            }],
          }
        }))
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "polls" }, (payload) => {
        const poll = payload.new as { id: string; post_id: string; question: string }
        // Wait for poll_options to be inserted, then patch the post
        setTimeout(async () => {
          const sb = createClient()
          const { data } = await sb
            .from("polls")
            .select("id,question,poll_options(id,text,position,poll_votes(option_id,voter_name))")
            .eq("id", poll.id)
            .single()
          if (data) {
            const pollData: Poll = {
              question: data.question,
              options: ((data.poll_options as {id:string;text:string;position:number;poll_votes:{option_id:string;voter_name:string}[]}[]) ?? [])
                .sort((a, b) => a.position - b.position)
                .map(opt => ({
                  id: opt.id,
                  text: opt.text,
                  voters: (opt.poll_votes ?? []).map((v) => v.voter_name),
                })),
            }
            setPosts(prev => prev.map(p => {
              if (p.id !== poll.post_id) return p
              // Only update if we got real options; preserve existing if DB returned empty
              if (pollData.options.length === 0 && p.poll?.options?.length) return p
              return { ...p, poll: pollData }
            }))
          }
        }, 1500)
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_likes" }, (payload) => {
        const l = payload.new as { post_id: string; voter_name: string }
        setPosts((prev) => prev.map((p) => {
          if (p.id !== l.post_id) return p
          if ((p.likedBy ?? []).includes(l.voter_name)) return p
          return { ...p, likedBy: [...(p.likedBy ?? []), l.voter_name] }
        }))
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "post_likes" }, (payload) => {
        const l = payload.old as { post_id: string; voter_name: string }
        setPosts((prev) => prev.map((p) => {
          if (p.id !== l.post_id) return p
          return { ...p, likedBy: (p.likedBy ?? []).filter((n) => n !== l.voter_name) }
        }))
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "poll_votes" }, (payload) => {
        const v = payload.new as { option_id: string; voter_name: string }
        setPosts(prev => prev.map(p => {
          if (!p.poll) return p
          if (!p.poll.options.some(o => o.id === v.option_id)) return p
          return { ...p, poll: { ...p.poll, options: p.poll.options.map(o =>
            o.id === v.option_id && !o.voters.includes(v.voter_name)
              ? { ...o, voters: [...o.voters, v.voter_name] }
              : o
          ) } }
        }))
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "poll_votes" }, (payload) => {
        const v = payload.old as { option_id: string; voter_name: string }
        setPosts(prev => prev.map(p => {
          if (!p.poll) return p
          return { ...p, poll: { ...p.poll, options: p.poll.options.map(o =>
            o.id === v.option_id ? { ...o, voters: o.voters.filter(n => n !== v.voter_name) } : o
          ) } }
        }))
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "igem_requests" }, (payload) => {
        const r = payload.new as { id: string; author: string; initials: string; station: string; motivation: string; created_at: string; created_by?: string }
        setIgemRequests((prev) => {
          if (prev.some((x) => x.id === r.id)) return prev
          return [{ id: r.id, author: r.author ?? "", initials: r.initials ?? "?", station: r.station ?? "intl", motivation: r.motivation ?? "", date: r.created_at, createdBy: r.created_by, comments: [] }, ...prev]
        })
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "igem_requests" }, (payload) => {
        const old = payload.old as { id: string }
        setIgemRequests((prev) => prev.filter((r) => r.id !== old.id))
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        const p = payload.new as { id: string; name: string; photo_url: string | null }
        setPhotoMap(prev => {
          const next = new Map(prev)
          if (p.photo_url) { next.set(p.id, p.photo_url); next.set(p.name, p.photo_url) }
          else { next.delete(p.id); next.delete(p.name) }
          return next
        })
      })
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR") console.error("[posts-realtime] channel error:", err)
        if (status === "TIMED_OUT") console.warn("[posts-realtime] timed out")
      })

    return () => { supabase.removeChannel(channel) }
  }, [])

  function updatePost(updated: Post) {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  async function deletePost(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id))
    const supabase = createClient()
    await supabase.from("posts").delete().eq("id", id)
  }

  async function addPost(content: string, imageFile?: File, poll?: Poll) {
    if (!me.name?.trim()) {
      window.alert("Profil adınız eksik. Ayarlardan adınızı kontrol edin.")
      throw new Error("missing profile name")
    }
    const newId = crypto.randomUUID()
    let imageUrl: string | undefined
    if (imageFile) {
      const uploaded = await uploadPostImage(imageFile)
      if (!uploaded) {
        window.alert("Fotoğraf yüklenemedi. JPEG/PNG deneyin (HEIC desteklenmiyor olabilir).")
        throw new Error("image upload failed")
      }
      imageUrl = uploaded
    }

    // Générer de vrais UUIDs pour les options (utilisés à la fois en local et en BD)
    const pollWithIds: Poll | undefined = poll ? {
      ...poll,
      options: poll.options.map((opt) => ({ ...opt, id: crypto.randomUUID() })),
    } : undefined
    const newPost: Post = {
      id: newId,
      author: me.name,
      initials: me.initials,
      station: me.station as never,
      content,
      imageUrl,
      poll: pollWithIds,
      createdAt: new Date().toISOString(),
      createdBy: me.id,
      likedBy: [],
      comments: [],
    }
    // Optimistic update — instant, no async wait
    setPosts(prev => [newPost, ...prev])
    window.scrollTo({ top: 0, behavior: "smooth" })
    const supabase = createClient()
    try {
      const { error } = await supabase.from("posts").insert({
        id: newId,
        author: me.name,
        initials: me.initials || "?",
        station: me.station || "intl",
        content,
        image_url: imageUrl ?? null,
        created_by: me.id || null,
      })
      if (error) {
        console.error("[addPost] insert:", error.message)
        setPosts(prev => prev.filter(p => p.id !== newId))
        window.alert("Paylaşım kaydedilemedi. Lütfen tekrar deneyin.")
        throw error
      }
      if (pollWithIds && pollWithIds.options.length >= 2) {
        const { data: pollRow, error: pollErr } = await supabase
          .from("polls")
          .insert({ post_id: newId, question: pollWithIds.question })
          .select()
          .single()
        if (pollErr) console.error("[addPost] polls insert:", pollErr)
        if (pollRow) {
          const { error: optErr } = await supabase.from("poll_options").insert(
            pollWithIds.options.map((opt, i) => ({
              id: opt.id,
              poll_id: pollRow.id,
              text: opt.text,
              position: i,
            }))
          )
          if (optErr) console.error("[addPost] poll_options insert:", optErr)
        }
      }
    } catch (e) {
      setPosts(prev => prev.filter(p => p.id !== newId))
      throw e
    }
  }

  const cutoff = Date.now() - FEED_RETENTION_MS

  type FeedItem =
    | { kind: "post"; data: Post; date: string }
    | { kind: "igem"; data: typeof igemRequests[number]; date: string }

  const visiblePosts = posts.filter(p => new Date(p.createdAt).getTime() > cutoff)
  const visibleIgem = igemRequests.filter(r => new Date(r.date).getTime() > cutoff)

  const allItems: FeedItem[] = [
    ...visiblePosts.map(p => ({ kind: "post" as const, data: p, date: p.createdAt })),
    ...visibleIgem.map((r) => ({ kind: "igem" as const, data: r, date: r.date })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  async function deleteIgem(id: string) {
    setIgemRequests(prev => prev.filter(r => r.id !== id))
    const res = await fetch("/api/igem/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id }),
    })
    if (!res.ok) {
      // Restore if delete failed
      const supabase = createClient()
      const { data } = await supabase.from("igem_requests").select("id,author,initials,station,motivation,created_at,created_by").eq("id", id).single()
      if (data) {
        setIgemRequests(prev => [{ id: data.id, author: data.author, initials: data.initials ?? "?", station: data.station ?? "intl", motivation: data.motivation ?? "", date: data.created_at, createdBy: data.created_by ?? undefined, comments: [] }, ...prev])
      }
    }
  }

  async function addIgemComment(igemId: string, text: string) {
    const supabase = createClient()
    const { data } = await supabase.from("igem_comments").insert({
      igem_id: igemId,
      author: me.name,
      initials: me.initials,
      station: me.station,
      text,
    }).select().single()
    if (data) {
      setIgemRequests(prev => prev.map(r =>
        r.id === igemId
          ? { ...r, comments: [...r.comments, { id: data.id, author: me.name, initials: me.initials, station: me.station, text, time: "şimdi" }] }
          : r
      ))
    }
  }

  function renderItem(item: FeedItem) {
    if (item.kind === "igem") {
      return (
        <IgemCard
          key={`igem-${item.data.id}`}
          id={item.data.id}
          author={item.data.author}
          initials={item.data.initials ?? "?"}
          station={item.data.station ?? "intl"}
          motivation={item.data.motivation}
          date={item.data.date}
          photoMap={photoMap}
          me={me}
          onDelete={() => deleteIgem(item.data.id)}
        />
      )
    }
    if (item.data.author === "YSA Uygulaması") {
      return <WelcomeCard key={item.data.id} post={item.data} />
    }
    return (
      <PostCard
        key={item.data.id}
        post={item.data}
        onUpdate={updatePost}
        onDelete={() => deletePost(item.data.id)}
        me={me}
        photoMap={photoMap}
      />
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {allItems.map(renderItem)}
      </div>

      {/* Compose button */}
      <button
        onClick={() => setComposeOpen(true)}
        className="fixed bottom-28 right-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90"
      >
        <Plus className="h-7 w-7" />
      </button>

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} onPost={addPost} />
    </>
  )
}
