import PDFDocument from 'pdfkit'
export const reportNames={overview:'Operations overview',incidents:'Incident reports',shifts:'Duty schedules',attendance:'Time In / Time Out',billing:'Attendance hours for billing review',equipment:'Equipment inventory',assignments:'Equipment issued to guards',maintenance:'Equipment maintenance',defects:'Equipment fault reports',actions:'Corrective and preventive actions',escalations:'Escalated cases',training:'Training records',certifications:'Licenses and certifications',assessments:'Guard assessments',gps:'Shared GPS locations'}
const names={location_region:'Region',location_city:'City / municipality',title:'Title',start:'Shift starts',end:'Shift ends',post:'Duty post',instructions:'Duty instructions',status:'Status',completed_at:'Completed on',expires_at:'Valid until',notes:'Notes',number:'Certificate / license number',score:'Assessment score (%)',assessed_at:'Assessment date',serial:'Serial number',category:'Equipment type',acquired_at:'Acquired on',issued_at:'Issued on',returned_at:'Returned on',condition:'Condition',acknowledged:'Receipt acknowledged',description:'Description',type:'Action type',due_at:'Target completion',reason:'Reason',event:'Attendance event',cycle:'Attendance cycle',latitude:'Latitude',longitude:'Longitude',accuracy:'GPS accuracy (meters)',recorded_at:'Recorded at',distance_m:'Distance from site center (meters)',radius_m:'Site boundary radius (meters)',geofence_status:'Site boundary result',location_label:'Site / duty post',source:'Source',demo:'Demo record'}
const clock=new Intl.DateTimeFormat('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:true})
export const reportTime=value=>value?clock.format(new Date(value)):''
export function reportTable(kind,rows,related={}){
 if(kind==='assignments') rows=rows.map(row=>{const asset=related.equipment?.find(asset=>asset.id===row.data.equipment_id);return {...row,data:{...row.data,location_region:asset?.data.location_region || 'Uncategorized',location_city:asset?.data.location_city || 'Uncategorized',category:asset?.data.category || 'Uncategorized'}}})
 if(kind==='incidents')return [['Reference','Site','Reported by','Title','Description','Location / post','Status','Severity','Approval','Reported at','Target completion','Resolved at','Investigation feedback','Root cause'],...rows.map(r=>[r.id,r.site_name,r.reporter_name,r.title,r.description,r.location,r.status,r.severity,r.approval,reportTime(r.created_at),reportTime(r.due_at),reportTime(r.resolved_at),r.investigation,r.root_cause])]
 const keys=[...new Set(rows.flatMap(r=>Object.keys(r.data)))].filter(k=>!k.endsWith('_id')&&!['id','title'].includes(k))
 const links=[...new Set(rows.flatMap(r=>Object.keys(r.data)))].filter(k=>['equipment_id','incident_id','shift_id'].includes(k))
 const lookups={equipment_id:related.equipment || [],incident_id:related.incidents || [],shift_id:related.shifts || []}
 const linkName={equipment_id:'Equipment',incident_id:'Related incident',shift_id:'Duty schedule'}
 const format=(key,value)=>value==null?'':typeof value==='boolean'?(value?'Yes':'No'):key==='event'?(value==='in'?'Time In':'Time Out'):['start','end'].includes(key)||key.endsWith('_at')?reportTime(value):String(value)
 return [['Reference','Site','Guard / staff','Title',...links.map(k=>linkName[k]),...keys.map(k=>names[k] || k.replaceAll('_',' '))],...rows.map(r=>[r.id,r.site_name,r.subject_name,r.data.title || '',...links.map(k=>{const match=lookups[k].find(v=>v.id===r.data[k]);return match?.data?.title || match?.title || r.data[k] || ''}),...keys.map(k=>format(k,r.data[k]))])]
}
export function reportCsv(table){const quote=value=>'"'+String(value??'').replace(/^\s*[=+@-]/,"'$&").replaceAll('"','""')+'"';return '\ufeff'+table.map(row=>row.map(quote).join(',')).join('\r\n')}
export function reportPdf({title,table,scope,from,to,generatedAt=new Date(),actor}){
 return new Promise((resolve,reject)=>{
 const doc=new PDFDocument({size:'A4',margin:42,bufferPages:true,info:{Title:title,Author:'CAT Security Services Platform'}}),chunks=[]
 doc.on('data',b=>chunks.push(b));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject)
 const width=doc.page.width-84,bottom=doc.page.height-65
 let cursor=0
 const line=(text,x,y,font='Helvetica',size=9,color='#142e4b')=>doc.font(font).fontSize(size).fillColor(color).text(String(text),x,y,{lineBreak:false})
 const wrap=(value,w,font='Helvetica')=>{
  doc.font(font).fontSize(9);const lines=[];let current=''
  for(const word of String(value).split(/\s+/)){
   if(doc.widthOfString(word)>w){if(current){lines.push(current);current=''}let piece='';for(const ch of word){if(doc.widthOfString(piece+ch)>w){lines.push(piece);piece=ch}else piece+=ch}current=piece;continue}
   if(current&&doc.widthOfString(current+' '+word)>w){lines.push(current);current=word}else current=current?current+' '+word:word
  }if(current)lines.push(current);return lines.length?lines:['-']
 }
 const header=()=>{
  doc.rect(0,0,doc.page.width,7).fill('#ed843b')
  line('CAT SECURITY SERVICES PLATFORM',42,29,'Helvetica-Bold',11)
  line(title,42,51,'Helvetica-Bold',18)
  const metadata=['Site: '+scope,`Period: ${from?reportTime(from):'All dates'} to ${to?reportTime(to):'Present'}`,`Generated: ${reportTime(generatedAt)} | Asia/Manila`, 'Prepared for: '+actor,`${Math.max(0,table.length-1)} record(s)`]
  let y=79;for(const text of metadata)for(const item of wrap(text,width)){line(item,42,y,'Helvetica',9,'#4b5f75');y+=12}
  cursor=y+14
 }
 const nextPage=()=>{doc.addPage();header()}
 header()
 if(table.length===1)line('No matching records for the selected filters.',42,cursor,'Helvetica',11)
 table.slice(1).forEach((row,index)=>{
  if(cursor>bottom-110)nextPage()
  doc.roundedRect(42,cursor,width,25,4).fill('#142e4b');line('Record '+(index+1),52,cursor+8,'Helvetica-Bold',10,'#ffffff');cursor+=35
  table[0].forEach((field,column)=>{
   const labelWidth=145,valueWidth=width-labelWidth-12,values=wrap(String(row[column]??'') || '-',valueWidth)
   let offset=0,continued=false
   while(offset<values.length){
    const labels=wrap(field+(continued?' (continued)':''),labelWidth-8,'Helvetica-Bold')
    let capacity=Math.floor((bottom-cursor-10)/12)
    if(capacity<Math.max(2,labels.length)){nextPage();capacity=Math.floor((bottom-cursor-10)/12)}
    const count=Math.min(values.length-offset,capacity),height=Math.max(count,labels.length)*12+10
    labels.forEach((text,n)=>line(text,42,cursor+n*12,'Helvetica-Bold',9,'#4b5f75'))
    values.slice(offset,offset+count).forEach((text,n)=>line(text,42+labelWidth,cursor+n*12))
    doc.moveTo(42,cursor+height-4).lineTo(42+width,cursor+height-4).strokeColor('#e1e8f0').lineWidth(.4).stroke()
    cursor+=height;offset+=count;continued=true
   }
  });cursor+=14
 })
 const range=doc.bufferedPageRange()
 for(let i=range.start;i<range.start+range.count;i++){
  doc.switchToPage(i);const margin=doc.page.margins.bottom;doc.page.margins.bottom=0
  line(`Confidential - authorized operational use | Page ${i+1} of ${range.count}`,42,doc.page.height-29,'Helvetica',8,'#687b91');doc.page.margins.bottom=margin
 }

 doc.end()
 })
}
