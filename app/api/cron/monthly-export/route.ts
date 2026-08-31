import { NextRequest, NextResponse } from "next/server"
import { isLastDayOfMonth, sendMonthlyExport } from "@/lib/monthly-export"

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  if (!isLastDayOfMonth()) {
    return NextResponse.json({ skipped: true, reason: "Not last day of month" })
  }

  try {
    await sendMonthlyExport()
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[cron/monthly-export]", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
