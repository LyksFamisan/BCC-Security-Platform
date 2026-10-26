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

test("All operational reports export readable PDF/CSV with scope, validation and audit controls", async () => {
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
    if(url === "/attendance" && data) {
      const form=new FormData()
      for(const [k,v] of Object.entries(data)) form.append(k,String(v))
      form.append("photo",new Blob([await sharp({create:{width:640,height:480,channels:3,background:"#345678"}}).jpeg().toBuffer()],{type:"image/jpeg"}),"attendance.jpg")
      return fetch(base+url,{method,headers:{Authorization:"Bearer "+tokens[role]},body:form})
    }
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
    const {buildDemoFixtures}=await import('../scripts/demo-fixtures.js')
    const {reportNames,reportCsv}=await import('../src/report-export.js')
    const plan=await buildDemoFixtures([{id:users.operations,role:'operations'},{id:users.guard,role:'guard'}])
    for(const sql of plan.sql)await db.exec(sql)
    for(const report of Object.keys(reportNames))for(const format of ['csv','pdf']){
      const response=await call('operations','/reports/export?path=reports%2Fexport&kind='+report+'&format='+format)
      assert.equal(response.status,200,report+' '+format+': '+await response.clone().text())
      assert(response.headers.get('content-disposition').includes(report+'.'+format))
      if(format==='pdf'){assert(response.headers.get('content-type').includes('application/pdf'));assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0,5).toString(),'%PDF-')}
      else{assert(response.headers.get('content-type').includes('text/csv'));const csv=await response.text();assert(!csv.includes('"details"'),'Readable columns replace opaque JSON')}
    }
    assert.equal((await call('operations','/reports/export?kind=attendance&unexpected_filter=1')).status,400,'Unknown business filters still rejected')
    const incidentCsv=await call('supervisor','/reports/export?kind=incidents');assert(!(await incidentCsv.text()).includes('[DEMO]'),'Supervisor cannot export unassigned demo sites')
    assert.equal((await call('guard','/reports/export?kind=incidents&format=pdf')).status,403)
    assert.equal((await call('admin','/reports/export?kind=equipment&format=pdf')).status,403)
    assert.equal((await call('supervisor','/reports/export?kind=equipment&site_id='+site2)).status,403)
    assert.equal((await call('operations','/reports/export?kind=attendance&format=exe')).status,400)
    assert.equal((await call('operations','/reports/export?kind=toString')).status,400)
    assert.equal((await call('operations','/reports/export?kind=attendance&from=2026-10-27T00:00:00Z&to=2026-10-26T00:00:00Z')).status,400)
    const empty=await call('operations','/reports/export?kind=incidents&format=pdf&from=2099-01-01T00:00:00Z');assert.equal(empty.status,200)
    const escaped=reportCsv([['Name'],['=HYPERLINK("bad")'],['  +SUM(1,1)']]);assert(escaped.includes("'=HYPERLINK"));assert(escaped.includes("'  +SUM"))
    const auditRows=(await db.query("SELECT details FROM operation_audit WHERE action='EXPORT_incidents'")).rows;assert(auditRows.some(r=>r.details.format==='pdf'))
  } finally {
    await new Promise((r) => io.close(r))
    await db.close()
    await rm(process.env.UPLOAD_DIR, { recursive: true, force: true })
  }
})
