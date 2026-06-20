"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion } from "framer-motion"

export default function LandingPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 200)
    return () => clearTimeout(t)
  }, [])

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-between overflow-hidden bg-[#0b3d4a] px-6 pb-12 pt-20">

      {/* Background blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 size-80 rounded-full bg-[#1a7a8a]/30 blur-3xl" />
        <div className="absolute -right-24 top-1/3 size-72 rounded-full bg-[#0e5a6a]/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 size-96 -translate-x-1/2 rounded-full bg-[#4a9db5]/10 blur-3xl" />
      </div>

      {/* Top spacer */}
      <div />

      {/* Center — Logo + text */}
      <div className="relative flex flex-col items-center gap-8">

        {/* Logo */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
          className="relative"
        >
          {/* Glow behind logo */}
          <div className="absolute inset-0 scale-110 rounded-3xl bg-[#4a9db5]/30 blur-xl" />
          <div className="relative overflow-hidden rounded-3xl bg-white p-3 shadow-2xl shadow-black/40">
            <Image
              src="/youthstation-logo.jpg"
              alt="YouthStation"
              width={160}
              height={160}
              className="block object-contain"
              priority
            />
          </div>
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="flex flex-col items-center gap-2 text-center"
        >
          <h1 className="font-heading text-4xl font-bold tracking-tight text-white">
            YouthStation
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-[#a8d8e8]/80">
            Gençleri bir araya getiren, projeleri hayata geçiren topluluk platformu
          </p>
        </motion.div>
      </div>

      {/* Bottom — CTA buttons */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="flex w-full max-w-xs flex-col gap-3"
      >
        <button
          onClick={() => router.push("/auth/login")}
          className="h-14 w-full rounded-2xl bg-white font-semibold text-[#0b3d4a] shadow-lg shadow-black/20 transition-transform active:scale-95"
        >
          Giriş Yap
        </button>
        <button
          onClick={() => router.push("/auth/sign-up")}
          className="h-14 w-full rounded-2xl border border-white/25 bg-white/10 font-semibold text-white backdrop-blur-sm transition-transform active:scale-95"
        >
          Kayıt Ol
        </button>
      </motion.div>
    </main>
  )
}
