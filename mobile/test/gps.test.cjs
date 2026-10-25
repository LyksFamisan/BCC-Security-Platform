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
  return {get:exports.getDutyPosition,emit:fix=>callback(fix),expire:()=>timeout(),removed:()=>removed}
}
const flush=()=>new Promise(r=>setImmediate(r))
const fix=(accuracy=5)=>({timestamp:Date.now(),coords:{latitude:14.55,longitude:121.02,accuracy}})
test('fresh accurate fix resolves and stops the foreground watcher',async()=>{const t=setup(),p=t.get();await flush();t.emit(fix());assert.equal((await p).accuracy,5);assert.equal(t.removed(),1)})
test('disabled GPS and blocked permission provide actionable errors',async()=>{await assert.rejects(setup({hasServicesEnabledAsync:async()=>false}).get(),/Location is off/);await assert.rejects(setup({requestForegroundPermissionsAsync:async()=>({granted:false,canAskAgain:false})}).get(),/Settings/)})
test('stale and low accuracy samples wait for a precise fix',async()=>{const t=setup(),p=t.get();await flush();t.emit({...fix(),timestamp:Date.now()-60000});t.emit(fix(500));assert.equal(t.removed(),0);t.emit(fix(8));assert.equal((await p).accuracy,8)})
test('timeout rejects and removes the watcher',async()=>{const t=setup(),p=t.get();await flush();t.emit(fix(500));t.expire();await assert.rejects(p,/accuracy is ±500/);assert.equal(t.removed(),1)})
test('Android mock GPS is refused',async()=>{const t=setup(),p=t.get();await flush();t.emit({...fix(),mocked:true});await assert.rejects(p,/Mock location/);assert.equal(t.removed(),1)})
