"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Search, Users, Pencil } from "lucide-react"
import { MEMBERS, getStation, type Member } from "@/lib/data/stations"
import { createClient } from "@/lib/supabase/client"
import { usePresence } from "@/lib/presence"

function mapProfile(p: Record<string, unknown>): Member {
  return {
    id: p.id as string,
    name: (p.name as string) ?? "",
    initials: (p.initials as string) ?? "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    role: ((p.role as string) ?? "") as any,
    station: ((p.station ?? "paris") as Member["station"]),
    city: (p.station as string) ?? "paris",
    email: (p.email as string) ?? "",
    phone: (p.phone as string) ?? "",
    birthday: (p.birthday as string) ?? "",
    linkedin: (p.linkedin as string) ?? "",
    memleket: (p.memleket as string) ?? "",
    igemEgitimi: (p.igem_egitimi as "evet" | "hayır") ?? undefined,
    photoUrl: (p.photo_url as string) ?? undefined,
    online: false,
  }
}

/** BeReal-style compose: create group + pick a contact in one screen */
export function ComposeScreen({
  currentUserName,
  currentUserId,
  existingDmNames,
  onClose,
  onSelectContact,
  onCreateGroup,
}: {
  currentUserName: string
  currentUserId?: string
  existingDmNames: string[]
  onClose: () => void
  onSelectContact: (member: Member) => void
  onCreateGroup: () => void
}) {
  const activeUsers = usePresence()
  const [search, setSearch] = useState("")
  const [members, setMembers] = useState<Member[]>(MEMBERS)

  useEffect(() => {
    const supabase = createClient()
    void supabase
      .from("profiles")
      .select("id,name,initials,station,role,phone,email,birthday,linkedin,memleket,photo_url,igem_egitimi")
      .then(({ data }) => {
        if (data?.length) setMembers(data.map((p) => mapProfile(p as Record<string, unknown>)))
      })
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return members
      .filter((m) => m.name && m.name !== currentUserName && m.id !== currentUserId)
      .filter((m) => !q || m.name.toLowerCase().includes(q) || (m.role ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
  }, [members, search, currentUserName, currentUserId])

  return (
    <div className="fixed inset-0 z-[55] mx-auto flex max-w-md flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex size-9 items-center justify-center rounded-full active:bg-secondary"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h2 className="flex-1 text-lg font-bold tracking-tight text-foreground">Yeni</h2>
      </div>

      <div className="px-4 pt-3">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Arkadaş ara…"
            autoFocus
            className="h-11 w-full rounded-full border-0 bg-secondary pl-9 pr-3 text-base outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <button
          type="button"
          onClick={onCreateGroup}
          className="mb-2 flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left active:bg-secondary"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Yeni grup</p>
            <p className="text-sm text-muted-foreground">Birden fazla kişiyle sohbet</p>
          </div>
          <Pencil className="size-4 text-muted-foreground" />
        </button>
      </div>

      <p className="px-5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Önerilenler
      </p>

      <div className="flex-1 overflow-y-auto pb-8">
        {filtered.map((m) => {
          const station = getStation(m.station)
          const online = activeUsers.has(m.name)
          const already = existingDmNames.includes(m.name)
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectContact(m)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-secondary"
            >
              <div className="relative shrink-0">
                {m.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.photoUrl} alt="" className="size-12 rounded-full object-cover" />
                ) : (
                  <span
                    className="flex size-12 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: `hsl(${station.color})` }}
                  >
                    {m.initials}
                  </span>
                )}
                {online && (
                  <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-background bg-emerald-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{m.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {already ? "Sohbet mevcut" : station.city}
                </p>
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">Kimse bulunamadı</p>
        )}
      </div>
    </div>
  )
}
