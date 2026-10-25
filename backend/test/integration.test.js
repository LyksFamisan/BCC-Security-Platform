import { test } from "node:test"
import assert from "node:assert/strict"
import { PGlite } from "@electric-sql/pglite"
import bcrypt from "bcryptjs"
import { readFile, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createService } from "../src/service.js"
import { io as clientSocket } from "socket.io-client"
import sharp from "sharp"
test("shared mobile/web flow, authorization, evidence, audit and reconnect", async () => {
  const db = new PGlite()
  await db.exec(
    await readFile(
      new URL("../migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  )
  await db.exec(
    await readFile(
      new URL("../migrations/002_four_roles.sql", import.meta.url),
      "utf8",
    ),
  )
  await db.exec(
    await readFile(
      new URL("../migrations/003_operations.sql", import.meta.url),
      "utf8",
    ),
  )
await db.exec(await readFile(new URL("../migrations/004_hosted_storage.sql",import.meta.url),"utf8"))
  const pool = {
    query: (sql, args) => db.query(sql, args),
    connect: async () => ({
      query: (sql, args) => db.query(sql, args),
      release() {},
    }),
  }
  process.env.UPLOAD_DIR = await mkdtemp(path.join(os.tmpdir(), "bcc-test-"))
  const { server, io } = createService(
    pool,
    "test-only-secret-not-a-real-credential-123456",
  )
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const base = "http://127.0.0.1:" + server.address().port
  const site1 = "10000000-0000-4000-8000-000000000001",
    site2 = "10000000-0000-4000-8000-000000000002"
  let socket
  try {
    await db.query("INSERT INTO sites VALUES($1,$2),($3,$4)", [
      site1,
      "Demo North",
      site2,
      "Demo South",
    ])
    const password = "test-only-password",
      hash = await bcrypt.hash(password, 4),
      tokens = {}
    for (const [n, role] of [
      "operations",
      "supervisor",
      "guard",
      "guard",
      "admin",
    ].entries()) {
      const id = `20000000-0000-4000-8000-00000000000${n + 1}`,
        email = `user${n}@demo.invalid`
      await db.query("INSERT INTO users VALUES($1,$2,$3,$4,$5)", [
        id,
        role,
        email,
        hash,
        role,
      ])
      await db.query("INSERT INTO user_sites VALUES($1,$2)", [
        id,
        n === 3 ? site2 : site1,
      ])
      const res = await fetch(base + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      assert.equal(res.status, 200)
      tokens[n] = (await res.json()).token
    }
    // App selection is checked on the server, before a token is issued.
    for (const [user, appRole, expected] of [
      [2, "guard", 200],
      [1, "supervisor", 200],
      [2, "supervisor", 403],
      [1, "guard", 403],
      [0, "supervisor", 403],
    ]) {
      const res = await fetch(base + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `user${user}@demo.invalid`,
          password,
          app_role: appRole,
        }),
      })
      assert.equal(
        res.status,
        expected,
        `${appRole} app access for user ${user}`,
      )
      if (expected === 403) assert.equal((await res.json()).token, undefined)
      else {
        const { token: appToken } = await res.json()
        assert.equal(
          (
            await fetch(base + "/auth/me", {
              headers: { Authorization: "Bearer " + appToken },
            })
          ).status,
          200,
        )
        // Changing an account role invalidates its app-bound session.
        const id = `20000000-0000-4000-8000-00000000000${user + 1}`
        const otherRole = appRole === "guard" ? "supervisor" : "guard"
        await db.query("UPDATE users SET role=$1 WHERE id=$2", [otherRole, id])
        assert.equal(
          (
            await fetch(base + "/auth/me", {
              headers: { Authorization: "Bearer " + appToken },
            })
          ).status,
          401,
        )
        await db.query("UPDATE users SET role=$1 WHERE id=$2", [appRole, id])
      }
    }
    async function get(route, user) {
      return fetch(base + route, {
        headers: { Authorization: "Bearer " + tokens[user] },
      })
    }
    assert.equal((await fetch(base + "/incidents")).status, 401)
    const badLogin = await fetch(base + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user0@demo.invalid", password: "wrong" }),
    })
    assert.equal(badLogin.status, 401)
    socket = clientSocket(base, {
      auth: { token: tokens[0] },
      reconnection: false,
    })
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve)
      socket.once("connect_error", reject)
    })
    const change = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(Error("Missing realtime event")), 5000)
      socket.once("incidents:changed", () => {
        clearTimeout(t)
        resolve()
      })
    })
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "red" },
    })
      .png()
      .toBuffer()
    function form(site = site1, bytes = png) {
      const f = new FormData()
      for (const [k, v] of Object.entries({
        title: "Demo incident",
        description: "Fictional report from mobile",
        location: "North gate",
        site_id: site,
      }))
        f.append(k, v)
      f.append("photo", new Blob([bytes], { type: "image/png" }), "photo.png")
      return f
    }
    const created = await fetch(base + "/incidents", {
      method: "POST",
      headers: { Authorization: "Bearer " + tokens[2] },
      body: form(),
    })
    assert.equal(created.status, 201)
    const report = await created.json()
    await change
    assert.equal(
      (await (await get("/incidents", 0)).json()).length,
      1,
      "web admin sees mobile report",
    )
    assert.equal(
      (await (await get("/incidents", 1)).json()).length,
      1,
      "assigned supervisor sees report",
    )
    assert.equal(
      (await (await get("/incidents", 3)).json()).length,
      0,
      "other guard cannot list it",
    )
    for (const suffix of ["/photo", "/audit"])
      assert.equal(
        (await get("/incidents/" + report.id + suffix, 3)).status,
        404,
      )
    assert.equal(
      (await get("/incidents/" + report.id + "/photo", 2)).headers.get(
        "content-type",
      ),
      "image/jpeg",
    )
    const update = (user, data) =>
      fetch(base + "/incidents/" + report.id, {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + tokens[user],
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })
    assert.equal(
      (await update(2, { status: "Resolved", approval: "Approved" })).status,
      403,
    )
    assert.equal((await update(1, { status: "Under Review" })).status, 200)
    assert.equal(
      (await update(4, { status: "Resolved", approval: "Approved" })).status,
      404,
    )
    assert.deepEqual(await (await get("/incidents", 4)).json(), [])
    assert.equal(
      (await get("/incidents/" + report.id + "/photo", 4)).status,
      404,
    )
    const otherSite = await fetch(base + "/incidents", {
      method: "POST",
      headers: { Authorization: "Bearer " + tokens[3] },
      body: form(site2),
    })
    assert.equal(otherSite.status, 201)
    const otherReport = await otherSite.json()
    assert.equal(
      (
        await fetch(base + "/incidents/" + otherReport.id, {
          method: "PATCH",
          headers: {
            Authorization: "Bearer " + tokens[1],
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "Resolved", approval: "Approved" }),
        })
      ).status,
      404,
    )
    assert.equal((await (await get("/incidents", 1)).json()).length, 1)
    assert.equal((await (await get("/incidents", 0)).json()).length, 2)
    assert.equal((await update(0, { status: "Closed" })).status, 400)
    assert.equal(
      (await update(0, { assignee_id: "20000000-0000-4000-8000-000000000004" }))
        .status,
      400,
    )
    assert.equal(
      (
        await update(0, {
          status: "In Progress",
          assignee_id: "20000000-0000-4000-8000-000000000003",
        })
      ).status,
      200,
    )
    assert.equal(
      (await (await get("/incidents", 2)).json())[0].status,
      "In Progress",
      "mobile sees admin update",
    )
    const audit = await (
      await get("/incidents/" + report.id + "/audit", 0)
    ).json()
    assert.deepEqual(
      audit.map((a) => a.action),
      ["SUBMITTED", "UPDATED", "UPDATED"],
    )
    assert.equal(
      (
        await fetch(base + "/incidents", {
          method: "POST",
          headers: { Authorization: "Bearer " + tokens[2] },
          body: form(site2),
        })
      ).status,
      403,
    )
    assert.equal(
      (
        await fetch(base + "/incidents", {
          method: "POST",
          headers: { Authorization: "Bearer " + tokens[2] },
          body: form(site1, Buffer.from("not an image")),
        })
      ).status,
      400,
    )
    socket.disconnect()
    assert.equal(
      (await update(0, { status: "Resolved", approval: "Approved" })).status,
      200,
    )
    socket.connect()
    await new Promise((resolve) => socket.once("connect", resolve))
    assert.equal(
      (await (await get("/incidents", 2)).json())[0].status,
      "Resolved",
      "reconnect refresh recovers missed update",
    )
  } finally {
    socket?.disconnect()
    await new Promise((resolve) => io.close(resolve))
    await db.close()
    await rm(process.env.UPLOAD_DIR, { recursive: true, force: true })
  }
})
