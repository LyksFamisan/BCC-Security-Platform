import {test} from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import {readFile,readdir} from 'node:fs/promises'
import {fileStore} from '../src/file-store.js'
import {createHostedHandler} from '../src/hosted-handler.js'
import {createServer} from 'node:http'

test('hosted database storage persists private evidence and backup bytes; one-time activation locks after first admin',async()=>{
 const db=new PGlite();for(const f of(await readdir(new URL('../migrations/',import.meta.url))).sort())await db.exec(await readFile(new URL('../migrations/'+f,import.meta.url),'utf8'))
 const pool={query:(q,a)=>db.query(q,a),connect:async()=>({query:(q,a)=>db.query(q,a),release(){}})};process.env.FILE_STORAGE='postgres';process.env.SETUP_TOKEN='test-only-activation-token-1234567890'
 const key='evidence/10000000-0000-4000-8000-000000000001.jpg',store=fileStore(pool)
 await store.write(key,Buffer.from('fictional encrypted evidence'));assert.equal((await fileStore(pool).read(key)).toString(),'fictional encrypted evidence');await assert.rejects(()=>store.read('../private'),/Invalid/);await store.remove(key);await assert.rejects(()=>store.read(key),e=>e.code==='ENOENT')
 const backup='backups/10000000-0000-4000-8000-000000000002.bccbackup';await store.write(backup,Buffer.from('encrypted snapshot'));assert.equal((await store.listBackups())[0].id,'10000000-0000-4000-8000-000000000002')
 const server=createServer(createHostedHandler(pool,'test-only-secret-of-at-least-32-characters'));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/api'
 try{const body={token:'test-only-activation-token-1234567890',name:'Test Administrator',email:'test@demo.invalid',password:'test-only-password-12345'},post=(path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 assert.equal((await post('/auth/setup',{...body,token:'incorrect-token-but-at-least-32-characters'})).status,403);assert.equal((await post('/auth/setup',body)).status,201);assert.equal((await post('/auth/setup',body)).status,409);const login=await post('/auth/login',{email:body.email,password:body.password});assert.equal(login.status,200);const session=await login.json();assert.equal(session.user.role,'admin');const storage=(await db.query('SELECT * FROM private_files')).rows;assert.equal(storage.length,1)
 }finally{await new Promise(r=>server.close(r));await db.close();delete process.env.FILE_STORAGE;delete process.env.SETUP_TOKEN}
})
