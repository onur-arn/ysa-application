"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ThumbsUp, ThumbsDown, TrendingUp, Sparkles, Check, Rocket } from "lucide-react"
import { IDEAS, type IdeaItem, type IdeaStatus } from "@/lib/data/feed"
import { station } from "@/lib/data/stations"
import { useI18n } from "@/lib/i18n/context"
import { createClient } from "@/lib/supabase/client"

const statusConfig: Record<IdeaStatus, { key: string; icon: typeof TrendingUp; className: string }> = {
  trending: { key: "feed.trending", icon: TrendingUp, className: "bg-chart-4/15 text-chart-4" },
  new: { key: "feed.new", icon: Sparkles, className: "bg-primary/15 text-primary" },
  accepted: { key: "feed.accepted", icon: Check, className: "bg-emerald-500/15 text-emerald-600" },
  igem: { key: "feed.igem", icon: Rocket, className: "bg-purple-500/15 text-purple-600" },
}

function IdeaCard({ idea }: { idea: IdeaItem }) {
  const { t } = useI18n()
  const [vote, setVote] = useState<"up" | "down" | null>(null)
  const s = station(idea.station)
  const cfg = statusConfig[idea.status]
  const StatusIcon = cfg.icon

  const up = idea.up + (vote === "up" ? 1 : 0)
  const down = idea.down + (vote === "down" ? 1 : 0)

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.className}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {t(cfg.key)}
        </span>
        <span className="text-xs font-medium" style={{ color: `hsl(${s.color})` }}>
          {s.name}
        </span>
      </div>

      <h3 className="mt-2.5 font-semibold text-foreground text-pretty">{idea.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">{idea.description}</p>
      <p className="mt-2 text-xs text-muted-foreground">{idea.author}</p>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setVote(vote === "up" ? null : "up")}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
            vote === "up" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
          }`}
        >
          <motion.span whileTap={{ scale: 0.8 }}>
            <ThumbsUp className="h-4 w-4" />
          </motion.span>
          {up}
        </button>
        <button
          onClick={() => setVote(vote === "down" ? null : "down")}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
            vote === "down" ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-muted-foreground"
          }`}
        >
          <motion.span whileTap={{ scale: 0.8 }}>
            <ThumbsDown className="h-4 w-4" />
          </motion.span>
          {down}
        </button>
      </div>
    </div>
  )
}

export function IdeasList() {
  const [igemIdeas, setIgemIdeas] = useState<IdeaItem[]>([])

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data } = await supabase.from("igem_requests").select("author,motivation,created_at").order("created_at", { ascending: false })
        if (data) {
          const items: IdeaItem[] = data.map((r, i) => ({
            id: `igem-${i}`,
            title: "iGEM Programı Katılım Talebi",
            description: r.motivation || "Üye iGEM programına katılmak istiyor.",
            author: r.author,
            station: "intl" as const,
            up: 0,
            down: 0,
            status: "igem" as const,
          }))
          setIgemIdeas(items)
        }
      } catch {
        // ignore
      }
    }
    load()
  }, [])

  const allIdeas = [...igemIdeas, ...IDEAS]

  return (
    <div className="flex flex-col gap-3">
      {allIdeas.map((idea) => (
        <IdeaCard key={idea.id} idea={idea} />
      ))}
    </div>
  )
}
