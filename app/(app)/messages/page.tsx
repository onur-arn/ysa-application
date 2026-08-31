
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { fetchUserConversationRows } from "@/lib/queries/conversations"
import { MessagesClient } from "./messages-client"

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, allProfilesRes] = await Promise.all([
    user
      ? supabase.from("profiles").select("name,initials,station").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id,name,photo_url"),
  ])

  const userName = (profileRes.data?.name as string) ?? ""

  let convRows: Record<string, unknown>[] = []
  if (user?.id) {
    convRows = await fetchUserConversationRows(supabase, user.id, userName)
  }

  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">Yükleniyor…</div>}>
      <MessagesClient
        initialUserId={user?.id ?? ""}
        initialProfile={profileRes.data as { name: string; initials: string; station: string } | null}
        initialProfiles={(allProfilesRes.data ?? []) as { id: string; name: string; photo_url: string | null }[]}
        initialConversations={convRows}
      />
    </Suspense>
  )
}
