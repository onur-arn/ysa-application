"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  User, Bell, Info, LogOut, Moon, Sun, Rocket, X, Camera,
  Pencil, Mail, Lock, Phone, Cake, ExternalLink, MapPin, Check,
  ChevronDown, ZoomIn, Loader2, Briefcase,
} from "lucide-react"
import Cropper from "react-easy-crop"
import type { Area } from "react-easy-crop"
import { useI18n } from "@/lib/i18n/context"
import { useTheme } from "@/lib/theme/context"
import { getStation, SEHIRLER, STATIONS_SORTED } from "@/lib/data/stations"
import { getCroppedImg } from "@/lib/crop"
import { createClient } from "@/lib/supabase/client"
import { AdminPanel } from "./admin-panel"

const ADMIN_EMAIL = "secretaire@youthstation.org"

type ProfileData = {
  name: string
  email: string
  phone: string
  birthday: string
  linkedin: string
  memleket: string
  photoUrl: string | null
  station: string
  role: string
  igemEgitimi: string
  igemTarihi: string
  password?: string
}

export function SettingsClient({
  email: initialEmail,
  fullName,
  station,
  phone: initialPhone,
  birthday: initialBirthday,
  linkedin: initialLinkedin,
  memleket: initialMemleket,
  photoUrl: initialPhotoUrl,
  role: initialRole,
  igemEgitimi: initialIgemEgitimi,
  igemTarihi: initialIgemTarihi,
}: {
  email: string
  fullName: string
  station: string
  phone?: string
  birthday?: string
  linkedin?: string
  memleket?: string
  photoUrl?: string | null
  role?: string
  igemEgitimi?: string
  igemTarihi?: string
}) {
  const router = useRouter()
  const { t } = useI18n()
  const { theme, toggle } = useTheme()
  const [notifs, setNotifs] = useState({ push: true, email: false, events: true })
  const [loggingOut, setLoggingOut] = useState(false)
  const [igemOpen, setIgemOpen] = useState(false)
  const [igemMotivation, setIgemMotivation] = useState("")
  const [igemSent, setIgemSent] = useState(false)
  const [editOpen, setEditOpen] = useState(false)


  const [profile, setProfile] = useState<ProfileData>({
    name: fullName,
    email: initialEmail,
    phone: initialPhone ?? "",
    birthday: initialBirthday ?? "",
    linkedin: initialLinkedin ?? "",
    memleket: initialMemleket ?? "",
    photoUrl: initialPhotoUrl ?? null,
    station: station,
    role: initialRole ?? "",
    igemEgitimi: initialIgemEgitimi ?? "",
    igemTarihi: initialIgemTarihi ?? "",
  })

  const isIntl = profile.station === "intl"
  const stationInfo = getStation(profile.station as never)
  const initials =
    profile.name.trim().split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() ||
    (profile.email[0]?.toUpperCase() ?? "U")

  async function saveProfile(updated: ProfileData): Promise<string | null> {
    try {
      const res = await fetch("/api/profile-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      })
      const json = await res.json()
      if (!res.ok) return json.error ?? "Bilinmeyen hata."
      setProfile(updated)
      setEditOpen(false)
      router.refresh()
      return null
    } catch {
      return "Ağ hatası. Bağlantınızı kontrol edin."
    }
  }

  async function logout() {
    setLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {}
    window.location.href = "/"
  }


  async function submitIgem() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profileData } = await supabase.from("profiles").select("name,initials,station").eq("id", user.id).single()
      const authorName = profileData?.name || profile.name || "Kullanıcı"
      const authorStation = profileData?.station || station
      const authorInitials = profileData?.initials || initials

      await supabase.from("igem_requests").insert({
        author: authorName,
        initials: authorInitials,
        station: authorStation,
        motivation: igemMotivation,
        created_by: user.id,
      })
    } catch {}
    setIgemSent(true)
    setIgemOpen(false)
    setIgemMotivation("")
  }

  const igemDisplay =
    profile.igemEgitimi === "evet"
      ? `Evet${profile.igemTarihi ? ` — ${profile.igemTarihi}` : ""}`
      : profile.igemEgitimi === "hayır"
      ? "Hayır"
      : "—"

  return (
    <div>
      <div className="flex flex-col gap-6 px-4 pt-4">
        {/* Profile card */}
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <div className="relative shrink-0">
            {profile.photoUrl ? (
              <img src={profile.photoUrl} alt={fullName} className="size-16 rounded-full object-cover" />
            ) : (
              <span
                className="flex size-16 items-center justify-center rounded-full text-xl font-bold text-white"
                style={{ backgroundColor: `hsl(${stationInfo.color})` }}
              >
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-lg font-bold text-foreground">{profile.name || profile.email}</p>
            <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
                style={{ backgroundColor: `hsl(${stationInfo.color})` }}
              >
                {stationInfo.name}
              </span>
              {profile.role && (
                <span className="inline-block rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                  {profile.role}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground transition-colors active:bg-border"
          >
            <Pencil className="size-4" />
          </button>
        </div>

        {/* Appearance */}
        <Section title={t("settings.appearance")} icon={theme === "dark" ? Moon : Sun}>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <button
              onClick={() => theme === "dark" && toggle()}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                theme !== "dark" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              <Sun className="size-4" /> Aydınlık
            </button>
            <button
              onClick={() => theme !== "dark" && toggle()}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                theme === "dark" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              <Moon className="size-4" /> Karanlık
            </button>
          </div>
        </Section>

        {/* Account — all profile fields */}
        <Section title={t("settings.account")} icon={User}>
          <Row label="Ad Soyad" value={profile.name || "—"} />
          <Row label="E-posta" value={profile.email} />
          <Row label="Görev" value={profile.role || "—"} />
          <Row label="İstasyon" value={stationInfo.name} />
          <Row label="Telefon" value={profile.phone || "—"} />
          <Row label="Doğum tarihi" value={profile.birthday || "—"} />
          <Row label="Memleket" value={profile.memleket || "—"} />
          <Row label="iGEM" value={igemDisplay} last />
        </Section>

        {/* Notifications */}
        <Section title={t("settings.notifications")} icon={Bell}>
          <Toggle label={t("settings.pushNotif")} checked={notifs.push} onChange={() => setNotifs((n) => ({ ...n, push: !n.push }))} />
          <Toggle label={t("settings.events")} checked={notifs.events} onChange={() => setNotifs((n) => ({ ...n, events: !n.events }))} last />
        </Section>

        {/* iGEM */}
        <Section title={t("settings.igem")} icon={Rocket}>
          <div className="flex flex-col gap-2 px-4 py-3.5">
            <p className="text-sm text-muted-foreground">{t("settings.igemDesc")}</p>
            {igemSent && (
              <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-600">{t("settings.igemSent")}</p>
            )}
            <button
              onClick={() => setIgemOpen(true)}
              disabled={igemSent}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-colors active:bg-primary/80 disabled:opacity-50"
            >
              <Rocket className="size-4" />
              {t("settings.igemRequestBtn")}
            </button>
          </div>
        </Section>

        {/* About */}
        <Section title={t("settings.about")} icon={Info}>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-foreground">YouthStation</span>
            <span className="text-sm text-muted-foreground">{t("settings.version")}</span>
          </div>
        </Section>


        {/* Admin panel — admin@youthstation.org only */}
        {initialEmail === ADMIN_EMAIL && <AdminPanel />}

        {/* Logout */}
        <button
          onClick={logout}
          disabled={loggingOut}
          className="flex items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 py-3.5 font-semibold text-destructive transition-colors active:bg-destructive/10 disabled:opacity-60"
        >
          <LogOut className="size-5" />
          {t("settings.logout")}
        </button>

        {/* Developer credit */}
        <div className="mb-4 mt-5 flex flex-col items-center gap-1 text-center text-[11px] text-muted-foreground/55">
          <p>
            <span className="font-medium text-muted-foreground/75">Onur Arslan</span> tarafından geliştirilmiştir.
          </p>
          <p>
            Bilgi için{" "}
            <a href="mailto:onur54700@gmail.com" className="underline underline-offset-2 hover:text-primary transition-colors">
              onur54700@gmail.com
            </a>
          </p>
        </div>
      </div>

      {/* Edit profile modal */}
      <AnimatePresence>
        {editOpen && (
          <EditProfileModal
            profile={profile}
            onSave={saveProfile}
            onClose={() => setEditOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* iGEM modal */}
      <AnimatePresence>
        {igemOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-6"
            onClick={() => setIgemOpen(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold text-foreground">{t("settings.igem")}</h2>
                <button onClick={() => setIgemOpen(false)} className="rounded-full p-1 text-muted-foreground active:bg-secondary">
                  <X className="size-5" />
                </button>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">{t("settings.igemDesc")}</p>
              <label className="mb-1 block text-sm font-medium text-foreground">{t("settings.igemMotivation")}</label>
              <textarea
                value={igemMotivation}
                onChange={(e) => setIgemMotivation(e.target.value)}
                placeholder={t("settings.igemMotivationPlaceholder")}
                rows={4}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <button
                onClick={submitIgem}
                className="mt-3 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors active:bg-primary/80"
              >
                {t("settings.igemRequestBtn")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Edit Profile Modal ────────────────────────────────────────────────────────
function EditProfileModal({
  profile,
  onSave,
  onClose,
}: {
  profile: ProfileData
  onSave: (p: ProfileData) => Promise<string | null>
  onClose: () => void
}) {
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState(profile.phone)
  const [birthday, setBirthday] = useState(profile.birthday)
  const [linkedin, setLinkedin] = useState(profile.linkedin)
  const [memleket, setMemleket] = useState(profile.memleket)
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile.photoUrl)
  const [stationVal, setStationVal] = useState(profile.station)
  const [role, setRole] = useState(profile.role)
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Crop states
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleCropConfirm = useCallback(async () => {
    if (!cropSrc || !croppedAreaPixels) return
    try {
      const { dataUrl, file } = await getCroppedImg(cropSrc, croppedAreaPixels)
      setPhotoUrl(dataUrl)
      setPendingPhotoFile(file)
    } catch {}
    setCropSrc(null)
    setZoom(1)
    setCrop({ x: 0, y: 0 })
  }, [cropSrc, croppedAreaPixels])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    let finalPhotoUrl = photoUrl
    if (pendingPhotoFile) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(",")[1])
          reader.onerror = reject
          reader.readAsDataURL(pendingPhotoFile)
        })
        const ext = pendingPhotoFile.name.split(".").pop() ?? "jpg"
        const res = await fetch("/api/profile-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoBase64: base64, photoExt: ext }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? "Upload failed")
        finalPhotoUrl = json.url
      } catch {
        setSaveError("Fotoğraf yüklenemedi. Lütfen tekrar deneyin.")
        setSaving(false)
        return
      }
    }
    const err = await onSave({
      name, email, phone, birthday, linkedin, memleket,
      photoUrl: finalPhotoUrl, station: stationVal, role,
      igemEgitimi: profile.igemEgitimi,
      igemTarihi: profile.igemTarihi,
      ...(password ? { password } : {}),
    })
    // onSave closes the modal on success — only update error state on failure
    if (err) {
      setSaveError(err)
      setSaving(false)
    }
  }

  const fieldClass =
    "h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4"
      onClick={onClose}
    >
      {/* Crop overlay */}
      {cropSrc && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black"
          onClick={e => e.stopPropagation()}
        >
          <div className="relative flex-1">
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, px) => setCroppedAreaPixels(px)}
            />
          </div>
          <div className="flex flex-col gap-4 bg-black/80 px-6 py-5">
            <div className="flex items-center gap-3 text-white">
              <ZoomIn className="size-4 opacity-50" />
              <input
                type="range" min={1} max={3} step={0.01}
                value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                className="flex-1 accent-white"
              />
              <ZoomIn className="size-5" />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setCropSrc(null); setZoom(1); setCrop({ x: 0, y: 0 }) }}
                className="flex-1 rounded-xl border border-white/30 py-3 font-semibold text-white"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleCropConfirm}
                className="flex-1 rounded-xl bg-white py-3 font-semibold text-black"
              >
                Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-heading text-lg font-bold text-foreground">Profili düzenle</h2>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground active:bg-secondary">
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable form */}
        <form onSubmit={handleSave} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-5 py-4">
          {/* Photo */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex size-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-secondary transition-colors hover:border-primary"
            >
              {photoUrl ? (
                <img src={photoUrl} alt="Profil" className="size-full object-cover" />
              ) : (
                <Camera className="size-7 text-muted-foreground group-hover:text-primary" />
              )}
              {photoUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="size-5 text-white" />
                </div>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <p className="text-xs text-muted-foreground">Profil fotoğrafı</p>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Ad Soyad</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={name} onChange={e => setName(e.target.value)} className={fieldClass} />
            </div>
          </div>

          {/* Station — read-only */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">İstasyon</label>
            <div className="flex h-11 items-center gap-2 rounded-xl border border-input bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed">
              <MapPin className="size-4 shrink-0" />
              <span>{STATIONS_SORTED.find(s => s.id === stationVal)?.city ?? stationVal}</span>
              <span className="ml-auto text-xs">Değiştirilemez</span>
            </div>
          </div>

          {/* Role — read-only */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Görev</label>
            <div className="flex h-11 items-center gap-2 rounded-xl border border-input bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed">
              <Briefcase className="size-4 shrink-0" />
              <span>{role || "—"}</span>
              <span className="ml-auto text-xs">Değiştirilemez</span>
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">E-posta</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={fieldClass} />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Şifre <span className="font-normal text-muted-foreground">(boş bırakırsanız değişmez)</span></label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={6} className={fieldClass} />
            </div>
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Telefon</label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+33 6 12 34 56 78" className={fieldClass} />
            </div>
          </div>

          {/* Birthday */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Doğum tarihi</label>
            <div className="relative">
              <Cake className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} className={fieldClass} />
            </div>
          </div>

          {/* LinkedIn */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">LinkedIn</label>
            <div className="relative">
              <ExternalLink className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="url" value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/…" className={fieldClass} />
            </div>
          </div>

          {/* Memleket */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Memleket</label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={memleket}
                onChange={e => setMemleket(e.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-input bg-background pl-9 pr-9 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                <option value="">İlininizi seçiniz</option>
                {([...SEHIRLER] as string[])
                  .sort((a, b) => parseInt(a) - parseInt(b))
                  .map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {saveError && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{saveError}</p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors active:bg-primary/80 disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }: { title: string; icon: typeof User; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-muted-foreground">
        <Icon className="size-4" />
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">{children}</div>
    </div>
  )
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 ${last ? "" : "border-b border-border"}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] truncate font-medium text-foreground">{value}</span>
    </div>
  )
}

function Toggle({ label, checked, onChange, last }: { label: string; checked: boolean; onChange: () => void; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 ${last ? "" : "border-b border-border"}`}>
      <span className="text-foreground">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-input"}`}
      >
        <motion.span
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="absolute left-1 top-1 size-5 rounded-full bg-white shadow"
        />
      </button>
    </div>
  )
}
