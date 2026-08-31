import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { findOrCreateDM } from "@/lib/dm"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const targetUserId = body.targetUserId as string | undefined
  if (!targetUserId || targetUserId === user.id) {
    return NextResponse.json({ error: "Geçersiz kullanıcı" }, { status: 400 })
  }

  const [{ data: me }, { data: target }] = await Promise.all([
    supabase.from("profiles").select("name, initials").eq("id", user.id).single(),
    supabase.from("profiles").select("name, initials, station").eq("id", targetUserId).single(),
  ])

  if (!me?.name?.trim()) {
    return NextResponse.json({ error: "Profilinizde isim eksik" }, { status: 400 })
  }
  if (!target?.name?.trim()) {
    return NextResponse.json({ error: "Üye bulunamadı" }, { status: 404 })
  }

  const convId = await findOrCreateDM(supabase, me.name, {
    name: target.name,
    initials: target.initials ?? "",
    station: target.station ?? "paris",
  })

  if (!convId) {
    return NextResponse.json({ error: "Sohbet açılamadı" }, { status: 500 })
  }

  return NextResponse.json({ convId })
}
