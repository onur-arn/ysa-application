import { createAdminClient } from "@/lib/supabase/admin"
import { ADMIN_EMAILS } from "@/lib/admin"
import { sendMail } from "@/lib/mailer"

export const FEED_RETENTION_DAYS = 30
export const FEED_RETENTION_MS = FEED_RETENTION_DAYS * 24 * 60 * 60 * 1000

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export type ExportPeriod = {
  label: string
  start: string
  end: string
}

export function getPreviousMonthPeriod(now = new Date()): ExportPeriod {
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  const start = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0)
  const label = end.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" })
  return { label, start: start.toISOString(), end: end.toISOString() }
}

export function isLastDayOfMonth(now = new Date()): boolean {
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.getDate() === 1
}

type ExportData = {
  profiles: Record<string, unknown>[]
  posts: Record<string, unknown>[]
  tasks: Record<string, unknown>[]
  igem: Record<string, unknown>[]
  pendingMembers: Record<string, unknown>[]
  conversations: Record<string, unknown>[]
}

async function fetchExportData(period?: ExportPeriod): Promise<ExportData> {
  const admin = createAdminClient()
  const start = period?.start
  const end = period?.end

  const postsQuery = admin
    .from("posts")
    .select("*, post_comments(*), post_likes(*), polls(*, poll_options(*, poll_votes(*)))")
    .order("created_at", { ascending: false })
  if (start) postsQuery.gte("created_at", start)
  if (end) postsQuery.lte("created_at", end)

  const tasksQuery = admin.from("tasks").select("*").order("created_at", { ascending: false })
  if (start) tasksQuery.gte("created_at", start)
  if (end) tasksQuery.lte("created_at", end)

  const igemQuery = admin.from("igem_requests").select("*").order("created_at", { ascending: false })
  if (start) igemQuery.gte("created_at", start)
  if (end) igemQuery.lte("created_at", end)

  const convQuery = admin
    .from("conversations")
    .select("id, type, name, created_at, conversation_members(member_name), chat_messages(sender_name, text, created_at, is_system)")
    .order("created_at", { ascending: true })

  const [profRes, postRes, taskRes, igemRes, pendRes, convRes] = await Promise.all([
    admin.from("profiles").select("*").order("name"),
    postsQuery,
    tasksQuery,
    igemQuery,
    admin.from("pending_members").select("*").order("created_at", { ascending: false }),
    convQuery,
  ])

  let conversations = (convRes.data ?? []) as Record<string, unknown>[]
  if (start || end) {
    conversations = conversations
      .map((conv) => {
        const msgs = ((conv.chat_messages as Array<{ created_at: string; is_system: boolean }>) ?? [])
          .filter((m) => !m.is_system)
          .filter((m) => {
            const t = new Date(m.created_at).getTime()
            if (start && t < new Date(start).getTime()) return false
            if (end && t > new Date(end).getTime()) return false
            return true
          })
        return { ...conv, chat_messages: msgs }
      })
      .filter((conv) => (conv.chat_messages as unknown[]).length > 0)
  }

  return {
    profiles: profRes.data ?? [],
    posts: postRes.data ?? [],
    tasks: taskRes.data ?? [],
    igem: igemRes.data ?? [],
    pendingMembers: pendRes.data ?? [],
    conversations,
  }
}

function buildExportHtml(data: ExportData, opts: { title: string; subtitle: string; periodLabel?: string }) {
  const { profiles, posts, tasks, igem, pendingMembers, conversations } = data
  const now = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })

  const section = (title: string, content: string) => `
    <div style="margin-bottom:32px">
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#0e7490;border-bottom:2px solid #0e7490;padding-bottom:6px">${title}</h2>
      ${content}
    </div>`

  const table = (headers: string[], rows: string[][]) => `
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr>${headers.map((h) => `<th style="text-align:left;padding:6px 8px;background:#f0f9ff;color:#0e7490;border:1px solid #e0f2fe">${h}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `<tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">${r.map((c) => `<td style="padding:6px 8px;border:1px solid #f0f4f8;vertical-align:top">${c || "—"}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>`

  const membersRows = profiles.map((p) => [
    escapeHtml(p.name),
    escapeHtml(p.email),
    escapeHtml(p.station),
    escapeHtml(p.role),
    escapeHtml(p.phone),
    escapeHtml(p.birthday),
    escapeHtml(p.memleket),
    escapeHtml(p.linkedin),
    escapeHtml(p.igem_egitimi),
  ])

  const pendingRows = pendingMembers.map((p) => [
    escapeHtml(`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()),
    escapeHtml(p.email),
    escapeHtml(p.station),
    escapeHtml(p.role),
    escapeHtml(p.phone),
    escapeHtml(p.created_at ? new Date(p.created_at as string).toLocaleDateString("fr-FR") : ""),
  ])

  const postsHtml = posts.map((p) => {
    const likes = (p.post_likes as Array<{ voter_name: string }>) ?? []
    const comments = (p.post_comments as Array<{ author: string; text: string; created_at: string }>) ?? []
    const likeList = likes.map((l) => escapeHtml(l.voter_name)).join(", ") || "—"
    const commentRows = comments.map((c) => [
      escapeHtml(c.author),
      new Date(c.created_at).toLocaleString("fr-FR"),
      escapeHtml(c.text),
    ])
    return `
      <div style="margin-bottom:16px;border:1px solid #e0f2fe;border-radius:8px;overflow:hidden">
        <div style="background:#f0f9ff;padding:10px 12px">
          <p style="margin:0;font-weight:700;font-size:13px;color:#0e7490">${escapeHtml(p.author)} · ${escapeHtml(p.station)} · ${escapeHtml(p.created_at ? new Date(p.created_at as string).toLocaleString("fr-FR") : "")}</p>
          <p style="margin:6px 0 0;font-size:12px;color:#374151">${escapeHtml(p.content)}</p>
          <p style="margin:6px 0 0;font-size:11px;color:#6b7280">❤️ ${likes.length} like(s) : ${likeList}</p>
        </div>
        ${commentRows.length > 0
          ? table(["Commentaire par", "Date", "Texte"], commentRows)
          : "<p style='padding:8px 12px;font-size:12px;color:#9ca3af'>Aucun commentaire</p>"
        }
      </div>`
  }).join("")

  const tasksRows = tasks.map((t) => [
    escapeHtml(t.title),
    escapeHtml(t.station),
    escapeHtml(t.assignee),
    escapeHtml(t.status),
    escapeHtml(t.priority),
    escapeHtml(t.due_date),
  ])

  const igemRows = igem.map((r) => [
    escapeHtml(r.author),
    escapeHtml(r.station),
    escapeHtml(String(r.motivation ?? "").slice(0, 200)),
    escapeHtml(r.created_at ? new Date(r.created_at as string).toLocaleDateString("fr-FR") : ""),
  ])

  type ConvRow = {
    id: string
    type: string
    name: string | null
    created_at: string
    conversation_members: Array<{ member_name: string }>
    chat_messages: Array<{ sender_name: string; text: string | null; created_at: string; is_system: boolean }>
  }

  const convsHtml = (conversations as unknown as ConvRow[]).map((conv) => {
    const members = (conv.conversation_members ?? []).map((m) => escapeHtml(m.member_name)).join(", ")
    const msgs = (conv.chat_messages ?? [])
      .filter((m) => !m.is_system)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    const convTitle = conv.type === "dm"
      ? `🔒 DM — ${members || escapeHtml(conv.name) || "?"}`
      : `👥 ${escapeHtml(conv.name) || "Grup"}`
    const msgRows = msgs.map((m) => [
      escapeHtml(m.sender_name),
      new Date(m.created_at).toLocaleString("fr-FR"),
      escapeHtml(String(m.text ?? "").slice(0, 500)),
    ])
    return `
      <div style="margin-bottom:18px;border:1px solid #e0f2fe;border-radius:8px;overflow:hidden">
        <div style="background:#f0f9ff;padding:8px 12px">
          <span style="font-weight:700;font-size:13px;color:#0e7490">${convTitle}</span>
          <span style="font-size:11px;color:#6b7280;margin-left:8px">Üyeler: ${members} · ${msgs.length} mesaj</span>
        </div>
        ${msgRows.length > 0
          ? table(["Gönderen", "Tarih", "Mesaj"], msgRows)
          : "<p style='padding:8px 12px;font-size:12px;color:#9ca3af'>Mesaj yok</p>"
        }
      </div>`
  }).join("")

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(opts.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 0; background: #fff; }
    .page { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
    @media print { body { font-size: 11px; } }
  </style>
</head>
<body>
<div class="page">
  <div style="background:#0e7490;color:#fff;padding:20px 24px;border-radius:8px;margin-bottom:28px">
    <h1 style="margin:0;font-size:22px">${escapeHtml(opts.title)}</h1>
    <p style="margin:4px 0 0;opacity:0.8;font-size:13px">${escapeHtml(opts.subtitle)}</p>
    ${opts.periodLabel ? `<p style="margin:4px 0 0;opacity:0.8;font-size:13px">Période : ${escapeHtml(opts.periodLabel)}</p>` : ""}
    <p style="margin:4px 0 0;opacity:0.7;font-size:11px">Généré le ${now} · Document confidentiel</p>
  </div>

  ${section("👥 Membres actifs (" + profiles.length + ")",
    profiles.length > 0
      ? table(["Nom", "Email", "Station", "Rôle", "Téléphone", "Naissance", "Memleket", "LinkedIn", "iGEM"], membersRows)
      : "<p style='color:#6b7280;font-size:13px'>Aucun membre enregistré.</p>"
  )}

  ${pendingMembers.length > 0 ? section("⏳ Membres en attente (" + pendingMembers.length + ")",
    table(["Nom", "Email", "Station", "Rôle", "Téléphone", "Date demande"], pendingRows)
  ) : ""}

  ${section("📝 Fil d'actualité — publications & interactions (" + posts.length + ")",
    posts.length > 0 ? postsHtml : "<p style='color:#6b7280;font-size:13px'>Aucune publication sur la période.</p>"
  )}

  ${section("✅ Tâches (" + tasks.length + ")",
    tasks.length > 0
      ? table(["Titre", "Station", "Assigné à", "Statut", "Priorité", "Échéance"], tasksRows)
      : "<p style='color:#6b7280;font-size:13px'>Aucune tâche.</p>"
  )}

  ${igem.length > 0 ? section("🚀 Demandes iGEM (" + igem.length + ")",
    table(["Auteur", "Station", "Motivation", "Date"], igemRows)
  ) : ""}

  ${conversations.length > 0 ? section("💬 Messages (" + conversations.length + " conversations)",
    convsHtml
  ) : ""}

  <p style="margin-top:40px;font-size:11px;color:#9ca3af;border-top:1px solid #f0f4f8;padding-top:12px">
    YouthStation — ${escapeHtml(opts.title)} — ${now}
  </p>
</div>
</body>
</html>`
}

export async function sendMonthlyExport(period?: ExportPeriod) {
  const p = period ?? getPreviousMonthPeriod()
  const data = await fetchExportData(p)
  const html = buildExportHtml(data, {
    title: `Rapport mensuel — ${p.label}`,
    subtitle: "Export automatique de fin de mois (fil d'actualité, messages, interactions)",
    periodLabel: p.label,
  })

  const subject = `[YouthStation] Rapport mensuel — ${p.label}`
  const intro = `<p style="font-family:sans-serif;color:#374151">Bonjour,<br><br>Voici le rapport mensuel de l'application YouthStation pour <strong>${escapeHtml(p.label)}</strong>. Vous pouvez l'imprimer en PDF depuis votre client mail (Fichier → Imprimer → Enregistrer en PDF).</p>`

  await Promise.all(
    ADMIN_EMAILS.map((to) =>
      sendMail({ to, subject, html: intro + html })
    )
  )
}

export async function sendManualExport(requestedBy: string) {
  const data = await fetchExportData()
  const now = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
  const html = buildExportHtml(data, {
    title: "Export complet — YouthStation",
    subtitle: `Demandé par : ${requestedBy}`,
  })

  await Promise.all(
    ADMIN_EMAILS.map((to) =>
      sendMail({
        to,
        subject: `[YouthStation] Export complet — ${now}`,
        html: `<p style="font-family:sans-serif;color:#374151">Bonjour,<br><br>Export complet de l'application YouthStation.</p>${html}`,
      })
    )
  )
}
