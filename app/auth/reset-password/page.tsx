"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı.")
      return
    }

    const token_hash = new URLSearchParams(window.location.search).get("token_hash")
    if (!token_hash) {
      setError("Bağlantı geçersiz. Lütfen yeni bir sıfırlama talebi oluşturun.")
      return
    }

    setLoading(true)
    setError(null)

    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token_hash, password }),
    })

    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error ?? "Şifre güncellenemedi.")
    } else {
      setDone(true)
      setTimeout(() => router.push("/auth/login"), 2500)
    }
  }

  const fieldClass =
    "h-12 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="h-14 w-14" />
          <h1 className="mt-4 font-heading text-2xl font-bold text-foreground">Yeni şifre belirle</h1>
          <p className="mt-1 text-sm text-muted-foreground">Hesabınız için yeni bir şifre belirleyin.</p>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="size-12 text-emerald-500" />
            <p className="text-sm text-muted-foreground">
              Şifreniz güncellendi. Giriş sayfasına yönlendiriliyorsunuz…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">E-posta</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e-posta adresiniz"
                  className={fieldClass}
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

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" size="lg" disabled={loading || password.length < 6}>
              {loading ? <Loader2 className="size-5 animate-spin" /> : "Şifreyi güncelle"}
            </Button>

            <button
              type="button"
              onClick={() => router.push("/auth/login")}
              className="text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
            >
              Giriş sayfasına dön
            </button>
          </form>
        )}
      </motion.div>
    </main>
  )
}
