"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { subscribeChannel } from "@/lib/supabase/realtime"

type PresenceState = Set<string>

const PresenceCtx = createContext<PresenceState>(new Set())

export function PresenceProvider({ userName, children }: { userName: string; children: ReactNode }) {
  const [activeUsers, setActiveUsers] = useState<PresenceState>(new Set())

  useEffect(() => {
    if (!userName) return

    const supabase = createClient()
    const channel = supabase.channel("app:presence")

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, Array<{ name?: string }>>
      const names = new Set(
        Object.values(state)
          .flat()
          .map((p) => p.name)
          .filter((n): n is string => Boolean(n)),
      )
      setActiveUsers(names)
    })

    void subscribeChannel(supabase, channel, async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ name: userName })
      }
    })

    function handleVisibility() {
      if (document.hidden) {
        channel.untrack().catch(() => {})
      } else {
        channel.track({ name: userName }).catch(() => {})
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [userName])

  return <PresenceCtx.Provider value={activeUsers}>{children}</PresenceCtx.Provider>
}

export function usePresence() {
  return useContext(PresenceCtx)
}
