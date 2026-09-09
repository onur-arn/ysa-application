
import { createClient } from "@/lib/supabase/server"
import { TasksClient } from "./tasks-client"
import type { StationId } from "@/lib/data/stations"

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, allProfilesRes, tasksRes, commentsRes] = await Promise.all([
    user
      ? supabase.from("profiles").select("name,initials,station,role").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("id,name,photo_url"),
    supabase
      .from("tasks")
      .select("id,title,description,status,priority,station,assignee,assignee_initials,assigned_by,assigned_by_initials,assigned_by_station,created_at,created_by,due_date")
      .order("created_at", { ascending: false }),
    supabase
      .from("task_comments")
      .select("id,task_id,author,initials,text,created_at")
      .order("created_at", { ascending: true }),
  ])

  return (
    <TasksClient
      initialUserId={user?.id ?? ""}
      initialUserEmail={user?.email ?? ""}
      initialProfile={profileRes.data as { name: string; initials: string; station: string; role: string } | null}
      initialProfiles={(allProfilesRes.data ?? []) as { id: string; name: string; photo_url: string | null }[]}
      initialTasks={(tasksRes.data ?? []) as Record<string, unknown>[]}
      initialComments={(commentsRes.data ?? []) as Record<string, unknown>[]}
    />
  )
}
