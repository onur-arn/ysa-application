/** Platform admins — full access to Yönetici Paneli and user management */
export const ADMIN_EMAILS = [
  "secretaire@youthstation.org",
  "president@youthstation.org",
] as const

export type AdminEmail = (typeof ADMIN_EMAILS)[number]

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return ADMIN_EMAILS.some((a) => a === normalized)
}
