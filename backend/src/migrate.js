import { pool } from "./db.js"
import { readdir, readFile } from "node:fs/promises"
const c = await pool.connect()
try {
  await c.query("BEGIN")
  await c.query("SELECT pg_advisory_xact_lock(472901)")
  await c.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY)",
  )
  for (const name of (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (
      !(await c.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name]))
        .rowCount
    ) {
      await c.query(
        await readFile(
          new URL("../migrations/" + name, import.meta.url),
          "utf8",
        ),
      )
      await c.query("INSERT INTO schema_migrations VALUES($1)", [name])
    }
  }
  await c.query("COMMIT")
  console.log("Migrations applied")
} catch (e) {
  await c.query("ROLLBACK")
  throw e
} finally {
  c.release()
  await pool.end()
}
