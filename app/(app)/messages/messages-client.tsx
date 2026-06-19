"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Lock, Send, ImageIcon, ArrowLeft, Check } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { GROUP_CHATS, DM_CHATS, type ChatMessage } from "@/lib/data/messages"
import { getStation } from "@/lib/data/stations"
import { PageHeader } from "@/components/app-shell"

type Tab = "groups" | "dm"

export function MessagesClient() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>("groups")
  const [search, setSearch] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)

  const groups = GROUP_CHATS.map((g) => ({ ...g, title: getStation(g.id).name }))

  const filteredGroups = groups.filter((g) => g.title.toLowerCase().includes(search.toLowerCase()))
  const filteredDMs = DM_CHATS.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))

  const activeGroup = GROUP_CHATS.find((g) => g.id === openId)
  const activeDM = DM_CHATS.find((d) => d.id === openId)

  if (activeGroup || activeDM) {
    return (
      <ChatView
        onBack={() => setOpenId(null)}
        title={activeGroup ? getStation(activeGroup.id).name : activeDM!.name}
        subtitle={
          activeGroup
            ? `${getStation(activeGroup.id).city}`
            : activeDM!.online
              ? t("messages.online")
              : t("messages.offline")
        }
        color={activeGroup ? getStation(activeGroup.id).color : activeDM!.color}
        initials={activeGroup ? getStation(activeGroup.id).short : activeDM!.initials}
        isPrivate={!!activeDM}
        online={activeDM?.online}
        initialMessages={activeGroup ? activeGroup.messages : activeDM!.messages}
      />
    )
  }

  return (
    <div>
      <PageHeader title={t("nav.messages")} />
      <div className="px-4 pt-3">
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("messages.search")}
            className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-base outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>

        {/* Tabs */}
        <div className="mb-3 flex gap-1 rounded-xl bg-secondary p-1">
          {(["groups", "dm"] as Tab[]).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={`relative flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                tab === tb ? "text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {tab === tb && (
                <motion.span
                  layoutId="msgtab"
                  className="absolute inset-0 rounded-lg bg-primary"
                  transition={{ type: "spring", stiffness: 700, damping: 28 }}
                />
              )}
              <span className="relative flex items-center justify-center gap-1.5">
                {tb === "dm" && <Lock className="size-3.5" />}
                {tb === "groups" ? t("messages.groups") : t("messages.private")}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col">
        {tab === "groups"
          ? filteredGroups.map((g) => (
              <ConversationRow
                key={g.id}
                onClick={() => setOpenId(g.id)}
                initials={getStation(g.id).short}
                color={getStation(g.id).color}
                title={g.title}
                last={g.lastMessage}
                time={g.lastTime}
                unread={g.unread}
              />
            ))
          : filteredDMs.map((d) => (
              <ConversationRow
                key={d.id}
                onClick={() => setOpenId(d.id)}
                initials={d.initials}
                color={d.color}
                title={d.name}
                last={d.lastMessage}
                time={d.lastTime}
                unread={d.unread}
                online={d.online}
                isPrivate
              />
            ))}
      </div>
    </div>
  )
}

function ConversationRow({
  onClick,
  initials,
  color,
  title,
  last,
  time,
  unread,
  online,
  isPrivate,
}: {
  onClick: () => void
  initials: string
  color: string
  title: string
  last: string
  time: string
  unread: number
  online?: boolean
  isPrivate?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors active:bg-secondary"
    >
      <div className="relative shrink-0">
        <span
          className="flex size-12 items-center justify-center rounded-2xl text-sm font-bold text-white"
          style={{ backgroundColor: `hsl(${color})` }}
        >
          {initials}
        </span>
        {online && (
          <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-card bg-emerald-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isPrivate && <Lock className="size-3 shrink-0 text-muted-foreground" />}
          <span className="truncate font-semibold text-foreground">{title}</span>
        </div>
        <p className="truncate text-sm text-muted-foreground">{last}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs text-muted-foreground">{time}</span>
        {unread > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {unread}
          </span>
        )}
      </div>
    </button>
  )
}

function ChatView({
  onBack,
  title,
  subtitle,
  color,
  initials,
  isPrivate,
  online,
  initialMessages,
}: {
  onBack: () => void
  title: string
  subtitle: string
  color: string
  initials: string
  isPrivate: boolean
  online?: boolean
  initialMessages: ChatMessage[]
}) {
  const { t } = useI18n()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState("")
  const [attached, setAttached] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  function send() {
    if (!draft.trim() && !attached) return
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        author: "Moi",
        initials: "MO",
        text: draft.trim(),
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        self: true,
        image: attached ?? undefined,
      } as ChatMessage & { image?: string },
    ])
    setDraft("")
    setAttached(null)
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5">
        <button onClick={onBack} className="flex size-9 items-center justify-center rounded-full active:bg-secondary">
          <ArrowLeft className="size-5" />
        </button>
        <div className="relative">
          <span
            className="flex size-10 items-center justify-center rounded-xl text-xs font-bold text-white"
            style={{ backgroundColor: `hsl(${color})` }}
          >
            {initials}
          </span>
          {online && (
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-emerald-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isPrivate && <Lock className="size-3 shrink-0 text-primary" />}
            <span className="truncate font-semibold text-foreground">{title}</span>
          </div>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-background px-3 py-4">
        {messages.map((m) => {
          const msg = m as ChatMessage & { image?: string }
          return (
            <div key={m.id} className={`flex ${m.self ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-[78%] gap-2 ${m.self ? "flex-row-reverse" : ""}`}>
                {!m.self && (
                  <span className="mt-auto flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">
                    {m.initials}
                  </span>
                )}
                <div
                  className={`rounded-2xl px-3 py-2 ${
                    m.self
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-card text-foreground shadow-sm"
                  }`}
                >
                  {!m.self && <p className="mb-0.5 text-[11px] font-semibold text-primary">{m.author}</p>}
                  {msg.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={msg.image || "/placeholder.svg"} alt="" className="mb-1 max-h-48 rounded-lg" />
                  )}
                  {m.text && <p className="text-[15px] leading-relaxed">{m.text}</p>}
                  <span
                    className={`mt-0.5 block text-right text-[10px] ${m.self ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                  >
                    {m.time}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-card px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {attached && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-secondary px-2 py-1.5 text-xs text-secondary-foreground">
            <Check className="size-3.5 text-primary" />
            {t("messages.imageAttached")}
            <button onClick={() => setAttached(null)} className="ml-auto font-semibold text-destructive">
              {t("common.remove")}
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                const url = URL.createObjectURL(file)
                setAttached(url)
                e.target.value = ""
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-secondary"
            aria-label={t("messages.attachImage")}
          >
            <ImageIcon className="size-5" />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={t("messages.typeMessage")}
            className="h-11 flex-1 rounded-full border border-input bg-background px-4 text-base outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <button
            onClick={send}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
            disabled={!draft.trim() && !attached}
            aria-label={t("messages.send")}
          >
            <Send className="size-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
