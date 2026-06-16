"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Plus, X } from "lucide-react"
import { STATIONS } from "@/lib/data/stations"
import { STORY_BG } from "@/lib/data/feed"
import { useI18n } from "@/lib/i18n/context"

export function StoriesBar() {
  const { t } = useI18n()
  const [active, setActive] = useState<string | null>(null)
  const activeStation = STATIONS.find((s) => s.id === active)

  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button className="flex shrink-0 flex-col items-center gap-1.5" aria-label={t("feed.yourStory")}>
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-primary/50 bg-primary/5">
            <Plus className="h-6 w-6 text-primary" />
          </span>
          <span className="max-w-16 truncate text-[11px] font-medium text-muted-foreground">{t("feed.yourStory")}</span>
        </button>

        {STATIONS.map((s) => (
          <button key={s.id} onClick={() => setActive(s.id)} className="flex shrink-0 flex-col items-center gap-1.5">
            <span className="rounded-full bg-gradient-to-tr from-primary to-chart-3 p-[2.5px]">
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-card font-heading text-sm font-bold text-white"
                style={{ backgroundColor: `hsl(${STORY_BG[s.id]})` }}
              >
                {s.short}
              </span>
            </span>
            <span className="max-w-16 truncate text-[11px] font-medium text-foreground">{s.city}</span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {activeStation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 mx-auto flex w-full max-w-md items-center justify-center bg-black p-4"
            onClick={() => setActive(null)}
          >
            <div className="absolute inset-x-4 top-4 flex gap-1">
              <span className="h-1 flex-1 rounded-full bg-white/40">
                <motion.span
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 4 }}
                  onAnimationComplete={() => setActive(null)}
                  className="block h-full rounded-full bg-white"
                />
              </span>
            </div>
            <button
              className="absolute right-4 top-8 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
            <div
              className="flex aspect-[9/16] w-full max-w-xs flex-col items-center justify-center rounded-3xl text-center"
              style={{ backgroundColor: `hsl(${STORY_BG[activeStation.id]})` }}
            >
              <span className="font-heading text-5xl font-bold text-white">{activeStation.short}</span>
              <span className="mt-3 px-6 text-lg font-semibold text-white text-pretty">{activeStation.name}</span>
              <span className="mt-1 text-sm text-white/80">{activeStation.city}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
