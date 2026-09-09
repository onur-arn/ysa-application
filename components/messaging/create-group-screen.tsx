"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Search, Check, Users, Loader2, Camera } from "lucide-react"
import { MEMBERS, getStation, type Member } from "@/lib/data/stations"
import { createClient } from "@/lib/supabase/client"

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

/** Full-screen create-group flow (above compose). */
export function CreateGroupScreen({
  currentUserName,
  onClose,
  onCreate,
}: {
  currentUserName: string
  onClose: () => void
  onCreate: (name: string, memberNames: string[], photo?: { base64: string; ext: string } | null) => void | Promise<void>
}) {
  const [step, setStep] = useState<"members" | "name">("members")
  const [name, setName] = useState("")
  const [memberSearch, setMemberSearch] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>(MEMBERS)
  const [saving, setSaving] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoPayload, setPhotoPayload] = useState<{ base64: string; ext: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    void supabase
      .from("profiles")
      .select("id,name,initials,station,role,email,phone,birthday,linkedin,memleket,photo_url,igem_egitimi")
      .then(({ data }) => {
        if (data?.length) setAllMembers(data.map((p) => mapProfile(p as Record<string, unknown>)))
      })
  }, [])

  const filtered = useMemo(() => {
    const q = memberSearch.toLowerCase().trim()
    return allMembers
      .filter((m) => m.name && m.name !== currentUserName)
      .filter((m) => !q || m.name.toLowerCase().includes(q) || (m.role ?? "").toLowerCase().includes(q))
      .sort((a, b) => {
        const aSel = selected.includes(a.name) ? 0 : 1
        const bSel = selected.includes(b.name) ? 0 : 1
        if (aSel !== bSel) return aSel - bSel
        return a.name.localeCompare(b.name, "tr")
      })
  }, [allMembers, memberSearch, currentUserName, selected])

  const selectedMembers = useMemo(
    () => allMembers.filter((m) => selected.includes(m.name)),
    [allMembers, selected],
  )

  function toggle(name: string) {
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed || selected.length === 0 || saving) return
    setSaving(true)
    try {
      await onCreate(trimmed, selected, photoPayload)
    } finally {
      setSaving(false)
    }
  }

  function onPickPhoto(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase()
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || "")
      const base64 = result.includes(",") ? result.split(",")[1] : result
      setPhotoPreview(result)
      setPhotoPayload({ base64, ext })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-md flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-3">
        <button
          type="button"
          onClick={() => (step === "name" ? setStep("members") : onClose())}
          className="flex size-9 items-center justify-center rounded-full active:bg-secondary"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold tracking-tight text-foreground">
            {step === "members" ? "Yeni grup" : "Grup adı"}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {step === "members"
              ? selected.length > 0
                ? `${selected.length} kişi seçildi`
                : "En az 1 kişi seç"
              : "Son adım"}
          </p>
        </div>
        {step === "members" && (
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => setStep("name")}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            İleri
          </button>
        )}
      </div>

      {step === "members" ? (
        <>
          {selectedMembers.length > 0 && (
            <div className="no-scrollbar flex gap-3 overflow-x-auto border-b border-border/40 px-4 py-3">
              {selectedMembers.map((m) => {
                const s = getStation(m.station)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.name)}
                    className="flex w-16 shrink-0 flex-col items-center gap-1"
                  >
                    <div className="relative">
                      {m.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.photoUrl} alt="" className="size-12 rounded-full object-cover" />
                      ) : (
                        <span
                          className="flex size-12 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: `hsl(${s.color})` }}
                        >
                          {m.initials}
                        </span>
                      )}
                      <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    </div>
                    <span className="w-full truncate text-center text-[10px] text-foreground">{m.name.split(" ")[0]}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="px-4 pt-3">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Üye ara…"
                className="h-11 w-full rounded-full border-0 bg-secondary pl-9 pr-3 text-base outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-8">
            {filtered.map((m) => {
              const s = getStation(m.station)
              const isSelected = selected.includes(m.name)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.name)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-secondary"
                >
                  {m.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photoUrl} alt="" className="size-12 rounded-full object-cover" />
                  ) : (
                    <span
                      className="flex size-12 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: `hsl(${s.color})` }}
                    >
                      {m.initials}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{m.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {m.role ? `${m.role} · ` : ""}{s.city}
                    </p>
                  </div>
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                    }`}
                  >
                    {isSelected && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">Kimse bulunamadı</p>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col px-5 pt-8">
          <div className="mb-8 flex flex-col items-center gap-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary active:opacity-80"
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="" className="size-full object-cover" />
                ) : (
                  <Users className="size-9" />
                )}
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Grup fotoğrafı ekle"
                className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full border-[3px] border-background bg-primary text-primary-foreground shadow-md active:scale-95"
              >
                <Camera className="size-4" strokeWidth={2.25} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Grup fotoğrafı ekle (isteğe bağlı)</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Grup adı yaz…"
              autoFocus
              maxLength={60}
              className="w-full border-0 border-b-2 border-border bg-transparent pb-2 text-center text-xl font-semibold outline-none focus:border-primary"
            />
            <p className="text-center text-sm text-muted-foreground">
              {selected.length} üye · sen yönetici olacaksın
            </p>
          </div>

          <div className="mt-auto pb-8">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!name.trim() || saving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Grup oluştur
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
