import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { AppShell } from "@/components/app-shell"
import { createClient } from "@/lib/supabase/server"

// Auth is enforced in the middleware (lib/supabase/proxy.ts). We keep a
// lightweight server-side guard here as a fallback for the rare edge-runtime
// env reload where the middleware passes through. The server client reads env
// reliably, so this does not meaningfully slow navigation.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <AppShell>{children}</AppShell>
}
