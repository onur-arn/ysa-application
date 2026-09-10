import type { SupabaseClient } from "@supabase/supabase-js"

/** Find an Auth user id by email (paginated; avoids the old 50-user trap). */
export async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "")
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  if (base && key) {
    try {
      const res = await fetch(
        `${base}/auth/v1/admin/users?email=${encodeURIComponent(normalized)}`,
        {
          headers: {
            Authorization: `Bearer ${key}`,
            apikey: key,
          },
          cache: "no-store",
        },
      )
      if (res.ok) {
        const body = (await res.json()) as {
          users?: { id: string; email?: string | null }[]
          id?: string
          email?: string | null
        }
        if (Array.isArray(body.users)) {
          const hit = body.users.find((u) => (u.email ?? "").toLowerCase() === normalized)
          if (hit) return hit.id
        }
        if (body.id && (body.email ?? "").toLowerCase() === normalized) return body.id
      }
    } catch (err) {
      console.warn("[auth-admin] email lookup fetch failed:", err)
    }
  }

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) {
      console.warn("[auth-admin] listUsers failed:", error.message)
      break
    }
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === normalized)
    if (hit) return hit.id
    if (data.users.length < 200) break
  }
  return null
}

function isEmailExistsError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  const code = (err.code ?? "").toLowerCase()
  const msg = (err.message ?? "").toLowerCase()
  return (
    code === "email_exists" ||
    msg.includes("already been registered") ||
    msg.includes("already registered") ||
    msg.includes("user already exists") ||
    msg.includes("email address has already been registered")
  )
}

/**
 * Create an Auth user, or recover an orphan Auth account (email exists, no usable profile).
 * Syncs password from the pending signup so login works with the password they chose.
 */
export async function createOrReuseAuthUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<{ userId: string | null; error: string | null; reused: boolean }> {
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (!authErr && authUser.user) {
    return { userId: authUser.user.id, error: null, reused: false }
  }

  if (!isEmailExistsError(authErr)) {
    return {
      userId: null,
      error: authErr?.message ?? "Auth creation failed",
      reused: false,
    }
  }

  const existingId = await findAuthUserIdByEmail(admin, email)
  if (!existingId) {
    return {
      userId: null,
      error: "Cet e-mail existe déjà dans Auth, mais l'utilisateur est introuvable. Vérifiez Supabase Auth.",
      reused: false,
    }
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(existingId, {
    password,
    email_confirm: true,
    ban_duration: "none",
  })
  if (updErr) {
    console.warn("[auth-admin] password sync failed:", updErr.message)
  }

  return { userId: existingId, error: null, reused: true }
}
