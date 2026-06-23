import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")
  if (!email) return NextResponse.json({ taken: false })

  const admin = createAdminClient()

  // Check profiles table — covers all approved accounts
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle()
  if (profile) return NextResponse.json({ taken: true })

  // Check pending_members — covers accounts awaiting approval
  const { data: pending } = await admin
    .from("pending_members")
    .select("id")
    .eq("email", email)
    .maybeSingle()
  return NextResponse.json({ taken: !!pending })
}
