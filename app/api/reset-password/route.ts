import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const { token_hash, password } = await request.json()

  if (!token_hash || !password || password.length < 6) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 })
  }

  // Verify the token and get the user
  const supabase = await createClient()
  const { data, error: otpErr } = await supabase.auth.verifyOtp({ token_hash, type: "recovery" })

  if (otpErr || !data.user) {
    return NextResponse.json(
      { error: "Bağlantı geçersiz veya süresi dolmuş. Lütfen yeni bir sıfırlama talebi oluşturun." },
      { status: 400 },
    )
  }

  // Update the password via admin client (bypasses session propagation issues)
  const admin = createAdminClient()
  const { error: updateErr } = await admin.auth.admin.updateUserById(data.user.id, { password })

  if (updateErr) {
    return NextResponse.json({ error: "Şifre güncellenemedi. Lütfen tekrar deneyin." }, { status: 500 })
  }

  return NextResponse.json({ success: true, email: data.user.email })
}
