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
await db.exec(await readFile(new URL("../migrations/002_four_roles.sql", import.meta.url), "utf8"))
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
  for (const [n, role] of ["operations", "guard", "supervisor"].entries()) {
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
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto("http://127.0.0.1:9843")
  await page.getByLabel("Email", { exact: true }).fill("operations@demo.invalid")
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.getByRole("button", { name: "Sign out", exact: true }).waitFor()
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
  await page
    .getByRole("button", {
      name: "View preserved prototype (sample data only)",
    })
    .click()
  await page
    .getByRole("button", { name: "Open connected incident platform" })
    .waitFor()
  assert.deepEqual(errors, [])
  console.log(
    "PASS: browser login → mobile-style submit → realtime web render → web status update → guard read; audit/photo UI; responsive width; sign-out; late-response isolation; session expiry; preserved prototype switch.",
  )
} finally {
  await browser?.close()
  vite?.kill("SIGTERM")
  await new Promise((r) => io.close(r))
  await db.close()
  await rm(dir, { recursive: true, force: true })
}
