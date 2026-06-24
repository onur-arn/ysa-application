"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

export default function LandingPage() {
  const router = useRouter()

  return (
    <main
      className="relative flex min-h-dvh flex-col items-center justify-between overflow-hidden px-6 pb-14 pt-24"
      style={{ background: "linear-gradient(160deg, #0a0f1e 0%, #0d1530 50%, #0f172a 100%)" }}
    >
      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 size-[500px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[#3B62E8]/18 blur-[100px]" />
        <div className="absolute -left-24 top-1/3 size-64 rounded-full bg-[#3B62E8]/10 blur-3xl" />
        <div className="absolute -right-16 bottom-1/4 size-56 rounded-full bg-[#4B73F7]/8 blur-3xl" />
      </div>

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
          <div className="absolute inset-0 scale-[1.15] rounded-[24px] bg-[#4B73F7]/20 blur-2xl" />
          <div className="relative overflow-hidden rounded-[22px] bg-white p-3 shadow-2xl shadow-black/50 ring-1 ring-white/10">
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
          <h1 className="font-heading text-[2.6rem] font-bold leading-tight tracking-[-0.02em] text-white">
            Youth<span style={{ color: "#6B8FF8" }}>Station</span>
          </h1>
          <p className="max-w-[240px] text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
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
            background: "linear-gradient(135deg, #4B73F7 0%, #3B5DE8 100%)",
            boxShadow: "0 8px 28px rgba(75,115,247,0.35)",
          }}
        >
          Giriş Yap
          <ArrowRight className="size-[15px]" />
        </button>
        <button
          onClick={() => router.push("/auth/sign-up")}
          className="h-[52px] w-full rounded-2xl font-semibold transition-transform active:scale-[0.97]"
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.65)",
            backdropFilter: "blur(8px)",
          }}
        >
          Kayıt Ol
        </button>

        {/* Small footer text */}
        <p className="mt-2 text-center text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
          YouthStation · Gençlik Topluluğu
        </p>
      </motion.div>
    </main>
  )
}
