/** Marker callee_name for group calls (rings all members). */
export const GROUP_CALL_CALLEE = "__group__"

export function groupAvatarPublicUrl(conversationId: string, cacheBust?: number | string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const url = `${base.replace(/\/$/, "")}/storage/v1/object/public/group-avatars/${conversationId}/avatar.jpg`
  if (cacheBust == null || cacheBust === "") return url
  return `${url}?t=${cacheBust}`
}
