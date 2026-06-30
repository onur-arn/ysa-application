import { NextRequest, NextResponse } from "next/server"
import webpush from "web-push"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  const { userId, title, body, url } = await req.json()
  if (!userId || !title) return NextResponse.json({ error: "Missing params" }, { status: 400 })

  const admin = createAdminClient()
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", userId)

  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const payload = JSON.stringify({ title, body, url })
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      )
    )
  )

  const failed = results.filter((r) => r.status === "rejected")
  if (failed.length > 0) {
    // Clean up expired subscriptions (410 Gone)
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "rejected") {
        await admin.from("push_subscriptions").delete().eq("endpoint", subs[i].endpoint)
      }
    }
  }

  return NextResponse.json({ sent: results.length - failed.length })
}
