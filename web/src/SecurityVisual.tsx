export default function SecurityVisual() {
  return <div className="security-visual" aria-hidden="true">
    <div className="security-orbit orbit-one" /><div className="security-orbit orbit-two" />
    <svg viewBox="0 0 520 400" fill="none" className="security-circuit">
      <defs>
        <linearGradient id="shieldFill" x1="185" y1="70" x2="350" y2="315" gradientUnits="userSpaceOnUse"><stop stopColor="#3189FF" stopOpacity=".32"/><stop offset="1" stopColor="#0B284C" stopOpacity=".8"/></linearGradient>
        <linearGradient id="shieldEdge" x1="180" y1="90" x2="345" y2="300" gradientUnits="userSpaceOnUse"><stop stopColor="#7DD3FC"/><stop offset=".5" stopColor="#2F7DF4"/><stop offset="1" stopColor="#0B3F80"/></linearGradient>
      </defs>
      <g stroke="#2875BA" strokeWidth="1.3" opacity=".55">
        <path d="M20 115H110L150 155H198M0 270H110L150 230H194M520 110H420L380 150H324M520 275H425L380 230H324M120 365V320L190 250M405 35V80L330 145M75 40V80H165L205 120M450 365V325H365L320 280"/>
        <path d="M45 195H195M325 195H480M260 20V85M260 315V385" strokeDasharray="3 8"/>
      </g>
      <g fill="#38BDF8">{[[110,115],[110,270],[420,110],[425,275],[120,365],[405,35],[75,40],[450,365],[45,195],[480,195],[260,20],[260,385]].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r={3.5}/>)}</g>
      <path d="M260 75L345 110V185C345 244 306 286 260 314C214 286 175 244 175 185V110L260 75Z" fill="url(#shieldFill)" stroke="url(#shieldEdge)" strokeWidth="2"/>
      <path d="M260 93L330 122V184C330 234 297 271 260 295C223 271 190 234 190 184V122L260 93Z" stroke="#67BEFF" strokeOpacity=".17"/>
      <rect x="225" y="174" width="70" height="62" rx="13" fill="#123E73" stroke="#82D5FF" strokeWidth="1.7"/>
      <path d="M240 174V156C240 145 249 136 260 136C271 136 280 145 280 156V174" stroke="#B6E7FF" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="260" cy="199" r="6" fill="#B6E7FF"/><path d="M260 203V214" stroke="#B6E7FF" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="345" cy="110" r="6" fill="#071A31" stroke="#58BBFF" strokeWidth="2"/>
      <circle cx="175" cy="185" r="5" fill="#071A31" stroke="#58BBFF" strokeWidth="2"/>
    </svg>
  </div>
}
