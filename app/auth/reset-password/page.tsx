"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2, Cake, Hash, Moon, Sun } from "lucide-react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/lib/theme/context"

function ResetPasswordForm() {
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const { theme, toggle } = useTheme()

  const [email, setEmail]       = useState(searchParams.get("email") ?? "")
  const [birthday, setBirthday] = useState("")
  const [code, setCode]         = useState(searchParams.get("code") ?? "")
  const emailFromLink           = !!searchParams.get("email")

  const [step1Loading, setStep1Loading] = useState(false)
  const [step1Error, setStep1Error]     = useState<string | null>(null)
  const [verified, setVerified]         = useState(false)

  const [password, setPassword]         = useState("")
  const [showPw, setShowPw]             = useState(false)
  const [step2Loading, setStep2Loading] = useState(false)
  const [step2Error, setStep2Error]     = useState<string | null>(null)
  const [done, setDone]                 = useState(false)

  // If all three params come from URL, auto-submit step 1
  useEffect(() => {
    const urlEmail    = searchParams.get("email")
    const urlCode     = searchParams.get("code")
    if (urlEmail && urlCode) {
      setEmail(urlEmail)
      setCode(urlCode)
    }
  }, [])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setStep1Loading(true)
    setStep1Error(null)

    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), birthday, code: code.trim() }),
    })

    const json = await res.json()
    setStep1Loading(false)

    if (!res.ok) {
      setStep1Error(json.error ?? "Une erreur est survenue.")
    } else {
      setVerified(true)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setStep2Error("Şifre en az 6 karakter olmalı.")
      return
    }
    setStep2Loading(true)
    setStep2Error(null)

    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), birthday, code: code.trim(), password }),
    })

    const json = await res.json()
    setStep2Loading(false)

    if (!res.ok) {
      setStep2Error(json.error ?? "Şifre güncellenemedi.")
    } else {
      setDone(true)
      setTimeout(() => router.push("/auth/login"), 2500)
    }
  }

  const fieldClass =
    "h-12 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      <div className="absolute left-4 top-4">
        <button
          onClick={toggle}
          className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="h-14 w-14" />
          <h1 className="mt-4 font-heading text-2xl font-bold text-foreground">Yeni şifre belirle</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {verified
              ? "Kimliğiniz doğrulandı. Yeni şifrenizi belirleyin."
              : "E-postanıza gönderilen kodu, e-posta adresinizi ve doğum tarihinizi girin."}
          </p>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="size-12 text-emerald-500" />
            <p className="text-sm text-muted-foreground">
              Şifreniz güncellendi. Giriş sayfasına yönlendiriliyorsunuz…
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {!verified ? (
              <motion.form
                key="step1"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleVerify}
                className="flex flex-col gap-4"
              >
                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">E-posta</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => !emailFromLink && setEmail(e.target.value)}
                      readOnly={emailFromLink}
                      placeholder="e-posta adresiniz"
                      className={emailFromLink
                        ? "h-12 w-full rounded-xl border border-input bg-muted pl-10 pr-3 text-base text-muted-foreground cursor-default outline-none"
                        : fieldClass}
                    />
                  </div>
                </div>

                {/* Birthday */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Date de naissance</label>
                  <div className="relative">
                    <Cake className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="date"
                      required
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                </div>

                {/* Code */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">Code de vérification</label>
                  <div className="relative">
                    <Hash className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6 chiffres reçus par e-mail"
                      inputMode="numeric"
                      maxLength={6}
                      className={`${fieldClass} tracking-[0.25em] font-mono`}
                    />
                  </div>
                </div>

                {step1Error && <p className="text-sm text-destructive">{step1Error}</p>}

                <Button
                  type="submit"
                  size="lg"
                  disabled={step1Loading || !email || !birthday || code.length !== 6}
                >
                  {step1Loading ? <Loader2 className="size-5 animate-spin" /> : "Vérifier"}
                </Button>

                <button
                  type="button"
                  onClick={() => router.push("/auth/login")}
                  className="text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
                >
                  Giriş sayfasına dön
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleUpdate}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">E-posta</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      readOnly
                      className="h-12 w-full rounded-xl border border-input bg-muted pl-10 pr-3 text-base text-muted-foreground cursor-default outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Yeni şifre{" "}
                    <span className="font-normal text-muted-foreground">(en az 6 karakter)</span>
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showPw ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-10 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {step2Error && <p className="text-sm text-destructive">{step2Error}</p>}

                <Button
                  type="submit"
                  size="lg"
                  disabled={step2Loading || password.length < 6}
                >
                  {step2Loading ? <Loader2 className="size-5 animate-spin" /> : "Şifreyi güncelle"}
                </Button>

                <button
                  type="button"
                  onClick={() => setVerified(false)}
                  className="text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
                >
                  Geri dön
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        )}
      </motion.div>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
