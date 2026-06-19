"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useRef } from "react"
import {
  Mail, Lock, User, Phone, Cake, ExternalLink, Loader2,
  ChevronDown, ChevronLeft, Check, MapPin, Briefcase, CheckCircle2, Camera,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n/context"
import {
  STATIONS,
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
  memleket: "",
}

const fieldClass =
  "h-12 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
const selectClass =
  "h-12 w-full appearance-none rounded-xl border border-input bg-card pl-3 pr-9 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"

const variants = {
  enter: (d: number) => ({ x: d * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d * -40, opacity: 0 }),
}

export default function SignUpPage() {
  const router = useRouter()
  const { t } = useI18n()
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

  async function submit() {
    setLoading(true)
    setError(null)
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supaUrl && supaKey) {
      try {
        const supabase = createClient()
        const { error: err } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo:
              process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
              `${window.location.origin}/auth/callback`,
            data: {
              full_name: `${data.firstName} ${data.lastName}`.trim(),
              station: data.station,
              role: data.role,
              phone: data.phone,
              birthday: data.birthday,
              linkedin: data.linkedin,
              memleket: data.memleket,
            },
          },
        })
        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }
      } catch {
        // Supabase not configured — continue to success in demo mode
      }
    }
    // Send notification email to secretary
    try {
      let photoBase64: string | null = null
      if (photo) {
        photoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(photo)
        })
      }
      await fetch("/api/signup-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, photoBase64 }),
      })
    } catch {
      // Non-blocking — proceed to success even if email fails
    }

    setLoading(false)
    go(1)
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
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
                onSubmit={(d) => { setData(p => ({ ...p, ...d })); submit() }}
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
  const [phone, setPhone] = useState(data.phone)
  const [birthday, setBirthday] = useState(data.birthday)
  const [linkedin, setLinkedin] = useState(data.linkedin)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onPhotoChange(file, reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    if (!photo) return
    onNext({ firstName, lastName, email, password, phone, birthday, linkedin })
  }

  return (
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
        <Field label="E-posta" icon={Mail}>
          <input
            type="email" required value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="uye@youthstation.org" className={fieldClass}
          />
        </Field>
        <Field label="Şifre" icon={Lock}>
          <input
            type="password" required minLength={6} value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" className={fieldClass}
          />
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
            type="date" value={birthday}
            onChange={e => setBirthday(e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="LinkedIn (isteğe bağlı)" icon={ExternalLink}>
          <input
            type="url" value={linkedin}
            onChange={e => setLinkedin(e.target.value)}
            placeholder="https://linkedin.com/in/…" className={fieldClass}
          />
        </Field>
        <Button type="submit" size="lg" className="mt-2" disabled={!photo}>
          Devam et
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Zaten üye misin?{" "}
        <button onClick={onLogin} className="font-semibold text-primary">Giriş yap</button>
      </p>
    </div>
  )
}

// ── Step 2 — Role + Station (Europe map) ─────────────────────────────────────
const STATIONS_SORTED = [
  // Uluslararası toujours en premier
  ...STATIONS.filter(s => s.id === "intl"),
  // les autres triées alphabétiquement par ville
  ...[...STATIONS.filter(s => s.id !== "intl")].sort((a, b) =>
    a.city.localeCompare(b.city, "tr")
  ),
]

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
  const canProceed = role !== ""

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
              {YONETIM_KURULU_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </optgroup>
            <optgroup label="Yürütme Kurulu">
              {YURUTME_KURULU_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </optgroup>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        {!canProceed && role === "" && (
          <p className="text-xs text-muted-foreground">Devam etmek için görevinizi seçmelisiniz.</p>
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
        {/* Fallback grid — alphabetical, intl first */}
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

// ── Step 3 — Memleket (Turkey map) ────────────────────────────────────────────
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

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Geri
      </button>
      <h1 className="mb-1 font-heading text-2xl font-bold text-foreground">Memleket</h1>
      <p className="mb-5 text-sm text-muted-foreground">Adım 3 / 3</p>

      {/* Turkey map */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-card p-2">
        <TurkeyMap selected={memleket} onSelect={setMemleket} />
      </div>

      {/* Dropdown — sorted by numeric prefix */}
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
        disabled={loading || !memleket}
        onClick={() => onSubmit({ memleket })}
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
        Kayıt talebiniz başarıyla gönderildi.{email && (
          <> <span className="font-medium text-foreground">{email}</span> adresine bir doğrulama e-postası gönderilecektir.</>
        )}
      </p>
      <p className="mt-2 text-sm text-muted-foreground text-pretty">
        Hesabınız yöneticiler tarafından onaylandıktan sonra aktif hale gelecektir.
      </p>
      <Button size="lg" className="mt-8 w-full" onClick={onLogin}>
        Giriş sayfasına git
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
