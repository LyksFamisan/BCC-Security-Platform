import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto"
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises"
import path from "node:path"
const tables = [
  "sites",
  "users",
  "account_controls",
  "revoked_sessions",
  "user_sites",
  "site_settings",
  "incidents",
  "audit_events",
  "operational_records",
  "operation_audit",
  "user_preferences",
  "notification_reads",
  "technical_settings",
]
function key() {
  const k = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY || "", "base64")
  if (k.length !== 32)
    throw Object.assign(
      Error("Configure BACKUP_ENCRYPTION_KEY before creating backups"),
      { status: 409 },
    )
  return k
}
export function pack(snapshot) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), nonce),
    body = Buffer.from(JSON.stringify(snapshot))
  if (body.length > 100 * 1024 * 1024)
    throw Object.assign(
      Error(
        "Snapshot exceeds 100 MB. Use provider-managed backups for this dataset",
      ),
      { status: 409 },
    )
  return Buffer.concat([
    Buffer.from("BCCBACKUP1"),
    nonce,
    cipher.update(body),
    cipher.final(),
    cipher.getAuthTag(),
  ])
}
export function unpack(bytes) {
  if (bytes.subarray(0, 10).toString() !== "BCCBACKUP1")
    throw Error("Invalid backup format")
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    bytes.subarray(10, 22),
  )
  decipher.setAuthTag(bytes.subarray(-16))
  const result = JSON.parse(
    Buffer.concat([
      decipher.update(bytes.subarray(22, -16)),
      decipher.final(),
    ]).toString(),
  )
  if (result.version !== 3) throw Error("Unsupported backup schema")
  return result
}
export async function snapshot(pool) {
  const c = await pool.connect()
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    const result = {
      version: 3,
      created_at: new Date().toISOString(),
      tables: {},
      photos: {},
    }
    for (const table of tables)
      result.tables[table] = (await c.query(`SELECT * FROM ${table}`)).rows
    let total = 0
    for (const incident of result.tables.incidents) {
      if (!incident.photo_key) continue
      if (!/^[\da-f-]{36}\.jpg$/.test(incident.photo_key))
        throw Error("Unsafe evidence filename")
      const data = await readFile(
        path.resolve(process.env.UPLOAD_DIR || "uploads", incident.photo_key),
      )
      total += data.length
      if (total > 70 * 1024 * 1024)
        throw Object.assign(
          Error("Use provider-managed backups for evidence larger than 70 MB"),
          { status: 409 },
        )
      result.photos[incident.photo_key] = data.toString("base64")
    }
    await c.query("COMMIT")
    return result
  } catch (e) {
    await c.query("ROLLBACK")
    throw e
  } finally {
    c.release()
  }
}
export async function createBackup(pool) {
  const bytes = pack(await snapshot(pool)),
    id = randomUUID(),
    dir = path.resolve(process.env.BACKUP_DIR || "backups")
  await mkdir(dir, { recursive: true, mode: 0o700 })
  await writeFile(path.join(dir, id + ".bccbackup"), bytes, {
    mode: 0o600,
    flag: "wx",
  })
  return { id, created_at: new Date().toISOString(), bytes: bytes.length }
}
export async function listBackups() {
  const dir = path.resolve(process.env.BACKUP_DIR || "backups")
  try {
    return (await readdir(dir))
      .filter((n) => /^[\da-f-]{36}\.bccbackup$/.test(n))
      .map((n) => ({ id: n.slice(0, -10) }))
  } catch (e) {
    if (e.code === "ENOENT") return []
    throw e
  }
}
// Restore is deliberately CLI-only and refuses a database with any operational/user data.
// Run migrations against an isolated empty database before calling this function.
export async function restoreSnapshot(pool, result) {
  if (result.version !== 3) throw Error("Unsupported backup schema")
  const c = await pool.connect()
  try {
    await c.query("BEGIN")
    for (const table of tables) {
      if ((await c.query(`SELECT 1 FROM ${table} LIMIT 1`)).rows.length)
        throw Error("Restore target must be empty")
      if (!Array.isArray(result.tables[table])) throw Error("Incomplete backup")
    }
    for (const table of tables)
      await c.query(
        `INSERT INTO ${table} OVERRIDING SYSTEM VALUE SELECT * FROM json_populate_recordset(NULL::${table},$1::json)`,
        [JSON.stringify(result.tables[table])],
      )
    for (const table of ["audit_events", "operation_audit"])
      await c.query(
        `SELECT setval(pg_get_serial_sequence('${table}','id'),COALESCE(MAX(id),1),MAX(id) IS NOT NULL) FROM ${table}`,
      )
    await c.query("COMMIT")
  } catch (e) {
    await c.query("ROLLBACK")
    throw e
  } finally {
    c.release()
  }
}
