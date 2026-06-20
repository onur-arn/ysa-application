"use client"

import { Logo } from "@/components/logo"
import { BottomNav } from "@/components/bottom-nav"
import { ThemeToggle } from "@/components/theme-toggle"
import { Settings } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const onSettings = pathname.startsWith("/ayarlar")

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur-lg">
        <Link href="/feed" className="flex items-center gap-2" aria-label="YouthStation">
          <Logo size={34} />
          <span className="font-heading text-base font-extrabold tracking-tight text-primary">YouthStation</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {!onSettings && (
            <Link
              href="/ayarlar"
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
              aria-label="Ayarlar"
            >
              <Settings className="h-5 w-5" />
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
