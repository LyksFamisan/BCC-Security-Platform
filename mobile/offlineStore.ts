import * as FS from 'expo-file-system/legacy'
export type Capture={id:string;type:'incident'|'attendance';captured_at:string;photo:{uri:string;name:string;type:string};[key:string]:any}
const folder=(user:string)=>{if(!/^[a-f0-9-]{36}$/i.test(user))throw Error('Sign in before saving records');return FS.documentDirectory+'bcc-guard/'+user+'/'}
export const captureId=()=> 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return (c==='x'?r:(r&3)|8).toString(16)})
let work=Promise.resolve()
function lock<T>(fn:()=>Promise<T>):Promise<T>{const next=work.then(fn,fn);work=next.then(()=>{},()=>{});return next}
async function read(user:string):Promise<Capture[]>{const path=folder(user)+'queue.json';if(!(await FS.getInfoAsync(path)).exists)return [];return JSON.parse(await FS.readAsStringAsync(path))}
async function write(user:string,rows:Capture[]){const dir=folder(user);await FS.makeDirectoryAsync(dir,{intermediates:true});await FS.writeAsStringAsync(dir+'queue.json',JSON.stringify(rows))}
export const pending=(user:string)=>lock(()=>read(user))
export const enqueue=(user:string,capture:Capture)=>lock(async()=>{const dir=folder(user);await FS.makeDirectoryAsync(dir,{intermediates:true});const uri=dir+capture.id+'.jpg';await FS.copyAsync({from:capture.photo.uri,to:uri});const row={...capture,photo:{...capture.photo,uri}};const rows=await read(user);await write(user,[...rows.filter(r=>r.id!==row.id),row]);return row})
export const removeCapture=(user:string,id:string)=>lock(async()=>{const rows=await read(user);const row=rows.find(r=>r.id===id);await write(user,rows.filter(r=>r.id!==id));if(row)await FS.deleteAsync(row.photo.uri,{idempotent:true})})
export const markFailure=(user:string,id:string,error:string)=>lock(async()=>{const rows=await read(user);await write(user,rows.map(r=>r.id===id?{...r,sync_error:error}:r))})
export async function cacheWrite(user:string,route:string,value:any){const dir=folder(user);await FS.makeDirectoryAsync(dir,{intermediates:true});await FS.writeAsStringAsync(dir+'cache-'+encodeURIComponent(route)+'.json',JSON.stringify({saved_at:new Date().toISOString(),value}))}
export async function cacheRead(user:string,route:string){try{return JSON.parse(await FS.readAsStringAsync(folder(user)+'cache-'+encodeURIComponent(route)+'.json'))}catch{return null}}
export function captureForm(row:Capture){const form=new FormData();for(const [k,v] of Object.entries(row))if(!['photo','sync_error','site_name'].includes(k))form.append(k,String(v));form.append('photo',row.photo as any);return form}
