"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Logo } from "@/components/logo"

function ErrorContent() {
  const params = useSearchParams()
  const message = params.get("error") ?? "Une erreur est survenue."
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 text-center">
      <Logo className="h-14 w-14" />
      <h1 className="mt-6 font-heading text-xl font-bold text-foreground">Oups…</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <a href="/auth/login" className="mt-6 text-sm font-semibold text-primary">
        Retour à la connexion
      </a>
    </main>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  )
}
