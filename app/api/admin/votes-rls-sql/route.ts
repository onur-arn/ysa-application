import { NextResponse } from "next/server"
import { readFileSync } from "fs"
import { join } from "path"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/admin"

/**
 * One-shot: returns the SQL admins must run in Supabase SQL Editor
 * to make everyone's votes/likes visible (RLS SELECT was own-only).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  try {
    const sql = readFileSync(
      join(process.cwd(), "supabase/fix-votes-likes-visibility-rls.sql"),
      "utf8",
    )
    return NextResponse.json({
      ok: true,
      instruction: "Copiez ce SQL dans Supabase Dashboard → SQL Editor → Run",
      sql,
    })
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
