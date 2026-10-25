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
      ["Demo Makati Office", "Demo BGC Commercial Site"][n - 1],
    ])
  for (const [n, role] of [
    "operations",
    "supervisor",
    "guard",
    "guard",
    "admin",
  ].entries()) {
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
  // Extra fictional assigned sites for demonstrations. No real geofence coordinates are invented.
  for (const [n, name] of [[3, "Demo Ortigas Business Center"], [4, "Demo Quezon City Warehouse"]]) {
    const siteId = "10000000-0000-4000-8000-00000000000" + n
    await c.query("INSERT INTO sites(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING", [siteId, name])
  }
  for (const [userNo, siteNo] of [[1,2],[1,3],[2,2],[2,3],[3,3],[4,4]]) {
    await c.query("INSERT INTO user_sites(user_id,site_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [
      "20000000-0000-4000-8000-00000000000" + userNo,
      "10000000-0000-4000-8000-00000000000" + siteNo,
    ])
  }
  // Fictional sample records only; explicit seeding is never run at API startup.
  const now = Date.now(),
    at = (hours) => new Date(now + hours * 3600000).toISOString()
  const site = "10000000-0000-4000-8000-000000000001",
    guard = "20000000-0000-4000-8000-000000000003",
    actor = "20000000-0000-4000-8000-000000000001"
  await c.query(
    "INSERT INTO site_settings(site_id,client_name,required_guards) VALUES($1,'Fictional Demo Client',2) ON CONFLICT DO NOTHING",
    [site],
  )
  const examples = [
    [
      "30000000-0000-4000-8000-000000000001",
      "shifts",
      guard,
      {
        title: "Demo gate duty",
        post: "Main entrance",
        start: at(-1),
        end: at(7),
        status: "Scheduled",
      },
    ],
    [
      "30000000-0000-4000-8000-000000000002",
      "equipment",
      null,
      {
        title: "Demo handheld radio",
        serial: "FICTIONAL-R001",
        category: "Radio",
        status: "Available",
        acquired_at: at(-720),
        notes: "Fictional equipment for testing only",
      },
    ],
    [
      "30000000-0000-4000-8000-000000000003",
      "assignments",
      guard,
      {
        equipment_id: "30000000-0000-4000-8000-000000000002",
        issued_at: at(-1),
        returned_at: null,
        condition: "Good",
        acknowledged: false,
      },
    ],
    [
      "30000000-0000-4000-8000-000000000004",
      "training",
      guard,
      {
        title: "Demo emergency orientation",
        completed_at: at(-48),
        expires_at: null,
        notes: "Fictional completion",
      },
    ],
    [
      "30000000-0000-4000-8000-000000000005",
      "certifications",
      guard,
      {
        title: "Demo guard license",
        number: "FICTIONAL-L001",
        expires_at: at(480),
        notes: "Not a real license",
      },
    ],
    [
      "30000000-0000-4000-8000-000000000006",
      "assessments",
      guard,
      {
        title: "Demo radio handling",
        score: 90,
        assessed_at: at(-24),
        notes: "Fictional assessment",
      },
    ],
    [
      "30000000-0000-4000-8000-000000000007",
      "maintenance",
      null,
      {
        equipment_id: "30000000-0000-4000-8000-000000000002",
        title: "Demo radio inspection",
        due_at: at(168),
        status: "Scheduled",
        completed_at: null,
        notes: "",
      },
    ],
  ]
  for (const [id, kind, subject, data] of examples)
    await c.query(
      "INSERT INTO operational_records(id,kind,site_id,subject_id,created_by,data) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING",
      [id, kind, site, subject, actor, JSON.stringify(data)],
    )
  await c.query("COMMIT")
  console.log("Fictional users seeded; password comes from DEMO_PASSWORD")
} catch (e) {
  await c.query("ROLLBACK")
  throw e
} finally {
  c.release()
  await pool.end()
}
