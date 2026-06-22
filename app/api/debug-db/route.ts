import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const result: Record<string, unknown> = {
    env: {
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "MISSING",
      anon_key_set: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      service_key_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      supabase_enabled: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  }

  // Test admin client
  try {
    const admin = createAdminClient()

    // Check pending_members
    const { data: pending, error: pendingErr } = await admin
      .from("pending_members")
      .select("id, email, first_name, last_name, station, memleket, phone, role")
      .limit(5)
    result.pending_members = pendingErr ? { error: pendingErr.message } : pending

    // Check profiles
    const { data: profiles, error: profilesErr } = await admin
      .from("profiles")
      .select("id, email, name, station, memleket, phone, role, birthday")
      .limit(10)
    result.profiles = profilesErr ? { error: profilesErr.message } : profiles

    // List pending_members columns
    const { data: cols, error: colsErr } = await admin
      .rpc("get_pending_columns" as never)
      .maybeSingle()
    if (colsErr) {
      // fallback: try inserting nothing to see column errors
      result.pending_columns_check = "rpc not available"
    } else {
      result.pending_columns = cols
    }
  } catch (err) {
    result.admin_error = String(err)
  }

  // Test server client (current user)
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    result.current_user = authErr
      ? { error: authErr.message }
      : user
        ? { id: user.id, email: user.email }
        : null

    if (user) {
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      result.current_profile = profileErr ? { error: profileErr.message } : profile
    }
  } catch (err) {
    result.server_client_error = String(err)
  }

  return NextResponse.json(result, { status: 200 })
}
