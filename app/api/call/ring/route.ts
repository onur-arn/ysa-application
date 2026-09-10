import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { GROUP_CALL_CALLEE } from "@/lib/group-avatar"

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

type Sub = { endpoint: string; p256dh: string; auth: string }

async function sendToSubs(subs: Sub[], payload: string) {
  if (!subs.length) return 0
  const admin = createAdminClient()
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      ),
    ),
  )
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "rejected") {
      await admin.from("push_subscriptions").delete().eq("endpoint", subs[i].endpoint)
    }
  }
  return results.filter((r) => r.status === "fulfilled").length
}

/** Notify callee(s) of an incoming call via Web Push (works when app is backgrounded). */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    sessionId?: string
    conversationId?: string
    callerName?: string
    calleeName?: string
    isGroup?: boolean
  }

  const sessionId = body.sessionId
  const conversationId = body.conversationId
  const callerName = (body.callerName ?? "").trim()
  const calleeName = (body.calleeName ?? "").trim()
  if (!sessionId || !conversationId || !callerName || !calleeName) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }

  const admin = createAdminClient()
  const isGroup = !!body.isGroup || calleeName === GROUP_CALL_CALLEE

  let targetUserIds: string[] = []

  if (isGroup) {
    const { data: members } = await admin
      .from("conversation_members")
      .select("member_name, user_id")
      .eq("conversation_id", conversationId)

    const names = (members ?? [])
      .map((m) => (m.member_name as string | null)?.trim())
      .filter((n): n is string => !!n && n !== callerName)

    if (names.length) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, name")
        .in("name", names)
      targetUserIds = (profiles ?? []).map((p) => p.id as string)
    }

    // Also use member user_id when present
    for (const m of members ?? []) {
      if (m.user_id && typeof m.user_id === "string") targetUserIds.push(m.user_id)
    }
  } else {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("name", calleeName)
      .maybeSingle()
    if (profile?.id) targetUserIds.push(profile.id)
  }

  targetUserIds = [...new Set(targetUserIds)].filter((id) => id !== user.id)
  if (targetUserIds.length === 0) {
    return NextResponse.json({ sent: 0, reason: "no_targets" })
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth,user_id")
    .in("user_id", targetUserIds)

  const payload = JSON.stringify({
    title: isGroup ? "Gelen grup araması" : "Gelen arama",
    body: isGroup ? `${callerName} grup araması başlattı` : `${callerName} seni arıyor`,
    url: `/messages?open=${conversationId}&call=${sessionId}`,
    tag: `call-${sessionId}`,
    kind: "call",
    requireInteraction: true,
  })

  const sent = await sendToSubs(
    (subs ?? []).map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })),
    payload,
  )

  return NextResponse.json({ sent, targets: targetUserIds.length })
}
