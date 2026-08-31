"use client"

import dynamic from "next/dynamic"
import { useState, useCallback, useEffect } from "react"
import { getCroppedImg } from "@/lib/crop"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useRef } from "react"
import {
  Mail, Lock, User, Phone, Cake, ExternalLink, Loader2,
  ChevronDown, ChevronLeft, Check, MapPin, Briefcase, CheckCircle2,
  Camera, Moon, Sun, Eye, EyeOff, ZoomIn,
} from "lucide-react"
import Cropper from "react-easy-crop"
import type { Area } from "react-easy-crop"
import { createClient } from "@/lib/supabase/client"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n/context"
import { useTheme } from "@/lib/theme/context"
import {
  STATIONS_SORTED,
  SEHIRLER,
  YONETIM_KURULU_ROLES,
  YURUTME_KURULU_ROLES,
  type Role,
  type StationId,
} from "@/lib/data/stations"

// Lazy-load maps (use browser APIs)
const EuropeMap = dynamic(() => import("./europe-map").then(m => ({ default: m.EuropeMap })), {
  ssr: false,
  loading: () => <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Harita yükleniyor…</div>,
})
const TurkeyMap = dynamic(() => import("./turkey-map").then(m => ({ default: m.TurkeyMap })), {
  ssr: false,
  loading: () => <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Harita yükleniyor…</div>,
})

type FormData = {
  firstName: string
  lastName: string
  email: string
  password: string
  phone: string
  birthday: string
  linkedin: string
  role: Role
  station: StationId
  igemEgitimi: "evet" | "hayır" | ""
  igemTarihi: string
  memleket: string
}

const INITIAL: FormData = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phone: "",
  birthday: "",
  linkedin: "",
  role: "" as Role,
  station: "paris",
  igemEgitimi: "",
  igemTarihi: "",
  memleket: "",
}

const fieldClass =
  "h-12 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
const selectClass =
  "h-12 w-full appearance-none rounded-xl border border-input bg-card pl-3 pr-9 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
const dateClass =
  "h-12 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 [appearance:none] [-webkit-appearance:none]"

const variants = {
  enter: (d: number) => ({ x: d * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d * -40, opacity: 0 }),
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SignUpPage() {
  const router = useRouter()
  const { t } = useI18n()
  const { theme, toggle } = useTheme()
  const [step, setStep] = useState(1)
  const [dir, setDir] = useState(1)
  const [data, setData] = useState<FormData>(INITIAL)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function go(delta: number, updates?: Partial<FormData>) {
    if (updates) setData(p => ({ ...p, ...updates }))
    setDir(delta)
    setStep(s => s + delta)
  }

  async function submit(step3: Partial<FormData> = {}) {
    setLoading(true)
    setError(null)
    const finalData: FormData = { ...data, ...step3 }

    // Convert photo to base64 — upload will happen server-side via admin client (bypasses RLS)
    let photoBase64: string | null = null
    let photoExt: string | null = null
    if (photo) {
      photoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(",")[1])
        reader.onerror = reject
        reader.readAsDataURL(photo)
      })
      photoExt = photo.name.split(".").pop() ?? "jpg"
    }

    try {
      const res = await fetch("/api/signup-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...finalData, photoBase64, photoExt }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        if (json.error === "EMAIL_TAKEN") {
          setError("Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.")
        } else if (json.error === "ROLE_TAKEN") {
          setError("Seçtiğiniz görev zaten başka bir üye tarafından alınmış. Lütfen başka bir görev seçin.")
        } else {
          console.error("signup-request failed:", json)
          setError("Bir hata oluştu. Lütfen tekrar deneyin.")
        }
        setLoading(false)
        return
      }
    } catch (err) {
      console.error("signup-request error:", err)
      setError("Erreur réseau lors de l'envoi. Vérifiez votre connexion.")
      setLoading(false)
      return
    }
    setLoading(false)
    go(1)
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Theme toggle */}
        <div className="absolute right-4 top-4">
          <button
            onClick={toggle}
            className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>

        {/* Logo */}
        <div className="mb-6 flex flex-col items-center">
          <Logo className="h-12 w-12" />
        </div>

        {/* Progress bar */}
        {step < 4 && (
          <div className="mb-6 flex items-center gap-1.5">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  step >= i ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: "easeInOut" }}
          >
            {step === 1 && (
              <Step1
                data={data}
                photo={photo}
                photoPreview={photoPreview}
                onPhotoChange={(file, preview) => { setPhoto(file); setPhotoPreview(preview) }}
                onNext={d => go(1, d)}
                onLogin={() => router.push("/auth/login")}
              />
            )}
            {step === 2 && <Step2 data={data} onNext={d => go(1, d)} onBack={() => go(-1)} />}
            {step === 3 && (
              <Step3
                data={data}
                onBack={() => go(-1)}
                onSubmit={(d) => { setData(p => ({ ...p, ...d })); submit(d) }}
                loading={loading}
                error={error}
              />
            )}
            {step === 4 && <SuccessStep email={data.email} onLogin={() => router.push("/auth/login")} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  )
}

// ── Step 1 — Contact info ─────────────────────────────────────────────────────
function Step1({
  data,
  photo,
  photoPreview,
  onPhotoChange,
  onNext,
  onLogin,
}: {
  data: FormData
  photo: File | null
  photoPreview: string | null
  onPhotoChange: (file: File, preview: string) => void
  onNext: (d: Partial<FormData>) => void
  onLogin: () => void
}) {
  const [firstName, setFirstName] = useState(data.firstName)
  const [lastName, setLastName] = useState(data.lastName)
  const [email, setEmail] = useState(data.email)
  const [password, setPassword] = useState(data.password)
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState(data.phone)
  const [birthday, setBirthday] = useState(data.birthday)
  const [linkedin, setLinkedin] = useState(data.linkedin)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Crop modal state
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCropSrc(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(file)
  }

  async function handleCropConfirm() {
    if (!cropSrc || !croppedAreaPixels) return
    const { dataUrl, file } = await getCroppedImg(cropSrc, croppedAreaPixels)
    onPhotoChange(file, dataUrl)
    setCropSrc(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleCropCancel() {
    setCropSrc(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailChecking, setEmailChecking] = useState(false)

  const canProceed = !!photo && !!firstName && !!lastName && !!email && password.length >= 6 && !!phone && !!birthday

  async function handleNext(e: React.FormEvent) {
    e.preventDefault()
    if (!canProceed) return
    setEmailError(null)
    setEmailChecking(true)
    try {
      const res = await fetch(`/api/check-email?email=${encodeURIComponent(email)}`)
      const json = await res.json()
      if (json.taken) {
        setEmailError("Bu e-posta adresi zaten kullanımda. Giriş yapmayı deneyin.")
        setEmailChecking(false)
        return
      }
    } catch {
      // network error — let it through, server will catch it
    }
    setEmailChecking(false)
    onNext({ firstName, lastName, email, password, phone, birthday, linkedin })
  }

  return (
    <>
      {/* ── Photo crop modal ── */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <span className="text-sm font-medium text-white">Fotoğrafı düzenle</span>
            <button
              type="button"
              onClick={handleCropCancel}
              className="text-sm text-white/60 underline"
            >
              İptal
            </button>
          </div>

          {/* Cropper area */}
          <div className="relative flex-1">
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-4 bg-black/90 px-6 pb-10 pt-4">
            <div className="flex items-center gap-3">
              <ZoomIn className="size-4 text-white/40" style={{ transform: "scale(0.75)" }} />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                className="flex-1 accent-white"
              />
              <ZoomIn className="size-4 text-white/70" />
            </div>
            <button
              type="button"
              onClick={handleCropConfirm}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-opacity active:opacity-80"
            >
              Onayla
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1 form ── */}
      <div>
        <h1 className="mb-1 font-heading text-2xl font-bold text-foreground">İletişim bilgileri</h1>
        <p className="mb-6 text-sm text-muted-foreground">Adım 1 / 3</p>
        <form onSubmit={handleNext} className="flex flex-col gap-4">

          {/* Photo picker */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex size-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-card transition-colors hover:border-primary"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Profil" className="size-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground group-hover:text-primary">
                  <Camera className="size-7" />
                  <span className="text-[10px] font-medium">Fotoğraf ekle</span>
                </div>
              )}
              {photoPreview && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="size-6 text-white" />
                </div>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            {!photo && (
              <p className="text-xs text-destructive">Profil fotoğrafı zorunludur <span aria-hidden>*</span></p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ad" icon={User}>
              <input
                type="text" required value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Jean" className={fieldClass}
              />
            </Field>
            <Field label="Soyad" icon={User}>
              <input
                type="text" required value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Dupont" className={fieldClass}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-1">
            <Field label="E-posta" icon={Mail}>
              <input
                type="email" required value={email}
                onChange={e => { setEmail(e.target.value); setEmailError(null) }}
                placeholder="uye@youthstation.org"
                className={fieldClass}
              />
            </Field>
            {emailError && (
              <p className="text-xs text-destructive">{emailError}</p>
            )}
          </div>

          {/* Password with eye toggle */}
          <Field label="Şifre" icon={Lock}>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-10 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </Field>

          <Field label="Telefon" icon={Phone}>
            <input
              type="tel" value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+33 6 12 34 56 78" className={fieldClass}
            />
          </Field>

          <Field label="Doğum tarihi" icon={Cake}>
            <input
              type="date"
              value={birthday}
              onChange={e => setBirthday(e.target.value)}
              className={`${fieldClass} [appearance:none] [-webkit-appearance:none]`}
            />
          </Field>

          <Field label="LinkedIn (isteğe bağlı)" icon={ExternalLink}>
            <input
              type="url" value={linkedin}
              onChange={e => setLinkedin(e.target.value)}
              placeholder="https://linkedin.com/in/…" className={fieldClass}
            />
          </Field>
          <Button type="submit" size="lg" className="mt-2" disabled={!canProceed || emailChecking}>
            {emailChecking ? "Kontrol ediliyor…" : "Devam et"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Zaten üye misin?{" "}
          <button onClick={onLogin} className="font-semibold text-primary">Giriş yap</button>
        </p>
      </div>
    </>
  )
}

// ── Step 2 — Role + Station (Europe map) ─────────────────────────────────────
function Step2({
  data,
  onNext,
  onBack,
}: {
  data: FormData
  onNext: (d: Partial<FormData>) => void
  onBack: () => void
}) {
  const [role, setRole] = useState<Role | "">(data.role)
  const [station, setStation] = useState<StationId>(data.station)
  const [occupiedRoles, setOccupiedRoles] = useState<string[]>([])

  useEffect(() => {
    fetch(`/api/check-roles?station=${encodeURIComponent(station)}`)
      .then((r) => r.json())
      .then((d) => setOccupiedRoles(d.occupied ?? []))
      .catch(() => setOccupiedRoles([]))
  }, [station])

  useEffect(() => {
    if (role && occupiedRoles.includes(role)) {
      setRole("")
    }
  }, [occupiedRoles, role])

  const canProceed = role !== "" && !occupiedRoles.includes(role)

  function renderRoleOption(r: Role) {
    const taken = occupiedRoles.includes(r)
    return (
      <option key={r} value={r} disabled={taken}>
        {r}{taken ? " (dolu)" : ""}
      </option>
    )
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Geri
      </button>
      <h1 className="mb-1 font-heading text-2xl font-bold text-foreground">Görev & İstasyon</h1>
      <p className="mb-5 text-sm text-muted-foreground">Adım 2 / 3</p>

      {/* Role */}
      <div className="mb-5 flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Briefcase className="size-4 text-muted-foreground" />
          Göreviniz <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <select
            value={role}
            onChange={e => setRole(e.target.value as Role)}
            className={selectClass}
          >
            <option value="">Görevinizi seçin…</option>
            <optgroup label="Yönetim Kurulu">
              {YONETIM_KURULU_ROLES.map(renderRoleOption)}
            </optgroup>
            <optgroup label="Yürütme Kurulu">
              {YURUTME_KURULU_ROLES.map(renderRoleOption)}
            </optgroup>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        {!canProceed && role === "" && (
          <p className="text-xs text-muted-foreground">Devam etmek için görevinizi seçmelisiniz.</p>
        )}
        {role !== "" && occupiedRoles.includes(role) && (
          <p className="text-xs text-destructive">Bu görev bu istasyonda zaten dolu. Lütfen başka bir görev seçin.</p>
        )}
      </div>

      {/* Station — Europe map */}
      <div className="mb-5 flex flex-col gap-2">
        <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <MapPin className="size-4 text-muted-foreground" />
          İstasyonun
        </label>
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-2">
          <EuropeMap selected={station} onSelect={setStation} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {STATIONS_SORTED.map(s => {
            const sel = station === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStation(s.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  sel ? "border-primary bg-primary/10 text-foreground" : "border-input bg-card text-muted-foreground"
                }`}
              >
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-[8px] font-bold tracking-wide text-white"
                  style={{ backgroundColor: `hsl(${s.color})` }}
                >
                  {s.short}
                </span>
                <span className="truncate font-medium">{s.city}</span>
                {sel && <Check className="ml-auto size-4 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={!canProceed}
        onClick={() => canProceed && onNext({ role: role as Role, station })}
      >
        Devam et
      </Button>
    </div>
  )
}

// ── Step 3 — iGEM + Memleket ──────────────────────────────────────────────────
function Step3({
  data,
  onBack,
  onSubmit,
  loading,
  error,
}: {
  data: FormData
  onBack: () => void
  onSubmit: (d: Partial<FormData>) => void
  loading: boolean
  error: string | null
}) {
  const [memleket, setMemleket] = useState(data.memleket)
  const [igemEgitimi, setIgemEgitimi] = useState<"evet" | "hayır" | "">(data.igemEgitimi)
  const [igemTarihi, setIgemTarihi] = useState(data.igemTarihi)

  const canSubmit = !!memleket && igemEgitimi !== "" && (igemEgitimi === "hayır" || !!igemTarihi)

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Geri
      </button>
      <h1 className="mb-1 font-heading text-2xl font-bold text-foreground">Eğitim & Memleket</h1>
      <p className="mb-5 text-sm text-muted-foreground">Adım 3 / 3</p>

      {/* iGEM question */}
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">
          iGEM eğitimini gerçekleştirdiniz mi? <span className="text-destructive">*</span>
        </p>
        <div className="flex gap-3">
          {(["evet", "hayır"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { setIgemEgitimi(opt); if (opt === "hayır") setIgemTarihi("") }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${
                igemEgitimi === opt
                  ? opt === "evet"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                    : "border-destructive bg-destructive/10 text-destructive"
                  : "border-border text-muted-foreground"
              }`}
            >
              {opt === "evet" ? <Check className="size-4" /> : <span className="text-base leading-none">✕</span>}
              {opt === "evet" ? "Evet" : "Hayır"}
            </button>
          ))}
        </div>

        {igemEgitimi === "evet" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Ne zaman? <span className="text-destructive">*</span></label>
            <input
              type="date"
              value={igemTarihi}
              onChange={e => setIgemTarihi(e.target.value)}
              className={dateClass}
            />
          </div>
        )}
      </div>

      {/* Turkey map */}
      <p className="mb-2 text-sm font-semibold text-foreground">
        Memleket <span className="text-destructive">*</span>
      </p>
      <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-card p-2">
        <TurkeyMap selected={memleket} onSelect={setMemleket} />
      </div>

      <div className="relative mb-5">
        <select
          value={memleket}
          onChange={e => setMemleket(e.target.value)}
          className={`${selectClass} ${!memleket ? "text-muted-foreground" : ""}`}
        >
          <option value="">İlininizi seçiniz</option>
          {([...SEHIRLER] as string[])
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <Button
        size="lg"
        className="w-full"
        disabled={loading || !canSubmit}
        onClick={() => onSubmit({ memleket, igemEgitimi, igemTarihi })}
      >
        {loading ? <Loader2 className="size-5 animate-spin" /> : "Kayıt talebini gönder"}
      </Button>
    </div>
  )
}

// ── Step 4 — Success ──────────────────────────────────────────────────────────
function SuccessStep({ email, onLogin }: { email: string; onLogin: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex size-20 items-center justify-center rounded-full bg-emerald-500/15">
        <CheckCircle2 className="size-10 text-emerald-500" />
      </div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Talebiniz alındı!</h1>
      <p className="mt-3 text-sm text-muted-foreground text-pretty">
        Kaydınız başarıyla iletildi. Yönetici onayladıktan sonra hesabınız aktif hale gelecektir.
      </p>
      <p className="mt-2 text-sm text-muted-foreground text-pretty">
        Onay e-postası geldiğinde giriş yapabilirsiniz.
      </p>
      <Button size="lg" className="mt-8 w-full" onClick={onLogin}>
        Giriş sayfasına dön
      </Button>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon: typeof Mail
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        {children}
      </div>
    </div>
  )
}
