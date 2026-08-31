"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useQueryClient, useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion"
import {
  Search, Send, ArrowLeft, Check, Plus,
  Users, X, ChevronRight, LogOut, UserPlus, Loader2, Pencil, ShieldCheck, BarChart2, Trash2,
  Phone, Mic, Mail,
} from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { GROUP_CHATS, DM_CHATS, type ChatMessage, type ChatPoll, type ChatPollOption, messagePreview } from "@/lib/data/messages"
import { MEMBERS, getStation, type Member, type StationId } from "@/lib/data/stations"
import { createClient } from "@/lib/supabase/client"
import { subscribeChannel } from "@/lib/supabase/realtime"
import { useNavVisibility } from "@/lib/nav-visibility"
import { Modal } from "@/components/ui/modal"
import { usePresence } from "@/lib/presence"
import { CallEventBubble } from "@/components/messaging/call-event-bubble"
import { parseCallEvent } from "@/lib/call/call-event"
import { GifPicker } from "@/components/messaging/gif-picker"
import { AudioMessage, VoiceRecorderBar, useVoiceRecorder } from "@/components/messaging/audio-message"
import { AttachMenu } from "@/components/messaging/attach-menu"
import { ComposeScreen } from "@/components/messaging/compose-screen"
import { CreateGroupScreen } from "@/components/messaging/create-group-screen"
import { MemberProfileSheet } from "@/components/messaging/member-profile-sheet"
import { useCallOptional } from "@/lib/call/call-context"
import { openDMViaApi } from "@/lib/dm"
import { prefetchChatMessages } from "@/lib/queries/messages"
import { messageKeys } from "@/lib/queries/keys"
import { insertConversationMembers } from "@/lib/queries/conversations"
import { useChatMessages, broadcastChatMessage } from "@/lib/hooks/use-chat-messages"
import { chatDayLabel, sameChatDay } from "@/lib/chat-day"

const CUSTOM_COLOR = "262 83% 58%"

type CustomGroup = {
  id: string
  name: string
  initials: string
  adminNames: string[]
  memberNames: string[]
  lastMessage: string
  lastTime: string
  lastAt: string
  unread: number
  messages: ChatMessage[]
}

type CustomDM = {
  id: string
  name: string
  initials: string
  color: string
  station: string
  online: boolean
  lastMessage: string
  lastTime: string
  lastAt: string
  unread: number
  messages: ChatMessage[]
  peerUserId?: string
}

const HIDDEN_CONVS_KEY = "ys-hidden-convs"

function readHiddenConvIds(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_CONVS_KEY) ?? "[]") as string[]
    return new Set(Array.isArray(raw) ? raw : [])
  } catch {
    return new Set()
  }
}

function writeHiddenConvIds(ids: Set<string>) {
  try {
    localStorage.setItem(HIDDEN_CONVS_KEY, JSON.stringify([...ids]))
  } catch { /* ignore */ }
}

function softHideConv(id: string) {
  const next = readHiddenConvIds()
  next.add(id)
  writeHiddenConvIds(next)
}

function softUnhideConv(id: string) {
  const next = readHiddenConvIds()
  if (!next.has(id)) return
  next.delete(id)
  writeHiddenConvIds(next)
}

type CurrentUser = { station: StationId; name: string; isIntl: boolean }

interface MessagesClientProps {
  initialUserId?: string
  initialProfile?: { name: string; initials: string; station: string } | null
  initialProfiles?: { id: string; name: string; photo_url: string | null }[]
  initialConversations?: Record<string, unknown>[]
}

function mapConversations(
  convRows: Record<string, unknown>[],
  userName: string,
): { groups: CustomGroup[]; dms: CustomDM[] } {
  const groups: CustomGroup[] = []
  const dms: CustomDM[] = []

  // Sort by last message time descending so newest activity appears first
  const sortedRows = [...convRows].sort((a, b) => {
    const msgsA = (a.chat_messages as { created_at: string }[]) ?? []
    const msgsB = (b.chat_messages as { created_at: string }[]) ?? []
    const lastA = msgsA.length > 0 ? msgsA[msgsA.length - 1].created_at : (a.created_at as string ?? "")
    const lastB = msgsB.length > 0 ? msgsB[msgsB.length - 1].created_at : (b.created_at as string ?? "")
    return lastB.localeCompare(lastA)
  })

  for (const c of sortedRows) {
    const memberRows = ((c.conversation_members as { member_name: string; is_admin?: boolean; user_id?: string | null }[]) ?? [])
    const adminNames = memberRows.filter((m) => m.is_admin).map((m) => m.member_name)
    // Backward compat: if no is_admin flags set yet, fall back to legacy admin_name column
    const effectiveAdminNames = adminNames.length > 0
      ? adminNames
      : (c.admin_name ? [(c.admin_name as string)] : [])
    const otherMembers = memberRows.filter((m) => m.member_name !== userName)
    const memberNames = otherMembers.map((m) => m.member_name)

    // Derive last message from embedded chat_messages (sorted asc, last is the latest)
    const msgs = (c.chat_messages as { id: string; sender_name: string; sender_initials: string; text: string | null; image_url: string | null; gif_url?: string | null; audio_url?: string | null; message_type?: string | null; is_system: boolean; created_at: string }[]) ?? []
    const lastMsgObj = msgs.length > 0 ? msgs[msgs.length - 1] : null
    const lastMessage = lastMsgObj
      ? messagePreview({
          text: lastMsgObj.text ?? "",
          messageType: (lastMsgObj.message_type as ChatMessage["messageType"]) ?? undefined,
          image: lastMsgObj.image_url ?? undefined,
          gif: lastMsgObj.gif_url ?? undefined,
          audio: lastMsgObj.audio_url ?? undefined,
        })
      : ((c.type as string) === "group" ? "Grup oluşturuldu" : "")
    const lastAt = lastMsgObj?.created_at ?? (c.created_at as string) ?? ""
    const lastTime = lastMsgObj?.created_at
      ? new Date(lastMsgObj.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
      : ""

    if ((c.type as string) === "group") {
      groups.push({ id: c.id as string, name: (c.name as string) ?? "", initials: (c.initials as string) ?? "", adminNames: effectiveAdminNames, memberNames, lastMessage, lastTime, lastAt, unread: 0, messages: [] })
    } else {
      const otherName = memberNames[0] ?? (c.name as string) ?? ""
      const peerUserId = otherMembers[0]?.user_id ?? undefined
      dms.push({
        id: c.id as string,
        name: otherName,
        initials: otherName.slice(0, 2).toUpperCase(),
        color: CUSTOM_COLOR,
        station: "paris",
        online: false,
        lastMessage,
        lastTime,
        lastAt,
        unread: 0,
        messages: [],
        peerUserId: peerUserId || undefined,
      })
    }
  }

  return { groups, dms: dedupeDmsByPeer(dms) }
}

/** One DM per peer — keep the most recently active conversation (messages win over empty). */
function dedupeDmsByPeer(dms: CustomDM[]): CustomDM[] {
  const byKey = new Map<string, CustomDM>()
  for (const d of dms) {
    const key = (d.peerUserId || d.name).trim().toLowerCase()
    if (!key) continue
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, d)
      continue
    }
    const dHasMsg = !!(d.lastMessage && d.lastAt)
    const prevHasMsg = !!(prev.lastMessage && prev.lastAt)
    if (dHasMsg !== prevHasMsg) {
      byKey.set(key, dHasMsg ? d : prev)
      continue
    }
    const newer = (d.lastAt || "") >= (prev.lastAt || "")
    byKey.set(key, newer ? d : prev)
  }
  return [...byKey.values()].sort((a, b) => (b.lastAt || "").localeCompare(a.lastAt || ""))
}

export function MessagesClient({
  initialUserId = "",
  initialProfile = null,
  initialProfiles = [],
  initialConversations = [],
}: MessagesClientProps) {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const { setHideNav } = useNavVisibility()
  const activeUsers = usePresence()
  const [search, setSearch] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [profileMember, setProfileMember] = useState<Member | null>(null)
  const [profileDirectory, setProfileDirectory] = useState<Member[]>([])
  const [forcedUnread, setForcedUnread] = useState<Record<string, number>>({})

  // Hide app header + bottom nav in chat / compose / group create / profile
  const urlOpen = searchParams.get("open")
  useEffect(() => {
    const immersive = openId !== null || !!urlOpen || composeOpen || createGroupOpen || !!profileMember
    setHideNav(immersive)
    return () => setHideNav(false)
  }, [openId, urlOpen, composeOpen, createGroupOpen, profileMember, setHideNav])

  const [currentUser, setCurrentUser] = useState<CurrentUser>({
    station: (initialProfile?.station as StationId) ?? "intl",
    name: initialProfile?.name ?? "",
    isIntl: initialProfile?.station === "intl",
  })

  const initialMapped = useMemo(
    () => mapConversations(initialConversations, initialProfile?.name ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Restore unread counts from localStorage on mount
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>(() => {
    try {
      const lastRead: Record<string, string> = JSON.parse(localStorage.getItem("ys-last-read") ?? "{}")
      return initialMapped.groups.map((g) => {
        const read = lastRead[g.id]
        if (!read || !g.lastTime) return g
        // lastTime is HH:MM — compare via raw lastMessage timestamp stored separately
        // Use the raw conversations to find the actual ISO timestamp
        const conv = initialConversations.find((c) => (c as Record<string,unknown>).id === g.id)
        const msgs = ((conv as Record<string,unknown>)?.chat_messages as {created_at:string;is_system?:boolean}[] | undefined) ?? []
        const lastMsgTime = msgs.filter(m => !m.is_system).at(-1)?.created_at ?? ""
        return { ...g, unread: lastMsgTime > read ? 1 : 0 }
      })
    } catch { return initialMapped.groups }
  })
  const [customDMs, setCustomDMs] = useState<CustomDM[]>(() => {
    try {
      const hidden = readHiddenConvIds()
      const lastRead: Record<string, string> = JSON.parse(localStorage.getItem("ys-last-read") ?? "{}")
      return initialMapped.dms
        .filter((d) => !hidden.has(d.id))
        .map((d) => {
          const read = lastRead[d.id]
          if (!read || !d.lastTime) return d
          const conv = initialConversations.find((c) => (c as Record<string,unknown>).id === d.id)
          const msgs = ((conv as Record<string,unknown>)?.chat_messages as {created_at:string;is_system?:boolean}[] | undefined) ?? []
          const lastMsgTime = msgs.filter(m => !m.is_system).at(-1)?.created_at ?? ""
          return { ...d, unread: lastMsgTime > read ? 1 : 0 }
        })
    } catch { return initialMapped.dms }
  })
  const [photoMap, setPhotoMap]               = useState<Map<string, string>>(
    () => new Map(initialProfiles.filter(p => p.photo_url).map(p => [p.name, p.photo_url as string]))
  )
  const profileByName = useMemo(() => {
    const map = new Map<string, { id: string; name: string; photo_url: string | null }>()
    for (const p of initialProfiles) map.set(p.name, p)
    return map
  }, [initialProfiles])

  useEffect(() => {
    const supabase = createClient()
    void supabase
      .from("profiles")
      .select("id,name,initials,station,role,phone,email,birthday,linkedin,memleket,photo_url,igem_egitimi")
      .then(({ data }) => {
        if (!data?.length) return
        setProfileDirectory(data.map((p) => ({
          id: p.id as string,
          name: (p.name as string) ?? "",
          initials: (p.initials as string) ?? "",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          role: ((p.role as string) ?? "") as any,
          station: ((p.station ?? "paris") as StationId),
          city: (p.station as string) ?? "paris",
          email: (p.email as string) ?? "",
          phone: (p.phone as string) ?? "",
          birthday: (p.birthday as string) ?? "",
          linkedin: (p.linkedin as string) ?? "",
          memleket: (p.memleket as string) ?? "",
          igemEgitimi: (p.igem_egitimi as "evet" | "hayır") ?? undefined,
          photoUrl: (p.photo_url as string) ?? undefined,
          online: false,
        })))
      })
  }, [])

  function openMemberProfile(name: string) {
    const fromDir = profileDirectory.find((m) => m.name === name)
    if (fromDir) {
      setProfileMember({ ...fromDir, online: activeUsers.has(name), photoUrl: fromDir.photoUrl ?? photoMap.get(name) })
      return
    }
    const p = profileByName.get(name)
    const station = "paris" as StationId
    setProfileMember({
      id: p?.id ?? name,
      name,
      initials: name.slice(0, 2).toUpperCase(),
      role: "" as Member["role"],
      station,
      city: station,
      email: "",
      phone: "",
      birthday: "",
      photoUrl: photoMap.get(name) ?? p?.photo_url ?? undefined,
      online: activeUsers.has(name),
    })
  }

  const userNameRef = useRef(currentUser.name || initialProfile?.name || "")
  useEffect(() => {
    userNameRef.current = currentUser.name || initialProfile?.name || ""
  }, [currentUser.name, initialProfile?.name])

  // If SSR brought conversations but RQ cache still has [] from a prior failed fetch, restore it
  useEffect(() => {
    if (!initialUserId || initialConversations.length === 0) return
    queryClient.setQueryData(
      messageKeys.conversations(initialUserId),
      (old: Record<string, unknown>[] | undefined) =>
        old && old.length > 0 ? old : initialConversations,
    )
  }, [initialUserId, initialConversations, queryClient])

  // Reload conversations from DB via reliable API (never cache an empty wipe over real data)
  const { data: liveConversations } = useQuery({
    queryKey: messageKeys.conversations(initialUserId),
    queryFn: async (): Promise<Record<string, unknown>[]> => {
      const res = await fetch("/api/conversations/list", { cache: "no-store" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
      }
      const rows = ((body as { conversations?: Record<string, unknown>[] }).conversations) ?? []
      // Guard: don't publish [] over a non-empty cache if the API glitched
      if (rows.length === 0) {
        const prev = queryClient.getQueryData<Record<string, unknown>[]>(
          messageKeys.conversations(initialUserId),
        )
        if (prev && prev.length > 0) return prev
      }
      return rows
    },
    enabled: !!initialUserId,
    initialData: initialConversations.length > 0 ? initialConversations : undefined,
    staleTime: 15_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 12_000,
    retry: 2,
  })

  useEffect(() => {
    const name = currentUser.name || initialProfile?.name || ""
    if (!name || !liveConversations?.length) return
    const { groups, dms } = mapConversations(liveConversations, name)
    const hidden = readHiddenConvIds()
    setCustomGroups((prev) => {
      const unread = new Map(prev.map((g) => [g.id, g.unread]))
      const messages = new Map(prev.map((g) => [g.id, g.messages]))
      return groups.map((g) => ({
        ...g,
        unread: unread.get(g.id) ?? g.unread,
        messages: messages.get(g.id)?.length ? messages.get(g.id)! : g.messages,
      }))
    })
    setCustomDMs((prev) => {
      const unread = new Map(prev.map((d) => [d.id, d.unread]))
      const messages = new Map(prev.map((d) => [d.id, d.messages]))
      // If soft-hide would wipe the whole inbox, ignore it (corrupt localStorage)
      const notHidden = dms.filter((d) => !hidden.has(d.id))
      const base = notHidden.length > 0 || dms.length === 0 ? notHidden : dms
      if (notHidden.length === 0 && dms.length > 0) {
        try { localStorage.removeItem(HIDDEN_CONVS_KEY) } catch { /* ignore */ }
      }
      const fromLive = base.map((d) => ({
        ...d,
        unread: unread.get(d.id) ?? d.unread,
        messages: messages.get(d.id)?.length ? messages.get(d.id)! : d.messages,
      }))
      const liveIds = new Set(fromLive.map((d) => d.id))
      const livePeers = new Set(
        fromLive.map((d) => (d.peerUserId || d.name).trim().toLowerCase()).filter(Boolean),
      )
      const openIdNow = openIdRef.current
      const pendingLocal = prev.filter((d) => {
        if (liveIds.has(d.id)) return false
        if (d.id === openIdNow) return true
        const key = (d.peerUserId || d.name).trim().toLowerCase()
        return !key || !livePeers.has(key)
      })
      return dedupeDmsByPeer([...fromLive, ...pendingLocal])
    })
  }, [liveConversations, currentUser.name, initialProfile?.name])

  useEffect(() => {
    const name = currentUser.name || initialProfile?.name || ""
    if (!initialUserId || !name) return
    void queryClient.invalidateQueries({ queryKey: messageKeys.conversations(initialUserId) })
  }, [currentUser.name, initialProfile?.name, initialUserId, queryClient])

  // Keep profile name in sync (needed for conversation membership)
  useEffect(() => {
    if (currentUser.name) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from("profiles").select("name,station").eq("id", user.id).single().then(({ data }) => {
        if (!data?.name) return
        setCurrentUser((prev) => ({
          ...prev,
          name: data.name,
          station: (data.station as StationId) ?? prev.station,
          isIntl: data.station === "intl",
        }))
      })
    })
  }, [currentUser.name])

  const convIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    convIdsRef.current = new Set([
      ...customGroups.map((g) => g.id),
      ...customDMs.map((d) => d.id),
    ])
  }, [customGroups, customDMs])

  // Seed React Query only when thread cache is empty — never overwrite live messages
  useEffect(() => {
    for (const g of customGroups) {
      if (g.messages.length === 0) continue
      const existing = queryClient.getQueryData<ChatMessage[]>(messageKeys.thread(g.id))
      if (existing && existing.length > 0) continue
      queryClient.setQueryData(messageKeys.thread(g.id), g.messages, { updatedAt: Date.now() - 20_000 })
    }
    for (const d of customDMs) {
      if (d.messages.length === 0) continue
      const existing = queryClient.getQueryData<ChatMessage[]>(messageKeys.thread(d.id))
      if (existing && existing.length > 0) continue
      queryClient.setQueryData(messageKeys.thread(d.id), d.messages, { updatedAt: Date.now() - 20_000 })
    }
  }, [customGroups, customDMs, queryClient])

  const ensureConversationInState = useCallback(async (convId: string): Promise<boolean> => {
    if (convIdsRef.current.has(convId)) return true

    const supabase = createClient()
    const { data: conv } = await supabase
      .from("conversations")
      .select("id,type,name,initials")
      .eq("id", convId)
      .maybeSingle()

    if (!conv) return false

    const { data: members } = await supabase
      .from("conversation_members")
      .select("member_name")
      .eq("conversation_id", convId)

    const userName = userNameRef.current
    const memberNames = (members ?? []).map((m) => m.member_name).filter((n) => n !== userName)

    if (conv.type === "group") {
      setCustomGroups((prev) => {
        if (prev.some((g) => g.id === convId)) return prev
        return [{
          id: conv.id as string,
          name: (conv.name as string) ?? "",
          initials: (conv.initials as string) ?? "",
          adminNames: [],
          memberNames,
          lastMessage: "",
          lastTime: "",
          lastAt: new Date().toISOString(),
          unread: 0,
          messages: [],
        }, ...prev]
      })
    } else {
      const otherName = memberNames[0] ?? (conv.name as string) ?? ""
      setCustomDMs((prev) => {
        if (prev.some((d) => d.id === convId)) return prev
        return [{
          id: conv.id as string,
          name: otherName,
          initials: otherName.slice(0, 2).toUpperCase(),
          color: CUSTOM_COLOR,
          station: "paris",
          online: false,
          lastMessage: "",
          lastTime: "",
          lastAt: new Date().toISOString(),
          unread: 0,
          messages: [],
        }, ...prev]
      })
    }
    return true
  }, [])

  const closeConversation = useCallback(() => {
    setOpenId(null)
    router.replace(pathname, { scroll: false })
  }, [router, pathname])

  // Open conversation from URL (?open=convId) — e.g. from Rehber
  useEffect(() => {
    const convId = searchParams.get("open")
    if (!convId) return

    let cancelled = false

    ensureConversationInState(convId).then((ok) => {
      if (!cancelled && ok) setOpenId(convId)
    })

    return () => { cancelled = true }
  }, [searchParams, ensureConversationInState])


  // ── Group actions ─────────────────────────────────────────────────────────
  async function createGroup(name: string, memberNames: string[]) {
    const words = name.replace(/[^a-zA-ZÀ-ÿ\s]/g, "").trim().split(/\s+/).filter(Boolean)
    const initials = (words.length >= 2 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
    const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })

    const supabase = createClient()
    const { data: conv, error } = await supabase
      .from("conversations")
      .insert({ type: "group", name, initials, admin_name: currentUser.name })
      .select()
      .single()

    if (error || !conv) {
      console.error("[createGroup] failed:", error?.message)
      return
    }

    // Add all members (creator gets is_admin = true)
    const allMembers = [...new Set([currentUser.name, ...memberNames])]
    const { data: profiles } = await supabase.from("profiles").select("id,name").in("name", allMembers)
    const idByName = new Map((profiles ?? []).map((p) => [p.name as string, p.id as string]))
    const ok = await insertConversationMembers(
      supabase,
      allMembers.map((member_name) => ({
        conversation_id: conv.id,
        member_name,
        user_id: member_name === currentUser.name ? initialUserId || idByName.get(member_name) : idByName.get(member_name),
        is_admin: member_name === currentUser.name,
      })),
    )
    if (!ok) {
      console.error("[createGroup] members insert failed")
      await supabase.from("conversations").delete().eq("id", conv.id)
      return
    }

    const newGroup: CustomGroup = {
      id: conv.id, name, initials, adminNames: [currentUser.name], memberNames,
      lastMessage: "Grup oluşturuldu", lastTime: time, lastAt: new Date().toISOString(), unread: 0, messages: [],
    }
    setCustomGroups((prev) => [newGroup, ...prev])
    setCreateGroupOpen(false)
    setComposeOpen(false)
    await openConversation(conv.id)
  }

  async function promoteToAdmin(id: string, memberName: string) {
    const supabase = createClient()
    await supabase.from("conversation_members")
      .update({ is_admin: true })
      .eq("conversation_id", id)
      .eq("member_name", memberName)
    setCustomGroups((prev) =>
      prev.map((g) => g.id === id ? { ...g, adminNames: [...new Set([...g.adminNames, memberName])] } : g)
    )
  }

  async function addMembersToGroup(id: string, newNames: string[]) {
    const supabase = createClient()
    const { data: profiles } = await supabase.from("profiles").select("id,name").in("name", newNames)
    const idByName = new Map((profiles ?? []).map((p) => [p.name as string, p.id as string]))
    const ok = await insertConversationMembers(
      supabase,
      newNames.map((member_name) => ({
        conversation_id: id,
        member_name,
        user_id: idByName.get(member_name),
        is_admin: false,
      })),
    )
    if (!ok) return
    setCustomGroups((prev) =>
      prev.map((g) => g.id === id ? { ...g, memberNames: [...new Set([...g.memberNames, ...newNames])] } : g)
    )
  }

  async function removeMemberFromGroup(id: string, memberName: string) {
    const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    const supabase = createClient()
    await supabase.from("conversation_members").delete()
      .eq("conversation_id", id).eq("member_name", memberName)
    await supabase.from("chat_messages").insert({
      conversation_id: id, sender_name: "", sender_initials: "",
      text: `Yönetici ${memberName} kişisini gruptan çıkardı`, is_system: true,
    })
    setCustomGroups((prev) =>
      prev.map((g) => g.id === id ? { ...g, memberNames: g.memberNames.filter((n) => n !== memberName) } : g)
    )
  }

  async function leaveGroup(id: string) {
    const supabase = createClient()
    await supabase.from("conversation_members").delete()
      .eq("conversation_id", id).eq("member_name", currentUser.name)
    setCustomGroups((prev) => prev.filter((g) => g.id !== id))
    closeConversation()
  }

  async function deleteGroup(id: string) {
    const supabase = createClient()
    await supabase.from("conversations").delete().eq("id", id)
    setCustomGroups((prev) => prev.filter((g) => g.id !== id))
    closeConversation()
  }

  async function renameGroup(id: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed) return
    const words = trimmed.replace(/[^a-zA-ZÀ-ÿ\s]/g, "").trim().split(/\s+/).filter(Boolean)
    const newInitials = (words.length >= 2 ? words[0][0] + words[1][0] : trimmed.slice(0, 2)).toUpperCase()
    const supabase = createClient()
    await supabase.from("conversations").update({ name: trimmed, initials: newInitials }).eq("id", id)
    setCustomGroups((prev) =>
      prev.map((g) => g.id === id ? { ...g, name: trimmed, initials: newInitials } : g)
    )
  }

  const openingDmRef = useRef<Set<string>>(new Set())

  // ── DM actions ────────────────────────────────────────────────────────────
  async function openOrCreateDM(member: Member) {
    const lockKey = member.id || member.name
    if (!lockKey) return
    if (openingDmRef.current.has(lockKey)) return
    openingDmRef.current.add(lockKey)

    // Instant UI: leave compose immediately
    setComposeOpen(false)
    setCreateGroupOpen(false)

    try {
      const existingStatic = DM_CHATS.find((d) => d.name === member.name)
      if (existingStatic) {
        softUnhideConv(existingStatic.id)
        openConversation(existingStatic.id)
        return
      }

      const matchDm = (d: CustomDM) =>
        d.name === member.name || (!!member.id && d.peerUserId === member.id)

      const existingCustom = customDMs.find(matchDm)
      if (existingCustom) {
        softUnhideConv(existingCustom.id)
        openConversation(existingCustom.id)
        return
      }

      // Soft-hidden DMs stay in DB — recover from live rows before creating anything new
      const name = currentUser.name || initialProfile?.name || ""
      if (liveConversations?.length && name) {
        const hiddenMatch = mapConversations(liveConversations, name).dms.find(matchDm)
        if (hiddenMatch) {
          softUnhideConv(hiddenMatch.id)
          setCustomDMs((prev) => dedupeDmsByPeer(
            prev.some((d) => d.id === hiddenMatch.id) ? prev : [hiddenMatch, ...prev],
          ))
          openConversation(hiddenMatch.id)
          return
        }
      }

      if (!member.id) {
        console.error("[openOrCreateDM] missing member id")
        return
      }

      // Wait for a real conversation id before opening the chat (pending-* blocks sends)
      const s = getStation(member.station)
      const convId = await openDMViaApi(member.id)
      if (!convId) {
        console.error("[openOrCreateDM] API failed")
        window.alert("Sohbet açılamadı. Lütfen tekrar deneyin.")
        return
      }

      softUnhideConv(convId)
      setCustomDMs((prev) => {
        const withoutPeer = prev.filter((d) => !matchDm(d) && d.id !== convId)
        return dedupeDmsByPeer([{
          id: convId,
          name: member.name,
          initials: member.initials,
          color: s.color,
          station: member.station,
          online: member.online ?? false,
          lastMessage: "",
          lastTime: "",
          lastAt: new Date().toISOString(),
          unread: 0,
          messages: [],
          peerUserId: member.id,
        }, ...withoutPeer])
      })
      openConversation(convId)
      void queryClient.invalidateQueries({ queryKey: messageKeys.conversations(initialUserId) })
    } finally {
      openingDmRef.current.delete(lockKey)
    }
  }

  function updateCustomGroupMessages(id: string, messages: ChatMessage[]) {
    setCustomGroups((prev) => {
      const last = messages[messages.length - 1]
      const idx = prev.findIndex((g) => g.id === id)
      if (idx < 0) return prev
      const preview = last
        ? messagePreview({
            text: last.text,
            messageType: last.messageType,
            image: last.image,
            gif: last.gif,
            audio: last.audio,
          })
        : prev[idx].lastMessage
      const updated = {
        ...prev[idx],
        messages,
        lastMessage: preview || prev[idx].lastMessage,
        lastTime: last?.time || prev[idx].lastTime,
        lastAt: last?.createdAt || new Date().toISOString(),
      }
      return [updated, ...prev.filter((_, i) => i !== idx)]
    })
  }

  function updateCustomDMMessages(id: string, messages: ChatMessage[]) {
    setCustomDMs((prev) => {
      const last = messages[messages.length - 1]
      const idx = prev.findIndex((d) => d.id === id)
      if (idx < 0) return prev
      const preview = last
        ? messagePreview({
            text: last.text,
            messageType: last.messageType,
            image: last.image,
            gif: last.gif,
            audio: last.audio,
          })
        : prev[idx].lastMessage
      const updated = {
        ...prev[idx],
        messages,
        lastMessage: preview || prev[idx].lastMessage,
        lastTime: last?.time || prev[idx].lastTime,
        lastAt: last?.createdAt || new Date().toISOString(),
      }
      return [updated, ...prev.filter((_, i) => i !== idx)]
    })
  }

  // Refs to avoid stale closures in global realtime subscription
  const openIdRef      = useRef(openId)
  const currentNameRef = useRef(currentUser.name)
  useEffect(() => { openIdRef.current = openId }, [openId])
  useEffect(() => { currentNameRef.current = currentUser.name }, [currentUser.name])

  // Open a conversation instantly; hydrate membership in background if needed
  function openConversation(id: string) {
    setOpenId(id)
    void prefetchChatMessages(queryClient, id, currentUser.name)
    if (
      !id.startsWith("pending-") &&
      !convIdsRef.current.has(id) &&
      !customGroups.some((g) => g.id === id) &&
      !customDMs.some((d) => d.id === id)
    ) {
      void ensureConversationInState(id)
    }
    router.replace(`${pathname}?open=${id}`, { scroll: false })
    setForcedUnread((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
    setCustomGroups((prev) => prev.map((g) => g.id === id ? { ...g, unread: 0 } : g))
    setCustomDMs((prev) => prev.map((d) => d.id === id ? { ...d, unread: 0 } : d))
    try {
      const lastRead = JSON.parse(localStorage.getItem("ys-last-read") ?? "{}")
      lastRead[id] = new Date().toISOString()
      localStorage.setItem("ys-last-read", JSON.stringify(lastRead))
    } catch {}
  }

  function markUnread(id: string) {
    setForcedUnread((prev) => ({ ...prev, [id]: 1 }))
    setCustomGroups((prev) => prev.map((g) => g.id === id ? { ...g, unread: Math.max(1, g.unread) } : g))
    setCustomDMs((prev) => prev.map((d) => d.id === id ? { ...d, unread: Math.max(1, d.unread) } : d))
    try {
      const lastRead = JSON.parse(localStorage.getItem("ys-last-read") ?? "{}")
      lastRead[id] = "1970-01-01T00:00:00.000Z"
      localStorage.setItem("ys-last-read", JSON.stringify(lastRead))
    } catch {}
  }

  async function hideConversation(id: string) {
    // Soft-hide only: keep membership so reopening always lands on the same DM
    softHideConv(id)
    setCustomDMs((prev) => prev.filter((d) => d.id !== id))
    setCustomGroups((prev) => prev.filter((g) => g.id !== id))
    if (openId === id) closeConversation()
  }

  // Filtered subscription: only our conversations (avoids TIMED_OUT from global fan-out)
  const knownConvIds = useMemo(
    () => [...customGroups.map((g) => g.id), ...customDMs.map((d) => d.id)],
    [customGroups, customDMs],
  )

  useEffect(() => {
    if (knownConvIds.length === 0) return
    const supabase = createClient()
    const filter = `conversation_id=in.(${knownConvIds.join(",")})`

    const channel = supabase
      .channel(`conversations-meta-${knownConvIds.length}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter,
      }, (payload) => {
        const m = payload.new as { id: string; conversation_id: string; sender_name: string; text: string | null; created_at: string; is_system?: boolean; message_type?: string; gif_url?: string; audio_url?: string; image_url?: string }
        if (m.is_system) return
        const isOwn  = m.sender_name === currentNameRef.current
        const isOpen = m.conversation_id === openIdRef.current
        const time   = new Date(m.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
        const preview = messagePreview({
          text: m.text ?? "",
          messageType: (m.message_type as ChatMessage["messageType"])
            ?? (m.audio_url ? "audio" : undefined),
          image: m.image_url ?? undefined,
          gif: m.gif_url ?? undefined,
          audio: m.audio_url ?? undefined,
        })

        const bumpUnread = !isOpen && !isOwn

        setCustomGroups((prev) => {
          const idx = prev.findIndex((g) => g.id === m.conversation_id)
          if (idx < 0) return prev
          const updated = {
            ...prev[idx],
            lastMessage: preview || prev[idx].lastMessage,
            lastTime: time,
            lastAt: m.created_at,
            unread: bumpUnread ? prev[idx].unread + 1 : prev[idx].unread,
          }
          return [updated, ...prev.filter((_, i) => i !== idx)]
        })
        setCustomDMs((prev) => {
          const idx = prev.findIndex((d) => d.id === m.conversation_id)
          if (idx < 0) return prev
          const updated = {
            ...prev[idx],
            lastMessage: preview || prev[idx].lastMessage,
            lastTime: time,
            lastAt: m.created_at,
            unread: bumpUnread ? prev[idx].unread + 1 : prev[idx].unread,
          }
          return [updated, ...prev.filter((_, i) => i !== idx)]
        })

        if (bumpUnread) {
          try {
            const prefs = JSON.parse(localStorage.getItem("ys-notif-prefs") ?? "{}")
            if (prefs.messages === false) return
            const title = "Yeni Mesaj"
            const body = preview
              ? `${m.sender_name}: ${preview}`
              : `${m.sender_name} bir mesaj gönderdi`
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              navigator.serviceWorker?.ready.then((reg) => {
                void reg.showNotification(title, {
                  body,
                  icon: "/icon.png",
                  badge: "/icon.png",
                  tag: `msg-${m.conversation_id}`,
                  data: { url: `/messages?open=${m.conversation_id}` },
                })
              }).catch(() => {
                new Notification(title, { body, icon: "/icon.png", tag: `msg-${m.conversation_id}` })
              })
            } else if (typeof Notification !== "undefined" && Notification.permission === "default") {
              void Notification.requestPermission()
            }
          } catch { /* ignore */ }
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        const p = payload.new as { name: string; photo_url: string | null }
        setPhotoMap(prev => {
          const next = new Map(prev)
          if (p.photo_url) next.set(p.name, p.photo_url)
          else next.delete(p.name)
          return next
        })
      })

    void subscribeChannel(supabase, channel)
    return () => { supabase.removeChannel(channel) }
  }, [knownConvIds.join(",")])

  const senderInitials = currentUser.name.trim().split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  const prefetchThread = useCallback(
    (id: string) => { void prefetchChatMessages(queryClient, id, currentUser.name) },
    [queryClient, currentUser.name],
  )

  // ── Filtering — unified inbox (BeReal-style) ──────────────────────────────
  const q = search.toLowerCase().trim()
  const unifiedInbox = useMemo(() => {
    type Row =
      | { kind: "group"; item: CustomGroup }
      | { kind: "dm"; item: CustomDM }
      | { kind: "station"; item: typeof GROUP_CHATS[number] & { title: string } }

    const rows: Row[] = [
      ...customGroups
        .filter((g) => !q || g.name.toLowerCase().includes(q))
        .map((item) => ({ kind: "group" as const, item })),
      ...customDMs
        .filter((d) => !q || d.name.toLowerCase().includes(q))
        .map((item) => ({ kind: "dm" as const, item })),
      ...GROUP_CHATS
        .filter((g) => currentUser.isIntl || g.id === currentUser.station)
        .map((g) => ({ ...g, title: getStation(g.id).name }))
        .filter((g) => !q || g.title.toLowerCase().includes(q))
        .map((item) => ({ kind: "station" as const, item })),
      ...DM_CHATS
        .filter((d) => !q || d.name.toLowerCase().includes(q))
        .map((item) => ({ kind: "dm" as const, item: {
          id: item.id,
          name: item.name,
          initials: item.initials,
          color: item.color,
          station: "paris",
          online: item.online,
          lastMessage: item.lastMessage,
          lastTime: item.lastTime,
          lastAt: "",
          unread: item.unread,
          messages: item.messages,
        } })),
    ]

    return rows.sort((a, b) => {
      const atA = a.kind === "station" ? "" : (a.item.lastAt || "")
      const atB = b.kind === "station" ? "" : (b.item.lastAt || "")
      if (atA || atB) return atB.localeCompare(atA)
      return 0
    })
  }, [customGroups, customDMs, currentUser.isIntl, currentUser.station, q])

  // ── Open conversation ─────────────────────────────────────────────────────
  const activeCustomGroup  = customGroups.find((g) => g.id === openId)
  const activeCustomDM     = !activeCustomGroup ? customDMs.find((d) => d.id === openId) : null
  const activeStationGroup = !activeCustomGroup && !activeCustomDM ? GROUP_CHATS.find((g) => g.id === openId) : null
  const activeDM           = !activeCustomGroup && !activeCustomDM && !activeStationGroup
    ? DM_CHATS.find((d) => d.id === openId) : null

  const chatExtras = profileMember ? (
    <MemberProfileSheet
      member={profileMember}
      onClose={() => setProfileMember(null)}
      hideMessage
    />
  ) : null

  if (activeCustomGroup) {
    return (
      <>
      <ChatView
        onBack={closeConversation}
        title={activeCustomGroup.name}
        subtitle={`${activeCustomGroup.memberNames.length + 1} üye`}
        color={CUSTOM_COLOR}
        initials={activeCustomGroup.initials}
        isPrivate={false}
        senderName={currentUser.name}
        senderInitials={senderInitials}
        initialMessages={activeCustomGroup.messages}
        onMessagesChange={(msgs) => updateCustomGroupMessages(activeCustomGroup.id, msgs)}
        conversationId={activeCustomGroup.id}
        photoMap={photoMap}
        groupSettings={{
          memberNames: activeCustomGroup.memberNames,
          adminNames: activeCustomGroup.adminNames,
          currentUserName: currentUser.name,
          isAdmin: activeCustomGroup.adminNames.includes(currentUser.name),
          onAddMembers: (newNames) => addMembersToGroup(activeCustomGroup.id, newNames),
          onRemoveMember: (name) => removeMemberFromGroup(activeCustomGroup.id, name),
          onLeave: () => leaveGroup(activeCustomGroup.id),
          onDeleteGroup: () => deleteGroup(activeCustomGroup.id),
          onRename: (newName) => renameGroup(activeCustomGroup.id, newName),
          onPromoteToAdmin: (name) => promoteToAdmin(activeCustomGroup.id, name),
        }}
      />
      {chatExtras}
      </>
    )
  }

  if (activeCustomDM) {
    const dmOnline = activeUsers.has(activeCustomDM.name)
    return (
      <>
      <ChatView
        onBack={closeConversation}
        title={activeCustomDM.name}
        subtitle={dmOnline ? t("messages.online") : t("messages.offline")}
        color={activeCustomDM.color}
        initials={activeCustomDM.initials}
        headerPhotoUrl={photoMap.get(activeCustomDM.name)}
        isPrivate
        online={dmOnline}
        senderName={currentUser.name}
        senderInitials={senderInitials}
        initialMessages={activeCustomDM.messages}
        onMessagesChange={(msgs) => updateCustomDMMessages(activeCustomDM.id, msgs)}
        conversationId={activeCustomDM.id}
        photoMap={photoMap}
        peerName={activeCustomDM.name}
        onOpenProfile={() => openMemberProfile(activeCustomDM.name)}
      />
      {chatExtras}
      </>
    )
  }

  if (activeStationGroup || activeDM) {
    return (
      <>
      <ChatView
        onBack={closeConversation}
        title={activeStationGroup ? getStation(activeStationGroup.id).name : activeDM!.name}
        subtitle={
          activeStationGroup
            ? getStation(activeStationGroup.id).city
            : (activeDM && activeUsers.has(activeDM.name)) ? t("messages.online") : t("messages.offline")
        }
        color={activeStationGroup ? getStation(activeStationGroup.id).color : activeDM!.color}
        initials={activeStationGroup ? getStation(activeStationGroup.id).short : activeDM!.initials}
        headerPhotoUrl={activeDM ? photoMap.get(activeDM.name) : undefined}
        isPrivate={!!activeDM}
        online={activeDM ? activeUsers.has(activeDM.name) : undefined}
        senderName={currentUser.name}
        senderInitials={senderInitials}
        initialMessages={activeStationGroup ? activeStationGroup.messages : activeDM!.messages}
        photoMap={photoMap}
        peerName={activeDM?.name}
        onOpenProfile={activeDM ? () => openMemberProfile(activeDM.name) : undefined}
      />
      {chatExtras}
      </>
    )
  }

  // ── List view (BeReal inbox) ──────────────────────────────────────────────
  return (
    <div className="relative min-h-full">
      <div className="px-4 pt-2">
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("messages.search")}
              className="h-11 w-full rounded-full border-0 bg-secondary pl-9 pr-3 text-base outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm active:scale-95"
            aria-label="Yeni"
          >
            <Plus className="size-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col">
        {unifiedInbox.map((row) => {
          if (row.kind === "group") {
            const g = row.item
            return (
              <ConversationRow
                key={g.id}
                onClick={() => openConversation(g.id)}
                onPrefetch={() => prefetchThread(g.id)}
                onMarkUnread={() => markUnread(g.id)}
                initials={g.initials}
                color={CUSTOM_COLOR}
                title={g.name}
                last={g.lastMessage}
                time={g.lastTime}
                unread={forcedUnread[g.id] ?? g.unread}
                isCustomGroup
              />
            )
          }
          if (row.kind === "station") {
            const g = row.item
            return (
              <ConversationRow
                key={g.id}
                onClick={() => openConversation(g.id)}
                onPrefetch={() => prefetchThread(g.id)}
                onMarkUnread={() => markUnread(g.id)}
                initials={getStation(g.id).short}
                color={getStation(g.id).color}
                title={g.title}
                last={g.lastMessage}
                time={g.lastTime}
                unread={forcedUnread[g.id] ?? g.unread}
              />
            )
          }
          const d = row.item
          const isPersisted = customDMs.some((x) => x.id === d.id)
          return (
            <ConversationRow
              key={d.id}
              onClick={() => openConversation(d.id)}
              onPrefetch={() => prefetchThread(d.id)}
              onDelete={isPersisted ? () => {
                if (window.confirm("Bu sohbeti listenizden silmek istiyor musunuz? (Karşı taraf için kalır)")) {
                  void hideConversation(d.id)
                }
              } : undefined}
              onMarkUnread={() => markUnread(d.id)}
              initials={d.initials}
              color={d.color}
              title={d.name}
              last={d.lastMessage}
              time={d.lastTime}
              unread={forcedUnread[d.id] ?? d.unread}
              online={activeUsers.has(d.name)}
              isPrivate
              photoUrl={photoMap.get(d.name)}
            />
          )
        })}
        {unifiedInbox.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Henüz sohbet yok.<br />Sağ üstten birine yazmaya başla.
          </p>
        )}
      </div>

      {composeOpen && !createGroupOpen && (
        <ComposeScreen
          currentUserName={currentUser.name}
          currentUserId={initialUserId}
          existingDmNames={(() => {
            const names = new Set([
              ...DM_CHATS.map((d) => d.name),
              ...customDMs.map((d) => d.name),
            ])
            const myName = currentUser.name || initialProfile?.name || ""
            if (liveConversations?.length && myName) {
              for (const d of mapConversations(liveConversations, myName).dms) names.add(d.name)
            }
            return [...names]
          })()}
          onClose={() => setComposeOpen(false)}
          onSelectContact={(m) => void openOrCreateDM(m)}
          onCreateGroup={() => setCreateGroupOpen(true)}
        />
      )}

      {createGroupOpen && (
        <CreateGroupScreen
          currentUserName={currentUser.name}
          onClose={() => setCreateGroupOpen(false)}
          onCreate={async (name, members) => {
            await createGroup(name, members)
          }}
        />
      )}

      {profileMember && (
        <MemberProfileSheet
          member={profileMember}
          onClose={() => setProfileMember(null)}
          hideMessage
        />
      )}
    </div>
  )
}

// ── Conversation row ──────────────────────────────────────────────────────────
const SWIPE_ACTION = 88

function ConversationRow({
  onClick, onPrefetch, initials, color, title, last, time, unread, online, isPrivate, isCustomGroup, photoUrl, onDelete, onMarkUnread, hideTime,
}: {
  onClick: () => void; onPrefetch?: () => void; initials: string; color: string; title: string
  last: string; time: string; unread: number; online?: boolean
  isPrivate?: boolean; isCustomGroup?: boolean; photoUrl?: string
  onDelete?: () => void; onMarkUnread?: () => void; hideTime?: boolean
}) {
  const x = useMotionValue(0)
  const dragged = useRef(false)

  function snapBack() {
    void animate(x, 0, { type: "spring", stiffness: 420, damping: 36 })
  }

  return (
    <div className="relative overflow-hidden">
      {onDelete && (
        <div className="absolute inset-y-0 left-0 flex w-[88px] flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground">
          <Trash2 className="size-5" />
          <span className="text-[10px] font-semibold">Sil</span>
        </div>
      )}
      {onMarkUnread && (
        <div className="absolute inset-y-0 right-0 flex w-[88px] flex-col items-center justify-center gap-1 bg-sky-500 text-white">
          <Mail className="size-5" />
          <span className="text-[10px] font-semibold">Okunmadı</span>
        </div>
      )}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{
          left: onMarkUnread ? -SWIPE_ACTION : 0,
          right: onDelete ? SWIPE_ACTION : 0,
        }}
        dragElastic={0.12}
        style={{ x }}
        onDragStart={() => { dragged.current = true }}
        onDragEnd={(_, info) => {
          const ox = info.offset.x
          const vx = info.velocity.x
          if (onDelete && (ox > SWIPE_ACTION * 0.55 || vx > 550)) {
            x.set(0)
            onDelete()
          } else if (onMarkUnread && (ox < -SWIPE_ACTION * 0.55 || vx < -550)) {
            x.set(0)
            onMarkUnread()
          } else {
            snapBack()
          }
          window.setTimeout(() => { dragged.current = false }, 80)
        }}
        className="relative z-10 bg-background"
      >
        <button
          type="button"
          onClick={() => {
            if (dragged.current) return
            onClick()
          }}
          onPointerDown={() => onPrefetch?.()}
          onTouchStart={() => onPrefetch?.()}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-secondary"
        >
          <div className="relative shrink-0">
            {photoUrl && !isCustomGroup ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={initials} className="size-14 rounded-full object-cover" />
            ) : (
              <span
                className="flex size-14 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: `hsl(${color})` }}
              >
                {isCustomGroup ? <Users className="size-6" /> : initials}
              </span>
            )}
            {online && (
              <span className="absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-background bg-emerald-500" />
            )}
          </div>
          <div className="min-w-0 flex-1 border-b border-border/50 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className={`truncate text-[15px] text-foreground ${unread > 0 ? "font-bold" : "font-semibold"}`}>{title}</span>
              {!hideTime && time && (
                <span className={`shrink-0 text-[11px] ${unread > 0 ? "font-semibold text-primary" : "text-muted-foreground"}`}>{time}</span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <p className={`min-w-0 flex-1 truncate text-[13px] ${unread > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {isCustomGroup ? `👥 ${last || "Grup"}` : last || (isPrivate ? "Yeni sohbet" : "")}
              </p>
              {unread > 0 && (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {unread}
                </span>
              )}
            </div>
          </div>
        </button>
      </motion.div>
    </div>
  )
}

// ── Group settings panel ──────────────────────────────────────────────────────
function GroupSettingsPanel({
  title, initials, isAdmin, adminNames, currentUserName, memberNames, onClose, onAddMembers, onRemoveMember, onLeave, onDeleteGroup, onRename, onPromoteToAdmin,
}: {
  title: string; initials: string; isAdmin: boolean; adminNames: string[]; currentUserName: string; memberNames: string[]
  onClose: () => void
  onAddMembers: (newNames: string[]) => void
  onRemoveMember: (name: string) => void
  onLeave: () => void
  onDeleteGroup: () => void
  onRename: (newName: string) => void
  onPromoteToAdmin: (name: string) => void
}) {
  const [allMembers, setAllMembers]       = useState<Member[]>(MEMBERS)
  const [addOpen, setAddOpen]             = useState(false)
  const [confirmLeave, setConfirmLeave]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingName, setEditingName]     = useState(false)
  const [newName, setNewName]             = useState(title)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: profiles } = await supabase.from("profiles").select("id,name,initials,station,role,email,phone,birthday,linkedin,memleket,photo_url,igem_egitimi")
      if (profiles && profiles.length > 0) {
        const mapped: Member[] = profiles.map((p) => ({
          id: p.id, name: p.name ?? "", initials: p.initials ?? "",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          role: ((p.role as string) ?? "") as any, station: (p.station ?? "paris") as StationId,
          city: p.station ?? "paris", email: p.email ?? "", phone: p.phone ?? "",
          birthday: p.birthday ?? "", linkedin: p.linkedin ?? "",
          memleket: p.memleket ?? "", igemEgitimi: p.igem_egitimi ?? undefined, online: false,
          photoUrl: p.photo_url ?? undefined,
        }))
        setAllMembers([...MEMBERS, ...mapped])
      }
    }
    load()
  }, [])

  const groupMembers = allMembers.filter((m) => memberNames.includes(m.name))
  const nonMembers   = allMembers.filter((m) => !memberNames.includes(m.name) && m.name !== currentUserName)

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 400, damping: 36 }}
      className="absolute inset-0 z-10 flex flex-col bg-background"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-2.5">
        <button onClick={onClose} className="flex size-9 items-center justify-center rounded-full active:bg-secondary">
          <ArrowLeft className="size-5" />
        </button>
        <span className="font-semibold text-foreground">Grup ayarları</span>
        {isAdmin && (
          <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            Yönetici
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Group identity */}
        <div className="flex flex-col items-center gap-2 py-8">
          <span
            className="flex size-20 items-center justify-center rounded-full text-2xl font-bold text-white"
            style={{ backgroundColor: `hsl(${CUSTOM_COLOR})` }}
          >
            {initials}
          </span>
          {isAdmin && editingName ? (
            <div className="flex items-center gap-2 px-6 w-full">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 rounded-xl border border-input bg-background px-3 py-1.5 text-center text-base font-bold text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <button
                onClick={() => { onRename(newName); setEditingName(false) }}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
              >
                <Check className="size-4" />
              </button>
              <button
                onClick={() => { setNewName(title); setEditingName(false) }}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              className={`flex items-center gap-1.5 font-heading text-xl font-bold text-foreground ${isAdmin ? "active:opacity-60" : ""}`}
              onClick={() => isAdmin && setEditingName(true)}
              disabled={!isAdmin}
            >
              {title}
              {isAdmin && <Pencil className="size-3.5 text-muted-foreground" />}
            </button>
          )}
          <p className="text-sm text-muted-foreground">{memberNames.length + 1} üye</p>
        </div>

        {/* Members */}
        <div className="px-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Üyeler ({memberNames.length + 1})
          </p>
          <div className="overflow-hidden rounded-xl border border-border">
            {/* Self row */}
            <div className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                Sen
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{currentUserName}</p>
              </div>
              {isAdmin && (
                <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  <ShieldCheck className="size-3" /> Yönetici
                </span>
              )}
            </div>

            {groupMembers.map((m) => {
              const s = getStation(m.station)
              const memberIsAdmin = adminNames.includes(m.name)
              return (
                <div key={m.id} className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-0">
                  {m.photoUrl ? (
                    <img src={m.photoUrl} alt={m.initials} className="size-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: `hsl(${s.color})` }}
                    >
                      {m.initials}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.role} · {s.city}</p>
                  </div>
                  {memberIsAdmin && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      <ShieldCheck className="size-3" /> Yönetici
                    </span>
                  )}
                  {isAdmin && !memberIsAdmin && (
                    <button
                      onClick={() => onPromoteToAdmin(m.name)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-primary/10 active:text-primary"
                      aria-label={`${m.name} yönetici yap`}
                      title="Yönetici yap"
                    >
                      <ShieldCheck className="size-4" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => onRemoveMember(m.name)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-destructive/10 active:text-destructive"
                      aria-label={`${m.name} çıkar`}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add members — admin only */}
          {isAdmin && (
            <button
              onClick={() => setAddOpen(true)}
              className="mt-3 flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors active:bg-secondary"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserPlus className="size-4" />
              </span>
              Üye ekle
              <ChevronRight className="ml-auto size-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 px-4 pb-8 pt-6">
          {/* Leave group — everyone can leave */}
          {!confirmLeave ? (
            <button
              onClick={() => setConfirmLeave(true)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-muted-foreground transition-colors active:bg-secondary"
            >
              <LogOut className="size-4" />
              Gruptan çık
            </button>
          ) : (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="mb-3 text-sm font-medium text-destructive">Bu gruptan çıkmak istediğinizden emin misiniz?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmLeave(false)}
                  className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-muted-foreground"
                >
                  İptal
                </button>
                <button
                  onClick={onLeave}
                  className="flex-1 rounded-lg bg-destructive py-2 text-sm font-semibold text-white"
                >
                  Çık
                </button>
              </div>
            </div>
          )}

          {/* Delete group — admin only */}
          {isAdmin && (
            !confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex w-full items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive transition-colors active:bg-destructive/10"
              >
                <LogOut className="size-4" />
                Grubu sil
              </button>
            ) : (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="mb-3 text-sm font-semibold text-destructive">Grubu silmek istediğinizden emin misiniz?</p>
                <p className="mb-3 text-xs text-muted-foreground">Bu işlem tüm üyeler için grubu kaldıracaktır.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-muted-foreground"
                  >
                    İptal
                  </button>
                  <button
                    onClick={onDeleteGroup}
                    className="flex-1 rounded-lg bg-destructive py-2 text-sm font-semibold text-white"
                  >
                    Sil
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <AnimatePresence>
        {addOpen && (
          <AddMembersModal
            availableMembers={nonMembers}
            onClose={() => setAddOpen(false)}
            onAdd={(newNames) => { onAddMembers(newNames); setAddOpen(false) }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Add members modal ─────────────────────────────────────────────────────────
function AddMembersModal({
  availableMembers, onClose, onAdd,
}: {
  availableMembers: Member[]
  onClose: () => void
  onAdd: (names: string[]) => void
}) {
  const [search, setSearch]   = useState("")
  const [selected, setSelected] = useState<string[]>([])

  const filtered = availableMembers
    .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex items-end bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3.5">
          <div className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" />
            <h2 className="font-heading text-base font-bold">Üye ekle</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground active:bg-secondary">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Üye ara…"
              className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          {selected.length > 0 && (
            <p className="text-xs font-medium text-primary">{selected.length} seçildi</p>
          )}
          <div className="overflow-hidden rounded-xl border border-border">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Tüm üyeler zaten grupta</p>
            ) : (
              filtered.map((m) => {
                const s = getStation(m.station)
                const isSelected = selected.includes(m.name)
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelected((prev) =>
                      prev.includes(m.name) ? prev.filter((n) => n !== m.name) : [...prev, m.name]
                    )}
                    className={`flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left last:border-0 transition-colors ${
                      isSelected ? "bg-primary/5" : "active:bg-secondary"
                    }`}
                  >
                    {m.photoUrl ? (
                      <img src={m.photoUrl} alt={m.initials} className="size-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: `hsl(${s.color})` }}
                      >
                        {m.initials}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.role} · {s.city}</p>
                    </div>
                    <div className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      isSelected ? "border-primary bg-primary" : "border-border"
                    }`}>
                      {isSelected && <Check className="size-3 text-white" />}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border p-4">
          <button
            onClick={() => selected.length > 0 && onAdd(selected)}
            disabled={selected.length === 0}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {selected.length > 0 ? `Ekle (${selected.length})` : "Üye seç"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Chat view ─────────────────────────────────────────────────────────────────
function ChatView({
  onBack, title, subtitle, color, initials, isPrivate, online,
  initialMessages, onMessagesChange, groupSettings, senderName, senderInitials, conversationId, photoMap, headerPhotoUrl, peerName, onOpenProfile,
}: {
  onBack: () => void
  title: string
  subtitle: string
  color: string
  initials: string
  isPrivate: boolean
  online?: boolean
  initialMessages: ChatMessage[]
  onMessagesChange?: (messages: ChatMessage[]) => void
  senderName: string
  senderInitials: string
  conversationId?: string
  photoMap?: Map<string, string>
  headerPhotoUrl?: string
  peerName?: string
  onOpenProfile?: () => void
  groupSettings?: {
    memberNames: string[]
    adminNames: string[]
    currentUserName: string
    isAdmin: boolean
    onAddMembers: (newNames: string[]) => void
    onRemoveMember: (name: string) => void
    onLeave: () => void
    onDeleteGroup: () => void
    onRename: (newName: string) => void
    onPromoteToAdmin: (name: string) => void
  }
}) {
  const { t } = useI18n()
  const call = useCallOptional()
  const voice = useVoiceRecorder()
  const chatQuery = useChatMessages(conversationId, senderName, initialMessages)
  const [staticMessages, setStaticMessages] = useState<ChatMessage[]>(initialMessages)
  const messages = conversationId ? chatQuery.messages : staticMessages
  const setMessages = conversationId
    ? chatQuery.setMessages
    : setStaticMessages
  const [draft, setDraft]       = useState("")
  const [attached, setAttached] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPollCompose, setShowPollCompose] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const scrollRef   = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (conversationId && messages.length > 0) onMessagesChange?.(messages)
  }, [conversationId, messages, onMessagesChange])

  const isFirstScroll = useRef(true)
  useEffect(() => {
    const behavior = isFirstScroll.current ? "instant" : "smooth"
    isFirstScroll.current = false
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: behavior as ScrollBehavior })
  }, [messages])

  async function send() {
    if (!draft.trim() && !attached) return
    if (!conversationId || conversationId.startsWith("pending-")) {
      window.alert("Sohbet henüz hazır değil. Bir saniye bekleyip tekrar deneyin.")
      return
    }
    if (!senderName.trim()) {
      window.alert("Profil adınız eksik. Ayarlardan kontrol edin.")
      return
    }
    const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    const createdAt = new Date().toISOString()
    const messageType = attached ? "image" : "text"
    const text = draft.trim()
    const image = attached ?? undefined
    const tempId = `temp-${Date.now()}`

    const optimistic: ChatMessage = {
      id: tempId,
      author: senderName,
      initials: senderInitials,
      text,
      time,
      createdAt,
      self: true,
      image,
      messageType,
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft("")
    setAttached(null)

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          text,
          imageUrl: image ?? null,
          messageType,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.id) {
        console.error("[chat] send failed:", data.error ?? res.status)
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        window.alert("Mesaj gönderilemedi. Lütfen tekrar deneyin.")
        return
      }

      const newMsg: ChatMessage = {
        id: data.id as string,
        author: senderName,
        initials: senderInitials,
        text,
        time,
        createdAt: (data.createdAt as string) || createdAt,
        self: true,
        image,
        messageType,
      }
      setMessages((prev) => {
        const updated = prev.some((m) => m.id === tempId)
          ? prev.map((m) => (m.id === tempId ? newMsg : m))
          : prev.some((m) => m.id === newMsg.id)
            ? prev
            : [...prev, newMsg]
        onMessagesChange?.(updated)
        return updated
      })
      void broadcastChatMessage(conversationId, newMsg)
    } catch (e) {
      console.error("[chat] send failed:", e)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      window.alert("Mesaj gönderilemedi. Lütfen tekrar deneyin.")
    }
  }

  async function sendGif(rawUrl: string) {
    if (!conversationId || conversationId.startsWith("pending-") || !rawUrl) return
    const url = rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl
    setShowGifPicker(false)
    const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    const createdAt = new Date().toISOString()
    const tempId = `temp-gif-${Date.now()}`
    setMessages((prev) => [...prev, {
      id: tempId,
      author: senderName,
      initials: senderInitials,
      text: "",
      time,
      createdAt,
      self: true,
      gif: url,
      messageType: "gif" as const,
    }])

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          gifUrl: url,
          messageType: "gif",
          text: "GIF",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.id) {
        console.error("[chat] gif send failed:", data.error)
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        window.alert("GIF gönderilemedi. Lütfen tekrar deneyin.")
        return
      }

      const newMsg: ChatMessage = {
        id: data.id as string,
        author: senderName,
        initials: senderInitials,
        text: "",
        time,
        createdAt: (data.createdAt as string) || createdAt,
        self: true,
        gif: url,
        messageType: "gif",
      }
      setMessages((prev) => {
        const updated = prev.map((m) => (m.id === tempId ? newMsg : m))
        onMessagesChange?.(updated)
        return updated
      })
      void broadcastChatMessage(conversationId, newMsg)
    } catch (e) {
      console.error("[chat] gif:", e)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      window.alert("GIF gönderilemedi. Lütfen tekrar deneyin.")
    }
  }

  async function sendAudio(blob: Blob, durationSec?: number) {
    if (!conversationId || conversationId.startsWith("pending-")) return
    if (!senderName.trim()) {
      window.alert("Profil adınız eksik.")
      return
    }
    const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    const createdAt = new Date().toISOString()
    const tempId = `temp-audio-${Date.now()}`
    const localUrl = URL.createObjectURL(blob)
    const audioDuration = durationSec && durationSec > 0 ? durationSec : undefined

    const optimistic: ChatMessage = {
      id: tempId,
      author: senderName,
      initials: senderInitials,
      text: "",
      time,
      createdAt,
      self: true,
      audio: localUrl,
      audioDuration,
      messageType: "audio",
    }
    setMessages((prev) => [...prev, optimistic])
    setUploading(true)

    try {
      const form = new FormData()
      const cleanType = (blob.type || "audio/webm").split(";")[0].trim() || "audio/webm"
      const ext = cleanType.includes("mp4") ? "m4a" : cleanType.includes("ogg") ? "ogg" : "webm"
      const file = new File([blob], `voice.${ext}`, { type: cleanType })
      form.append("file", file)
      form.append("conversationId", conversationId)
      const upRes = await fetch("/api/chat/upload-audio", { method: "POST", body: form })
      const upData = await upRes.json().catch(() => ({}))
      if (!upRes.ok || !upData.url) {
        console.error("[chat] audio upload failed:", upData.error || upData.detail)
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        window.alert("Ses yüklenemedi. Lütfen tekrar deneyin.")
        return
      }
      const url = upData.url as string

      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          audioUrl: url,
          messageType: "audio",
          text: "",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.id) {
        console.error("[chat] audio send failed:", data.error)
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        window.alert("Sesli mesaj gönderilemedi.")
        return
      }

      const newMsg: ChatMessage = {
        id: data.id as string,
        author: senderName,
        initials: senderInitials,
        text: "",
        time,
        createdAt: (data.createdAt as string) || createdAt,
        self: true,
        audio: url,
        audioDuration,
        messageType: "audio",
      }
      setMessages((prev) => {
        const updated = prev.map((m) => (m.id === tempId ? newMsg : m))
        onMessagesChange?.(updated)
        return updated
      })
      void broadcastChatMessage(conversationId, newMsg)
    } catch (e) {
      console.error("[chat] audio:", e)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      window.alert("Sesli mesaj gönderilemedi.")
      URL.revokeObjectURL(localUrl)
    } finally {
      setUploading(false)
    }
  }

  async function handleVoiceStop() {
    const result = await voice.stop()
    if (result) await sendAudio(result.blob, result.durationSec)
  }

  async function sendPoll(question: string, optionTexts: string[]) {
    if (!conversationId) return
    const supabase = createClient()
    const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })

    const { data: msg } = await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_name: senderName,
      sender_initials: senderInitials,
      text: `📊 ${question}`,
    }).select().single()
    if (!msg) return

    const { data: poll } = await supabase.from("message_polls").insert({
      message_id: msg.id,
      question,
    }).select().single()
    if (!poll) return

    await supabase.from("message_poll_options").insert(
      optionTexts.map((text, i) => ({ id: `${poll.id}-opt-${i}`, poll_id: poll.id, text, position: i }))
    )

    const newMsg: ChatMessage = {
      id: msg.id,
      author: senderName,
      initials: senderInitials,
      text: `📊 ${question}`,
      time,
      self: true,
      poll: {
        id: poll.id,
        question,
        options: optionTexts.map((text, i) => ({ id: `${poll.id}-opt-${i}`, text, voters: [] })),
      },
    }
    setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, newMsg])
  }

  async function voteOnPoll(messageId: string, optionId: string) {
    const msg = messages.find((m) => m.id === messageId)
    if (!msg?.poll) return
    const alreadyVotedOption = msg.poll.options.find((o) => o.voters.includes(senderName))
    const previousId = alreadyVotedOption?.id
    const clickedMine = previousId === optionId

    setMessages((prev) => prev.map((m) => {
      if (m.id !== messageId || !m.poll) return m
      return {
        ...m,
        poll: {
          ...m.poll,
          options: m.poll.options.map((o) => {
            const without = o.voters.filter((v) => v !== senderName)
            return o.id === optionId && !clickedMine
              ? { ...o, voters: [...without, senderName] }
              : { ...o, voters: without }
          }),
        },
      }
    }))

    const supabase = createClient()
    if (previousId) await supabase.from("message_poll_votes").delete().eq("option_id", previousId).eq("voter_name", senderName)
    if (!clickedMine) await supabase.from("message_poll_votes").insert({ option_id: optionId, voter_name: senderName })
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)]">
      {/* Header — BeReal-like: tap name/avatar → profile; calls on the right */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-card/95 px-2 py-2 backdrop-blur">
        <button type="button" onClick={onBack} className="flex size-9 items-center justify-center rounded-full active:bg-secondary">
          <ArrowLeft className="size-5" />
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left active:opacity-70"
          onClick={() => {
            if (onOpenProfile) onOpenProfile()
            else if (groupSettings) setShowSettings(true)
          }}
          disabled={!onOpenProfile && !groupSettings}
        >
          <div className="relative shrink-0">
            {headerPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={headerPhotoUrl} alt={initials} className="size-9 rounded-full object-cover" />
            ) : (
              <span
                className="flex size-9 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: `hsl(${color})` }}
              >
                {groupSettings ? <Users className="size-4" /> : initials}
              </span>
            )}
            {online && (
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-emerald-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="truncate font-semibold text-foreground">{title}</span>
              {groupSettings && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
            </div>
            <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>
          </div>
        </button>
        {isPrivate && conversationId && peerName && call && (
          <button
            type="button"
            onClick={() => call.startCall({ conversationId, peerName, callType: "audio" })}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-foreground active:bg-secondary"
            aria-label="Sesli arama"
          >
            <Phone className="size-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto overscroll-contain bg-background px-3 py-4">
        {chatQuery.isLoading && messages.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {messages.map((m, idx) => {
          const prev = messages[idx - 1]
          const dayIso = m.createdAt
          const showDay = !!dayIso && (!prev?.createdAt || !sameChatDay(prev.createdAt, dayIso))
          const daySep = showDay ? (
            <div className="flex justify-center py-3">
              <span className="rounded-full bg-secondary/90 px-3 py-1 text-[11px] font-medium capitalize text-muted-foreground shadow-sm">
                {chatDayLabel(dayIso)}
              </span>
            </div>
          ) : null

          const callEvent = m.messageType === "call" ? parseCallEvent(m.text) : null
          if (callEvent) {
            return (
              <div key={m.id}>
                {daySep}
                <div className={`flex ${m.self ? "justify-end" : "justify-start"} py-1`}>
                  <CallEventBubble
                    event={callEvent}
                    isSelf={!!m.self}
                    time={m.time}
                    onCallBack={
                      isPrivate && conversationId && peerName && call
                        ? () => call.startCall({ conversationId, peerName, callType: "audio" })
                        : undefined
                    }
                  />
                </div>
              </div>
            )
          }

          if (m.system) {
            return (
              <div key={m.id}>
                {daySep}
                <div className="flex justify-center py-1">
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                    {m.text}
                  </span>
                </div>
              </div>
            )
          }

          if (m.poll) {
            return (
              <div key={m.id}>
                {daySep}
                <div className={`flex flex-col gap-1 ${m.self ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-1.5 px-1">
                    {!m.self && (() => {
                      const photo = photoMap?.get(m.author)
                      return photo
                        ? <img src={photo} alt={m.initials} className="size-5 rounded-full object-cover" />
                        : <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-secondary-foreground">{m.initials}</span>
                    })()}
                    <span className="text-xs font-semibold text-foreground">{m.self ? "Sen" : m.author}</span>
                    <span className="text-[10px] text-muted-foreground">{m.time}</span>
                  </div>
                  <div className="w-full max-w-[85%]">
                    <ChatPollBlock
                      poll={m.poll}
                      voterName={senderName}
                      onVote={(optId) => voteOnPoll(m.id, optId)}
                    />
                  </div>
                </div>
              </div>
            )
          }

          return (
            <div key={m.id}>
              {daySep}
              <div className={`flex ${m.self ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[78%] gap-2 ${m.self ? "flex-row-reverse" : ""}`}>
                  {!m.self && (() => {
                    const photo = photoMap?.get(m.author)
                    return photo
                      ? <img src={photo} alt={m.initials} className="mt-auto size-7 shrink-0 rounded-full object-cover" />
                      : <span className="mt-auto flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">{m.initials}</span>
                  })()}
                  <div
                    className={`rounded-2xl px-3.5 py-2 ${
                      m.self
                        ? "rounded-br-[5px] bg-primary text-primary-foreground"
                        : "rounded-bl-[5px] bg-card text-foreground shadow-sm"
                    }`}
                  >
                    {m.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.image} alt="" className="mb-1 max-h-48 rounded-lg" />
                    )}
                    {m.gif && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.gif} alt="" className="mb-1 max-h-48 rounded-lg" />
                    )}
                    {m.audio && <AudioMessage src={m.audio} self={m.self} durationHint={m.audioDuration} />}
                    {m.text && !m.audio && <p className="text-[15px] leading-relaxed">{m.text}</p>}
                    <span
                      className={`mt-0.5 block text-right text-[10px] ${m.self ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                    >
                      {m.time}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border bg-card px-3 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <VoiceRecorderBar
          recording={voice.recording}
          seconds={voice.seconds}
          onStop={handleVoiceStop}
          onCancel={voice.cancel}
        />
        {(attached || uploading) && !voice.recording && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-secondary px-2 py-1.5 text-xs text-secondary-foreground">
            {uploading
              ? <><Loader2 className="size-3.5 animate-spin text-primary" /> Yükleniyor…</>
              : <><Check className="size-3.5 text-primary" /> {t("messages.imageAttached")}</>
            }
            {!uploading && (
              <button onClick={() => setAttached(null)} className="ml-auto font-semibold text-destructive">
                {t("common.remove")}
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              e.target.value = ""
              setUploading(true)
              try {
                const supabase = createClient()
                const ext = file.name.split(".").pop() ?? "jpg"
                const path = `chat/${conversationId ?? "general"}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
                const { error: upErr } = await supabase.storage.from("chat-images").upload(path, file, { upsert: true })
                if (upErr) throw upErr
                const { data: { publicUrl } } = supabase.storage.from("chat-images").getPublicUrl(path)
                setAttached(publicUrl)
              } catch (err) {
                console.error("[chat] image upload failed:", err)
              } finally {
                setUploading(false)
              }
            }}
          />
          <div ref={attachRef} className="relative">
            <button
              type="button"
              onClick={() => setShowAttachMenu((v) => !v)}
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-secondary"
              aria-label="Ekle"
            >
              <Plus className="size-5" />
            </button>
            <AttachMenu
              open={showAttachMenu}
              onClose={() => setShowAttachMenu(false)}
              onImage={() => fileInputRef.current?.click()}
              onGif={() => setShowGifPicker(true)}
              onPoll={() => setShowPollCompose(true)}
            />
          </div>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={t("messages.typeMessage")}
            className="h-11 flex-1 rounded-full border border-input bg-background px-4 text-base outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          {draft.trim() || attached ? (
            <button
              onClick={send}
              disabled={(!draft.trim() && !attached) || uploading || voice.recording}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
            >
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { if (!voice.recording) voice.start() }}
              disabled={!conversationId || uploading}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
              aria-label="Sesli mesaj"
            >
              <Mic className="size-5" />
            </button>
          )}
        </div>
      </div>

      <GifPicker
        open={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={sendGif}
      />

      {/* Group settings overlay */}
      <AnimatePresence>
        {showSettings && groupSettings && (
          <GroupSettingsPanel
            title={title}
            initials={initials}
            isAdmin={groupSettings.isAdmin}
            adminNames={groupSettings.adminNames}
            currentUserName={groupSettings.currentUserName}
            memberNames={groupSettings.memberNames}
            onClose={() => setShowSettings(false)}
            onAddMembers={groupSettings.onAddMembers}
            onRemoveMember={groupSettings.onRemoveMember}
            onLeave={groupSettings.onLeave}
            onDeleteGroup={groupSettings.onDeleteGroup}
            onRename={groupSettings.onRename}
            onPromoteToAdmin={groupSettings.onPromoteToAdmin}
          />
        )}
      </AnimatePresence>

      {/* Poll compose sheet */}
      <AnimatePresence>
        {showPollCompose && (
          <PollComposeSheet
            onClose={() => setShowPollCompose(false)}
            onSubmit={(question, options) => {
              setShowPollCompose(false)
              sendPoll(question, options)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Chat poll block ───────────────────────────────────────────────────────────
function ChatPollBlock({
  poll, voterName, onVote,
}: {
  poll: ChatPoll
  voterName: string
  onVote: (optionId: string) => void
}) {
  const total = poll.options.reduce((s, o) => s + o.voters.length, 0)
  const myVote = poll.options.find((o) => o.voters.includes(voterName))?.id ?? null

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <BarChart2 className="size-4 shrink-0 text-primary" />
        <p className="font-semibold text-foreground text-sm">{poll.question}</p>
      </div>
      {poll.options.map((opt) => {
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
              <div
                className={`absolute inset-y-0 left-0 rounded-xl transition-all duration-500 ${
                  isMyVote ? "bg-primary/20" : "bg-muted"
                }`}
                style={{ width: total > 0 ? `${pct}%` : "0%" }}
              />
              <div className="relative flex items-center gap-2 px-3 py-2">
                <span className={`flex-1 text-sm font-medium ${isMyVote ? "text-primary" : "text-foreground"}`}>
                  {opt.text}
                </span>
                {isMyVote && <Check className="size-3.5 shrink-0 text-primary" />}
                <span className="shrink-0 text-xs font-bold text-muted-foreground">{pct}%</span>
              </div>
            </button>
            {opt.voters.length > 0 && (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1 px-1">
                <Users className="size-3 shrink-0 text-muted-foreground/50" />
                {opt.voters.map((v, i) => (
                  <span key={v} className="text-[10px] text-muted-foreground">
                    {v}{i < opt.voters.length - 1 ? "," : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <p className="text-right text-[11px] text-muted-foreground">{total} oy</p>
    </div>
  )
}

// ── Poll compose sheet ────────────────────────────────────────────────────────
function PollComposeSheet({
  onClose, onSubmit,
}: {
  onClose: () => void
  onSubmit: (question: string, options: string[]) => void
}) {
  const [question, setQuestion] = useState("")
  const [options, setOptions]   = useState(["", ""])

  function setOption(i: number, v: string) { setOptions((p) => p.map((o, idx) => idx === i ? v : o)) }
  function addOption() { setOptions((p) => [...p, ""]) }
  function removeOption(i: number) { if (options.length > 2) setOptions((p) => p.filter((_, idx) => idx !== i)) }

  const validOptions = options.filter((o) => o.trim())
  const canSubmit = question.trim() && validOptions.length >= 2

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-end bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3.5">
          <div className="flex items-center gap-2">
            <BarChart2 className="size-4 text-primary" />
            <h2 className="font-heading text-base font-bold">Anket oluştur</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground active:bg-secondary">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Soru</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Anket sorusu..."
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Seçenekler</label>
            <div className="flex flex-col gap-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={opt}
                    onChange={(e) => setOption(i, e.target.value)}
                    placeholder={`Seçenek ${i + 1}`}
                    className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(i)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-destructive/10 active:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <button
                  onClick={addOption}
                  className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors active:bg-secondary"
                >
                  <Plus className="size-4" /> Seçenek ekle
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-border p-4">
          <button
            onClick={() => { if (canSubmit) onSubmit(question.trim(), validOptions.map((o) => o.trim())) }}
            disabled={!canSubmit}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Anketi gönder
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
