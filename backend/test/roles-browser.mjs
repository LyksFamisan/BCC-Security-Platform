// Run against a built sample-data frontend, e.g. npm --prefix web run preview -- --port 9444.
import { chromium } from '../../web/node_modules/playwright/index.mjs'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
let preview
if (!process.env.ROLE_DEMO_URL) {
 preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','9444','--strictPort'], {cwd:fileURLToPath(new URL('../../web/',import.meta.url)),stdio:'ignore'})
 for(let n=0;n<50;n++) {try {if((await fetch('http://127.0.0.1:9444')).ok) break} catch {} await delay(100)}
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] })
const errors = []
try {
 for (const [name,email,navCount] of [
  ['Security Personnel (Guards)','security@gmail.com',1],
  ['Supervisor / Site In-Charge','supervisor@demo.invalid',4],
  ['Operations Management (SSD)','ar@gmail.com',5],
  ['System Administrator','bcc@gmail.com',1],
 ]) {
  const page = await browser.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(process.env.ROLE_DEMO_URL || 'http://127.0.0.1:9444')
  await page.getByRole('button',{name:'Access Portal',exact:true}).click()
  assert.equal(await page.locator('.portal-card').count(),4)
  await page.locator('.portal-card').filter({hasText:name}).click()
  await page.getByLabel('Email / Employee ID').fill(email)
  await page.getByLabel('Password',{exact:true}).fill('demo-only')
  await page.getByRole('button',{name:'Sign In',exact:true}).click()
  await page.locator('.app-sidebar').waitFor()
  assert.equal(await page.locator('nav button').count(),navCount)
  if (email === 'bcc@gmail.com') {
   assert.equal(await page.locator('nav').getByText('Incident Resolution').count(),0)
   assert.equal(await page.getByText('Connected Portal Activity',{exact:true}).count(),0)
   await page.getByRole('button',{name:'Roles & Permissions',exact:true}).click()
   assert.equal(await page.locator('table tbody tr').count(),52)
  }
  if (email.startsWith('supervisor')) {
   await page.getByRole('button',{name:'Manpower Deployment',exact:true}).click()
   assert.equal(await page.getByText('SG-00283',{exact:true}).count(),0)
   assert.equal(await page.getByText('SG-00147',{exact:true}).count(),1)
   await page.getByRole('button',{name:'Incident Resolution',exact:true}).click()
   assert.equal(await page.getByText('INC-2026-0846',{exact:true}).count(),0)
   assert.equal(await page.getByText('INC-2026-0847',{exact:true}).count(),1)
  }
  await page.close()
 }
 assert.deepEqual(errors,[])
 console.log('PASS: four portals, role-specific navigation, supervisor site records, admin separation, 52-feature matrix; no browser errors')
} finally { await browser.close(); preview?.kill() }
