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

test("Online-only Guard camera attendance is idempotent, scoped and visible to Operations", async () => {
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
    assert.equal((await call('guard','/mobile/offline',{})).status,410,'Offline submissions disabled')
    assert.equal((await ok('guard','/operations/attendance')).length,0)
    const capture={id:'30000000-0000-4000-8000-000000000006',shift_id:shift.id,event:'in',latitude:14.55,longitude:121.02,accuracy:5}
    const online=await ok('guard','/attendance',capture);assert.equal(online.id,capture.id)
    const retry=await ok('guard','/attendance',capture);assert.equal(retry.id,online.id)
    assert.equal((await ok('operations','/operations/attendance')).length,1,'Operations sees online record')
    assert.equal((await call('operations','/attendance/'+online.id+'/photo')).status,200)
    assert.equal((await call('guard2','/attendance/'+online.id+'/photo')).status,403)
    assert.equal((await ok('guard','/operations/offline_attendance')).length,0,'No queued record created')
    await ok('admin','/system/sites/'+site1,{...config,latitude:null,longitude:null},'PUT',200)
    const withoutFence=await ok('guard','/attendance',{shift_id:shift.id,event:'out',latitude:14.56,longitude:121.03,accuracy:5})
    assert.equal(withoutFence.data.geofence_status,'Not configured')
    assert.equal(withoutFence.data.distance_m,null)
    assert.equal(withoutFence.data.radius_m,null)
    assert.equal((await call('operations','/attendance/'+withoutFence.id+'/photo')).status,200)
    assert.equal((await call('guard','/attendance',{shift_id:shift.id,event:'in',latitude:14.56,longitude:121.03,accuracy:150})).status,400)
    await db.query('DELETE FROM site_settings WHERE site_id=$1',[site1])
    const missingSettings=await ok('guard','/attendance',{shift_id:shift.id,event:'in',latitude:14.56,longitude:121.03,accuracy:5})
    assert.equal(missingSettings.data.geofence_status,'Not configured')
    assert.equal((await ok('operations','/operations/attendance')).length,3,'Operations receives unfenced Time In and Time Out')
    await ok('admin','/system/sites/'+site1,config,'PUT',200)
    assert.equal((await call('guard','/attendance',{shift_id:shift.id,event:'out',latitude:14.56,longitude:121.03,accuracy:5})).status,403,'Configured boundary still enforced')
    const form=new FormData();for(const [k,v] of Object.entries({title:'Online severity report',description:'Test incident transmitted to Operations',location:'Gate 1',site_id:site1,severity:'High'}))form.append(k,v)
    form.append('photo',new Blob([await sharp({create:{width:320,height:240,channels:3,background:'#123456'}}).jpeg().toBuffer()],{type:'image/jpeg'}),'photo.jpg')
    const incident=await fetch(base+'/incidents',{method:'POST',headers:{Authorization:'Bearer '+tokens.guard},body:form});assert.equal(incident.status,201,await incident.clone().text())
    assert.equal((await ok('operations','/incidents'))[0].severity,'High')
  } finally {
    await new Promise((r) => io.close(r))
    await db.close()
    await rm(process.env.UPLOAD_DIR, { recursive: true, force: true })
  }
})
