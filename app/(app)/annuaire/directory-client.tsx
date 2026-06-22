"use client"

import { useState, useMemo, useEffect } from "react"
import { Search, Phone, Mail, Cake, ExternalLink, Home, GraduationCap, ChevronDown, Check } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { MEMBERS, STATIONS, STATIONS_SORTED, getStation, YONETIM_KURULU_ROLES, YURUTME_KURULU_ROLES, type Member, type StationId, type Role } from "@/lib/data/stations"
import { PageHeader } from "@/components/app-shell"
import { Modal } from "@/components/ui/modal"
import { createClient } from "@/lib/supabase/client"

type StationFilter = "all" | StationId

export function DirectoryClient() {
  const { t } = useI18n()
  const [search, setSearch] = useState("")
  const [stationFilter, setStationFilter] = useState<StationFilter>("all")
  const [selected, setSelected] = useState<Member | null>(null)
  const [allMembers, setAllMembers] = useState<Member[]>(MEMBERS)
  const [currentUser, setCurrentUser] = useState<{ station: StationId; isIntl: boolean }>({ station: "paris", isIntl: false })
  const [assignOpen, setAssignOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: me } = await supabase.from("profiles").select("station").eq("id", user.id).single()
        if (me?.station) {
          setCurrentUser({ station: me.station as StationId, isIntl: me.station === "intl" })
        }
      }
      const { data: profiles } = await supabase.from("profiles").select("*")
      if (profiles && profiles.length > 0) {
        const mapped: Member[] = profiles.map((p) => ({
          id: p.id,
          name: p.name ?? "",
          initials: p.initials ?? "",
          role: p.role ?? "",
          station: (p.station ?? "paris") as StationId,
          city: p.station ?? "paris",
          email: p.email ?? "",
          phone: p.phone ?? "",
          birthday: p.birthday ?? "",
          linkedin: p.linkedin ?? "",
          memleket: p.memleket ?? "",
          igemEgitimi: p.igem_egitimi ?? undefined,
          photoUrl: p.photo_url ?? undefined,
          online: false,
        }))
        setAllMembers(mapped)
      }
    }
    load()
  }, [])

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

  const showStationFilter = true

  return (
    <div>
      <PageHeader title={t("nav.directory")} />

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
            {members.map((m) => (
              <MemberRow key={m.id} member={m} onClick={() => setSelected(m)} />
            ))}
          </div>
        ))}
        {grouped.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">Üye bulunamadı</p>
        )}
      </div>

      <Modal open={!!selected} onClose={() => { setSelected(null); setAssignOpen(false) }} title={t("nav.directory")}>
        {selected && (
          <>
            <MemberDetail member={selected} />
            {currentUser.isIntl && (
              <div className="mt-4 border-t border-border pt-4">
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
      className="flex items-center gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors active:bg-secondary"
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
          {member.role}
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
