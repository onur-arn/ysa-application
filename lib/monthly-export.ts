import { createAdminClient } from "@/lib/supabase/admin"
import { ADMIN_EMAILS, isAdminEmail } from "@/lib/admin"
import { sendMail } from "@/lib/mailer"
import { listArchives, type ArchiveEntry } from "@/lib/admin-archive"

export { FEED_RETENTION_DAYS, FEED_RETENTION_MS } from "@/lib/feed-retention"

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
  taskComments: Record<string, unknown>[]
  igem: Record<string, unknown>[]
  igemComments: Record<string, unknown>[]
  events: Record<string, unknown>[]
  stories: Record<string, unknown>[]
  storyReactions: Array<{ story_id: string; user_name: string }>
  pendingMembers: Record<string, unknown>[]
  conversations: Record<string, unknown>[]
  archives: ArchiveEntry[]
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

  const eventsQuery = admin.from("events").select("*").order("date", { ascending: false })
  if (start) eventsQuery.gte("created_at", start)
  if (end) eventsQuery.lte("created_at", end)

  const storiesQuery = admin.from("stories").select("*").order("created_at", { ascending: false })
  if (start) storiesQuery.gte("created_at", start)
  if (end) storiesQuery.lte("created_at", end)

  const convQuery = admin
    .from("conversations")
    .select("id, type, name, created_at, conversation_members(member_name)")
    .order("created_at", { ascending: true })

  const [profRes, postRes, taskRes, taskComRes, igemRes, igemComRes, eventRes, storyRes, storyReactRes, pendRes, convRes, archives] =
    await Promise.all([
      admin.from("profiles").select("*").order("name"),
      postsQuery,
      tasksQuery,
      admin.from("task_comments").select("*").order("created_at", { ascending: true }),
      igemQuery,
      admin.from("igem_comments").select("*").order("created_at", { ascending: true }),
      eventsQuery,
      storiesQuery,
      admin.from("story_reactions").select("story_id,user_name"),
      admin.from("pending_members").select("*").order("created_at", { ascending: false }),
      convQuery,
      listArchives(800),
    ])

  // Load ALL messages in pages (nested select truncates large threads)
  const msgsByConv = new Map<string, Record<string, unknown>[]>()
  const pageSize = 1000
  let from = 0
  for (;;) {
    let msgQuery = admin
      .from("chat_messages")
      .select("conversation_id,sender_name,text,image_url,gif_url,audio_url,message_type,created_at,is_system")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1)
    if (start) msgQuery = msgQuery.gte("created_at", start)
    if (end) msgQuery = msgQuery.lte("created_at", end)
    const { data: page, error } = await msgQuery
    if (error) {
      console.error("[export] chat_messages:", error.message)
      break
    }
    const rows = page ?? []
    for (const m of rows) {
      const cid = m.conversation_id as string
      if (!cid) continue
      const arr = msgsByConv.get(cid) ?? []
      arr.push(m as Record<string, unknown>)
      msgsByConv.set(cid, arr)
    }
    if (rows.length < pageSize) break
    from += pageSize
    if (from > 100_000) break // safety
  }

  let conversations = ((convRes.data ?? []) as Record<string, unknown>[]).map((conv) => ({
    ...conv,
    chat_messages: msgsByConv.get(conv.id as string) ?? [],
  }))

  if (start || end) {
    conversations = conversations
      .map((conv) => {
        const msgs = ((conv.chat_messages as Array<{ created_at: string; is_system: boolean }>) ?? [])
          .filter((m) => !m.is_system)
        return { ...conv, chat_messages: msgs }
      })
      .filter((conv) => (conv.chat_messages as unknown[]).length > 0)
  }

  // Newest activity first (like Yönetici)
  conversations.sort((a, b) => {
    const msgsA = (a.chat_messages as Array<{ created_at: string }>) ?? []
    const msgsB = (b.chat_messages as Array<{ created_at: string }>) ?? []
    const lastA = msgsA.length > 0 ? msgsA[msgsA.length - 1].created_at : (a.created_at as string) || ""
    const lastB = msgsB.length > 0 ? msgsB[msgsB.length - 1].created_at : (b.created_at as string) || ""
    return lastB.localeCompare(lastA)
  })

  let filteredArchives = archives
  if (start || end) {
    filteredArchives = archives.filter((a) => {
      const t = new Date(a.deletedAt).getTime()
      if (start && t < new Date(start).getTime()) return false
      if (end && t > new Date(end).getTime()) return false
      return true
    })
  }

  return {
    profiles: profRes.data ?? [],
    posts: postRes.data ?? [],
    tasks: taskRes.data ?? [],
    taskComments: taskComRes.data ?? [],
    igem: igemRes.data ?? [],
    igemComments: igemComRes.data ?? [],
    events: eventRes.data ?? [],
    stories: storyRes.data ?? [],
    storyReactions: (storyReactRes.data ?? []) as Array<{ story_id: string; user_name: string }>,
    pendingMembers: pendRes.data ?? [],
    conversations,
    archives: filteredArchives,
  }
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function buildExportHtml(data: ExportData, opts: { title: string; subtitle: string; periodLabel?: string }) {
  const {
    profiles, posts, tasks, taskComments, igem, igemComments,
    events, stories, storyReactions, pendingMembers, conversations, archives,
  } = data
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
    const likes = asArray(p.post_likes as Array<{ voter_name: string }> | { voter_name: string } | null)
    const comments = asArray(p.post_comments as Array<{ author: string; text: string; created_at: string }> | { author: string; text: string; created_at: string } | null)
    const polls = asArray(p.polls as Array<{ question: string; poll_options: Array<{ text: string; poll_votes: Array<{ voter_name: string }> }> }> | { question: string; poll_options: Array<{ text: string; poll_votes: Array<{ voter_name: string }> }> } | null)
    const likeList = likes.map((l) => escapeHtml(l.voter_name)).join(", ") || "—"
    const commentRows = comments.map((c) => [
      escapeHtml(c.author),
      new Date(c.created_at).toLocaleString("fr-FR"),
      escapeHtml(c.text),
    ])
    const pollHtml = polls.map((poll) => {
      const optRows = asArray(poll.poll_options).map((o) => [
        escapeHtml(o.text),
        String(asArray(o.poll_votes).length),
        escapeHtml(asArray(o.poll_votes).map((v) => v.voter_name).join(", ")),
      ])
      return `<p style="margin:8px 12px 4px;font-size:12px;font-weight:700">Sondage : ${escapeHtml(poll.question)}</p>${table(["Option", "Votes", "Votants"], optRows)}`
    }).join("")
    return `
      <div style="margin-bottom:16px;border:1px solid #e0f2fe;border-radius:8px;overflow:hidden">
        <div style="background:#f0f9ff;padding:10px 12px">
          <p style="margin:0;font-weight:700;font-size:13px;color:#0e7490">${escapeHtml(p.author)} · ${escapeHtml(p.station)} · ${escapeHtml(p.created_at ? new Date(p.created_at as string).toLocaleString("fr-FR") : "")}</p>
          <p style="margin:6px 0 0;font-size:12px;color:#374151">${escapeHtml(p.content)}</p>
          ${p.image_url ? `<p style="margin:6px 0 0;font-size:11px;color:#6b7280">📷 Image jointe</p>` : ""}
          <p style="margin:6px 0 0;font-size:11px;color:#6b7280">❤️ ${likes.length} like(s) : ${likeList}</p>
        </div>
        ${pollHtml}
        ${commentRows.length > 0
          ? table(["Commentaire par", "Date", "Texte"], commentRows)
          : "<p style='padding:8px 12px;font-size:12px;color:#9ca3af'>Aucun commentaire</p>"
        }
      </div>`
  }).join("")

  const commentsByTask: Record<string, Record<string, unknown>[]> = {}
  for (const c of taskComments) {
    const tid = String(c.task_id ?? "")
    if (!commentsByTask[tid]) commentsByTask[tid] = []
    commentsByTask[tid].push(c)
  }

  const tasksRows = tasks.map((t) => {
    const tc = commentsByTask[String(t.id)] ?? []
    const commentSummary = tc.map((c) => `${c.author}: ${String(c.text ?? "").slice(0, 80)}`).join(" | ")
    return [
      escapeHtml(t.title),
      escapeHtml(t.description),
      escapeHtml(t.station),
      escapeHtml(t.assignee),
      escapeHtml(t.assigned_by),
      escapeHtml(t.status),
      escapeHtml(t.priority),
      escapeHtml(t.due_date),
      escapeHtml(t.created_at ? new Date(t.created_at as string).toLocaleString("fr-FR") : ""),
      escapeHtml(commentSummary),
    ]
  })

  const igemCommentByReq: Record<string, Record<string, unknown>[]> = {}
  for (const c of igemComments) {
    const iid = String(c.igem_id ?? "")
    if (!igemCommentByReq[iid]) igemCommentByReq[iid] = []
    igemCommentByReq[iid].push(c)
  }

  const igemRows = igem.map((r) => {
    const cs = (igemCommentByReq[String(r.id)] ?? []).map((c) => `${c.author}: ${String(c.text ?? "").slice(0, 80)}`).join(" | ")
    return [
      escapeHtml(r.author),
      escapeHtml(r.station),
      escapeHtml(String(r.motivation ?? "")),
      escapeHtml(r.created_at ? new Date(r.created_at as string).toLocaleString("fr-FR") : ""),
      escapeHtml(cs),
    ]
  })

  const today = new Date().toISOString().slice(0, 10)
  const eventsRows = events.map((e) => {
    const date = String(e.date ?? "")
    const past = date && date < today
    return [
      escapeHtml(e.title),
      escapeHtml(date),
      escapeHtml(e.time),
      escapeHtml(e.end_date),
      escapeHtml(e.place),
      escapeHtml(e.station),
      escapeHtml(e.description),
      past ? "Passé" : "À venir / en cours",
      escapeHtml(e.created_at ? new Date(e.created_at as string).toLocaleString("fr-FR") : ""),
    ]
  })

  const reactionsByStory = new Map<string, string[]>()
  for (const r of storyReactions) {
    const sid = r.story_id
    const arr = reactionsByStory.get(sid) ?? []
    if (!arr.includes(r.user_name)) arr.push(r.user_name)
    reactionsByStory.set(sid, arr)
  }

  const storiesRows = stories.map((s) => {
    const id = String(s.id ?? "")
    const likers = reactionsByStory.get(id) ?? []
    const img = s.image_url
      ? `<a href="${escapeHtml(s.image_url)}" target="_blank" rel="noopener"><img src="${escapeHtml(s.image_url)}" alt="story" style="max-width:120px;max-height:180px;border-radius:8px;object-fit:cover;display:block" /></a>`
      : "—"
    return [
      escapeHtml(s.author_name),
      escapeHtml(s.station),
      escapeHtml(s.music_label) || "—",
      escapeHtml(s.created_at ? new Date(s.created_at as string).toLocaleString("fr-FR") : ""),
      img,
      likers.length > 0 ? `${likers.length} ♥ — ${escapeHtml(likers.join(", "))}` : "0",
    ]
  })

  const storiesHtml = stories.length > 0
    ? table(["Auteur", "Station", "Musique", "Date", "Image", "Réactions"], storiesRows)
    : "<p style='color:#6b7280;font-size:13px'>Aucune story.</p>"

  type ConvRow = {
    id: string
    type: string
    name: string | null
    created_at: string
    conversation_members: Array<{ member_name: string }>
    chat_messages: Array<{
      sender_name: string
      text: string | null
      image_url?: string | null
      gif_url?: string | null
      audio_url?: string | null
      created_at: string
      is_system: boolean
    }>
  }

  const convsHtml = (conversations as unknown as ConvRow[]).map((conv) => {
    const members = asArray(conv.conversation_members).map((m) => escapeHtml(m.member_name)).join(", ")
    const msgs = asArray(conv.chat_messages)
      .filter((m) => !m.is_system)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    const msgRows = msgs.map((m) => {
      let body = m.text ? escapeHtml(String(m.text)) : ""
      if (m.image_url) body += (body ? " " : "") + "[image]"
      if (m.gif_url) body += (body ? " " : "") + "[gif]"
      if (m.audio_url) body += (body ? " " : "") + "[audio]"
      return [
        escapeHtml(m.sender_name),
        new Date(m.created_at).toLocaleString("fr-FR"),
        body || "—",
      ]
    })
    const title = conv.type === "group"
      ? escapeHtml(conv.name || "Groupe")
      : `DM — ${members}`
    return `
      <div style="margin-bottom:16px;border:1px solid #e0f2fe;border-radius:8px;overflow:hidden">
        <div style="background:#f0f9ff;padding:10px 12px">
          <p style="margin:0;font-weight:700;font-size:13px;color:#0e7490">${title}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#6b7280">Membres : ${members || "—"} · ${msgs.length} message(s)</p>
        </div>
        ${msgRows.length > 0 ? table(["Expéditeur", "Date", "Message"], msgRows) : "<p style='padding:8px 12px;font-size:12px;color:#9ca3af'>Aucun message</p>"}
      </div>`
  }).join("")

  const archiveRows = archives.map((a) => {
    const row = a.row ?? {}
    const label =
      (row.title as string) ||
      (row.content as string) ||
      (row.motivation as string) ||
      (row.name as string) ||
      (row.author_name as string) ||
      (row.author as string) ||
      a.id
    return [
      escapeHtml(a.table),
      escapeHtml(String(label).slice(0, 120)),
      escapeHtml(a.deletedBy),
      escapeHtml(a.deletedAt ? new Date(a.deletedAt).toLocaleString("fr-FR") : ""),
    ]
  })

  const totalMsgCount = conversations.reduce((n, c) => {
    const msgs = asArray((c as { chat_messages?: unknown }).chat_messages) as Array<{ is_system?: boolean }>
    return n + msgs.filter((m) => !m.is_system).length
  }, 0)

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827">
<div style="max-width:900px;margin:0 auto;padding:24px">
  <div style="margin-bottom:28px">
    <h1 style="margin:0;font-size:22px;color:#0e7490">${escapeHtml(opts.title)}</h1>
    <p style="margin:8px 0 0;font-size:13px;color:#6b7280">${escapeHtml(opts.subtitle)}</p>
    ${opts.periodLabel ? `<p style="margin:4px 0 0;font-size:13px;color:#6b7280">Période : <strong>${escapeHtml(opts.periodLabel)}</strong></p>` : ""}
    <p style="margin:4px 0 0;font-size:12px;color:#9ca3af">Généré le ${escapeHtml(now)} — contenu actif + archives des suppressions</p>
  </div>

  ${section("👥 Membres actifs (" + profiles.length + ")",
    profiles.length > 0
      ? table(["Nom", "Email", "Station", "Rôle", "Téléphone", "Naissance", "Memleket", "LinkedIn", "iGEM"], membersRows)
      : "<p style='color:#6b7280;font-size:13px'>Aucun membre enregistré.</p>"
  )}

  ${pendingMembers.length > 0 ? section("⏳ Membres en attente (" + pendingMembers.length + ")",
    table(["Nom", "Email", "Station", "Rôle", "Téléphone", "Date demande"], pendingRows)
  ) : ""}

  ${section("📅 Événements — passés et à venir (" + events.length + ")",
    events.length > 0
      ? table(["Titre", "Date", "Heure", "Fin", "Lieu", "Station", "Description", "Statut", "Créé le"], eventsRows)
      : "<p style='color:#6b7280;font-size:13px'>Aucun événement.</p>"
  )}

  ${section("📝 Fil d'actualité — publications & interactions (" + posts.length + ")",
    posts.length > 0 ? postsHtml : "<p style='color:#6b7280;font-size:13px'>Aucune publication.</p>"
  )}

  ${section("📲 Hikayeler (" + stories.length + ")", storiesHtml)}

  ${section("✅ Tâches (" + tasks.length + ")",
    tasks.length > 0
      ? table(["Titre", "Description", "Station", "Assigné à", "Par", "Statut", "Priorité", "Échéance", "Créé le", "Commentaires"], tasksRows)
      : "<p style='color:#6b7280;font-size:13px'>Aucune tâche.</p>"
  )}

  ${section("🚀 Demandes iGEM (" + igem.length + ")",
    igem.length > 0
      ? table(["Auteur", "Station", "Motivation", "Date", "Commentaires"], igemRows)
      : "<p style='color:#6b7280;font-size:13px'>Aucune demande iGEM.</p>"
  )}

  ${conversations.length > 0 ? section("💬 Sohbetler & messages (" + conversations.length + " conversations · " + totalMsgCount + " msgs)",
    convsHtml
  ) : section("💬 Sohbetler & messages", "<p style='color:#6b7280;font-size:13px'>Aucune conversation.</p>")}

  ${section("🗑️ Éléments supprimés — archive (" + archives.length + ")",
    archives.length > 0
      ? table(["Type", "Résumé", "Supprimé par", "Date suppression"], archiveRows)
      : "<p style='color:#6b7280;font-size:13px'>Aucune suppression archivée pour le moment.</p>"
  )}

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
    subtitle: "Export automatique de fin de mois (actif + archives)",
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

export async function buildManualExportHtml(requestedBy: string): Promise<string> {
  const data = await fetchExportData()
  return buildExportHtml(data, {
    title: "Export complet — YouthStation (Yönetici)",
    subtitle: `Demandé par : ${requestedBy} — tous les onglets yönetici : membres, événements, posts, hikayeler, tâches, iGEM, sohbetler (tous les messages), archives`,
  })
}

export async function sendManualExport(requestedBy: string) {
  const now = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
  const stamp = new Date().toISOString().slice(0, 10)
  const html = await buildManualExportHtml(requestedBy)
  const intro = `<p style="font-family:sans-serif;color:#374151">Bonjour,<br><br>Export <strong>complet</strong> du panneau Yönetici YouthStation (membres, événements, posts, hikayeler, tâches, iGEM, <strong>tous les messages de tous les sohbetler</strong>, archives).<br><br>Le rapport HTML complet est en pièce jointe — ouvrez-le puis <em>Fichier → Imprimer → Enregistrer en PDF</em>.</p>`

  const recipients = new Set<string>(ADMIN_EMAILS.map((e) => e.toLowerCase()))
  const maybeEmail = requestedBy.trim().toLowerCase()
  if (maybeEmail.includes("@") && isAdminEmail(maybeEmail)) {
    recipients.add(maybeEmail)
  }

  const attachment = {
    filename: `youthstation-export-${stamp}.html`,
    content: html,
    contentType: "text/html; charset=utf-8",
  }

  const errors: string[] = []
  let sent = 0
  for (const to of recipients) {
    try {
      await sendMail({
        to,
        subject: `[YouthStation] Export complet Yönetici — ${now}`,
        html: intro,
        attachments: [attachment],
      })
      sent += 1
    } catch (err) {
      errors.push(`${to}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (sent === 0) {
    throw new Error(errors.join(" | ") || "Aucun email envoyé")
  }
  if (errors.length > 0) {
    console.warn("[export] partial send failures:", errors.join(" | "))
  }
}
