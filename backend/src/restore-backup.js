import pg from "pg"
import { readFile, mkdir, writeFile, readdir } from "node:fs/promises"
import path from "node:path"
import { unpack, restoreSnapshot } from "./backups.js"
const target = process.env.RESTORE_DATABASE_URL
if (!target || !process.env.RESTORE_UPLOAD_DIR)
  throw Error(
    "Set RESTORE_DATABASE_URL and RESTORE_UPLOAD_DIR for an isolated empty target",
  )
const url = new URL(target),
  source = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null
if (source && source.host === url.host && source.pathname === url.pathname)
  throw Error("Refusing to restore into the configured application database")
if (process.argv[3] !== `--confirm-target=${url.hostname}${url.pathname}`)
  throw Error(
    "Pass --confirm-target=HOST/DATABASE to acknowledge the isolated target",
  )
const result = unpack(await readFile(process.argv[2])),
  dir = path.resolve(process.env.RESTORE_UPLOAD_DIR)
if(dir===path.resolve(process.env.UPLOAD_DIR||"uploads"))throw Error("Restore evidence directory must be separate from application uploads")
await mkdir(dir, { recursive: true, mode: 0o700 })
if((await readdir(dir)).length)throw Error("Restore evidence directory must be empty")
// Exclusive file creation prevents overwriting existing evidence.
for (const [name, data] of Object.entries(result.photos || {})) {
  if (!/^[\da-f-]{36}\.jpg$/.test(name))
    throw Error("Invalid evidence filename")
  await writeFile(path.join(dir, name), Buffer.from(data, "base64"), {
    flag: "wx",
    mode: 0o600,
  })
}
const pool = new pg.Pool({ connectionString: target })
try {
  await restoreSnapshot(pool, result)
  console.log(
    "Restored into the isolated target. Verify users, reports and evidence before a controlled cutover.",
  )
} finally {
  await pool.end()
}
