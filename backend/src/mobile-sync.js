import {z} from 'zod'
const fail=(status,message)=>{throw Object.assign(Error(message),{status})}
export function mountMobileSync(app,pool,{transaction,siteAccess,audit,notify}){
 app.post('/mobile/offline',(req,res)=>res.status(410).json({error:'Offline capture is disabled. Use online camera + GPS attendance and online incident reporting.'}))
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
