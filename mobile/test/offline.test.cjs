const {test}=require('node:test')
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
function setup(files=new Map()){
 const native={documentDirectory:'private/',makeDirectoryAsync:async()=>{},getInfoAsync:async path=>({exists:files.has(path)}),readAsStringAsync:async path=>{if(!files.has(path))throw Error('Missing');return files.get(path)},writeAsStringAsync:async(path,value)=>files.set(path,value),copyAsync:async({from,to})=>files.set(to,files.get(from)||'photo'),deleteAsync:async path=>files.delete(path)}
 const source=ts.transpileModule(fs.readFileSync(require.resolve('../offlineStore.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,exports={}
 vm.runInNewContext(source,{exports,require:()=>native,Date,Error,Number,Math,JSON,Promise,encodeURIComponent,FormData})
 return {api:exports,files}
}
const user='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002'
test('offline queue persists photographs and metadata across restart and isolates accounts',async()=>{
 const {api,files}=setup(),id=api.captureId(),row={id,type:'incident',title:'Example',captured_at:new Date().toISOString(),photo:{uri:'temp.jpg',name:'evidence.jpg',type:'image/jpeg'}}
 await api.enqueue(user,row);assert(files.has('private/bcc-guard/'+user+'/'+id+'.jpg'))
 const restarted=setup(files).api;assert.equal((await restarted.pending(user)).length,1);assert.equal((await restarted.pending(other)).length,0)
 await restarted.markFailure(user,id,'No internet');assert.equal((await restarted.pending(user))[0].sync_error,'No internet')
 await restarted.removeCapture(user,id);assert.equal((await restarted.pending(user)).length,0);assert(!files.has('private/bcc-guard/'+user+'/'+id+'.jpg'))
})
test('parallel captures preserve both records and failed attempts retain their photos',async()=>{
 const {api,files}=setup();await Promise.all([1,2].map(n=>api.enqueue(user,{id:api.captureId(),type:'attendance',captured_at:new Date().toISOString(),event:n===1?'in':'out',photo:{uri:'camera.jpg',name:'a.jpg',type:'image/jpeg'}})))
 assert.equal((await api.pending(user)).length,2);assert.equal([...files.keys()].filter(k=>k.endsWith('.jpg')).length,2)
 await api.cacheWrite(user,'/sites',[{id:'site'}]);assert.equal((await api.cacheRead(user,'/sites')).value[0].id,'site');assert.equal(await api.cacheRead(other,'/sites'),null)
 await assert.rejects(api.pending('../../bad'),/Sign in/)
})
