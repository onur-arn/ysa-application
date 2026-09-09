import { NextRequest, NextResponse } from "next/server"
import { isAdminEmail } from "@/lib/admin"
import { buildManualExportHtml, sendManualExport } from "@/lib/monthly-export"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const requestedBy = (body as { requestedBy?: string }).requestedBy ?? user.email ?? "Admin"
  const mode = (body as { mode?: string }).mode ?? "email"

  try {
    if (mode === "download") {
      const html = await buildManualExportHtml(requestedBy)
      const stamp = new Date().toISOString().slice(0, 10)
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="youthstation-export-${stamp}.html"`,
        },
      })
    }

    await sendManualExport(requestedBy)
    return NextResponse.json({
      ok: true,
      recipients: ["secretaire@youthstation.org", "president@youthstation.org", "feyza.simsek09@gmail.com"],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[export-pdf] failed:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
