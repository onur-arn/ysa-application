import type { ReactNode } from "react"
import { AppShell } from "@/components/app-shell"

// Auth is enforced in the middleware (lib/supabase/proxy.ts), which refreshes
// the session and redirects unauthenticated users. We intentionally avoid a
// blocking getUser() network call here so tab navigation stays instant.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>
}
