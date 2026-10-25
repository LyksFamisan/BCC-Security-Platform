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

test("Offline mobile captures are durable, idempotent, scoped and separately reviewed", async () => {
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
    const photo=await sharp({create:{width:320,height:240,channels:3,background:'#123456'}}).jpeg().toBuffer()
    const captured_at=new Date().toISOString(),id='30000000-0000-4000-8000-000000000001'
    const capture={id,type:'attendance',captured_at,shift_id:shift.id,event:'in',latitude:14.55,longitude:121.02,accuracy:5}
    async function sync(who,data){const form=new FormData();for(const [k,v] of Object.entries(data))form.append(k,String(v));form.append('photo',new Blob([photo],{type:'image/jpeg'}),'capture.jpg');return fetch(base+'/mobile/offline',{method:'POST',headers:{Authorization:'Bearer '+tokens[who]},body:form})}
    const first=await sync('guard',capture);assert.equal(first.status,201,await first.clone().text());const row=await first.json()
    assert.equal(row.data.status,'Pending review');assert.equal(row.data.geofence_status,'Inside')
    const duplicate=await sync('guard',capture);assert.equal(duplicate.status,201);assert.equal((await duplicate.json()).id,id)
    assert.equal((await ok('guard','/operations/offline_attendance')).length,1)
    assert.equal((await ok('guard2','/operations/offline_attendance')).length,0)
    assert.equal((await ok('guard','/operations/attendance')).length,0,'Offline capture is not verified attendance')
    assert.equal((await call('guard','/attendance/'+id+'/photo')).status,200)
    assert.equal((await call('guard2','/attendance/'+id+'/photo')).status,403)
    assert.equal((await sync('guard2',capture)).status,409,'Retry cannot disclose another guard record')
    const decision={status:'Approved',notes:'Test supervisor checked shift evidence',version:row.version}
    assert.equal((await call('guard','/offline-attendance/'+id+'/review',decision)).status,403)
    const reviewed=await ok('supervisor','/offline-attendance/'+id+'/review',decision,'POST',200)
    assert.equal(reviewed.data.status,'Approved')
    assert.equal((await call('supervisor','/offline-attendance/'+id+'/review',decision)).status,409)
    assert.equal((await ok('guard','/operations/attendance')).length,0,'Approval does not invent a verified camera punch or billable hours')
    const incident={id:'30000000-0000-4000-8000-000000000002',type:'incident',captured_at,site_id:site1,title:'Offline test report',description:'A fully simulated incident report',location:'Test gate',severity:'High'}
    const submitted=await sync('guard',incident);assert.equal(submitted.status,201,await submitted.clone().text());assert.equal((await submitted.json()).severity,'High')
    assert.equal((await sync('guard',incident)).status,201)
    assert.equal((await ok('guard','/incidents')).length,1,'Retry does not duplicate incident')
    assert.equal((await sync('guard2',{...incident,id:'30000000-0000-4000-8000-000000000003'})).status,403,'Assigned site required even for offline sync')
    assert.equal((await sync('guard',{...capture,id:'30000000-0000-4000-8000-000000000004',captured_at:new Date(Date.now()+3600000).toISOString()})).status,400)
    assert.equal((await sync('guard',{...capture,id:'30000000-0000-4000-8000-000000000005',latitude:15})).status,201,'Outside capture retained explicitly for review')
    const outside=(await ok('guard','/operations/offline_attendance')).find(r=>r.data.geofence_status==='Outside');assert(outside)
    const verifiedCapture={id:'30000000-0000-4000-8000-000000000006',shift_id:shift.id,event:'in',latitude:14.55,longitude:121.02,accuracy:5}
    const online=await ok('guard','/attendance',verifiedCapture);assert.equal(online.id,verifiedCapture.id)
    const onlineRetry=await ok('guard','/attendance',verifiedCapture);assert.equal(onlineRetry.id,online.id)
    const uncertainResponse=await sync('guard',{...verifiedCapture,type:'attendance',captured_at});assert.equal(uncertainResponse.status,201);assert.equal((await uncertainResponse.json()).kind,'attendance_punch','Lost-response retry recognizes existing verified punch')
    assert.equal((await ok('guard','/operations/attendance')).length,1)
    const alerts=await ok('guard','/notifications');assert(alerts.some(a=>a.key.startsWith('offline:')));assert(alerts.some(a=>a.key.startsWith('shift:')));assert(alerts.some(a=>a.key.startsWith('incident:')))
  } finally {
    await new Promise((r) => io.close(r))
    await db.close()
    await rm(process.env.UPLOAD_DIR, { recursive: true, force: true })
  }
})
