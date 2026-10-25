import {test} from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import {readFile,readdir} from 'node:fs/promises'
import {buildDemoFixtures,demoId} from '../scripts/demo-fixtures.js'
import {resources} from '../src/operations.js'
test('DEMO fixtures cover every operational module and are additive and idempotent',async()=>{
 const db=new PGlite()
 try{
  for(const f of (await readdir(new URL('../migrations/',import.meta.url))).sort())await db.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'))
  const users=['operations','supervisor','guard','guard'].map((role,i)=>({id:demoId('test-user-'+i),role}))
  for(const [i,user] of users.entries())await db.query('INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)',[user.id,'Test '+i,'fixture'+i+'@example.invalid','test-not-a-password',user.role])
  const originalSite=demoId('existing-real-site');await db.query('INSERT INTO sites VALUES($1,$2)',[originalSite,'Original site'])
  const plan=await buildDemoFixtures(users,new Date('2026-10-26T00:00:00Z'))
  for(const record of plan.records)if(resources[record.kind])assert(resources[record.kind].schema.safeParse(record.data).success,record.kind+' data conforms to API schema')
  for(let run=0;run<2;run++){await db.exec('BEGIN');for(const sql of plan.sql)await db.exec(sql);await db.exec('COMMIT')}
  const counts=(await db.query('SELECT kind,count(*)::int AS n FROM operational_records GROUP BY kind')).rows
  for(const kind of Object.keys(resources).concat(['attendance_punch','gps']))assert(counts.some(r=>r.kind===kind && r.n>0),'Populated '+kind)
  assert.equal((await db.query('SELECT id FROM incidents')).rows.length,8)
  assert.equal((await db.query('SELECT id FROM operational_records')).rows.length,plan.records.length)
  assert.equal((await db.query('SELECT key FROM private_files')).rows.length,3)
  assert.equal((await db.query('SELECT name FROM sites WHERE id=$1',[originalSite])).rows[0].name,'Original site')
  assert.equal((await db.query('SELECT id FROM users')).rows.length,4,'No credentials/accounts were created or overwritten')
 }finally{await db.close()}
})
