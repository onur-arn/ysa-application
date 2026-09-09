
import { createClient } from "@/lib/supabase/server"
import { AgendaClient } from "./agenda-client"

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, eventsRes] = await Promise.all([
    user
      ? supabase.from("profiles").select("station").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("events")
      .select("id,title,date,time,place,station,description,link,created_by,end_date")
      .order("date", { ascending: true }),
  ])

  return (
    <AgendaClient
      initialUserId={user?.id ?? ""}
      initialUserStation={(profileRes.data?.station as string) ?? "paris"}
      initialIsIntl={profileRes.data?.station === "intl"}
      initialEvents={(eventsRes.data ?? []) as Record<string, unknown>[]}
    />
  )
}
