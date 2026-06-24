"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Lock, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [showCf, setShowCf] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let unsubscribe: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout> | undefined

    async function init() {
      // 1. PKCE flow: ?code=xxx in query string
      const code = new URLSearchParams(window.location.search).get("code")
      if (code) {
        const { error: err } = await supabase.auth.exchangeCodeForSession(code)
        if (!err) { setReady(true); return }
        // code_verifier may be missing (different browser/device) — fall through
      }

      // 2. Implicit flow: tokens in URL hash (#access_token=...&type=recovery)
      const hash = window.location.hash.slice(1)
      if (hash) {
        const p = new URLSearchParams(hash)
        const accessToken = p.get("access_token")
        const refreshToken = p.get("refresh_token")
        if (accessToken && p.get("type") === "recovery") {
          const { error: err } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken ?? "",
          })
          if (!err) { setReady(true); return }
        }
      }

      // 3. Session already set (e.g. via auth state change event)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { setReady(true); return }

      // 4. Wait for PASSWORD_RECOVERY event (fallback)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") setReady(true)
      })
      unsubscribe = () => subscription.unsubscribe()
      timer = setTimeout(() => {
        setError("Bağlantı geçersiz veya süresi dolmuş. Lütfen yeni bir sıfırlama talebi oluşturun.")
      }, 6000)
    }

    init()
    return () => { unsubscribe?.(); clearTimeout(timer) }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.")
      return
    }
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı.")
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateErr) {
      setError("Şifre güncellenemedi. Bağlantı süresi dolmuş olabilir.")
    } else {
      setDone(true)
      setTimeout(() => router.push("/auth/login"), 2500)
    }
  }

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
          <p className="mt-1 text-sm text-muted-foreground">Şifrenizi sıfırlamak için aşağıdaki formu doldurun.</p>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="size-12 text-emerald-500" />
            <p className="text-sm text-muted-foreground">
              Şifreniz güncellendi. Giriş sayfasına yönlendiriliyorsunuz…
            </p>
          </div>
        ) : !ready ? (
          <div className="flex flex-col items-center gap-4 text-center">
            {error ? (
              <>
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" className="w-full" onClick={() => router.push("/auth/forgot-password")}>
                  Yeni sıfırlama talebi oluştur
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Bağlantı doğrulanıyor…</p>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPw ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Yeni şifre"
                className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-10 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showCf ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Şifreyi tekrar girin"
                className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-10 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <button
                type="button"
                onClick={() => setShowCf(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showCf ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {confirm && password !== confirm && (
              <p className="text-xs text-destructive">Şifreler eşleşmiyor.</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              size="lg"
              disabled={loading || !password || password !== confirm || password.length < 6}
            >
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
