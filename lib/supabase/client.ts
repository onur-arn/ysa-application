import { createBrowserClient } from "@supabase/ssr"

const noopStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
}

let _client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (typeof window === "undefined") {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { storage: noopStorage } },
    )
  }

  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    // Inject JWT into Realtime so postgres_changes respects RLS as authenticated user
    _client.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) _client!.realtime.setAuth(session.access_token)
    })

    // Keep Realtime auth in sync on token refresh
    _client.auth.onAuthStateChange((_event, session) => {
      _client!.realtime.setAuth(session?.access_token ?? null)
    })
  }

  return _client
}
