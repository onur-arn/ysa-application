"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Mail, Loader2, CheckCircle2, Home, Moon, Sun, ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/lib/theme/context"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    // Use the current origin so it works on every deployment
    const redirectTo = `${window.location.origin}/auth/callback?next=/auth/reset-password`
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (error) {
        setError("Bir hata oluştu. Lütfen tekrar deneyin.")
      } else {
        setSent(true)
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      {/* Top-left: home + theme */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <button
          onClick={() => router.push("/")}
          className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <Home className="size-4" />
        </button>
        <button
          onClick={toggle}
          className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>

      {/* Top-right: back */}
      <button
        onClick={() => router.push("/auth/login")}
        className="absolute right-4 top-4 flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Geri dön
      </button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="h-14 w-14" />
          <h1 className="mt-4 font-heading text-2xl font-bold text-foreground">Şifremi unuttum</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            E-posta adresinizi girin, şifre sıfırlama bağlantısı gönderelim.
          </p>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="size-12 text-emerald-500" />
            <p className="text-sm text-muted-foreground">
              Şifre sıfırlama bağlantısı{" "}
              <span className="font-medium text-foreground">{email}</span>{" "}
              adresine gönderildi. E-postanızı kontrol edin.
            </p>
            <Button variant="outline" className="w-full mt-2" onClick={() => router.push("/auth/login")}>
              Giriş sayfasına dön
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e-posta adresiniz"
                className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" disabled={loading || !email.trim()}>
              {loading ? <Loader2 className="size-5 animate-spin" /> : "Bağlantı gönder"}
            </Button>
          </form>
        )}
      </motion.div>
    </main>
  )
}
