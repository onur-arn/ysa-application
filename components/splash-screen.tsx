"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

export function SplashScreen() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2000)
    return () => clearTimeout(t)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: "linear-gradient(160deg, #0d2028 0%, #0e2a33 60%, #0b1e27 100%)" }}
        >
          {/* Ambient glow */}
          <div
            className="absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]"
            style={{ backgroundColor: "rgba(91,158,181,0.22)" }}
          />

          {/* Logo */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 22, delay: 0.05 }}
            className="relative mb-5"
          >
            <div
              className="absolute inset-0 scale-[1.2] rounded-[24px] blur-2xl"
              style={{ backgroundColor: "rgba(91,158,181,0.30)" }}
            />
            <div className="relative overflow-hidden rounded-[22px] bg-white p-3 shadow-2xl" style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.45)" }}>
              <Image
                src="/youthstation-logo.jpg"
                alt="YouthStation"
                width={96}
                height={96}
                className="block object-contain"
                priority
              />
            </div>
          </motion.div>

          {/* Name */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center gap-1.5"
          >
            <p className="font-heading text-2xl font-bold tracking-[-0.01em] text-white">
              Youth<span style={{ color: "#5B9EB5" }}>Station</span>
            </p>
            <p className="text-[11px] tracking-widest uppercase" style={{ color: "rgba(91,158,181,0.60)", letterSpacing: "0.18em" }}>
              Gençlik Topluluğu
            </p>
          </motion.div>

          {/* Bottom loading dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.3 }}
            className="absolute bottom-16 flex gap-1.5"
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-1.5 rounded-full"
                style={{ backgroundColor: "rgba(91,158,181,0.5)" }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
