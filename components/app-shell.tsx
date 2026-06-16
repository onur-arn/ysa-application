"use client"

import { Logo } from "@/components/logo"
import { BottomNav } from "@/components/bottom-nav"
import { Settings } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

export function AppShell({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur-lg">
        <div className="flex items-center gap-2.5">
          <Logo size={36} />
          <div className="leading-tight">
            <h1 className="font-heading text-lg font-bold tracking-tight text-foreground">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {action}
          <Link
            href="/ayarlar"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            aria-label="Paramètres"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </header>
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}
