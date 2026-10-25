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
const pool = {
  query: (q, a) => db.query(q, a),
  connect: async () => ({ query: (q, a) => db.query(q, a), release() {} }),
}
const dir = await mkdtemp(path.join(os.tmpdir(), "bcc-browser-"))
process.env.UPLOAD_DIR = dir
process.env.WEB_ORIGINS = "http://127.0.0.1:9843"
const { server, io } = createService(
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
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
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
  await page.screenshot({path:"/tmp/bcc-theme-dark-login.png",fullPage:true})
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
  await page
    .getByRole("button", { name: "Incident center ↗", exact: true })
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
    () => document.querySelector("article strong")?.textContent === "Resolved",
  )
  const guardReports = await (
    await fetch(api + "/incidents", {
      headers: { Authorization: "Bearer " + token },
    })
  ).json()
  assert.equal(guardReports[0].status, "Resolved")
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
  await page.locator(".geofence-map .leaflet-interactive").first().waitFor()
  await page.locator(".geofence-map-panel").screenshot({path:"/tmp/bcc-geofence-map.png"})

  await page.getByRole("button", { name: "Save site", exact: true }).click()
  await page
    .getByRole("heading", { name: "Browser configured site", exact: true })
    .waitFor()
  assert.equal(
    await page
      .getByRole("button", { name: "Incident center ↗", exact: true })
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
  await db.query("INSERT INTO operational_records(id,kind,site_id,subject_id,created_by,data) VALUES($1,'shifts',$2,$3,$3,$4)",["30000000-0000-4000-8000-000000000009",site,"20000000-0000-4000-8000-000000000002",JSON.stringify({title:"Current gate duty",post:"Gate 1",status:"Scheduled",start:new Date(Date.now()-60000).toISOString(),end:new Date(Date.now()+1800000).toISOString()})])
  await page.context().grantPermissions(["geolocation"])
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
  const duty = page.locator("article.guard-card").filter({hasText:"Current gate duty"})
  await duty.getByRole("button",{name:"Time In with GPS",exact:true}).click()
  await duty.getByRole("button",{name:"Time Out with GPS",exact:true}).waitFor()
  await duty.getByRole("button",{name:"Time Out with GPS",exact:true}).click()
  await page.getByText("Check-out recorded successfully.",{exact:true}).waitFor()
  await page.getByRole("button",{name:"Send Current Location",exact:true}).click()
  await page.getByText("Location recorded. Geofence: Inside",{exact:true}).waitFor()
  assert.equal((await db.query("SELECT id FROM operational_records WHERE kind='attendance' AND data->>'shift_id'=$1",["30000000-0000-4000-8000-000000000009"])).rows.length,2)
  await page.screenshot({path:"/tmp/bcc-guard-attendance-web.png",fullPage:true})
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
