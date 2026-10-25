const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const ts=require('typescript')
function setup(overrides={}) {
  let callback, timeout, removed=0
  const location={Accuracy:{High:4},hasServicesEnabledAsync:async()=>true,requestForegroundPermissionsAsync:async()=>({granted:true,canAskAgain:true}),watchPositionAsync:async(_,cb)=>{callback=cb;return{remove:()=>removed++}},...overrides}
  const source=ts.transpileModule(fs.readFileSync(require.resolve('../gps.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
  const exports={}
  vm.runInNewContext(source,{exports,require:name=>name==='expo-location'?location:{Platform:{OS:'android'}},setTimeout:cb=>{timeout=cb;return 1},clearTimeout:()=>{},Date,Error,Number,Math})
  return {geofence:exports.geofenceStatus,next:exports.nextAttendanceEvent,get:exports.getDutyPosition,emit:fix=>callback(fix),expire:()=>timeout(),removed:()=>removed}
}
const flush=()=>new Promise(r=>setImmediate(r))
const fix=(accuracy=5)=>({timestamp:Date.now(),coords:{latitude:14.55,longitude:121.02,accuracy}})
test('fresh accurate fix resolves and stops the foreground watcher',async()=>{const t=setup(),p=t.get();await flush();t.emit(fix());assert.equal((await p).accuracy,5);assert.equal(t.removed(),1)})
test('disabled GPS and blocked permission provide actionable errors',async()=>{await assert.rejects(setup({hasServicesEnabledAsync:async()=>false}).get(),/Location is off/);await assert.rejects(setup({requestForegroundPermissionsAsync:async()=>({granted:false,canAskAgain:false})}).get(),/Settings/)})
test('stale and low accuracy samples wait for a precise fix',async()=>{const t=setup(),p=t.get();await flush();t.emit({...fix(),timestamp:Date.now()-60000});t.emit(fix(500));assert.equal(t.removed(),0);t.emit(fix(8));assert.equal((await p).accuracy,8)})
test('timeout rejects and removes the watcher',async()=>{const t=setup(),p=t.get();await flush();t.emit(fix(500));t.expire();await assert.rejects(p,/accuracy is ±500/);assert.equal(t.removed(),1)})
test('Android mock GPS is refused',async()=>{const t=setup(),p=t.get();await flush();t.emit({...fix(),mocked:true});await assert.rejects(p,/Mock location/);assert.equal(t.removed(),1)})

test('geofencing identifies inside outside uncertain and missing boundaries',()=>{const t=setup(),site={latitude:14.55,longitude:121.02,radius_m:300};assert.equal(t.geofence(fix().coords,site).status,'Inside');assert.equal(t.geofence({...fix().coords,latitude:14.56},site).status,'Outside');assert.equal(t.geofence(fix(500).coords,site).status,'Uncertain');assert.equal(t.geofence(fix().coords,{}).status,'Not configured')})
test('mobile next action alternates across repeated cycles and legacy history',()=>{const t=setup(),rows=[];assert.equal(t.next(rows,'s'),'in');rows.push({data:{shift_id:'s',event:'in'}});assert.equal(t.next(rows,'s'),'out');rows.push({data:{shift_id:'s',event:'out'}});assert.equal(t.next(rows,'s'),'in');rows.push({data:{shift_id:'s',cycle:2,event:'in'}});assert.equal(t.next(rows,'s'),'out');rows.push({data:{shift_id:'s',cycle:2,event:'out'}});assert.equal(t.next(rows,'s'),'in')})
