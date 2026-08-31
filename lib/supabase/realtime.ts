import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"

/** Ensure JWT is set on Realtime before subscribing (avoids CHANNEL_ERROR / TIMED_OUT on cold start). */
export async function ensureRealtimeAuth(supabase: SupabaseClient) {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    await supabase.realtime.setAuth(session.access_token)
  }
}

export async function subscribeChannel(
  supabase: SupabaseClient,
  channel: RealtimeChannel,
  onStatus?: (status: string, err?: Error) => void,
) {
  await ensureRealtimeAuth(supabase)
  return channel.subscribe((status, err) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.warn("[realtime]", status, err?.message)
    }
    onStatus?.(status, err)
  })
}
