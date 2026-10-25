import {randomUUID} from 'node:crypto'
import multer from 'multer'
import sharp from 'sharp'
import {z} from 'zod'
import {fileStore} from './file-store.js'
import {encodePhoto} from './photo-storage.js'
const schema=z.object({id:z.uuid(),type:z.enum(['incident','attendance']),captured_at:z.iso.datetime({offset:true}),site_id:z.uuid().optional(),shift_id:z.uuid().optional(),event:z.enum(['in','out']).optional(),latitude:z.coerce.number().min(-90).max(90).optional(),longitude:z.coerce.number().min(-180).max(180).optional(),accuracy:z.coerce.number().min(0).max(100).optional(),title:z.string().trim().min(3).max(160).optional(),description:z.string().trim().min(5).max(5000).optional(),location:z.string().trim().min(2).max(300).optional(),severity:z.enum(['Low','Medium','High','Critical']).default('Medium')}).strict()
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
export function mountMobileSync(app,pool,{transaction,siteAccess,audit,notify}){
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:3*1024*1024,files:1,fields:16}})
 app.post('/mobile/offline', (req,res,next)=>{if(req.user.role!=='guard')return res.sendStatus(403);next()},upload.single('photo'),async(req,res)=>{
  const parsed=schema.safeParse(req.body);if(!parsed.success)fail(400,'Invalid offline record')
  const d=parsed.data,stamp=+new Date(d.captured_at)
  if(stamp>Date.now()+5*60000 || stamp<Date.now()-30*86400000)fail(400,'Capture time must be within the past 30 days')
  if(!req.file)fail(400,'A photo is required')
  let image
  try{const p=sharp(req.file.buffer,{limitInputPixels:25000000});if(!['jpeg','png','webp'].includes((await p.metadata()).format))throw Error();image=await p.rotate().resize({width:1000,height:1400,fit:'inside'}).jpeg({quality:80}).toBuffer()}catch{fail(400,'Invalid photo')}
  const row=await transaction(async c=>{
   await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.user.id])
   const existing=(await c.query(d.type==='incident'?'SELECT * FROM incidents WHERE id=$1':'SELECT * FROM operational_records WHERE id=$1',[d.id])).rows[0]
   if(existing){if((d.type==='incident'?existing.reporter_id:existing.subject_id)!==req.user.id || (d.type==='attendance'&&(!['offline_attendance','attendance_punch'].includes(existing.kind)||existing.data.shift_id!==d.shift_id||existing.data.event!==d.event)))fail(409,'Record ID already used');await siteAccess(req.user,existing.site_id,c);return existing}
   let site=d.site_id,extra={}
   if(d.type==='attendance'){
    if(!d.shift_id || !d.event || d.latitude==null || d.longitude==null || d.accuracy==null)fail(400,'Shift, event and captured GPS are required')
    const shift=(await c.query("SELECT * FROM operational_records WHERE id=$1 AND kind='shifts' AND subject_id=$2",[d.shift_id,req.user.id])).rows[0]
    if(!shift)fail(404,'Assigned shift not found');site=shift.site_id
    if(shift.data.status==='Cancelled')fail(409,'Shift cancelled')
    if(stamp<+new Date(shift.data.start)-30*60000 || stamp>+new Date(shift.data.end)+24*3600000)fail(400,'Capture time is outside the shift review window')
    const settings=(await c.query('SELECT * FROM site_settings WHERE site_id=$1',[site])).rows[0]
    if(!settings||settings.latitude==null||settings.longitude==null)fail(409,'Site geofence is not configured')
    const rad=x=>x*Math.PI/180,a=Math.sin(rad(d.latitude-settings.latitude)/2)**2+Math.cos(rad(d.latitude))*Math.cos(rad(settings.latitude))*Math.sin(rad(d.longitude-settings.longitude)/2)**2,distance=6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)))
    extra={distance_m:Math.round(distance),radius_m:settings.radius_m,geofence_status:distance+d.accuracy<=settings.radius_m?'Inside':distance-d.accuracy>settings.radius_m?'Outside':'Uncertain'}
   }else if(!d.title||!d.description||!d.location||!site)fail(400,'Incident details and assigned site are required')
   await siteAccess(req.user,site,c)
   if(d.type==='attendance'){
    const width=(await sharp(image).metadata()).width
    const label=`<svg width="${width}" height="116"><rect width="100%" height="100%" fill="#10253d"/><g fill="white" font-size="13" font-family="sans-serif"><text x="8" y="22">OFFLINE TIME ${d.event.toUpperCase()} · PENDING REVIEW</text><text x="8" y="47">Device time: ${new Date(d.captured_at).toISOString()}</text><text x="8" y="72">GPS ${d.latitude.toFixed(6)}, ${d.longitude.toFixed(6)} ±${d.accuracy} m</text><text x="8" y="97">${extra.geofence_status} · ${extra.distance_m} m from centre</text></g></svg>`
    image=await sharp(image).extend({bottom:116,background:'#10253d'}).composite([{input:Buffer.from(label),gravity:'south'}]).jpeg({quality:80}).toBuffer()
   }
   const photo_id=randomUUID();await fileStore(c).write('evidence/'+photo_id+'.jpg',encodePhoto(image))
   let result
   if(d.type==='attendance'){
    const data={title:'Offline Time '+d.event,status:'Pending review',shift_id:d.shift_id,event:d.event,captured_at:d.captured_at,received_at:new Date().toISOString(),latitude:d.latitude,longitude:d.longitude,accuracy:d.accuracy,photo_id,...extra,source:'Offline device capture; time and GPS require review',review_notes:''}
    result=(await c.query("INSERT INTO operational_records(id,kind,site_id,subject_id,created_by,data) VALUES($1,'offline_attendance',$2,$3,$3,$4) RETURNING *",[d.id,site,req.user.id,JSON.stringify(data)])).rows[0]
    await audit(c,req.user,'OFFLINE_ATTENDANCE_RECEIVED',d.id,site,{captured_at:d.captured_at})
   }else{
    const workflow=(await c.query("SELECT value FROM technical_settings WHERE key='workflow'")).rows[0]?.value
    result=(await c.query("INSERT INTO incidents(id,title,description,location,site_id,reporter_id,photo_key,severity,due_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+($9*interval '1 hour')) RETURNING *",[d.id,d.title,d.description,d.location,site,req.user.id,photo_id+'.jpg',d.severity,workflow?.standard_hours||72])).rows[0]
    await c.query("INSERT INTO audit_events(incident_id,actor_id,action,details) VALUES($1,$2,'SUBMITTED',$3)",[d.id,req.user.id,JSON.stringify({source:'Mobile saved capture',captured_at:d.captured_at,received_at:new Date().toISOString()})])
   }
   return result
  })
  notify({site_id:row.site_id,reporter_id:req.user.id});const {root_cause,classification,...visible}=row;res.status(201).json(visible)
 })
 app.post('/offline-attendance/:id/review',async(req,res)=>{
  if(!['supervisor','operations'].includes(req.user.role))return res.sendStatus(403)
  const d=z.object({status:z.enum(['Approved','Rejected']),notes:z.string().trim().min(3).max(2000),version:z.number().int().positive()}).strict().safeParse(req.body)
  if(!d.success||!z.uuid().safeParse(req.params.id).success)fail(400,'Review decision, notes and version are required')
  const row=await transaction(async c=>{
   const old=(await c.query("SELECT * FROM operational_records WHERE id=$1 AND kind='offline_attendance' FOR UPDATE",[req.params.id])).rows[0]
   if(!old)fail(404,'Offline attendance not found');await siteAccess(req.user,old.site_id,c)
   if(old.version!==d.data.version||old.data.status!=='Pending review')fail(409,'Record already reviewed or changed')
   const data={...old.data,status:d.data.status,review_notes:d.data.notes,reviewed_by:req.user.id,reviewed_at:new Date().toISOString()}
   const result=(await c.query('UPDATE operational_records SET data=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *',[old.id,JSON.stringify(data)])).rows[0]
   await audit(c,req.user,'OFFLINE_ATTENDANCE_REVIEWED',old.id,old.site_id,{status:d.data.status,notes:d.data.notes});return result
  });notify({site_id:row.site_id,reporter_id:row.subject_id});res.json(row)
 })
}
