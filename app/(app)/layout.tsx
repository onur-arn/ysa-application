import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { ReactNode } from "react"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <>{children}</>
}
