import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { type EmailOtpType } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/feed"

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  if (token_hash && type) {
    if (type === "recovery") {
      // Pass token_hash to the client page so it can verify the OTP client-side.
      // Server-side verifyOtp sets cookies the browser client can't read (storage mismatch).
      const url = new URL(`${origin}/auth/reset-password`)
      url.searchParams.set("token_hash", token_hash)
      return NextResponse.redirect(url.toString())
    }
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
