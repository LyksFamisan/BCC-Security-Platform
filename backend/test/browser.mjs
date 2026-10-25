// Run with the Vite dev server already on 127.0.0.1:8443.
import {PGlite} from '@electric-sql/pglite';
import {chromium} from '../../web/node_modules/playwright/index.mjs';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {createService} from '../src/service.js';
const db=new PGlite();await db.exec(await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));
const pool={query:(q,a)=>db.query(q,a),connect:async()=>({query:(q,a)=>db.query(q,a),release(){}})};
const dir=await mkdtemp(path.join(os.tmpdir(),'bcc-browser-'));process.env.UPLOAD_DIR=dir;process.env.WEB_ORIGINS='http://127.0.0.1:8443';
const {server,io}=createService(pool,'browser-test-only-not-production-secret-1234');await new Promise(r=>server.listen(3001,'127.0.0.1',r));
let browser;
try {
 const site='10000000-0000-4000-8000-000000000001',password='browser-test-only';
 await db.query('INSERT INTO sites VALUES($1,$2)',[site,'Demo site']);
 for(const [n,role]of ['admin','guard'].entries()){const id=`20000000-0000-4000-8000-00000000000${n+1}`;await db.query('INSERT INTO users VALUES($1,$2,$3,$4,$5)',[id,'Demo '+role,role+'@demo.invalid',await bcrypt.hash(password,4),role]);await db.query('INSERT INTO user_sites VALUES($1,$2)',[id,site]);}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8443');await page.getByLabel('Email',{exact:true}).fill('admin@demo.invalid');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
 const auth=await fetch('http://127.0.0.1:3001/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'guard@demo.invalid',password})});const {token}=await auth.json();
 const f=new FormData();for(const [k,v]of Object.entries({title:'Browser verified incident',description:'Submitted through the Guard API flow',location:'Demo gate',site_id:site}))f.append(k,v);const png=await sharp({create:{width:8,height:8,channels:3,background:'blue'}}).png().toBuffer();f.append('photo',new Blob([png],{type:'image/png'}),'evidence.png');
 assert.equal((await fetch('http://127.0.0.1:3001/incidents',{method:'POST',headers:{Authorization:'Bearer '+token},body:f})).status,201);
 await page.getByRole('heading',{name:'Browser verified incident'}).waitFor();await page.getByLabel('Status',{exact:true}).selectOption('Resolved');
 await page.waitForFunction(()=>document.querySelector('article strong')?.textContent==='Resolved');
 const guardReports=await(await fetch('http://127.0.0.1:3001/incidents',{headers:{Authorization:'Bearer '+token}})).json();assert.equal(guardReports[0].status,'Resolved');
 await page.getByRole('button',{name:'Audit trail',exact:true}).click();await page.getByRole('heading',{name:'Report audit trail'}).waitFor();await page.getByRole('button',{name:'View photo',exact:true}).click();await page.getByAltText('Incident evidence').waitFor();
 await page.screenshot({path:'/tmp/bcc-web-verified.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByLabel('Email',{exact:true}).waitFor();
 await page.getByRole('button',{name:'View preserved prototype (sample data only)'}).click();await page.getByRole('button',{name:'Open connected incident platform'}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: browser login → mobile-style submit → realtime web render → web status update → guard read; audit/photo UI; responsive width; sign-out; preserved prototype switch.');
}finally{await browser?.close();await new Promise(r=>io.close(r));await db.close();await rm(dir,{recursive:true,force:true});}
