"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight, Moon, Sun } from "lucide-react"
import { useTheme } from "@/lib/theme/context"

// YouthStation brand teal
const BRAND = "#5B9EB5"
const BRAND_DARK = "#3d7a8f"

export default function LandingPage() {
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const isDark = theme === "dark"

  return (
    <main
      className="relative flex min-h-dvh flex-col items-center justify-between overflow-hidden px-6 pb-14 pt-24"
      style={{
        background: isDark
          ? "linear-gradient(160deg, #0d2028 0%, #0e2a33 50%, #0d2530 100%)"
          : "linear-gradient(160deg, #eef8fb 0%, #f4fbfd 50%, #ffffff 100%)",
      }}
    >
      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 size-[480px] -translate-x-1/2 -translate-y-1/3 rounded-full blur-[90px]"
          style={{ backgroundColor: isDark ? "rgba(91,158,181,0.14)" : "rgba(91,158,181,0.18)" }}
        />
        <div
          className="absolute -left-24 top-1/3 size-64 rounded-full blur-3xl"
          style={{ backgroundColor: isDark ? "rgba(91,158,181,0.08)" : "rgba(91,158,181,0.12)" }}
        />
        <div
          className="absolute -right-16 bottom-1/4 size-56 rounded-full blur-3xl"
          style={{ backgroundColor: isDark ? "rgba(91,158,181,0.06)" : "rgba(91,158,181,0.10)" }}
        />
      </div>

      {/* Theme toggle — top right */}
      <button
        onClick={toggle}
        className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-xl transition-colors"
        style={{
          background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.10)",
        }}
        aria-label="Tema değiştir"
      >
        {isDark
          ? <Sun className="size-4" style={{ color: "rgba(255,255,255,0.65)" }} />
          : <Moon className="size-4" style={{ color: "rgba(0,0,0,0.50)" }} />
        }
      </button>

      {/* Top spacer */}
      <div />

      {/* Center content */}
      <div className="relative flex flex-col items-center gap-10 text-center">

        {/* Logo */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.05 }}
          className="relative"
        >
          <div
            className="absolute inset-0 scale-[1.15] rounded-[24px] blur-2xl"
            style={{ backgroundColor: "rgba(91,158,181,0.25)" }}
          />
          <div
            className="relative overflow-hidden rounded-[22px] p-3 shadow-2xl ring-1"
            style={{
              backgroundColor: "white",
              boxShadow: isDark ? "0 20px 50px rgba(0,0,0,0.5)" : "0 12px 36px rgba(91,158,181,0.22)",
              ringColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(91,158,181,0.20)",
            }}
          >
            <Image
              src="/youthstation-logo.jpg"
              alt="YouthStation"
              width={108}
              height={108}
              className="block object-contain"
              priority
            />
          </div>
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center gap-3"
        >
          <h1
            className="font-heading text-[2.6rem] font-bold leading-tight tracking-[-0.02em]"
            style={{ color: isDark ? "white" : "#0d2028" }}
          >
            Youth<span style={{ color: BRAND }}>Station</span>
          </h1>
          <p
            className="max-w-[240px] text-[13px] leading-relaxed"
            style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(13,32,40,0.50)" }}
          >
            Gençleri bir araya getiren, projeleri hayata geçiren topluluk platformu
          </p>
        </motion.div>
      </div>

      {/* Bottom CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.58, duration: 0.45, ease: "easeOut" }}
        className="flex w-full max-w-[300px] flex-col gap-3"
      >
        <button
          onClick={() => router.push("/auth/login")}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl font-semibold text-white transition-transform active:scale-[0.97]"
          style={{
            background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)`,
            boxShadow: `0 8px 28px rgba(91,158,181,0.38)`,
          }}
        >
          Giriş Yap
          <ArrowRight className="size-[15px]" />
        </button>
        <button
          onClick={() => router.push("/auth/sign-up")}
          className="h-[52px] w-full rounded-2xl font-semibold transition-transform active:scale-[0.97]"
          style={{
            border: isDark ? "1px solid rgba(91,158,181,0.30)" : `1px solid ${BRAND}50`,
            background: isDark ? "rgba(91,158,181,0.08)" : "rgba(91,158,181,0.07)",
            color: isDark ? "rgba(255,255,255,0.65)" : BRAND_DARK,
            backdropFilter: "blur(8px)",
          }}
        >
          Kayıt Ol
        </button>

        <p
          className="mt-2 text-center text-[11px]"
          style={{ color: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.22)" }}
        >
          YouthStation · Gençlik Topluluğu
        </p>
      </motion.div>
    </main>
  )
}
