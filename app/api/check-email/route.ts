import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")
  if (!email) return NextResponse.json({ taken: false })

  const admin = createAdminClient()

  const { data: authList } = await admin.auth.admin.listUsers()
  if (authList?.users?.some((u) => u.email === email)) {
    return NextResponse.json({ taken: true })
  }

  const { data: pending } = await admin.from("pending_members").select("id").eq("email", email).maybeSingle()
  return NextResponse.json({ taken: !!pending })
}
