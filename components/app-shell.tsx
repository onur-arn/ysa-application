"use client"

import { Logo } from "@/components/logo"
import { BottomNav } from "@/components/bottom-nav"
import { ThemeToggle } from "@/components/theme-toggle"
import { Settings } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const onSettings = pathname.startsWith("/ayarlar")

  const [avatar, setAvatar] = useState<{ photoUrl?: string | null; initials: string; color: string } | null>(null)

  useEffect(() => {
    async function loadAvatar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from("profiles").select("name,initials,station,photo_url").eq("id", user.id).single()
      if (!p) return
      // compute station color
      const colors: Record<string, string> = {
        paris: "199 89% 48%", strasbourg: "262 83% 58%", lyon: "142 71% 45%",
        bordeaux: "27 87% 60%", marseille: "349 89% 60%", intl: "262 83% 58%",
        nice: "262 83% 58%", toulouse: "199 89% 48%"
      }
      setAvatar({ photoUrl: p.photo_url, initials: p.initials || "?", color: colors[p.station] || "262 83% 58%" })
    }
    loadAvatar()
  }, [])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur-lg">
        <Link href="/feed" className="flex items-center gap-2" aria-label="YouthStation">
          <Logo size={34} />
          <span className="font-heading text-base font-extrabold tracking-tight text-primary">YouthStation</span>
        </Link>
        <div className="flex items-center gap-1">
          {!onSettings && (
            <Link
              href="/ayarlar"
              className="flex size-9 shrink-0 items-center justify-center rounded-full overflow-hidden border border-border"
              aria-label="Ayarlar"
            >
              {avatar?.photoUrl ? (
                <img src={avatar.photoUrl} alt="Profil" className="size-full object-cover" />
              ) : (
                <span
                  className="flex size-full items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: `hsl(${avatar?.color ?? "262 83% 58%"})` }}
                >
                  {avatar?.initials ?? <Settings className="h-4 w-4 text-muted-foreground" />}
                </span>
              )}
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1 pb-24">{children}</main>
      <BottomNav />
    </div>
  )
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pb-1 pt-4">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground text-balance">{title}</h1>
      {action}
    </div>
  )
}
