import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // In some edge-runtime reload scenarios the env vars are briefly unavailable.
  // Rather than throwing a 500 that takes the whole app down, pass the request
  // through untouched. Page-level checks still guard sensitive data access.
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // /auth/reset-password is only accessible via the email link (must have token_hash)
  if (pathname === "/auth/reset-password" && !request.nextUrl.searchParams.get("token_hash")) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/forgot-password"
    return NextResponse.redirect(url)
  }

  const isAuthRoute    = pathname.startsWith("/auth")
  const isPublicApi    = pathname.startsWith("/api/signup-") || pathname.startsWith("/api/test-email") || pathname === "/api/reset-password"
  const isPublicRoute  = pathname === "/" || pathname === "/manifest.json" || isPublicApi

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  if (user && (isAuthRoute || (isPublicRoute && !isPublicApi))) {
    const url = request.nextUrl.clone()
    url.pathname = "/feed"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
