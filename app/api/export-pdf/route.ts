import { NextRequest, NextResponse } from "next/server"
import { getTransporter } from "@/lib/mailer"
import { createAdminClient } from "@/lib/supabase/admin"

const SUPABASE_ENABLED = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function POST(req: NextRequest) {
  // Accept data from client (localStorage) and optionally merge with Supabase data
  const body = await req.json()
  const { requestedBy } = body

  let profiles: Record<string, unknown>[] = body.profiles ?? []
  let posts: Record<string, unknown>[] = body.posts ?? []
  let tasks: Record<string, unknown>[] = body.tasks ?? []
  let igem: Record<string, unknown>[] = body.igem ?? []
  let pendingMembers: Record<string, unknown>[] = []

  // Merge with Supabase data if available
  if (SUPABASE_ENABLED) {
    try {
      const admin = createAdminClient()
      const [profRes, postRes, taskRes, igemRes, pendRes] = await Promise.all([
        admin.from("profiles").select("*").order("name"),
        admin.from("posts").select("*, post_comments(*), post_likes(*), polls(*, poll_options(*, poll_votes(*)))").order("created_at", { ascending: false }),
        admin.from("tasks").select("*").order("created_at", { ascending: false }),
        admin.from("igem_requests").select("*").order("created_at", { ascending: false }),
        admin.from("pending_members").select("*").order("created_at", { ascending: false }),
      ])
      if (profRes.data?.length) profiles = profRes.data
      if (postRes.data?.length) posts = postRes.data
      if (taskRes.data?.length) tasks = taskRes.data
      if (igemRes.data?.length) igem = igemRes.data
      if (pendRes.data?.length) pendingMembers = pendRes.data
    } catch (err) {
      console.error("[export-pdf] Supabase fetch error:", err)
    }
  }

  const now = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })

  const section = (title: string, content: string) => `
    <div style="margin-bottom:32px">
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#0e7490;border-bottom:2px solid #0e7490;padding-bottom:6px">${title}</h2>
      ${content}
    </div>`

  const table = (headers: string[], rows: string[][]) => `
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr>${headers.map(h => `<th style="text-align:left;padding:6px 8px;background:#f0f9ff;color:#0e7490;border:1px solid #e0f2fe">${h}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `<tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">${r.map(c => `<td style="padding:6px 8px;border:1px solid #f0f4f8;vertical-align:top">${c || "—"}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>`

  // ── Members section
  const membersRows = profiles.map((p) => [
    String(p.name ?? ""),
    String(p.email ?? ""),
    String(p.initial_password ?? ""),
    String(p.station ?? ""),
    String(p.role ?? ""),
    String(p.phone ?? ""),
    String(p.birthday ?? ""),
    String(p.memleket ?? ""),
    String(p.linkedin ?? ""),
    String(p.igem_egitimi ?? ""),
  ])

  const pendingRows = pendingMembers.map((p) => [
    `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
    String(p.email ?? ""),
    String(p.password ?? ""),
    String(p.station ?? ""),
    String(p.role ?? ""),
    String(p.phone ?? ""),
    String(p.created_at ? new Date(p.created_at as string).toLocaleDateString("fr-FR") : ""),
  ])

  // ── Posts section
  const postsRows = posts.map((p) => [
    String(p.author ?? ""),
    String(p.station ?? ""),
    String(p.content ?? "").slice(0, 120),
    String(p.created_at ? new Date(p.created_at as string).toLocaleDateString("fr-FR") : ""),
    String(Array.isArray(p.post_likes) ? (p.post_likes as unknown[]).length : 0),
    String(Array.isArray(p.post_comments) ? (p.post_comments as unknown[]).length : 0),
  ])

  // ── Tasks section
  const tasksRows = tasks.map((t) => [
    String(t.title ?? ""),
    String(t.station ?? ""),
    String(t.assignee ?? ""),
    String(t.status ?? ""),
    String(t.priority ?? ""),
    String(t.due_date ?? ""),
  ])

  // ── iGEM section
  const igemRows = igem.map((r) => [
    String(r.author ?? ""),
    String(r.station ?? ""),
    String(r.motivation ?? ""),
    String(r.created_at ? new Date(r.created_at as string).toLocaleDateString("fr-FR") : ""),
  ])

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Export YSA — ${now}</title>
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
    <h1 style="margin:0;font-size:22px">Export complet — YSA Application</h1>
    <p style="margin:4px 0 0;opacity:0.8;font-size:13px">Généré le ${now} — Demandé par : ${requestedBy ?? "Admin"}</p>
    <p style="margin:4px 0 0;opacity:0.7;font-size:11px">⚠️ Document confidentiel — à ne pas transférer</p>
  </div>

  ${section("👥 Membres actifs (" + profiles.length + ")",
    profiles.length > 0
      ? table(["Nom", "Email", "Mot de passe initial", "Station", "Rôle", "Téléphone", "Naissance", "Memleket", "LinkedIn", "iGEM"], membersRows)
      : "<p style='color:#6b7280;font-size:13px'>Aucun membre enregistré.</p>"
  )}

  ${pendingMembers.length > 0 ? section("⏳ Membres en attente (" + pendingMembers.length + ")",
    table(["Nom", "Email", "Mot de passe", "Station", "Rôle", "Téléphone", "Date demande"], pendingRows)
  ) : ""}

  ${section("📝 Publications (" + posts.length + ")",
    posts.length > 0
      ? table(["Auteur", "Station", "Contenu (extrait)", "Date", "Likes", "Commentaires"], postsRows)
      : "<p style='color:#6b7280;font-size:13px'>Aucune publication.</p>"
  )}

  ${section("✅ Tâches (" + tasks.length + ")",
    tasks.length > 0
      ? table(["Titre", "Station", "Assigné à", "Statut", "Priorité", "Échéance"], tasksRows)
      : "<p style='color:#6b7280;font-size:13px'>Aucune tâche.</p>"
  )}

  ${igem.length > 0 ? section("🚀 Demandes iGEM (" + igem.length + ")",
    table(["Auteur", "Station", "Motivation", "Date"], igemRows)
  ) : ""}

  <p style="margin-top:40px;font-size:11px;color:#9ca3af;border-top:1px solid #f0f4f8;padding-top:12px">
    YSA Application — Export administrateur — ${now}
  </p>
</div>
</body>
</html>`

  try {
    const transporter = getTransporter()
    await transporter.sendMail({
      from: `"YSA Application" <${process.env.GMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL ?? "secretaire@youthstation.org",
      subject: `[YSA] Export complet — ${now}`,
      html: `<p style="font-family:sans-serif;color:#374151">Bonjour,<br><br>Veuillez trouver ci-joint l'export complet de l'application YSA.<br><br>Ce document contient toutes les données membres, publications, tâches et demandes iGEM.</p>`,
      attachments: [
        {
          filename: `ysa-export-${new Date().toISOString().slice(0, 10)}.html`,
          content: html,
          contentType: "text/html",
        },
      ],
    })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[export-pdf] Email failed:", message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
