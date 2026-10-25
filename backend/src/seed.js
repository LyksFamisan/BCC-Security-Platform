import { pool } from "./db.js"
import bcrypt from "bcryptjs"
const password = process.env.DEMO_PASSWORD
if (!password || password.length < 12)
  throw Error("Set DEMO_PASSWORD to at least 12 characters")
const hash = await bcrypt.hash(password, 12)
const c = await pool.connect()
try {
  await c.query("BEGIN")
  for (let n = 1; n <= 2; n++)
    await c.query("INSERT INTO sites VALUES($1,$2) ON CONFLICT DO NOTHING", [
      `10000000-0000-4000-8000-00000000000${n}`,
      `Demo Site ${n}`,
    ])
  for (const [n, role] of ["operations", "supervisor", "guard", "guard", "admin"].entries()) {
    const id = `20000000-0000-4000-8000-00000000000${n + 1}`,
      email = n === 3 ? "guard2@demo.invalid" : `${role}@demo.invalid`
    await c.query(
      "INSERT INTO users VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,password_hash=EXCLUDED.password_hash,role=EXCLUDED.role",
      [id, `Demo ${role} ${n + 1}`, email, hash, role],
    )
    await c.query(
      "INSERT INTO user_sites VALUES($1,$2) ON CONFLICT DO NOTHING",
      [id, `10000000-0000-4000-8000-00000000000${n === 3 ? 2 : 1}`],
    )
  }
  await c.query("COMMIT")
  console.log("Fictional users seeded; password comes from DEMO_PASSWORD")
} catch (e) {
  await c.query("ROLLBACK")
  throw e
} finally {
  c.release()
  await pool.end()
}
