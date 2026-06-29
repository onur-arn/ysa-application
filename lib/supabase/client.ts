import { createBrowserClient } from "@supabase/ssr"

declare global {
  interface Window {
    __YS_CONFIG__: { supabaseUrl: string; supabaseAnonKey: string }
  }
}

const noopStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
}

function getConfig() {
  if (typeof window !== "undefined") {
    return {
      url: window.__YS_CONFIG__?.supabaseUrl ?? "",
      key: window.__YS_CONFIG__?.supabaseAnonKey ?? "",
    }
  }
  return {
    url: process.env.SUPABASE_URL ?? "",
    key: process.env.SUPABASE_ANON_KEY ?? "",
  }
}

let _client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  const { url, key } = getConfig()

  if (typeof window === "undefined") {
    return createBrowserClient(url, key, { auth: { storage: noopStorage } })
  }

  if (!_client) {
    _client = createBrowserClient(url, key)

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
