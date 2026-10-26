// Starts an isolated API/database and Vite process; requires an installed Chromium.
import { PGlite } from "@electric-sql/pglite"
import { chromium } from "../../web/node_modules/playwright/index.mjs"
import { readFile, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import bcrypt from "bcryptjs"
import sharp from "sharp"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { createService } from "../src/service.js"
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
await db.exec(await readFile(new URL("../migrations/005_attendance_cycles.sql",import.meta.url),"utf8"))
const pool = {
  query: (q, a) => db.query(q, a),
  connect: async () => ({ query: (q, a) => db.query(q, a), release() {} }),
}
const dir = await mkdtemp(path.join(os.tmpdir(), "bcc-browser-"))
process.env.UPLOAD_DIR = dir
process.env.WEB_ORIGINS = "http://127.0.0.1:9843"
const { app:fixtureApp, server, io } = createService(
  pool,
  "browser-test-only-not-production-secret-1234",
)
await new Promise((r) => server.listen(0, "127.0.0.1", r))
const api = "http://127.0.0.1:" + server.address().port
let browser, vite

try {
  const site = "10000000-0000-4000-8000-000000000001",
    password = "browser-test-only"
  await db.query("INSERT INTO sites VALUES($1,$2)", [site, "Demo site"])
  for (const [n, role] of [
    "operations",
    "guard",
    "supervisor",
    "admin",
  ].entries()) {
    const id = `20000000-0000-4000-8000-00000000000${n + 1}`
    await db.query("INSERT INTO users VALUES($1,$2,$3,$4,$5)", [
      id,
      "Demo " + role,
      role + "@demo.invalid",
      await bcrypt.hash(password, 4),
      role,
    ])
    if (role !== "supervisor")
      await db.query("INSERT INTO user_sites VALUES($1,$2)", [id, site])
  }
  await db.query("INSERT INTO site_settings(site_id,latitude,longitude,radius_m) VALUES($1,14.55,121.02,300)",[site])
  await db.query("INSERT INTO operational_records(id,kind,site_id,subject_id,created_by,data) VALUES($1,'gps',$2,$3,$3,$4)",["30000000-0000-4000-8000-000000000001",site,"20000000-0000-4000-8000-000000000002",JSON.stringify({latitude:14.5505,longitude:121.0205,accuracy:5,geofence_status:"Inside",recorded_at:new Date().toISOString()})])
  vite = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "9843",
      "--strictPort",
    ],
    {
      cwd: fileURLToPath(new URL("../../web/", import.meta.url)),
      env: { ...process.env, VITE_API_URL: api },
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
  let logs = ""
  vite.stdout.on("data", (d) => (logs += d))
  vite.stderr.on("data", (d) => (logs += d))
  let listening = false
  for (let n = 0; n < 80; n++) {
    try {
      if ((await fetch("http://127.0.0.1:9843")).ok) {
        listening = true
        break
      }
    } catch {}
    await delay(100)
  }
  if (!listening) throw Error("Vite did not start: " + logs)
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
  })
  const page = await browser.newPage()
  page.setDefaultTimeout(10000)
  if (process.env.BCC_MAP_REAL_TILES === "1") await page.route("https://tile.openstreetmap.org/**", async route => {
    try {
      const response = await fetch(route.request().url(),{headers:{"User-Agent":"BCCSecurityPlatformVerification/1.0 (+https://bcc-security-platform.vercel.app)",Referer:"https://bcc-security-platform.vercel.app/"},signal:AbortSignal.timeout(10000)})
      await route.fulfill({status:response.status,contentType:response.headers.get("content-type") || "image/png",body:Buffer.from(await response.arrayBuffer())})
    } catch { await route.abort() }
  })

  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  const unexpectedResponses=[]
  page.on("response",r=>{if(r.status()===429 || r.status()>=500)unexpectedResponses.push([r.status(),r.url()])})
  await page.goto("http://127.0.0.1:9843")
  await page.getByLabel("Password",{exact:true}).fill("visibility-test-only")
  await page.getByRole("button",{name:"Show password",exact:true}).click()
  assert.equal(await page.getByLabel("Password",{exact:true}).getAttribute("type"),"text")
  assert.equal(await page.getByLabel("Password",{exact:true}).inputValue(),"visibility-test-only")
  await page.getByRole("button",{name:"Hide password",exact:true}).click()
  assert.equal(await page.getByLabel("Password",{exact:true}).getAttribute("type"),"password")
  await page.getByLabel("Password",{exact:true}).fill("")

  await page.getByRole("switch",{name:"Dark mode",exact:true}).click()
  await page.waitForFunction(()=>document.documentElement.dataset.bccTheme==="dark")
  await page.getByRole('img',{name:'BCC / CAT Security Services Platform',exact:true}).waitFor()
  await page.waitForFunction(()=>{const img=document.querySelector('.login-brand-art>img');return img&&img.complete&&img.naturalWidth>0})
  await page.screenshot({path:"/tmp/bcc-theme-dark-login.png",fullPage:true})
  const fallbackPage=await browser.newPage()
  await fallbackPage.route('**/assets/cat-security-brand-transparent.webp',route=>route.abort())
  await fallbackPage.goto('http://127.0.0.1:9843')
  await fallbackPage.locator('.login-brand-fallback strong').waitFor()
  assert.equal(await fallbackPage.locator('.login-brand-fallback strong').textContent(),'CAT Security Services Platform')
  await fallbackPage.close()

  await page.reload()
  await page.waitForFunction(()=>document.documentElement.dataset.bccTheme==="dark")
  assert.equal(await page.getByRole("switch",{name:"Dark mode",exact:true}).getAttribute("aria-checked"),"true","Theme survives refresh")
  await page.setViewportSize({width:390,height:844})
  await page.screenshot({path:"/tmp/bcc-theme-dark-phone.png",fullPage:true})
  await page.getByRole("switch",{name:"Dark mode",exact:true}).click()
  await page.waitForFunction(()=>document.documentElement.dataset.bccTheme==="light")
  await page.reload()
  await page.waitForFunction(()=>document.documentElement.dataset.bccTheme==="light")
  await page.screenshot({path:"/tmp/bcc-theme-light-phone.png",fullPage:true})
  await page.setViewportSize({width:1280,height:800})

  await page
    .getByLabel("Email", { exact: true })
    .fill("operations@demo.invalid")
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.getByRole("button", { name: "Sign out", exact: true }).waitFor()
  await page.getByRole("switch",{name:"Dark mode",exact:true}).click()
  await page.waitForFunction(()=>document.documentElement.dataset.bccTheme==="dark")
  await page.getByRole("button",{name:"Sign out",exact:true}).waitFor()
  await page.screenshot({path:"/tmp/bcc-theme-dark-workspace.png",fullPage:true})
  await page.getByRole("button", {name:"Location & geofencing",exact:true}).click()
  await page.getByRole("region", {name:"Geofence map",exact:true}).waitFor()
  await page.locator(".leaflet-container").waitFor()
  await page.getByRole("button",{name:"Fit all markers",exact:true}).click()
  await page.locator(".geofence-map .leaflet-interactive").last().click({force:true})
  await page.getByText("GPS accuracy: ±5 m",{exact:true}).waitFor()
  if (process.env.BCC_MAP_REAL_TILES === "1") await page.waitForFunction(()=>document.querySelectorAll(".leaflet-tile-loaded").length>0)
  await delay(300)
  await page.locator(".geofence-map-panel").screenshot({path:"/tmp/bcc-guard-map.png"})

  await page.getByRole('button',{name:'Overview',exact:true}).click()
  await page.getByRole('heading',{name:'Operations at a glance',exact:true}).waitFor()
  await page.getByText('Guards on duty now',{exact:true}).waitFor()
  const chart=page.getByLabel('Incident trend chart',{exact:true})
  await chart.waitFor()
  await chart.getByRole('button',{name:'30 days',exact:true}).click()
  assert.equal(await chart.locator('rect[role=button]').count(),30)
  await chart.getByRole('button',{name:'7 days',exact:true}).click()
  assert.equal(await chart.locator('rect[role=button]').count(),7)
  await chart.locator('rect[role=button]').first().focus()
  const selectedDay=await chart.locator('.incident-trend-detail strong').textContent()
  assert(selectedDay,"Keyboard focus selects a trend day")
  const before=await chart.locator('.incident-chart-flow').evaluate(e=>getComputedStyle(e).strokeDashoffset)
  await delay(160)
  const after=await chart.locator('.incident-chart-flow').evaluate(e=>getComputedStyle(e).strokeDashoffset)
  assert.notEqual(before,after,'Trend flow visibly animates')
  await chart.getByRole('button',{name:'Pause chart animation',exact:true}).click()
  assert.equal(await chart.locator('.incident-chart-flow').evaluate(e=>getComputedStyle(e).animationPlayState),'paused')
  await chart.getByRole('button',{name:'Play chart animation',exact:true}).click()

  await page.screenshot({path:'/tmp/bcc-overview-readable.png',fullPage:true})
  const overviewDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export overview PDF',exact:true}).click();assert.equal((await overviewDownload).suggestedFilename(),'overview.pdf')
  await page.getByRole('button',{name:'Reports',exact:true}).click()
  await page.getByLabel('Report',{exact:true}).selectOption('incidents')
  const pdfDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export PDF',exact:true}).click();const pdf=await pdfDownload;assert.equal(pdf.suggestedFilename(),'incidents.pdf');await pdf.saveAs('/tmp/bcc-browser-report.pdf')
  const csvDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();assert.equal((await csvDownload).suggestedFilename(),'incidents.csv')
  await page.getByLabel('From date',{exact:true}).fill('2026-10-27');await page.getByLabel('To date',{exact:true}).fill('2026-10-26')
  await page.getByRole('button',{name:'Export PDF',exact:true}).click();await page.getByRole('alert').filter({hasText:'From date must be before To date'}).waitFor()
  await page.getByLabel('From date',{exact:true}).fill('');await page.getByLabel('To date',{exact:true}).fill('')
  await page.screenshot({path:'/tmp/bcc-reports-readable.png',fullPage:true})
  await page.getByRole("button",{name:"Duty roster",exact:true}).click()

  // Exercise the actual roster form and persisted record, not just the API.
  await page.getByRole("button", { name: "Duty roster", exact: true }).click()
  await page.getByRole("button", { name: "+ Add record", exact: true }).click()
  await page.getByLabel("Site", { exact: true }).selectOption(site)
  await page
    .getByLabel("Person", { exact: true })
    .selectOption("20000000-0000-4000-8000-000000000002")
  await page
    .getByLabel("Title", { exact: true })
    .fill("Browser roster verification")
  await page.getByLabel("Duty post", { exact: true }).fill("North gate")
  await page
    .getByLabel("Start", { exact: true })
    .fill(new Date(Date.now() + 3600000).toISOString().slice(0, 16))
  await page
    .getByLabel("End", { exact: true })
    .fill(new Date(Date.now() + 7200000).toISOString().slice(0, 16))
  await page.getByRole("button", { name: "Save record", exact: true }).click()
  await page
    .getByRole("heading", { name: "Browser roster verification", exact: true })
    .waitFor()
  await page.screenshot({
    path: "/tmp/bcc-roster-verified.png",
    fullPage: true,
  })
  const offlineId="30000000-0000-4000-8000-000000000007"
  await db.query("INSERT INTO operational_records(id,kind,site_id,subject_id,created_by,data) VALUES($1,'offline_attendance',$2,$3,$3,$4)",[offlineId,site,"20000000-0000-4000-8000-000000000002",JSON.stringify({title:"Offline Time in",event:"in",status:"Pending review",captured_at:new Date().toISOString(),latitude:14.55,longitude:121.02,accuracy:5,review_notes:""})])
  await page.getByRole("button",{name:"Historical attendance reviews",exact:true}).click()
  await page.getByRole("heading",{name:"Offline Time in",exact:true}).waitFor()
  await page.getByLabel("Review notes for Demo guard",{exact:true}).fill("Evidence checked in isolated browser verification")
  await page.getByRole("button",{name:"Approve capture",exact:true}).click()
  await page.getByText("Approved",{exact:true}).waitFor()
  assert.equal((await db.query("SELECT data FROM operational_records WHERE id=$1",[offlineId])).rows[0].data.status,"Approved")
  await page.screenshot({path:"/tmp/bcc-offline-review-verified.png",fullPage:true})
  await page
    .getByRole("button", { name: "Incident Center", exact: true })
    .click()
  const auth = await fetch(api + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "guard@demo.invalid", password }),
  })
  const { token } = await auth.json()
  const f = new FormData()
  for (const [k, v] of Object.entries({
    title: "Browser verified incident",
    description: "Submitted through the Guard API flow",
    location: "Demo gate",
    site_id: site,
  }))
    f.append(k, v)
  const png = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "blue" },
  })
    .png()
    .toBuffer()
  f.append("photo", new Blob([png], { type: "image/png" }), "evidence.png")
  assert.equal(
    (
      await fetch(api + "/incidents", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: f,
      })
    ).status,
    201,
  )
  await page
    .getByRole("heading", { name: "Browser verified incident" })
    .waitFor()
  await page.getByLabel("Approval", { exact: true }).selectOption("Approved")
  await page.waitForFunction(
    () =>
      document.querySelector('select[aria-label="Approval"]')?.value ===
      "Approved",
  )
  await page.getByLabel("Status", { exact: true }).selectOption("Resolved")
  await page.waitForFunction(
    () => document.querySelector(".incident-status")?.textContent === "Resolved",
  )
  const guardReports = await (
    await fetch(api + "/incidents", {
      headers: { Authorization: "Bearer " + token },
    })
  ).json()
  assert.equal(guardReports[0].status, "Resolved")
  await page.locator('.incident-center-heading .incident-icon').waitFor()
  assert.equal(await page.locator('.incident-case-actions .incident-icon').count()>0,true,'Incident actions use SVG icons')
  await page.screenshot({path:'/tmp/bcc-incident-icons.png',fullPage:true})
  await page.getByRole("button", { name: "Audit trail", exact: true }).click()
  await page.getByRole("heading", { name: "Report audit trail" }).waitFor()
  await page.getByRole("button", { name: "View photo", exact: true }).click()
  await page.getByAltText("Incident evidence").waitFor()
  await page.screenshot({ path: "/tmp/bcc-web-verified.png", fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  )
  // Hold an authenticated response until after a different account signs in.
  await page.getByRole("button", { name: "Close audit", exact: true }).click()
  await page.getByRole("button", { name: "Close photo", exact: true }).click()
  let releaseAudit, notifyAudit, finishAudit
  const gate = new Promise((r) => (releaseAudit = r)),
    started = new Promise((r) => (notifyAudit = r)),
    finished = new Promise((r) => (finishAudit = r))
  await page.route("**/incidents/*/audit", async (route) => {
    const response = await route.fetch()
    notifyAudit()
    await gate
    await route.fulfill({ response })
    finishAudit()
  })
  await page.getByRole("button", { name: "Audit trail", exact: true }).click()
  await started
  await page.getByRole("button", { name: "Sign out", exact: true }).click()
  await page.getByLabel("Email", { exact: true }).waitFor()
  await page
    .getByLabel("Email", { exact: true })
    .fill("supervisor@demo.invalid")
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.getByRole("button", { name: "Sign out", exact: true }).waitFor()
  releaseAudit()
  await finished
  await page.unroute("**/incidents/*/audit")
  await delay(100)
  assert.equal(
    await page.getByRole("heading", { name: "Report audit trail" }).count(),
    0,
    "Late admin audit response must not enter the supervisor session",
  )
  assert.equal(
    await page.locator("article").count(),
    0,
    "Supervisor with no assigned sites must not see previous Admin reports",
  )
  // Simulate expired server session; no stale state should survive a subsequent login.
  await page.route("**/incidents", (route) =>
    route.fulfill({ status: 401, json: { error: "Session expired" } }),
  )
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await page.getByLabel("Email", { exact: true }).waitFor()
  await page.unroute("**/incidents")
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.getByRole("button", { name: "Sign out", exact: true }).waitFor()
  assert.equal(await page.locator("article").count(), 0)
  assert.equal(
    await page.getByRole("heading", { name: "Report audit trail" }).count(),
    0,
  )
  await page.getByRole("button", { name: "Sign out", exact: true }).click()
  await page.getByLabel("Email", { exact: true }).waitFor()
  await page.getByLabel("Email", { exact: true }).fill("admin@demo.invalid")
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page
    .getByRole("button", { name: "Sites & geofences", exact: true })
    .click()
  await page.getByRole("button", { name: "+ Add site", exact: true }).click()
  await page.getByLabel("Name", { exact: true }).fill("Browser configured site")
  await page.getByLabel("Client name", { exact: true }).fill("Fictional client")
  await page.getByLabel("Latitude", { exact: true }).fill("14.55")
  await page.getByLabel("Longitude", { exact: true }).fill("121.02")
  await page.context().grantPermissions(["geolocation"])
  await page.context().setGeolocation({latitude:14.5501,longitude:121.0201,accuracy:5})
  await page.getByRole("button",{name:"Use current device location (on-site)",exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('input[type="number"][value="14.5501"]'))

  await page.locator(".geofence-map .leaflet-interactive").first().waitFor()
  await page.locator(".geofence-map-panel").screenshot({path:"/tmp/bcc-geofence-map.png"})

  await page.getByRole("button", { name: "Save site", exact: true }).click()
  await page
    .getByRole("heading", { name: "Browser configured site", exact: true })
    .waitFor()
  assert.equal(
    await page
      .getByRole("button", { name: "Incident Center", exact: true })
      .count(),
    0,
  )
  assert(
    await page
      .locator(".ops-main")
      .evaluate((e) => e.getBoundingClientRect().left >= 0),
    "Mobile workspace must not be clipped on the left",
  )
  await page.getByRole("button", { name: "Workflow & SLA", exact: true }).click()
  await page.getByRole("heading", { name: "Resolution SLA", exact: true }).waitFor()
  for (const theme of ["dark", "light"]) {
    if (await page.evaluate(() => document.documentElement.dataset.bccTheme) !== theme)
      await page.getByRole("switch", { name: "Dark mode", exact: true }).click()
    const ratio = await page.locator(".ops-panel").first().evaluate(panel => {
      const luminance = color => {
        const rgb = color.match(/[\d.]+/g).slice(0,3).map(v => { const n=Number(v)/255; return n<=.04045?n/12.92:((n+.055)/1.055)**2.4 })
        return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722
      }
      const bg=luminance(getComputedStyle(panel).backgroundColor)
      return Math.min(...[...panel.querySelectorAll("h3,label")].map(e => {
        const fg=luminance(getComputedStyle(e).color)
        return (Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)
      }))
    })
    assert(ratio>=4.5, `${theme} workflow labels need readable contrast: ${ratio}`)
    await page.screenshot({ path: `/tmp/bcc-workflow-${theme}.png`, fullPage: true })
  }
  await page.screenshot({ path: "/tmp/bcc-admin-verified.png", fullPage: true })
  await page.getByRole("button", { name: "Sign out", exact: true }).click()
  await page.getByLabel("Email", { exact: true }).waitFor()
  assert.equal(await page.getByText(/sample data|simulated login|pending backend setup/i).count(),0)
  // Isolate the Guard journey from the earlier bulk multi-role fixture traffic.
  for(const layer of fixtureApp.router.stack)if(typeof layer.handle.resetKey==='function')await layer.handle.resetKey('127.0.0.1')
  await db.query("INSERT INTO operational_records(id,kind,site_id,subject_id,created_by,data) VALUES($1,'shifts',$2,$3,$3,$4)",["30000000-0000-4000-8000-000000000009",site,"20000000-0000-4000-8000-000000000002",JSON.stringify({title:"Current gate duty",post:"Gate 1",status:"Scheduled",start:new Date(Date.now()-60000).toISOString(),end:new Date(Date.now()+1800000).toISOString()})])
  await page.context().grantPermissions(["geolocation","camera"])
  await page.context().setGeolocation({latitude:14.55,longitude:121.02,accuracy:500})
  await page.goto("http://127.0.0.1:9843/guard")
  await page.getByLabel("Email address",{exact:true}).fill("guard@demo.invalid")
  await page.getByLabel("Password",{exact:true}).fill(password)
  await page.getByRole("button",{name:"Sign In Securely",exact:true}).click()
  await page.getByRole("button",{name:"Check GPS",exact:true}).click()
  await page.getByRole("alert").filter({hasText:"GPS accuracy is too low"}).waitFor()
  await page.context().setGeolocation({latitude:14.55,longitude:121.02,accuracy:5})
  await page.getByRole("button",{name:"Check GPS",exact:true}).click()
  await page.getByRole("status").filter({hasText:"GPS ready"}).waitFor()
  assert((await page.getByLabel("Geofence status",{exact:true}).textContent()).includes("Inside"))
  await page.context().setGeolocation({latitude:14.56,longitude:121.02,accuracy:5})
  await page.getByRole("button",{name:"Check GPS",exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('[aria-label="Geofence status"]')?.textContent.includes('Outside'))
  await page.context().setGeolocation({latitude:14.55,longitude:121.02,accuracy:5})
  await page.getByRole("button",{name:"Check GPS",exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('[aria-label="Geofence status"]')?.textContent.includes('Inside'))
  await page.locator('.guard-geofence-status').screenshot({path:"/tmp/bcc-guard-geofence-status.png"})


  const duty = page.locator("article.guard-card").filter({hasText:"Current gate duty"})
  await duty.getByRole("button",{name:"Open camera",exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2)
  await page.evaluate(()=>{window.__attendanceTestStream=document.querySelector('video').srcObject})
  await page.getByRole("dialog",{name:"Attendance camera",exact:true}).screenshot({path:"/tmp/bcc-live-camera.png"})
  await page.getByRole("button",{name:"Capture photo",exact:true}).click()
  await page.getByRole("img",{name:"Captured attendance photo preview",exact:true}).waitFor()
  await page.getByRole("button",{name:"Retake photo",exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2)
  await page.getByRole("button",{name:"Capture photo",exact:true}).click()
  await page.getByRole("button",{name:"Use photo",exact:true}).click()
  assert(await page.evaluate(()=>window.__attendanceTestStream.getTracks().every(track=>track.readyState==='ended')), "Camera tracks stop after capture/close")
  await duty.getByRole("img",{name:"Attendance photo ready to submit",exact:true}).waitFor()
  await duty.getByRole("button",{name:"Time In with GPS",exact:true}).click()
  await duty.getByRole("button",{name:"Time Out with GPS",exact:true}).waitFor()
  await duty.getByRole("button",{name:"Open camera",exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2)
  await page.getByRole("button",{name:"Capture photo",exact:true}).click()
  await page.getByRole("button",{name:"Use photo",exact:true}).click()
  await duty.getByRole("button",{name:"Time Out with GPS",exact:true}).click()
  await page.getByText("Check-out recorded successfully.",{exact:true}).waitFor()
  await duty.getByRole("button",{name:"Time In with GPS",exact:true}).waitFor()
  assert.equal(await duty.getByRole("button",{name:"Time In with GPS",exact:true}).isEnabled(),true,"Next action returns to Time In after checkout")
  await page.getByRole("button",{name:"Send Current Location",exact:true}).click()
  await page.getByText("Location recorded. Geofence: Inside",{exact:true}).waitFor()
  assert.equal((await db.query("SELECT id FROM operational_records WHERE kind IN ('attendance','attendance_punch') AND data->>'shift_id'=$1",["30000000-0000-4000-8000-000000000009"])).rows.length,2)
  await page.getByRole("button",{name:"View attendance photo",exact:true}).first().click()
  await page.getByRole("img",{name:"Attendance evidence with server timestamp and GPS"}).waitFor()
  await page.waitForFunction(()=>{const image=document.querySelector('.attendance-photo-dialog img');return image && image.complete && image.naturalWidth>0})
  await page.getByRole("img",{name:"Attendance evidence with server timestamp and GPS"}).screenshot({path:"/tmp/bcc-stamped-attendance.png"})
  await page.getByRole("button",{name:"Close attendance photo",exact:true}).click()
  const billingAuth=await (await fetch(api+"/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"operations@demo.invalid",password})})).json()
  const billingResponse=await fetch(api+"/reports/export?kind=billing",{headers:{Authorization:"Bearer "+billingAuth.token}})
  assert.equal(billingResponse.status,200)
  assert((await billingResponse.text()).includes("Recorded hours - review required"))
  await page.screenshot({path:"/tmp/bcc-guard-attendance-web.png",fullPage:true})
  // Browser Guard module parity and durable offline captures use the actual UI + IndexedDB.
  const guardId="20000000-0000-4000-8000-000000000002",assetId="30000000-0000-4000-8000-000000000020",issueId="30000000-0000-4000-8000-000000000021"
  for(const [id,kind,data] of [[assetId,'equipment',{title:'Browser radio',serial:'BROWSER-RADIO',category:'Radio',status:'In Service',acquired_at:new Date().toISOString(),notes:''}],[issueId,'assignments',{equipment_id:assetId,issued_at:new Date().toISOString(),returned_at:null,condition:'Working',acknowledged:false}],["30000000-0000-4000-8000-000000000022",'certifications',{title:'Browser guard licence',number:'BROWSER-LICENCE',expires_at:new Date(Date.now()+10*86400000).toISOString(),notes:'Test certificate'}]])await db.query('INSERT INTO operational_records(id,kind,site_id,subject_id,created_by,data) VALUES($1,$2,$3,$4,$4,$5)',[id,kind,site,guardId,JSON.stringify(data)])
  await page.getByRole('button',{name:'My Records',exact:true}).click()
  await page.getByText('Browser radio',{exact:true}).first().waitFor()
  await page.getByRole('button',{name:'Acknowledge receipt',exact:true}).click()
  await page.getByText('Receipt acknowledged',{exact:false}).waitFor()
  assert.equal((await db.query('SELECT data FROM operational_records WHERE id=$1',[issueId])).rows[0].data.acknowledged,true)
  await page.getByLabel('Assigned equipment',{exact:true}).selectOption(assetId)
  await page.getByLabel('Fault',{exact:true}).fill('Browser battery fault')
  await page.getByLabel('Details',{exact:true}).fill('Battery failed during browser acceptance test')
  await page.getByRole('button',{name:'Submit fault report',exact:true}).click()
  await page.getByRole('status').filter({hasText:'Saved'}).waitFor()
  assert.equal((await db.query("SELECT id FROM operational_records WHERE kind='defects' AND data->>'title'='Browser battery fault'")).rows.length,1)
  await page.getByRole('tab',{name:'Training & licenses',exact:true}).click()
  await page.getByText('Browser guard licence',{exact:true}).waitFor()
  await page.getByRole('tab',{name:'Notifications',exact:true}).click()
  await page.getByRole('button',{name:'Mark as read',exact:true}).first().click()
  await page.getByText('Read',{exact:true}).first().waitFor()
  await page.getByRole('button',{name:'Profile',exact:true}).click()
  await page.getByText('Guard ID: '+guardId,{exact:true}).waitFor()
  await page.getByRole('button',{name:'New Report',exact:true}).click()
  await page.getByLabel('Incident title',{exact:true}).fill('Online browser incident')
  await page.getByLabel('Description',{exact:true}).fill('Submitted live to Operations with severity and photo')
  await page.getByLabel('Location / post',{exact:true}).fill('Browser gate')
  await page.getByLabel('Severity',{exact:true}).selectOption('High')
  await page.getByLabel(/Evidence photo/).setInputFiles({name:'incident.png',mimeType:'image/png',buffer:png})
  await page.getByRole('button',{name:'Submit Incident Report',exact:true}).click()
  await page.getByText('Online browser incident',{exact:true}).waitFor()
  const synced=(await db.query("SELECT severity FROM incidents WHERE title='Online browser incident'")).rows;assert.equal(synced.length,1);assert.equal(synced[0].severity,'High')
  await page.getByRole('button',{name:'Duty',exact:true}).click()
  const onlineDuty=page.locator('article.guard-card').filter({hasText:'Current gate duty'})
  await onlineDuty.getByRole('button',{name:'Open camera',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2)
  await page.getByRole('button',{name:'Capture photo',exact:true}).click()
  await page.getByRole('button',{name:'Use photo',exact:true}).click()
  await page.route(api+'/attendance',route=>route.abort())
  await onlineDuty.getByRole('button',{name:'Time In with GPS',exact:true}).click()
  await page.getByRole('alert').filter({hasText:'Internet connection required'}).waitFor()
  assert.equal((await db.query("SELECT id FROM operational_records WHERE kind='attendance_punch'")).rows.length,2,'Network failure never creates an offline or confirmed punch')
  assert.equal(await page.getByRole('button',{name:/offline|sync/i}).count(),0,'No offline controls in Guard portal')
  await page.unroute(api+'/attendance')
  await onlineDuty.getByRole('button',{name:'Time In with GPS',exact:true}).click()
  await onlineDuty.getByRole('button',{name:'Time Out with GPS',exact:true}).waitFor().catch(async error=>{console.error('Guard attendance error:',await page.getByRole('alert').allTextContents());throw error})
  const liveAttendance=await (await fetch(api+'/operations/attendance',{headers:{Authorization:'Bearer '+billingAuth.token}})).json()
  assert.equal(liveAttendance.length,3,'Operations sees the online camera/GPS attendance')
  assert(liveAttendance.every(r=>r.data.photo_id&&r.data.latitude===14.55&&r.data.longitude===121.02))
  await page.setViewportSize({width:390,height:844})
  await page.getByRole('button',{name:'My Records',exact:true}).click()
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Guard modules fit a mobile screen')
  await page.screenshot({path:'/tmp/bcc-guard-records-verified.png',fullPage:true})
  assert.deepEqual(unexpectedResponses,[],"No rate-limit or server errors during browser journeys")
  assert.deepEqual(errors, [])
  console.log(
    "PASS: light/dark switching, persisted preference and session preservation; roster create/persist UI, admin site/geofence UI and technical-role isolation; browser login → mobile-style submit → realtime web render → web status update → guard read; audit/photo UI; responsive width; sign-out; late-response isolation; session expiry; production login without demo banners.",
  )
} finally {
  await browser?.close()
  vite?.kill("SIGTERM")
  await new Promise((r) => io.close(r))
  await db.close()
  await rm(dir, { recursive: true, force: true })
}
