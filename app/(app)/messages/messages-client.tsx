"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search, Lock, Send, ImageIcon, ArrowLeft, Check, Plus,
  Users, X, ChevronRight, LogOut, UserPlus, Loader2, Pencil, ShieldCheck, BarChart2,
} from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { GROUP_CHATS, DM_CHATS, type ChatMessage, type ChatPoll, type ChatPollOption } from "@/lib/data/messages"
import { MEMBERS, getStation, type Member, type StationId } from "@/lib/data/stations"
import { createClient } from "@/lib/supabase/client"
import { useNavVisibility } from "@/lib/nav-visibility"
import { Modal } from "@/components/ui/modal"
import { usePresence } from "@/lib/presence"

type Tab = "groups" | "dm"

const CUSTOM_COLOR = "262 83% 58%"

type CustomGroup = {
  id: string
  name: string
  initials: string
  adminNames: string[]
  memberNames: string[]
  lastMessage: string
  lastTime: string
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
  unread: number
  messages: ChatMessage[]
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

  for (const c of convRows) {
    const memberRows = ((c.conversation_members as { member_name: string; is_admin?: boolean }[]) ?? [])
    const adminNames = memberRows.filter((m) => m.is_admin).map((m) => m.member_name)
    // Backward compat: if no is_admin flags set yet, fall back to legacy admin_name column
    const effectiveAdminNames = adminNames.length > 0
      ? adminNames
      : (c.admin_name ? [(c.admin_name as string)] : [])
    const memberNames = memberRows.map((m) => m.member_name).filter((n) => n !== userName)

    // Derive last message from embedded chat_messages (sorted asc, last is the latest)
    const msgs = (c.chat_messages as { id: string; sender_name: string; sender_initials: string; text: string | null; image_url: string | null; is_system: boolean; created_at: string }[]) ?? []
    const lastMsgObj = msgs.length > 0 ? msgs[msgs.length - 1] : null
    const lastMessage = lastMsgObj?.text ?? ((c.type as string) === "group" ? "Grup oluşturuldu" : "")
    const lastTime = lastMsgObj?.created_at
      ? new Date(lastMsgObj.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
      : ""

    if ((c.type as string) === "group") {
      groups.push({ id: c.id as string, name: (c.name as string) ?? "", initials: (c.initials as string) ?? "", adminNames: effectiveAdminNames, memberNames, lastMessage, lastTime, unread: 0, messages: [] })
    } else {
      const otherName = memberNames[0] ?? ""
      dms.push({ id: c.id as string, name: otherName, initials: otherName.slice(0, 2).toUpperCase(), color: CUSTOM_COLOR, station: "paris", online: false, lastMessage, lastTime, unread: 0, messages: [] })
    }
  }

  return { groups, dms }
}

export function MessagesClient({
  initialUserId = "",
  initialProfile = null,
  initialProfiles = [],
  initialConversations = [],
}: MessagesClientProps) {
  const { t } = useI18n()
  const { setHideNav } = useNavVisibility()
  const activeUsers = usePresence()
  const [tab, setTab] = useState<Tab>("groups")
  const [search, setSearch] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)

  // Hide bottom nav when a conversation is open
  useEffect(() => {
    setHideNav(openId !== null)
    return () => setHideNav(false)
  }, [openId])
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
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>(initialMapped.groups)
  const [customDMs, setCustomDMs]       = useState<CustomDM[]>(initialMapped.dms)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [newDMOpen, setNewDMOpen]             = useState(false)
  const [photoMap, setPhotoMap]               = useState<Map<string, string>>(
    () => new Map(initialProfiles.filter(p => p.photo_url).map(p => [p.name, p.photo_url as string]))
  )


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
    await supabase.from("conversation_members").insert(
      allMembers.map((member_name) => ({
        conversation_id: conv.id,
        member_name,
        is_admin: member_name === currentUser.name,
      }))
    )

    const newGroup: CustomGroup = {
      id: conv.id, name, initials, adminNames: [currentUser.name], memberNames,
      lastMessage: "Grup oluşturuldu", lastTime: time, unread: 0, messages: [],
    }
    setCustomGroups((prev) => [newGroup, ...prev])
    setCreateGroupOpen(false)
  }

  function updateCustomGroupMessages(id: string, messages: ChatMessage[]) {
    setCustomGroups((prev) => {
      const last = messages[messages.length - 1]
      return prev.map((g) =>
        g.id === id
          ? { ...g, messages, lastMessage: last?.text || g.lastMessage, lastTime: last?.time || g.lastTime }
          : g
      )
    })
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
    await supabase.from("conversation_members").insert(
      newNames.map((member_name) => ({ conversation_id: id, member_name, is_admin: false }))
    )
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
    setOpenId(null)
  }

  async function deleteGroup(id: string) {
    const supabase = createClient()
    await supabase.from("conversations").delete().eq("id", id)
    setCustomGroups((prev) => prev.filter((g) => g.id !== id))
    setOpenId(null)
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

  // ── DM actions ────────────────────────────────────────────────────────────
  async function openOrCreateDM(member: Member) {
    const existingStatic = DM_CHATS.find((d) => d.name === member.name)
    if (existingStatic) { setOpenId(existingStatic.id); setNewDMOpen(false); return }
    const existingCustom = customDMs.find((d) => d.name === member.name)
    if (existingCustom) { setOpenId(existingCustom.id); setNewDMOpen(false); return }

    const s = getStation(member.station)
    const supabase = createClient()
    const { data: conv, error } = await supabase
      .from("conversations")
      .insert({ type: "dm", name: member.name, initials: member.initials })
      .select()
      .single()

    if (error || !conv) {
      console.error("[openOrCreateDM] failed:", error?.message)
      return
    }
    await supabase.from("conversation_members").insert([
      { conversation_id: conv.id, member_name: currentUser.name },
      { conversation_id: conv.id, member_name: member.name },
    ])

    const newDM: CustomDM = {
      id: conv.id, name: member.name, initials: member.initials,
      color: s.color, station: member.station, online: member.online ?? false,
      lastMessage: "", lastTime: "", unread: 0, messages: [],
    }
    setCustomDMs((prev) => [newDM, ...prev])
    setOpenId(conv.id)
    setNewDMOpen(false)
  }

  function updateCustomDMMessages(id: string, messages: ChatMessage[]) {
    setCustomDMs((prev) => {
      const last = messages[messages.length - 1]
      return prev.map((d) =>
        d.id === id
          ? { ...d, messages, lastMessage: last?.text || d.lastMessage, lastTime: last?.time || d.lastTime }
          : d
      )
    })
  }

  const senderInitials = currentUser.name.trim().split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase()

  // ── Filtering ─────────────────────────────────────────────────────────────
  // Station groups: intl sees all, others only see their own station
  const visibleStationGroups = GROUP_CHATS.filter(
    (g) => currentUser.isIntl || g.id === currentUser.station
  ).map((g) => ({ ...g, title: getStation(g.id).name }))

  // Custom groups: intl created them (sees all), others see groups they're named in
  const visibleCustomGroups = customGroups

  const filteredStationGroups = visibleStationGroups.filter((g) =>
    g.title.toLowerCase().includes(search.toLowerCase())
  )
  const filteredCustomGroups = visibleCustomGroups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  )
  const filteredDMs = [
    ...customDMs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase())),
    ...DM_CHATS.filter((d) => d.name.toLowerCase().includes(search.toLowerCase())),
  ]

  // ── Open conversation ─────────────────────────────────────────────────────
  const activeCustomGroup  = visibleCustomGroups.find((g) => g.id === openId)
  const activeCustomDM     = !activeCustomGroup ? customDMs.find((d) => d.id === openId) : null
  const activeStationGroup = !activeCustomGroup && !activeCustomDM ? GROUP_CHATS.find((g) => g.id === openId) : null
  const activeDM           = !activeCustomGroup && !activeCustomDM && !activeStationGroup
    ? DM_CHATS.find((d) => d.id === openId) : null

  if (activeCustomGroup) {
    return (
      <ChatView
        onBack={() => setOpenId(null)}
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
    )
  }

  if (activeCustomDM) {
    const dmOnline = activeUsers.has(activeCustomDM.name)
    return (
      <ChatView
        onBack={() => setOpenId(null)}
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
      />
    )
  }

  if (activeStationGroup || activeDM) {
    return (
      <ChatView
        onBack={() => setOpenId(null)}
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
      />
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div>
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

        {/* Action buttons */}
        {tab === "groups" && (
          <button
            onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); setCreateGroupOpen(true) }}
            className="mb-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors active:bg-primary/10"
          >
            <Plus className="size-4" />
            Yeni grup
          </button>
        )}
        {tab === "dm" && (
          <button
            onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); setNewDMOpen(true) }}
            className="mb-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors active:bg-primary/10"
          >
            <Plus className="size-4" />
            Yeni sohbet
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex flex-col">
        {tab === "groups" ? (
          <>
            {filteredCustomGroups.map((g) => (
              <ConversationRow
                key={g.id}
                onClick={() => setOpenId(g.id)}
                initials={g.initials}
                color={CUSTOM_COLOR}
                title={g.name}
                last={g.lastMessage}
                time={g.lastTime}
                unread={g.unread}
                isCustomGroup
              />
            ))}
            {filteredStationGroups.map((g) => (
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
            ))}
          </>
        ) : (
          filteredDMs.map((d) => (
            <ConversationRow
              key={d.id}
              onClick={() => setOpenId(d.id)}
              initials={d.initials}
              color={d.color}
              title={d.name}
              last={d.lastMessage}
              time={d.lastTime}
              unread={d.unread}
              online={activeUsers.has(d.name)}
              isPrivate
              photoUrl={photoMap.get(d.name)}
            />
          ))
        )}
      </div>

      {/* Modals */}
      <CreateGroupModal open={createGroupOpen} currentUserName={currentUser.name} onClose={() => setCreateGroupOpen(false)} onCreate={createGroup} />
      <AnimatePresence>
        {newDMOpen && (
          <NewDMModal
            existingNames={[
              ...DM_CHATS.map((d) => d.name),
              ...customDMs.map((d) => d.name),
            ]}
            currentUserName={currentUser.name}
            onClose={() => setNewDMOpen(false)}
            onSelect={openOrCreateDM}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Conversation row ──────────────────────────────────────────────────────────
function ConversationRow({
  onClick, initials, color, title, last, time, unread, online, isPrivate, isCustomGroup, photoUrl,
}: {
  onClick: () => void; initials: string; color: string; title: string
  last: string; time: string; unread: number; online?: boolean
  isPrivate?: boolean; isCustomGroup?: boolean; photoUrl?: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors active:bg-secondary"
    >
      <div className="relative shrink-0">
        {photoUrl && !isCustomGroup ? (
          <img
            src={photoUrl}
            alt={initials}
            className={`size-12 object-cover ${isCustomGroup ? "rounded-full" : "rounded-2xl"}`}
          />
        ) : (
          <span
            className={`flex size-12 items-center justify-center text-sm font-bold text-white ${
              isCustomGroup ? "rounded-full" : "rounded-2xl"
            }`}
            style={{ backgroundColor: `hsl(${color})` }}
          >
            {isCustomGroup ? <Users className="size-5" /> : initials}
          </span>
        )}
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
          role: p.role ?? "", station: (p.station ?? "paris") as StationId,
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

// ── New DM modal ──────────────────────────────────────────────────────────────
function NewDMModal({
  existingNames, currentUserName, onClose, onSelect,
}: {
  existingNames: string[]
  currentUserName: string
  onClose: () => void
  onSelect: (member: Member) => void
}) {
  const [search, setSearch] = useState("")
  const [allMembers, setAllMembers] = useState<Member[]>(MEMBERS)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: profiles } = await supabase.from("profiles").select("id,name,initials,station,role,email,phone,birthday,linkedin,memleket,photo_url,igem_egitimi")
      if (profiles && profiles.length > 0) {
        const mapped: Member[] = profiles.map((p) => ({
          id: p.id, name: p.name ?? "", initials: p.initials ?? "",
          role: p.role ?? "", station: (p.station ?? "paris") as StationId,
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

  const filtered = allMembers
    .filter((m) => m.name && m.name !== currentUserName && m.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Modal open onClose={onClose} title="Yeni sohbet">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim ara…"
            className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          {filtered.map((m) => {
            const s = getStation(m.station)
            const hasExisting = existingNames.includes(m.name)
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m)}
                className="flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left last:border-0 transition-colors active:bg-secondary"
              >
                <div className="relative shrink-0">
                  {m.photoUrl ? (
                    <img src={m.photoUrl} alt={m.initials} className="size-10 rounded-full object-cover" />
                  ) : (
                    <span
                      className="flex size-10 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: `hsl(${s.color})` }}
                    >
                      {m.initials}
                    </span>
                  )}
                  {m.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-emerald-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.role} · {s.city}</p>
                </div>
                {hasExisting && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Mevcut
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

// ── Create group modal ────────────────────────────────────────────────────────
function CreateGroupModal({
  open, currentUserName, onClose, onCreate,
}: {
  open: boolean
  currentUserName: string
  onClose: () => void
  onCreate: (name: string, memberNames: string[]) => void
}) {
  const [name, setName]             = useState("")
  const [memberSearch, setMemberSearch] = useState("")
  const [selected, setSelected]     = useState<string[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>(MEMBERS)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: profiles } = await supabase.from("profiles").select("id,name,initials,station,role,email,phone,birthday,linkedin,memleket,photo_url,igem_egitimi")
      if (profiles && profiles.length > 0) {
        const mapped: Member[] = profiles.map((p) => ({
          id: p.id, name: p.name ?? "", initials: p.initials ?? "",
          role: p.role ?? "", station: (p.station ?? "paris") as StationId,
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

  const filtered = allMembers
    .filter((m) => m.name && m.name !== currentUserName && m.name.toLowerCase().includes(memberSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Modal open={open} onClose={onClose} title="Yeni grup">
      <div className="flex flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Grup adı…"
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Üye ara…"
            className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>

        {selected.length > 0 && (
          <p className="text-xs font-medium text-primary">{selected.length} üye seçildi</p>
        )}

        <div className="overflow-hidden rounded-xl border border-border">
          {filtered.map((m) => {
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
          })}
        </div>
      </div>

      <div className="sticky bottom-0 -mx-5 mt-4 border-t border-border bg-card px-5 pb-0 pt-4">
        <button
          onClick={() => { if (name.trim() && selected.length > 0) onCreate(name.trim(), selected) }}
          disabled={!name.trim() || selected.length === 0}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {selected.length > 0
            ? `Grup oluştur (${selected.length} üye)`
            : "Grup oluştur"}
        </button>
      </div>
    </Modal>
  )
}

// ── Chat view ─────────────────────────────────────────────────────────────────
function ChatView({
  onBack, title, subtitle, color, initials, isPrivate, online,
  initialMessages, onMessagesChange, groupSettings, senderName, senderInitials, conversationId, photoMap, headerPhotoUrl,
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
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft]       = useState("")
  const [attached, setAttached] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPollCompose, setShowPollCompose] = useState(false)
  const scrollRef   = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isFirstScroll = useRef(true)
  useEffect(() => {
    const behavior = isFirstScroll.current ? "instant" : "smooth"
    isFirstScroll.current = false
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: behavior as ScrollBehavior })
  }, [messages])

  // Load messages from Supabase + realtime subscription if conversationId is available
  useEffect(() => {
    if (!conversationId) {
      // Fall back to initialMessages for static/mock conversations
      setMessages(initialMessages)
      return
    }

    const supabase = createClient()

    type RawPollOption = { id: string; text: string; position: number; message_poll_votes: { option_id: string; voter_name: string }[] }
    type RawPoll = { id: string; question: string; message_poll_options: RawPollOption[] } | null

    function parsePoll(rawPoll: RawPoll): ChatPoll | undefined {
      if (!rawPoll) return undefined
      return {
        id: rawPoll.id,
        question: rawPoll.question,
        options: (rawPoll.message_poll_options ?? [])
          .sort((a, b) => a.position - b.position)
          .map((o) => ({
            id: o.id,
            text: o.text,
            voters: (o.message_poll_votes ?? []).map((v) => v.voter_name),
          })),
      }
    }

    async function loadMessages() {
      const { data } = await supabase
        .from("chat_messages")
        .select("id,sender_name,sender_initials,text,image_url,is_system,created_at,message_polls(id,question,message_poll_options(id,text,position,message_poll_votes(option_id,voter_name)))")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })

      if (data) {
        setMessages(data.map((m) => ({
          id: m.id,
          author: m.sender_name,
          initials: m.sender_initials,
          text: m.text ?? "",
          time: new Date(m.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
          self: m.sender_name === senderName,
          image: m.image_url ?? undefined,
          system: m.is_system,
          poll: parsePoll((m as Record<string, unknown>).message_polls as RawPoll),
        })))
      }
    }
    loadMessages()

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
      }, (payload) => {
        const m = payload.new as { id: string; conversation_id: string; sender_name: string; sender_initials: string; text: string; image_url: string | null; is_system: boolean; created_at: string }
        // Filter client-side — avoids server-side filter instability
        if (m.conversation_id !== conversationId) return
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev
          return [...prev, {
            id: m.id,
            author: m.sender_name,
            initials: m.sender_initials,
            text: m.text ?? "",
            time: new Date(m.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
            self: m.sender_name === senderName,
            image: m.image_url ?? undefined,
            system: m.is_system,
          }]
        })
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_polls" }, (payload) => {
        const poll = payload.new as { id: string; message_id: string; question: string }
        setTimeout(async () => {
          const { data } = await supabase
            .from("message_polls")
            .select("id,question,message_poll_options(id,text,position,message_poll_votes(option_id,voter_name))")
            .eq("id", poll.id)
            .single()
          if (!data) return
          const chatPoll: ChatPoll = {
            id: data.id,
            question: (data as Record<string, unknown>).question as string,
            options: ((data as Record<string, unknown>).message_poll_options as { id: string; text: string; position: number; message_poll_votes: { option_id: string; voter_name: string }[] }[] ?? [])
              .sort((a, b) => a.position - b.position)
              .map((o) => ({ id: o.id, text: o.text, voters: (o.message_poll_votes ?? []).map((v) => v.voter_name) })),
          }
          setMessages((prev) => prev.map((msg) =>
            msg.id === poll.message_id ? { ...msg, poll: chatPoll } : msg
          ))
        }, 600)
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_poll_votes" }, (payload) => {
        const v = payload.new as { option_id: string; voter_name: string }
        setMessages((prev) => prev.map((msg) => {
          if (!msg.poll) return msg
          if (!msg.poll.options.some((o) => o.id === v.option_id)) return msg
          return {
            ...msg,
            poll: {
              ...msg.poll,
              options: msg.poll.options.map((o) =>
                o.id === v.option_id && !o.voters.includes(v.voter_name)
                  ? { ...o, voters: [...o.voters, v.voter_name] }
                  : o
              ),
            },
          }
        }))
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_poll_votes" }, (payload) => {
        const v = payload.old as { option_id: string; voter_name: string }
        setMessages((prev) => prev.map((msg) => {
          if (!msg.poll) return msg
          if (!msg.poll.options.some((o) => o.id === v.option_id)) return msg
          return {
            ...msg,
            poll: {
              ...msg.poll,
              options: msg.poll.options.map((o) =>
                o.id === v.option_id
                  ? { ...o, voters: o.voters.filter((vn) => vn !== v.voter_name) }
                  : o
              ),
            },
          }
        }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  async function send() {
    if (!draft.trim() && !attached) return
    const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })

    if (conversationId) {
      const supabase = createClient()
      const { data: inserted } = await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        sender_name: senderName,
        sender_initials: senderInitials,
        text: draft.trim() || null,
        image_url: attached ?? null,
      }).select().single()

      // Realtime will add it, but we also add optimistically for instant feedback
      if (inserted) {
        const newMsg: ChatMessage = {
          id: inserted.id,
          author: senderName,
          initials: senderInitials,
          text: draft.trim(),
          time,
          self: true,
          image: attached ?? undefined,
        }
        setMessages((prev) => prev.some((m) => m.id === inserted.id) ? prev : [...prev, newMsg])
        onMessagesChange?.([...messages, newMsg])
      }
    } else {
      // Static/mock conversation — local only
      const newMsg: ChatMessage & { image?: string } = {
        id: String(Date.now()),
        author: senderName, initials: senderInitials,
        text: draft.trim(), time, self: true,
        image: attached ?? undefined,
      }
      const newMessages = [...messages, newMsg]
      setMessages(newMessages)
      onMessagesChange?.(newMessages)
    }
    setDraft("")
    setAttached(null)
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
    <div className="relative flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-2.5">
        <button onClick={onBack} className="flex size-9 items-center justify-center rounded-full active:bg-secondary">
          <ArrowLeft className="size-5" />
        </button>
        <div className="relative">
          {headerPhotoUrl ? (
            <img src={headerPhotoUrl} alt={initials} className="size-10 rounded-xl object-cover" />
          ) : (
            <span
              className="flex size-10 items-center justify-center rounded-xl text-xs font-bold text-white"
              style={{ backgroundColor: `hsl(${color})` }}
            >
              {initials}
            </span>
          )}
          {online && (
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-emerald-500" />
          )}
        </div>
        <button
          className={`min-w-0 flex-1 text-left ${groupSettings ? "active:opacity-70" : ""}`}
          onClick={() => groupSettings && setShowSettings(true)}
          disabled={!groupSettings}
        >
          <div className="flex items-center gap-1">
            {isPrivate && <Lock className="size-3 shrink-0 text-primary" />}
            <span className="truncate font-semibold text-foreground">{title}</span>
            {groupSettings && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
          </div>
          <span className="block text-xs text-muted-foreground">{subtitle}</span>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-background px-3 py-4">
        {messages.map((m) => {
          const msg = m as ChatMessage & { image?: string }

          if (m.system) {
            return (
              <div key={m.id} className="flex justify-center py-1">
                <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                  {m.text}
                </span>
              </div>
            )
          }

          if (m.poll) {
            return (
              <div key={m.id} className={`flex flex-col gap-1 ${m.self ? "items-end" : "items-start"}`}>
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
            )
          }

          return (
            <div key={m.id} className={`flex ${m.self ? "justify-end" : "justify-start"}`}>
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
                  {msg.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={msg.image} alt="" className="mb-1 max-h-48 rounded-lg" />
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
      <div className="shrink-0 border-t border-border bg-card px-3 py-2 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        {(attached || uploading) && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-secondary px-2 py-1.5 text-xs text-secondary-foreground">
            {uploading
              ? <><Loader2 className="size-3.5 animate-spin text-primary" /> Fotoğraf yükleniyor…</>
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
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-secondary"
          >
            <ImageIcon className="size-5" />
          </button>
          {conversationId && (
            <button
              onClick={() => setShowPollCompose(true)}
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-secondary"
              aria-label="Anket oluştur"
            >
              <BarChart2 className="size-5" />
            </button>
          )}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={t("messages.typeMessage")}
            className="h-11 flex-1 rounded-full border border-input bg-background px-4 text-base outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <button
            onClick={send}
            disabled={(!draft.trim() && !attached) || uploading}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
          >
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          </button>
        </div>
      </div>

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
