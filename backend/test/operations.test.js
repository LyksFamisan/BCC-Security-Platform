import { test } from "node:test"
import assert from "node:assert/strict"
import { PGlite } from "@electric-sql/pglite"
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import bcrypt from "bcryptjs"
import sharp from "sharp"
import { randomBytes } from "node:crypto"
import { createService } from "../src/service.js"

test("TOR workflows persist across clients, enforce scope, geofence, concurrency, approval and account revocation", async () => {
  const db = new PGlite()
  for (const f of (
    await readdir(new URL("../migrations/", import.meta.url))
  ).sort())
    await db.exec(
      await readFile(new URL("../migrations/" + f, import.meta.url), "utf8"),
    )
  const pool = {
    query: (q, a) => db.query(q, a),
    connect: async () => ({ query: (q, a) => db.query(q, a), release() {} }),
  }
  process.env.UPLOAD_DIR = await mkdtemp(path.join(os.tmpdir(), "bcc-ops-"))
  const { server, io } = createService(
    pool,
    "test-only-tor-secret-credential-12345678",
  )
  await new Promise((r) => server.listen(0, "127.0.0.1", r))
  const base = "http://127.0.0.1:" + server.address().port
  const users = {},
    tokens = {},
    password = "test-only-password-123"
  const site1 = "10000000-0000-4000-8000-000000000001",
    site2 = "10000000-0000-4000-8000-000000000002"
  async function call(role, url, data, method = data ? "POST" : "GET") {
    return fetch(base + url, {
      method,
      headers: {
        Authorization: "Bearer " + tokens[role],
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    })
  }
  async function ok(role, url, data, method, expected = data ? 201 : 200) {
    const r = await call(role, url, data, method)
    const body = await r.json()
    assert.equal(r.status, expected, JSON.stringify(body))
    return body
  }
  try {
    await db.query("INSERT INTO sites VALUES($1,$2),($3,$4)", [
      site1,
      "Test North",
      site2,
      "Test South",
    ])
    const hash = await bcrypt.hash(password, 4)
    for (const [n, role] of [
      "admin",
      "operations",
      "supervisor",
      "guard",
      "guard2",
    ].entries()) {
      const id = `20000000-0000-4000-8000-00000000000${n + 1}`
      users[role] = id
      await db.query("INSERT INTO users VALUES($1,$2,$3,$4,$5)", [
        id,
        role,
        role + "@demo.invalid",
        hash,
        role === "guard2" ? "guard" : role,
      ])
      await db.query("INSERT INTO user_sites VALUES($1,$2)", [
        id,
        role === "guard2" ? site2 : site1,
      ])
      tokens[role] = (
        await (
          await fetch(base + "/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: role + "@demo.invalid", password }),
          })
        ).json()
      ).token
    }
    const now = Date.now(),
      iso = (delta = 0) => new Date(now + delta).toISOString()
    const create = (kind, data, subject_id = null, site_id = site1) => ({
      site_id,
      subject_id,
      data,
    })
    const config = {
      name: "Test North",
      client_name: "Fictional Client",
      required_guards: 2,
      latitude: 14.55,
      longitude: 121.02,
      radius_m: 300,
    }
    await ok("admin", "/system/sites/" + site1, config, "PUT", 200)
    assert.equal(
      (await call("operations", "/system/sites/" + site1, config, "PUT"))
        .status,
      403,
    )
    const shiftData = {
      title: "Gate duty",
      post: "Gate 1",
      start: iso(-60000),
      end: iso(3600000),
      status: "Scheduled",
    }
    const shift = await ok(
      "supervisor",
      "/operations/shifts",
      create("shifts", shiftData, users.guard),
    )
    assert.equal(
      (
        await call(
          "supervisor",
          "/operations/shifts",
          create("shifts", shiftData, users.guard),
        )
      ).status,
      409,
      "overlapping guard shifts blocked",
    )
    assert.equal((await ok("guard", "/operations/shifts")).length, 1)
    assert.equal((await ok("guard2", "/operations/shifts")).length, 0)
    assert.equal((await call("admin", "/operations/shifts")).status, 403)
    assert.equal(
      (
        await call(
          "guard",
          "/operations/shifts",
          create("shifts", shiftData, users.guard),
        )
      ).status,
      403,
    )
    const punch = {
      shift_id: shift.id,
      event: "in",
      latitude: 14.55,
      longitude: 121.02,
      accuracy: 10,
    }
    assert.equal(
      (await call("guard", "/attendance", { ...punch, latitude: 15 })).status,
      403,
    )
    assert.equal(
      (await call("guard", "/attendance", { ...punch, accuracy: 500 })).status,
      400,
    )
    await ok("guard", "/attendance", punch)
    assert.equal(
      (await call("guard", "/attendance", punch)).status,
      409,
      "duplicate check-in blocked",
    )
    assert.equal((await ok("supervisor", "/operations/attendance")).length, 1)
    assert.equal((await ok("guard2", "/operations/attendance")).length, 0)
    await ok("guard", "/location/check-in", {
      site_id: site1,
      location: { latitude: 14.55, longitude: 121.02, accuracy: 5 },
    })
    assert.equal((await ok("supervisor", "/operations/gps")).length, 1)
    assert.equal((await ok("supervisor", "/operations/gps"))[0].data.geofence_status, "Inside")
    const outside = await ok("guard", "/location/check-in", {
      site_id: site1,
      location: { latitude: 14.56, longitude: 121.02, accuracy: 5 },
    })
    assert.equal(outside.data.geofence_status, "Outside")
    assert(outside.data.distance_m > outside.data.radius_m)
    assert((await ok("supervisor", "/notifications")).some(a => a.key === "geofence:" + outside.id))
    assert(!(await ok("guard2", "/notifications")).some(a => a.key === "geofence:" + outside.id))
    const uncertain = await ok("guard", "/location/check-in", {
      site_id: site1,
      location: { latitude: 14.55, longitude: 121.02, accuracy: 500 },
    })
    assert.equal(uncertain.data.geofence_status, "Uncertain")
    assert(!(await ok("supervisor", "/notifications")).some(a => a.key.startsWith("geofence:")), "newer uncertain sample clears previous boundary alert")
    assert.equal((await call("guard2", "/location/check-in", {site_id:site1,location:{latitude:14.55,longitude:121.02,accuracy:5}})).status,403)

    const equipment = await ok(
      "operations",
      "/operations/equipment",
      create("equipment", {
        title: "Test radio",
        serial: "TEST-R001",
        category: "Radio",
        status: "Available",
        acquired_at: iso(),
        notes: "",
      }),
    )
    assert.equal(
      (
        await call(
          "supervisor",
          "/operations/equipment",
          create("equipment", equipment.data),
        )
      ).status,
      403,
    )
    assert.equal((await ok("guard", "/operations/equipment")).length, 0)
    const assignment = await ok(
      "supervisor",
      "/operations/assignments",
      create(
        "assignments",
        {
          equipment_id: equipment.id,
          issued_at: iso(),
          returned_at: null,
          condition: "Good",
          acknowledged: false,
        },
        users.guard,
      ),
    )
    assert.equal((await ok("guard", "/operations/equipment")).length, 1)
    assert.equal(
      (
        await call(
          "supervisor",
          "/operations/assignments",
          create("assignments", assignment.data, users.supervisor),
        )
      ).status,
      409,
      "cannot double issue equipment",
    )
    assert.equal(
      (await call("guard2", "/equipment/" + assignment.id + "/acknowledge", {}))
        .status,
      404,
    )
    await ok(
      "guard",
      "/equipment/" + assignment.id + "/acknowledge",
      {},
      "POST",
      200,
    )
    const ack = (await ok("supervisor", "/operations/assignments"))[0]
    assert.equal(ack.data.acknowledged, true)
    await ok(
      "guard",
      "/operations/defects",
      create("defects", {
        equipment_id: equipment.id,
        title: "Battery fault",
        description: "Battery not charging",
        status: "Reported",
      }),
    )
    assert.equal(
      (
        await call(
          "guard2",
          "/operations/defects",
          create(
            "defects",
            {
              equipment_id: equipment.id,
              title: "Forbidden",
              description: "Invalid equipment",
              status: "Reported",
            },
            null,
            site2,
          ),
        )
      ).status,
      400,
    )
    const maintenance = await ok(
      "operations",
      "/operations/maintenance",
      create("maintenance", {
        equipment_id: equipment.id,
        title: "Radio inspection",
        due_at: iso(-10000),
        status: "Scheduled",
        completed_at: null,
        notes: "",
      }),
    )
    assert.equal((await call("guard", "/operations/maintenance")).status, 403)
    assert.equal(
      (
        await call(
          "supervisor",
          "/operations/maintenance/" + maintenance.id,
          { version: 1, data: maintenance.data },
          "PATCH",
        )
      ).status,
      403,
    )
    await ok(
      "operations",
      "/operations/training",
      create(
        "training",
        {
          title: "Safety orientation",
          completed_at: iso(),
          expires_at: null,
          notes: "",
        },
        users.guard,
      ),
    )
    const cert = await ok(
      "operations",
      "/operations/certifications",
      create(
        "certifications",
        {
          title: "Test security license",
          number: "FICTIONAL-1",
          expires_at: iso(-86400000),
          notes: "",
        },
        users.guard,
      ),
    )
    assert.equal((await ok("guard", "/operations/training")).length, 1)
    assert.equal((await ok("guard2", "/operations/certifications")).length, 0)
    await ok(
      "supervisor",
      "/operations/assessments",
      create(
        "assessments",
        { title: "Radio handling", score: 90, assessed_at: iso(), notes: "" },
        users.guard,
      ),
    )
    const update = {
      version: cert.version,
      data: { ...cert.data, number: "FICTIONAL-2" },
    }
    await ok(
      "operations",
      "/operations/certifications/" + cert.id,
      update,
      "PATCH",
      200,
    )
    assert.equal(
      (
        await call(
          "operations",
          "/operations/certifications/" + cert.id,
          update,
          "PATCH",
        )
      ).status,
      409,
      "stale edit rejected",
    )
    const f = new FormData()
    for (const [k, v] of Object.entries({
      title: "TOR incident",
      description: "Fictional incident for workflow testing",
      location: "Test gate",
      site_id: site1,
    }))
      f.append(k, v)
    f.append(
      "photo",
      new Blob(
        [
          await sharp({
            create: { width: 8, height: 8, channels: 3, background: "blue" },
          })
            .png()
            .toBuffer(),
        ],
        { type: "image/png" },
      ),
      "test.png",
    )
    const r = await fetch(base + "/incidents", {
      method: "POST",
      headers: { Authorization: "Bearer " + tokens.guard },
      body: f,
    })
    assert.equal(r.status, 201)
    const incident = await r.json()
    assert.equal(
      (
        await call(
          "supervisor",
          "/incidents/" + incident.id,
          { status: "Resolved" },
          "PATCH",
        )
      ).status,
      409,
      "must approve first",
    )
    await ok(
      "supervisor",
      "/incidents/" + incident.id,
      {
        classification: "Equipment",
        severity: "Critical",
        investigation: "Inspected radio",
        root_cause: "Battery failure",
        approval: "Approved",
        version: incident.version,
      },
      "PATCH",
      200,
    )
    const action = await ok(
      "supervisor",
      "/operations/actions",
      create(
        "actions",
        {
          incident_id: incident.id,
          title: "Replace battery",
          type: "Corrective",
          due_at: iso(3600000),
          status: "Open",
          notes: "",
        },
        users.guard,
      ),
    )
    assert.equal(
      (
        await call(
          "operations",
          "/incidents/" + incident.id,
          { status: "Resolved" },
          "PATCH",
        )
      ).status,
      409,
      "outstanding actions block resolution",
    )
    await ok(
      "supervisor",
      "/operations/actions/" + action.id,
      { version: 1, data: { ...action.data, status: "Completed" } },
      "PATCH",
      200,
    )
    await ok(
      "operations",
      "/incidents/" + incident.id,
      { status: "Resolved" },
      "PATCH",
      200,
    )
    const resolved = (await ok("guard", "/incidents"))[0]
    assert.equal(resolved.status, "Resolved")
    assert.ok(resolved.resolved_at)
    assert.equal(resolved.root_cause, undefined)
    assert.equal(
      (await call("guard", "/incidents/" + incident.id + "/audit")).status,
      403,
    )
    const alerts = await ok("operations", "/notifications")
    assert.ok(alerts.some((a) => a.key === "shortage:" + site1))
    assert.ok(alerts.some((a) => a.key === "maintenance:" + maintenance.id))
    const guardAlerts = await ok("guard", "/notifications")
    assert.ok(
      !guardAlerts.some(
        (a) =>
          a.key.startsWith("shortage:") || a.key.startsWith("maintenance:"),
      ),
    )
    await ok(
      "guard",
      "/notifications/read",
      { key: guardAlerts[0].key },
      "POST",
      200,
    )
    assert.equal(
      (await ok("guard", "/notifications")).find(
        (a) => a.key === guardAlerts[0].key,
      ).read,
      true,
    )
    const dashboard = await ok("supervisor", "/dashboard")
    assert.equal(dashboard.counts.on_duty, 1)
    assert.equal(dashboard.sites.length, 1)
    const guardDashboard = await ok("guard2", "/dashboard")
    assert.equal(guardDashboard.counts.incidents, 0)
    assert.equal(guardDashboard.counts.on_duty, 0)
    const csv = await call("supervisor", "/reports/export?kind=attendance")
    assert.equal(csv.status, 200)
    assert.match(await csv.text(), /Test North/)
    assert.equal(
      (await call("guard", "/reports/export?kind=attendance")).status,
      403,
    )
    await ok(
      "operations",
      "/preferences",
      { dashboard: ["sites", "incidents"], report_kind: "attendance" },
      "PUT",
      200,
    )
    assert.deepEqual((await ok("operations", "/preferences")).dashboard, [
      "sites",
      "incidents",
    ])
    assert.ok(
      (await ok("operations", "/system/audit")).some(
        (a) => a.action === "ATTENDANCE_IN",
      ),
    )
    const adminAudit = await ok("admin", "/system/audit")
    assert.ok(adminAudit.every((a) => !("details" in a)))
    const external = {
      events: [
        {
          external_id: "TEST-OUT-1",
          shift_id: shift.id,
          event: "out",
          recorded_at: new Date().toISOString(),
        },
      ],
    }
    assert.equal(
      (await call("operations", "/integrations/attendance", external)).status,
      409,
    )
    await ok(
      "admin",
      "/system/integrations",
      { enabled: true, source_name: "Fictional timeclock" },
      "PUT",
      200,
    )
    assert.equal(
      (await call("guard", "/integrations/attendance", external)).status,
      403,
    )
    assert.equal(
      (
        await ok(
          "operations",
          "/integrations/attendance",
          external,
          "POST",
          200,
        )
      ).imported,
      1,
    )
    assert.equal(
      (
        await ok(
          "operations",
          "/integrations/attendance",
          external,
          "POST",
          200,
        )
      ).duplicates,
      1,
    )
    process.env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString("base64")
    process.env.BACKUP_DIR = path.join(process.env.UPLOAD_DIR, "backups")
    assert.equal((await call("operations", "/system/backups", {})).status, 403)
    const backup = await ok("admin", "/system/backups", {})
    assert.ok(
      (await ok("admin", "/system/backups")).some((b) => b.id === backup.id),
    )
    const archive = await call("admin", "/system/backups/" + backup.id)
    assert.equal(archive.status, 200)
    assert.equal(
      Buffer.from(await archive.arrayBuffer())
        .subarray(0, 10)
        .toString(),
      "BCCBACKUP1",
    )
    const userConfig = {
      name: "guard",
      email: "guard@demo.invalid",
      role: "guard",
      active: false,
      site_ids: [site1],
    }
    await ok("admin", "/system/users/" + users.guard, userConfig, "PUT", 200)
    assert.equal(
      (await call("guard", "/auth/me")).status,
      401,
      "disabled account immediately rejected",
    )
    const log = await fetch(base + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "guard@demo.invalid", password }),
    })
    assert.equal(log.status, 401)
    await ok("supervisor", "/auth/logout", {}, "POST", 200)
    assert.equal(
      (await call("supervisor", "/auth/me")).status,
      401,
      "signed-out token revoked server side",
    )
  } finally {
    await new Promise((r) => io.close(r))
    await db.close()
    await rm(process.env.UPLOAD_DIR, { recursive: true, force: true })
  }
})
