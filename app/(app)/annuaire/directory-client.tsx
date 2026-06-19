"use client"

import { useState, useMemo } from "react"
import { Search, Phone, Mail, Cake, MapPin, ExternalLink, Home } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { MEMBERS, STATIONS, getStation, type Member, type StationId } from "@/lib/data/stations"
import { PageHeader } from "@/components/app-shell"
import { Modal } from "@/components/ui/modal"

type StationFilter = "all" | StationId

export function DirectoryClient() {
  const { t } = useI18n()
  const [search, setSearch] = useState("")
  const [stationFilter, setStationFilter] = useState<StationFilter>("all")
  const [selected, setSelected] = useState<Member | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return [...MEMBERS]
      .filter((m) => {
        const matchesSearch =
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q) ||
          getStation(m.station).name.toLowerCase().includes(q) ||
          m.city.toLowerCase().includes(q)
        const matchesStation = stationFilter === "all" || m.station === stationFilter
        return matchesSearch && matchesStation
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [search, stationFilter])

  const grouped = useMemo(() => {
    const map: Record<string, Member[]> = {}
    filtered.forEach((m) => {
      const letter = m.name[0].toUpperCase()
      map[letter] = map[letter] || []
      map[letter].push(m)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

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

        {/* Station filter chips */}
        <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
          <StationChip
            active={stationFilter === "all"}
            onClick={() => setStationFilter("all")}
            label="Tümü"
          />
          {[...STATIONS]
            .sort((a, b) => a.city.localeCompare(b.city, "tr"))
            .map((s) => (
              <StationChip
                key={s.id}
                active={stationFilter === s.id}
                onClick={() => setStationFilter(s.id)}
                label={s.city}
                color={s.color}
              />
            ))}
        </div>

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

      <Modal open={!!selected} onClose={() => setSelected(null)} title={t("nav.directory")}>
        {selected && <MemberDetail member={selected} />}
      </Modal>
    </div>
  )
}

function StationChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean
  onClick: () => void
  label: string
  color?: string
}) {
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
        <span
          className="flex size-11 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: `hsl(${station.color})` }}
        >
          {member.initials}
        </span>
        {member.online && (
          <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-background bg-emerald-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{member.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {member.role} · {station.city}
        </p>
      </div>
    </button>
  )
}

function MemberDetail({ member }: { member: Member }) {
  const { t } = useI18n()
  const station = getStation(member.station)

  const rows = [
    { icon: Phone, label: t("directory.phone"), value: member.phone, href: `tel:${member.phone}` },
    { icon: Mail, label: t("directory.email"), value: member.email, href: `mailto:${member.email}` },
    { icon: Cake, label: t("directory.birthday"), value: member.birthday },
    { icon: MapPin, label: t("directory.city"), value: member.city },
    ...(member.memleket
      ? [{ icon: Home, label: t("directory.memleket"), value: member.memleket }]
      : []),
    ...(member.linkedin
      ? [{ icon: ExternalLink, label: "LinkedIn", value: "Profili gör", href: member.linkedin }]
      : []),
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <span
            className="flex size-20 items-center justify-center rounded-full text-2xl font-bold text-white"
            style={{ backgroundColor: `hsl(${station.color})` }}
          >
            {member.initials}
          </span>
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
