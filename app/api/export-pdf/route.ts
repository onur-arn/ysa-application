import { NextRequest, NextResponse } from "next/server"
import { isAdminEmail } from "@/lib/admin"
import { sendManualExport } from "@/lib/monthly-export"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const body = await req.json()
  const { requestedBy } = body

  try {
    await sendManualExport(requestedBy ?? user.email ?? "Admin")
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[export-pdf] Email failed:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
