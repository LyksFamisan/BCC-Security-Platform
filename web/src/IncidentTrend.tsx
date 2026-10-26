import {useId,useState} from 'react'
const displayDay=(day:string)=>new Date(day+'T12:00:00Z').toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric'})
export default function IncidentTrend({trend,asOf}:{trend:Record<string,number>;asOf:string}){
 const [days,setDays]=useState(7),[selected,setSelected]=useState<string|null>(null),[playing,setPlaying]=useState(true)
 const id=useId().replaceAll(':',''),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(asOf))
 const end=new Date(today+'T12:00:00Z'),data=Array.from({length:days},(_,i)=>{const d=new Date(end);d.setUTCDate(d.getUTCDate()-(days-i-1));const day=d.toISOString().slice(0,10);return {day,count:Number(trend[day] || 0)}})
 const max=Math.max(1,...data.map(d=>d.count)),ceiling=max<=4?4:Math.ceil(max/4)*4,left=42,right=682,top=22,bottom=220
 const points=data.map((d,i)=>({...d,x:left+i/(days-1)*(right-left),y:bottom-d.count/ceiling*(bottom-top)})),path=points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' '),area=path+`L${right},${bottom}L${left},${bottom}Z`
 const active=points.find(p=>p.day===selected)||points[points.length-1],total=data.reduce((n,d)=>n+d.count,0)
 return <div className={'incident-trend-chart '+(playing?'is-playing':'is-paused')} aria-label="Incident trend chart">
  <div className="incident-trend-toolbar"><div><h3>Incident Trend</h3><p>{total} {total===1?'incident':'incidents'} reported in the last {days} days</p></div><div className="incident-trend-controls"><button aria-pressed={days===7} onClick={()=>setDays(7)}>7 days</button><button aria-pressed={days===30} onClick={()=>setDays(30)}>30 days</button><button aria-label={playing?'Pause chart animation':'Play chart animation'} aria-pressed={playing} onClick={()=>setPlaying(v=>!v)}>{playing?'Pause animation':'Play animation'}</button></div></div>
  <div className="incident-trend-detail" aria-live="polite"><span className="incident-live-dot"/><strong>{displayDay(active.day)}</strong><span>{active.count} {active.count===1?'incident':'incidents'}</span><small>Philippine time</small></div>
  <svg viewBox="0 0 720 260" className="incident-trend-svg" role="group" aria-label={`Daily incident counts for ${days} days`}>
   <defs><linearGradient id={id+'-area'} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#608fff" stopOpacity=".35"/><stop offset="100%" stopColor="#8e65d8" stopOpacity=".02"/></linearGradient><linearGradient id={id+'-line'}><stop stopColor="#3888ef"/><stop offset="100%" stopColor="#b17beb"/></linearGradient></defs>
   {[0,1,2,3,4].map(i=>{const y=bottom-i/4*(bottom-top);return <g key={i} className="incident-chart-grid"><line x1={left} x2={right} y1={y} y2={y}/><text x={left-10} y={y+4} textAnchor="end">{ceiling*i/4}</text></g>})}
   <path d={area} fill={`url(#${id}-area)`}/><path className="incident-chart-line" d={path} stroke={`url(#${id}-line)`} fill="none" strokeWidth="3" strokeLinejoin="round"/>
   <path className="incident-chart-flow" d={path} fill="none" stroke="#ffad70" strokeWidth="3" strokeDasharray="6 28"/>
   <line className="incident-chart-cursor" x1={active.x} x2={active.x} y1={top} y2={bottom}/>
   {points.map((p,i)=><g key={p.day}><circle className={active.day===p.day?'incident-chart-dot selected':'incident-chart-dot'} cx={p.x} cy={p.y} r={active.day===p.day?5:3}/><rect role="button" tabIndex={0} aria-label={`${displayDay(p.day)}: ${p.count} ${p.count===1?'incident':'incidents'}`} x={p.x-(right-left)/(days-1)/2} y={top-8} width={(right-left)/(days-1)} height={bottom-top+18} fill="transparent" onMouseEnter={()=>setSelected(p.day)} onFocus={()=>setSelected(p.day)} onClick={()=>setSelected(p.day)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(p.day)}}}><title>{p.day}: {p.count} incidents</title></rect>{(i===0||i===points.length-1||i%Math.ceil(days/6)===0)&&<text className="incident-chart-date" x={p.x} y={247} textAnchor="middle">{displayDay(p.day)}</text>}</g>)}
  </svg>
  <p className="incident-chart-empty">{!total?"No incidents reported in this period.":" "}</p>
 </div>
}
