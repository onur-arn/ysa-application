import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/admin"
import { AdminClient } from "./admin-client"

export default async function YoneticiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")
  if (!isAdminEmail(user.email)) redirect("/ayarlar")

  return <AdminClient adminEmail={user.email ?? ""} />
}
