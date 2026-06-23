"use client"

import { AnimatePresence, motion } from "framer-motion"
import { usePathname } from "next/navigation"
import { useRef, type ReactNode } from "react"

const NAV_ORDER = ["/annuaire", "/messages", "/feed", "/agenda", "/gorevler"]

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const prevRef = useRef(pathname)

  const prevIdx = NAV_ORDER.findIndex(p => prevRef.current.startsWith(p))
  const currIdx = NAV_ORDER.findIndex(p => pathname.startsWith(p))
  const dir =
    currIdx !== -1 && prevIdx !== -1 && currIdx !== prevIdx
      ? Math.sign(currIdx - prevIdx)
      : 0

  prevRef.current = pathname

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: dir * 28 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: dir * -16, transition: { duration: 0.1 } }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        style={{ willChange: "opacity, transform" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
