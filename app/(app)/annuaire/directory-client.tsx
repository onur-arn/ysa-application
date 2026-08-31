"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, Phone, Mail, Cake, ExternalLink, Home, GraduationCap, ChevronDown, Check, MessageCircle, Trash2, Loader2 } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { MEMBERS, STATIONS_SORTED, getStation, YONETIM_KURULU_ROLES, YURUTME_KURULU_ROLES, type Member, type StationId, type Role } from "@/lib/data/stations"
import { Modal } from "@/components/ui/modal"
import { createClient } from "@/lib/supabase/client"
import { usePresence } from "@/lib/presence"
import { isAdminEmail } from "@/lib/admin"
import { findOrCreateDMFromBrowser } from "@/lib/dm"

type StationFilter = "all" | StationId

interface DirectoryClientProps {
  initialCurrentUserId?: string
  initialCurrentUserName?: string
  initialCurrentUserEmail?: string
  initialCurrentUserStation?: string
  initialProfiles?: Record<string, unknown>[]
}

function mapProfiles(profiles: Record<string, unknown>[]): Member[] {
  return profiles.map((p) => ({
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
  }))
}

export function DirectoryClient({
  initialCurrentUserId = "",
  initialCurrentUserName = "",
  initialCurrentUserEmail = "",
  initialCurrentUserStation = "paris",
  initialProfiles = [],
}: DirectoryClientProps) {
  const { t } = useI18n()
  const router = useRouter()
  const activeUsers = usePresence()
  const isAdmin = isAdminEmail(initialCurrentUserEmail)
  const [search, setSearch] = useState("")
  const [stationFilter, setStationFilter] = useState<StationFilter>("all")
  const [selected, setSelected] = useState<Member | null>(null)
  const [allMembers, setAllMembers] = useState<Member[]>(() =>
    initialProfiles.length > 0 ? mapProfiles(initialProfiles) : MEMBERS
  )
  const [currentUser, setCurrentUser] = useState<{ station: StationId; isIntl: boolean }>({
    station: (initialCurrentUserStation as StationId) ?? "paris",
    isIntl: initialCurrentUserStation === "intl",
  })
  const [assignOpen, setAssignOpen] = useState(false)
  const [messaging, setMessaging] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)


  // All stations see all members
  const visibleMembers = allMembers

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return [...visibleMembers]
      .filter((m) => {
        if (!m.name) return false
        const matchesSearch =
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q) ||
          getStation(m.station).name.toLowerCase().includes(q) ||
          (m.city ?? "").toLowerCase().includes(q)
        const matchesStation = stationFilter === "all" || m.station === stationFilter
        return matchesSearch && matchesStation
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [search, stationFilter, visibleMembers])

  const grouped = useMemo(() => {
    const map: Record<string, Member[]> = {}
    filtered.forEach((m) => {
      const letter = (m.name?.[0] ?? "#").toUpperCase()
      map[letter] = map[letter] || []
      map[letter].push(m)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  async function assignRole(member: Member, role: Role) {
    try {
      const supabase = createClient()
      await supabase.from("profiles").update({ role }).eq("id", member.id)
      setAllMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, role } : m))
      setSelected((prev) => prev?.id === member.id ? { ...prev, role } : prev)
    } catch {}
    setAssignOpen(false)
  }

  async function startMessage(member: Member) {
    if (member.id === initialCurrentUserId) return
    const myName = initialCurrentUserName.trim()
    if (!myName) {
      setMessageError("Profilinizde isim eksik. Ayarlardan tamamlayın.")
      return
    }
    setMessaging(true)
    setMessageError(null)
    try {
      const convId = await findOrCreateDMFromBrowser(myName, {
        name: member.name,
        initials: member.initials,
        station: member.station,
      })
      if (!convId) {
        setMessageError("Sohbet açılamadı. Lütfen tekrar deneyin.")
        return
      }
      setSelected(null)
      router.push(`/messages?open=${convId}`)
    } catch {
      setMessageError("Bağlantı hatası. Lütfen tekrar deneyin.")
    } finally {
      setMessaging(false)
    }
  }

  async function deleteProfile(member: Member) {
    setDeleting(true)
    try {
      await fetch("/api/admin/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.id }),
      })
      setAllMembers((prev) => prev.filter((m) => m.id !== member.id))
      setSelected(null)
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  const showStationFilter = true

  return (
    <div>
      <div className="px-4 pt-3">
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim, görev veya şehir..."
            className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-base outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>

        {/* Station filter chips — intl only */}
        {showStationFilter && (
          <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
            <StationChip active={stationFilter === "all"} onClick={() => setStationFilter("all")} label="Tümü" />
            {STATIONS_SORTED.map((s) => (
              <StationChip
                key={s.id}
                active={stationFilter === s.id}
                onClick={() => setStationFilter(s.id)}
                label={s.city}
                color={s.color}
              />
            ))}
          </div>
        )}

        <p className="px-1 py-2 text-xs text-muted-foreground">
          {filtered.length} {t("directory.members")}
        </p>
      </div>

      <div className="flex flex-col">
        {grouped.map(([letter, members]) => (
          <div key={letter}>
            <div className="sticky top-14 z-[1] bg-background/95 px-4 py-1 text-xs font-bold text-primary backdrop-blur">
              {letter}
            </div>
            {members.map((m) => {
              const online = activeUsers.has(m.name)
              return (
                <MemberRow
                  key={m.id}
                  member={{ ...m, online }}
                  onClick={() => setSelected({ ...m, online })}
                />
              )
            })}
          </div>
        ))}
        {grouped.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">Üye bulunamadı</p>
        )}
      </div>

      <Modal open={!!selected} onClose={() => { setSelected(null); setAssignOpen(false); setConfirmDelete(false); setMessageError(null) }} title={t("nav.directory")}>
        {selected && (
          <>
            <MemberDetail member={selected} />
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
              {selected.id !== initialCurrentUserId && (
                <>
                  <button
                    type="button"
                    onClick={() => startMessage(selected)}
                    disabled={messaging}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors active:bg-primary/90 disabled:opacity-60"
                  >
                    {messaging ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
                    Mesaj gönder
                  </button>
                  {messageError && (
                    <p className="text-center text-xs text-destructive">{messageError}</p>
                  )}
                </>
              )}

              {currentUser.isIntl && (
                <div>
                  {!assignOpen ? (
                    <button
                      onClick={() => setAssignOpen(true)}
                      className="w-full rounded-xl bg-primary/10 py-2.5 text-sm font-semibold text-primary transition-colors active:bg-primary/20"
                    >
                      Görev ver / değiştir
                    </button>
                  ) : (
                    <RoleAssignPanel member={selected} onAssign={(role) => assignRole(selected, role)} onCancel={() => setAssignOpen(false)} />
                  )}
                </div>
              )}

              {isAdmin && selected.id !== initialCurrentUserId && !isAdminEmail(selected.email) && (
                <div>
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 py-2.5 text-sm font-semibold text-destructive transition-colors active:bg-destructive/10"
                    >
                      <Trash2 className="size-4" />
                      Profili sil
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-center text-sm text-destructive">
                        <strong>{selected.name}</strong> uygulamaya erişemeyecek. Emin misiniz?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 rounded-xl border border-border py-2 text-sm font-medium text-muted-foreground"
                        >
                          İptal
                        </button>
                        <button
                          onClick={() => deleteProfile(selected)}
                          disabled={deleting}
                          className="flex-1 rounded-xl bg-destructive py-2 text-sm font-bold text-white disabled:opacity-60"
                        >
                          {deleting ? "Siliniyor…" : "Sil"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

function RoleAssignPanel({ member, onAssign, onCancel }: { member: Member; onAssign: (r: Role) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState<Role>(member.role)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-foreground">Yeni görev seç</p>
      <div className="max-h-52 overflow-y-auto rounded-xl border border-border">
        <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Yönetim Kurulu</p>
        {YONETIM_KURULU_ROLES.map((r) => (
          <RoleOption key={r} role={r} checked={selected === r} onSelect={() => setSelected(r)} />
        ))}
        <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground border-t border-border mt-1">Yürütme Kurulu</p>
        {YURUTME_KURULU_ROLES.map((r) => (
          <RoleOption key={r} role={r} checked={selected === r} onSelect={() => setSelected(r)} />
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground">
          İptal
        </button>
        <button
          onClick={() => onAssign(selected)}
          disabled={selected === member.role}
          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Kaydet
        </button>
      </div>
    </div>
  )
}

function RoleOption({ role, checked, onSelect }: { role: string; checked: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${checked ? "bg-primary/10 font-semibold text-primary" : "text-foreground"}`}
    >
      {role}
      {checked && <Check className="size-4 shrink-0 text-primary" />}
    </button>
  )
}

function StationChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
      }`}
    >
      {color && <span className="size-2 rounded-full" style={{ backgroundColor: `hsl(${color})` }} />}
      {label}
    </button>
  )
}

function MemberRow({ member, onClick }: { member: Member; onClick: () => void }) {
  const station = getStation(member.station)
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors active:bg-secondary"
    >
      <div className="relative shrink-0">
        {member.photoUrl ? (
          <img src={member.photoUrl} alt={member.name} className="size-11 rounded-full object-cover" />
        ) : (
          <span
            className="flex size-11 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: `hsl(${station.color})` }}
          >
            {member.initials}
          </span>
        )}
        {member.online && (
          <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-background bg-emerald-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{member.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {member.role ? `${member.role} · ` : ""}{station.name}
        </p>
      </div>
    </button>
  )
}

const TR_MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"]

function formatBirthday(dateStr?: string): string {
  if (!dateStr) return "—"
  const [y, m, d] = dateStr.split("-").map(Number)
  if (!y || !m || !d) return dateStr
  const now = new Date()
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--
  return `${d} ${TR_MONTHS[m - 1]} ${y} (${age} yaşında)`
}

function MemberDetail({ member }: { member: Member }) {
  const { t } = useI18n()
  const station = getStation(member.station)

  const rows = [
    { icon: Phone, label: t("directory.phone"), value: member.phone, href: `tel:${member.phone}` },
    { icon: Mail, label: t("directory.email"), value: member.email, href: `mailto:${member.email}` },
    { icon: Cake, label: t("directory.birthday"), value: formatBirthday(member.birthday) },
    ...(member.memleket ? [{ icon: Home, label: t("directory.memleket"), value: member.memleket }] : []),
    ...(member.igemEgitimi
      ? [{
          icon: GraduationCap,
          label: "iGEM Eğitimi",
          value: member.igemEgitimi === "evet" ? "✅ Evet" : "❌ Hayır",
        }]
      : []),
    ...(member.linkedin ? [{ icon: ExternalLink, label: "LinkedIn", value: "Profili gör", href: member.linkedin }] : []),
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          {member.photoUrl ? (
            <img src={member.photoUrl} alt={member.name} className="size-20 rounded-full object-cover" />
          ) : (
            <span
              className="flex size-20 items-center justify-center rounded-full text-2xl font-bold text-white"
              style={{ backgroundColor: `hsl(${station.color})` }}
            >
              {member.initials}
            </span>
          )}
          {member.online && (
            <span className="absolute bottom-1 right-1 size-4 rounded-full border-2 border-card bg-emerald-500" />
          )}
        </div>
        <h3 className="mt-3 font-heading text-xl font-bold">{member.name}</h3>
        <span
          className="mt-1 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: `hsl(${station.color})` }}
        >
          {member.role}
        </span>
        <p className="mt-1 text-sm text-muted-foreground">{station.name}</p>
      </div>

      <div className="flex flex-col gap-1">
        {rows.map((r) => {
          const content = (
            <div className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors active:bg-secondary">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <r.icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{r.label}</p>
                <p className="truncate font-medium text-foreground">{r.value}</p>
              </div>
            </div>
          )
          return r.href ? (
            <a key={r.label} href={r.href} target={r.label === "LinkedIn" ? "_blank" : undefined} rel="noopener noreferrer">
              {content}
            </a>
          ) : (
            <div key={r.label}>{content}</div>
          )
        })}
      </div>
    </div>
  )
}
