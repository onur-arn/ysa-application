"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Calendar, Lightbulb } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { useI18n } from "@/lib/i18n/context"
import { StoriesBar } from "./stories-bar"
import { EventsList } from "./events-list"
import { IdeasList } from "./ideas-list"
import { CreateContent } from "./create-content"

type Tab = "events" | "ideas"

export function FeedClient() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>("events")
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <AppShell title="YouthStation">
      <StoriesBar />

      <div className="sticky top-[61px] z-20 flex gap-1 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <TabButton active={tab === "events"} onClick={() => setTab("events")} icon={<Calendar className="h-4 w-4" />}>
          {t("feed.events")}
        </TabButton>
        <TabButton active={tab === "ideas"} onClick={() => setTab("ideas")} icon={<Lightbulb className="h-4 w-4" />}>
          {t("feed.ideas")}
        </TabButton>
      </div>

      <div className="px-4 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {tab === "events" ? <EventsList /> : <IdeasList />}
          </motion.div>
        </AnimatePresence>
      </div>

      <button
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-20 right-1/2 z-30 flex h-14 w-14 translate-x-[calc(min(50vw,224px)-1.5rem)] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90"
        aria-label={t("common.create")}
      >
        <Plus className="h-7 w-7" />
      </button>

      <CreateContent open={createOpen} onClose={() => setCreateOpen(false)} defaultTab={tab} />
    </AppShell>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
        active ? "text-primary-foreground" : "text-muted-foreground"
      }`}
    >
      {active && (
        <motion.span layoutId="feed-tab" className="absolute inset-0 rounded-xl bg-primary" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
      )}
      <span className="relative flex items-center gap-2">
        {icon}
        {children}
      </span>
    </button>
  )
}
