import { createBrowserClient } from "@supabase/ssr"

const noopStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
}

export function createClient() {
  if (typeof window === "undefined") {
    // SSR context: use no-op storage to avoid file-based DB errors
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { storage: noopStorage } },
    )
  }
  // Browser context: use default cookie-based storage so it reads the same
  // session as the server middleware (which writes to cookies, not localStorage)
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
