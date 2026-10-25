import {createHash} from 'node:crypto'
import sharp from 'sharp'
export function demoId(key){const bytes=createHash('sha256').update('bcc-demo-v1:'+key).digest().subarray(0,16);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const s=bytes.toString('hex');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`}
const q=value=>value==null?'NULL':"'"+String(value).replaceAll("'","''")+"'"
const json=value=>q(JSON.stringify(value))+'::jsonb'
export async function buildDemoFixtures(users,now=new Date()){
 const guards=users.filter(u=>u.role==='guard'),actor=users.find(u=>u.role==='operations')||users.find(u=>u.role==='admin'),supervisors=users.filter(u=>u.role==='supervisor')
 if(!actor||!guards.length)throw Error('An existing administrator/SSD and at least one active guard are required')
 const sql=[],records=[],incidents=[],sites=[{id:demoId('site:makati'),name:'[DEMO] Makati Training Site',latitude:14.5547,longitude:121.0244},{id:demoId('site:qc'),name:'[DEMO] Quezon Training Site',latitude:14.6507,longitude:121.0494}]
 const time=hours=>new Date(+now+hours*3600000).toISOString()
 const audit=(id,site,kind)=>`INSERT INTO operation_audit(actor_id,record_id,site_id,action,details) SELECT ${q(actor.id)},${q(id)},${q(site)},'ASSISTANT_SEED_DEMO',${json({source:'User-requested DEMO fixture setup',kind})} WHERE NOT EXISTS(SELECT 1 FROM operation_audit WHERE record_id=${q(id)} AND action='ASSISTANT_SEED_DEMO')`
 const add=(key,kind,site,subject,data,created=time(-1),creator=actor.id)=>{const id=demoId(key);records.push({id,kind,site_id:site,subject_id:subject,data});sql.push(`INSERT INTO operational_records(id,kind,site_id,subject_id,created_by,data,created_at,updated_at) VALUES(${q(id)},${q(kind)},${q(site)},${q(subject)},${q(creator)},${json(data)},${q(created)},${q(created)}) ON CONFLICT(id) DO NOTHING`,audit(id,site,kind));return id}
 const photoKeys={}
 for(const type of ['in','out','incident']){
  const id=demoId('photo:'+type),svg=`<svg width="640" height="420"><rect width="640" height="420" fill="#10253d"/><rect y="0" width="640" height="10" fill="#ee8b42"/><g fill="white" font-family="sans-serif" text-anchor="middle"><text x="320" y="115" font-size="38">DEMO SAMPLE PHOTO</text><text x="320" y="175" font-size="26">${type==='incident'?'INCIDENT EVIDENCE':'TIME '+type.toUpperCase()}</text><text x="320" y="245" font-size="20">SIMULATED RECORD · NOT ACTUAL ATTENDANCE</text><text x="320" y="290" font-size="18">No real person or event is depicted.</text><text x="320" y="345" font-size="16">Sample site, timestamps and GPS are in the record.</text></g></svg>`
  const bytes=await sharp(Buffer.from(svg)).jpeg({quality:65}).toBuffer();photoKeys[type]=id
  sql.push(`INSERT INTO private_files(key,content) VALUES(${q('evidence/'+id+'.jpg')},decode(${q(bytes.toString('hex'))},'hex')) ON CONFLICT(key) DO NOTHING`)
 }
 for(const site of sites){
  sql.push(`INSERT INTO sites(id,name) VALUES(${q(site.id)},${q(site.name)}) ON CONFLICT(id) DO NOTHING`,`INSERT INTO site_settings(site_id,client_name,required_guards,latitude,longitude,radius_m) VALUES(${q(site.id)},'DEMO Fictional Training Client',2,${site.latitude},${site.longitude},300) ON CONFLICT(site_id) DO NOTHING`)
  for(const user of supervisors.concat(users.filter(u=>u.role==='operations')))sql.push(`INSERT INTO user_sites(user_id,site_id) VALUES(${q(user.id)},${q(site.id)}) ON CONFLICT DO NOTHING`)
 }
 for(const [index,guard] of guards.entries()){
  const site=sites[index%sites.length],prefix='guard:'+guard.id
  sql.push(`INSERT INTO user_sites(user_id,site_id) VALUES(${q(guard.id)},${q(site.id)}) ON CONFLICT DO NOTHING`)
  for(let day=0;day<2;day++){
   const offset=day===0?-72:-48,start=time(offset),end=time(offset+8)
   const shift=add(prefix+':past:'+day,'shifts',site.id,guard.id,{title:'[DEMO] Completed training shift '+(day+1),post:'[DEMO] Training Gate '+(index+1),start,end,status:'Scheduled'},start)
   const cycles=day===0?1:2
   for(let cycle=1;cycle<=cycles;cycle++)for(const event of ['in','out']){
    const offsetHours=cycle===1?(event==='in'?0:cycles===1?8:3):(event==='in'?4:8),at=time(offset+offsetHours)
    add(prefix+':attendance:'+day+':'+cycle+':'+event,'attendance_punch',site.id,guard.id,{shift_id:shift,event,cycle,latitude:site.latitude,longitude:site.longitude,accuracy:5,recorded_at:at,distance_m:0,radius_m:300,geofence_status:'Inside',photo_id:photoKeys[event],location_label:site.name+' · DEMO training gate',source:'DEMO simulated attendance',demo:true},at,guard.id)
   }
  }
  for(let day=4;day<=5;day++)add(prefix+':future:'+day,'shifts',site.id,guard.id,{title:'[DEMO] Future training shift '+(day-3),post:'[DEMO] Training Gate '+(index+1),start:time(day*24),end:time(day*24+8),status:'Scheduled'},time(-2))
  add(prefix+':training','training',site.id,guard.id,{title:'[DEMO] Emergency response refresher',completed_at:time(-24*20),expires_at:time(24*180),notes:'DEMO training record for feature evaluation only.'})
  add(prefix+':license','certifications',site.id,guard.id,{title:'[DEMO] Security training certification',number:'DEMO-CERT-'+String(index+1).padStart(3,'0'),expires_at:time(24*10),notes:'DEMO certificate, not a real licence.'})
  add(prefix+':assessment','assessments',site.id,guard.id,{title:'[DEMO] Site readiness assessment',score:90-index*5,assessed_at:time(-24*4),notes:'DEMO assessment, not an actual employee rating.'})
  const radio=add(prefix+':radio','equipment',site.id,null,{title:'[DEMO] Handheld radio '+(index+1),serial:'BCC-DEMO-RADIO-'+guard.id.slice(0,8),category:'Radio',status:'In Service',acquired_at:time(-24*90),notes:'DEMO equipment only.'})
  const vest=add(prefix+':vest','equipment',site.id,null,{title:'[DEMO] Safety vest '+(index+1),serial:'BCC-DEMO-VEST-'+guard.id.slice(0,8),category:'Protective gear',status:'Available',acquired_at:time(-24*60),notes:'DEMO equipment only.'})
  const torch=add(prefix+':torch','equipment',site.id,null,{title:'[DEMO] Inspection torch '+(index+1),serial:'BCC-DEMO-TORCH-'+guard.id.slice(0,8),category:'Other',status:'Maintenance',acquired_at:time(-24*120),notes:'DEMO equipment only.'})
  add(prefix+':assignment','assignments',site.id,guard.id,{equipment_id:radio,issued_at:time(-24),returned_at:null,condition:'DEMO: good condition',acknowledged:index%2===1})
  add(prefix+':returned','assignments',site.id,guard.id,{equipment_id:vest,issued_at:time(-24*3),returned_at:time(-24),condition:'DEMO: returned in good condition',acknowledged:true})
  add(prefix+':maintenance','maintenance',site.id,null,{equipment_id:torch,title:'[DEMO] Overdue battery service',due_at:time(-24),status:'Scheduled',completed_at:null,notes:'DEMO maintenance alert.'})
  add(prefix+':defect','defects',site.id,guard.id,{equipment_id:torch,title:'[DEMO] Torch battery fault',description:'DEMO fault reported during an illustrative equipment check.',status:'Reported'},time(-5),guard.id)
  for(const [n,status] of ['Submitted','Under Review','In Progress','Resolved'].entries()){
   const id=demoId(prefix+':incident:'+n),created=time(-24*(n+1)),resolved=status==='Resolved',due=time(n===2?-3:24),severity=['Low','Medium','High','Critical'][n],assignee=supervisors[0]?.id||actor.id
   const row={id,title:'[DEMO] '+['Visitor log discrepancy','Access badge review','Training gate obstruction','Resolved drill observation'][n],description:'DEMO incident scenario for feature evaluation. No actual security incident occurred.',location:site.name+' - DEMO training post',site_id:site.id,reporter_id:guard.id,assignee_id:assignee,photo_key:photoKeys.incident+'.jpg',status,classification:'DEMO Training Exercise',severity,approval:n<2?'Pending':'Approved',investigation:n<2?'':'DEMO review completed by training supervisor.',root_cause:n===3?'DEMO process gap identified during exercise.':'',due_at:due,resolved_at:resolved?time(-12):null,created_at:created,updated_at:created};incidents.push(row)
   const columns=Object.keys(row);sql.push(`INSERT INTO incidents(${columns.join(',')}) VALUES(${columns.map(k=>q(row[k])).join(',')}) ON CONFLICT(id) DO NOTHING`,`INSERT INTO audit_events(incident_id,actor_id,action,details,created_at) SELECT ${q(id)},${q(actor.id)},'DEMO_INCIDENT_CREATED',${json({demo:true,source:'User-requested illustrative data'})},${q(created)} WHERE NOT EXISTS(SELECT 1 FROM audit_events WHERE incident_id=${q(id)} AND action='DEMO_INCIDENT_CREATED')`)
   add(prefix+':action:'+n,'actions',site.id,guard.id,{incident_id:id,title:'[DEMO] '+(resolved?'Completed drill correction':'Review training procedure'),type:n%2?'Preventive':'Corrective',due_at:due,status:resolved?'Completed':n===2?'In Progress':'Open',notes:'DEMO action only.'},created)
   add(prefix+':escalation:'+n,'escalations',site.id,guard.id,{incident_id:id,title:'[DEMO] Supervisor drill follow-up',reason:'DEMO escalation scenario.',due_at:due,status:resolved?'Closed':n===2?'Acknowledged':'Open'},created)
  }
  for(const [n,status] of ['Inside','Outside'].entries())add(prefix+':gps:'+n,'gps',site.id,guard.id,{latitude:site.latitude+(n ? 0.01 : 0),longitude:site.longitude,accuracy:5,recorded_at:time(n?-.05:-.2),distance_m:n?1112:0,radius_m:300,geofence_status:status,source:'DEMO simulated GPS point',demo:true},time(n?-.05:-.2),guard.id)
 }
 for(const user of supervisors.concat(users.filter(u=>u.role==='operations')))sql.push(`INSERT INTO user_preferences(user_id,data) VALUES(${q(user.id)},${json({dashboard:['incidents','attendance','equipment','sites'],report_kind:'billing'})}) ON CONFLICT(user_id) DO NOTHING`)
 return {sql,records,incidents,sites,photoKeys,summary:{sites:sites.length,guards:guards.length,incidents:incidents.length,records:records.length,byKind:records.reduce((a,r)=>(a[r.kind]=(a[r.kind]||0)+1,a),{})}}
}
