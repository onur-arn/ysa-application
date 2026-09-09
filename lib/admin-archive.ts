import { createAdminClient } from "@/lib/supabase/admin"

export type ArchiveTable =
  | "posts"
  | "tasks"
  | "events"
  | "igem_requests"
  | "stories"
  | "profiles"
  | "conversations"

const BUCKET = "admin-archive"

async function ensureBucket() {
  const admin = createAdminClient()
  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 20_000_000 })
  }
}

/** Snapshot a row into private storage, then hard-delete it from the live table. */
export async function archiveThenDelete(
  table: ArchiveTable,
  id: string,
  deletedBy?: string | null,
  extraSelect?: string,
) {
  const admin = createAdminClient()
  await ensureBucket()

  const { data: row } = await admin
    .from(table)
    .select(extraSelect ?? "*")
    .eq("id", id)
    .maybeSingle()

  if (row) {
    const payload = {
      table,
      id,
      deletedBy: deletedBy ?? null,
      deletedAt: new Date().toISOString(),
      row,
    }
    const path = `${table}/${id}-${Date.now()}.json`
    const body = JSON.stringify(payload)
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, body, { contentType: "application/json", upsert: true })
    if (upErr) console.error("[archiveThenDelete] upload:", upErr.message)
  }

  const { error } = await admin.from(table).delete().eq("id", id)
  return { error, archived: !!row }
}

export type ArchiveEntry = {
  table: string
  id: string
  deletedBy: string | null
  deletedAt: string
  row: Record<string, unknown>
  path: string
}

/** List archived (deleted) records for admin / export. */
export async function listArchives(limit = 500): Promise<ArchiveEntry[]> {
  const admin = createAdminClient()
  try {
    await ensureBucket()
  } catch (err) {
    console.error("[listArchives] bucket:", err)
    return []
  }

  const tables: ArchiveTable[] = ["posts", "tasks", "events", "igem_requests", "stories", "profiles", "conversations"]
  const entries: ArchiveEntry[] = []

  for (const table of tables) {
    const { data: files, error } = await admin.storage.from(BUCKET).list(table, {
      limit,
      sortBy: { column: "created_at", order: "desc" },
    })
    if (error || !files) continue

    for (const file of files) {
      if (!file.name?.endsWith(".json")) continue
      const path = `${table}/${file.name}`
      const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(path)
      if (dlErr || !blob) continue
      try {
        const text = await blob.text()
        const parsed = JSON.parse(text) as ArchiveEntry
        entries.push({ ...parsed, path, table: parsed.table ?? table })
      } catch {
        /* skip corrupt */
      }
    }
  }

  entries.sort((a, b) => (b.deletedAt || "").localeCompare(a.deletedAt || ""))
  return entries
}
