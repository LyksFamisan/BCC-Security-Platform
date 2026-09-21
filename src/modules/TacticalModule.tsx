import { useState, useEffect, useRef } from 'react'
import { usePortalData } from '../state/PortalDataContext'

const alarms = [
  {
    id: 1,
    site: 'Subic Depot Perimeter',
    sensor: 'Gate 1 Sensor',
    age: '42s',
    status: 'Signal Drop',
    statusColor: '#f59e0b',
    critical: false,
  },
  {
    id: 2,
    site: 'BGC Vault B',
    sensor: 'Firearms Safe Status',
    age: '2m 14s',
    status: 'Unscheduled Unlocked',
    statusColor: '#ef4444',
    critical: true,
  },
  {
    id: 3,
    site: 'Manila Terminal 3',
    sensor: 'SatLink Radio Comm',
    age: '11s',
    status: 'Offline Signal',
    statusColor: '#f59e0b',
    critical: false,
  },
]

function RadarMap({ threatLevel }: { threatLevel: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const angleRef = useRef(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const blips: { x: number; y: number; age: number; alpha: number }[] = []

    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      const cx = w / 2
      const cy = h / 2
      const r = Math.min(w, h) * 0.42

      ctx.clearRect(0, 0, w, h)

      // Background
      ctx.fillStyle = '#0F0C20'
      ctx.fillRect(0, 0, w, h)

      // Grid lines
      ctx.strokeStyle = 'rgba(240,101,34,0.06)'
      ctx.lineWidth = 1
      const gridStep = 40
      for (let x = 0; x < w; x += gridStep) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
      }
      for (let y = 0; y < h; y += gridStep) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
      }

      // Radar rings
      ;[1, 0.75, 0.5, 0.25].forEach((f) => {
        ctx.beginPath()
        ctx.arc(cx, cy, r * f, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(240,101,34,0.15)'
        ctx.lineWidth = 1
        ctx.stroke()
      })

      // Cross hairs
      ctx.strokeStyle = 'rgba(240,101,34,0.12)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke()

      // Sweep gradient (trailing glow)
      const sweepAngle = angleRef.current

      // Draw sweep as a filled arc sector
      const trailSpan = Math.PI * 0.55
      const sweepGrad = ctx.createLinearGradient(
        cx + Math.cos(sweepAngle) * r * 0.5,
        cy + Math.sin(sweepAngle) * r * 0.5,
        cx + Math.cos(sweepAngle - trailSpan) * r * 0.5,
        cy + Math.sin(sweepAngle - trailSpan) * r * 0.5
      )
      sweepGrad.addColorStop(0, 'rgba(240,101,34,0.22)')
      sweepGrad.addColorStop(1, 'rgba(240,101,34,0)')

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, sweepAngle - trailSpan, sweepAngle)
      ctx.closePath()
      ctx.fillStyle = sweepGrad
      ctx.fill()
      ctx.restore()

      // Sweep line
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(sweepAngle) * r, cy + Math.sin(sweepAngle) * r)
      ctx.strokeStyle = '#F06522'
      ctx.lineWidth = 1.5
      ctx.shadowColor = '#F06522'
      ctx.shadowBlur = 8
      ctx.stroke()
      ctx.restore()

      // Spawn blips near sweep line
      if (Math.random() < 0.03) {
        const dist = r * (0.25 + Math.random() * 0.7)
        const spread = (Math.random() - 0.5) * 0.3
        blips.push({
          x: cx + Math.cos(sweepAngle + spread) * dist,
          y: cy + Math.sin(sweepAngle + spread) * dist,
          age: 0,
          alpha: 1,
        })
      }

      // Draw blips
      blips.forEach((b, idx) => {
        b.age++
        b.alpha = Math.max(0, 1 - b.age / 80)
        if (b.alpha <= 0) { blips.splice(idx, 1); return }
        ctx.save()
        ctx.beginPath()
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(240,101,34,${b.alpha})`
        ctx.shadowColor = '#F06522'
        ctx.shadowBlur = 6
        ctx.fill()
        ctx.restore()
      })

      // Fixed node: BGC Tower (top-left quadrant of radar)
      const bgcX = cx - r * 0.45
      const bgcY = cy - r * 0.38
      ctx.save()
      ctx.beginPath()
      ctx.arc(bgcX, bgcY, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#34c759'
      ctx.shadowColor = '#34c759'
      ctx.shadowBlur = 10
      ctx.fill()
      ctx.restore()

      // Fixed node: Manila Port (bottom-right)
      const mpX = cx + r * 0.5
      const mpY = cy + r * 0.42
      const blink = Math.floor(Date.now() / 500) % 2 === 0
      if (blink) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(mpX, mpY, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#ff3b30'
        ctx.shadowColor = '#ff3b30'
        ctx.shadowBlur = 12
        ctx.fill()
        ctx.restore()
      }

      // Node labels
      ctx.font = '9px "JetBrains Mono", monospace'
      ctx.fillStyle = 'rgba(248,250,252,0.85)'
      ctx.fillText('BGC TOWER', bgcX + 8, bgcY - 5)
      ctx.fillStyle = 'rgba(52,199,89,0.75)'
      ctx.font = '8px "JetBrains Mono", monospace'
      ctx.fillText('24 GUARDS · SECURE', bgcX + 8, bgcY + 6)

      ctx.font = '9px "JetBrains Mono", monospace'
      ctx.fillStyle = 'rgba(248,250,252,0.85)'
      ctx.fillText('MANILA PORT', mpX + 8, mpY - 5)
      ctx.fillStyle = '#ff3b30'
      ctx.font = '8px "JetBrains Mono", monospace'
      ctx.fillText('INCIDENT DETECTED', mpX + 8, mpY + 6)

      // HUD text overlays
      ctx.font = '8px "JetBrains Mono", monospace'
      ctx.fillStyle = 'rgba(240,101,34,0.55)'
      ctx.fillText('UNIT STATUS', 14, 18)
      ctx.fillStyle = 'rgba(240,101,34,0.4)'
      ctx.fillText('OP TEAM 4 // ACTIVE // LOC 14.5995° N 120.9842° E', 14, 30)
      ctx.fillStyle = 'rgba(240,101,34,0.55)'
      ctx.fillText('SYSTEM TIME', 14, 46)
      const now = new Date()
      ctx.fillStyle = 'rgba(240,101,34,0.4)'
      ctx.fillText(
        `${now.toUTCString().slice(17, 25)} UTC // ${now.toDateString().toUpperCase()}`,
        14, 58
      )

      // Threat level top-right
      ctx.font = '8px "JetBrains Mono", monospace'
      ctx.textAlign = 'right'
      ctx.fillStyle = threatLevel === 'CRITICAL' ? '#ef4444' : threatLevel === 'HIGH' ? '#f59e0b' : '#fbbf24'
      ctx.fillText('THREAT LEVEL', w - 14, 18)
      ctx.fillText(`${threatLevel} // ${threatLevel === 'CRITICAL' ? 'CODE RED' : threatLevel === 'HIGH' ? 'CODE ORANGE' : 'CODE YELLOW'}`, w - 14, 30)
      ctx.fillStyle = 'rgba(240,101,34,0.45)'
      ctx.fillText('NAVIGATION', w - 14, 46)
      ctx.fillText('COMPASS N 350° // ALT 12M', w - 14, 58)
      ctx.textAlign = 'left'

      // Bottom left
      ctx.font = '8px "JetBrains Mono", monospace'
      ctx.fillStyle = 'rgba(240,101,34,0.45)'
      ctx.fillText('INFRASTRUCTURE STATUS', 14, h - 28)
      ctx.fillStyle = 'rgba(240,101,34,0.3)'
      ctx.fillText('POWER GRID ONLINE // WATERWORKS // TRAFFIC FLOW', 14, h - 16)

      // Bottom right
      ctx.textAlign = 'right'
      ctx.fillStyle = 'rgba(240,101,34,0.45)'
      ctx.fillText('COMMS // ENCRYPTED // SECURE', w - 14, h - 28)
      ctx.fillStyle = 'rgba(240,101,34,0.3)'
      ctx.fillText('DRONE FEED // ACTIVE // FEED 4 // LIVE', w - 14, h - 16)
      ctx.textAlign = 'left'

      angleRef.current = (sweepAngle + 0.018) % (Math.PI * 2)
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [threatLevel])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}

export default function TacticalModule() {
  const { addActivity } = usePortalData()
  const [notice, setNotice] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showRoster, setShowRoster] = useState(false)
  const [alarmQueue, setAlarmQueue] = useState(alarms)
  const [alarmHistory, setAlarmHistory] = useState<typeof alarms>([])
  const [systemTime, setSystemTime] = useState(new Date())
  const [threatLevel, setThreatLevel] = useState<'ELEVATED' | 'HIGH' | 'CRITICAL'>('ELEVATED')
  const [telemetryInterval, setTelemetryInterval] = useState('10 seconds')
  const [selectedMarker, setSelectedMarker] = useState('')

  useEffect(() => {
    const clock = window.setInterval(() => setSystemTime(new Date()), 1000)
    return () => window.clearInterval(clock)
  }, [])

  const acknowledgeAlarm = (alarm: typeof alarms[number]) => {
    setAlarmQueue(current => current.filter(item => item.id !== alarm.id))
    setAlarmHistory(current => [alarm, ...current])
    addActivity('Tactical Room', 'ALARM', `Alarm acknowledged: ${alarm.site} · ${alarm.status}`)
  }

  const refreshTelemetry = () => {
    setSystemTime(new Date())
    setNotice('Telemetry feed refreshed just now.')
  }

  return (
    <div className="p-5 flex flex-col gap-4 min-h-full" style={{ background: 'transparent' }}>
      <div className="flex gap-4 flex-1" style={{ minHeight: 0 }}>

        {/* ── Left: Guards Deployment Coordinates Grid ── */}
        <div
          style={{
            flex: 1,
            background: 'rgba(10,8,24,0.88)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid rgba(240,101,34,0.1)', flexShrink: 0, background: 'rgba(240,101,34,0.03)' }}
          >
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F06522" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="2" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="2" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="22" y2="12" />
              </svg>
              <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: '#e8eaf0' }}>
                Guards Deployment Coordinates Grid
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#22c55e' }}>RADAR LIVE</span>
              <button onClick={() => { setShowSettings(value => !value); setShowRoster(false); setNotice('') }} style={{ fontFamily: 'Inter', fontSize: 12, color: '#F06522', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 12 }}>
                Telemetry Settings
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>

          {showSettings && <div style={{ position: 'absolute', top: 68, right: 20, zIndex: 2, width: 250, background: '#10283d', border: '1px solid rgba(240,101,34,0.35)', borderRadius: 8, padding: 14, color: '#dfe7ff', fontFamily: 'Inter', fontSize: 12, boxShadow: '0 12px 28px rgba(2,6,23,0.4)' }}>
            <div style={{ fontWeight: 700, marginBottom: 10, color: '#fff' }}>Telemetry Settings</div>
            <label style={{ display: 'block', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '8px 0' }}>GPS refresh interval<select value={telemetryInterval} onChange={event => setTelemetryInterval(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 5, background: '#0b1c2d', color: '#dfe7ff', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 5, padding: '5px' }}><option>5 seconds</option><option>10 seconds</option><option>30 seconds</option></select></label>
            <button type="button" onClick={() => setNotice('Critical alarm sound enabled.')} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '8px 0', background: 'transparent', color: '#dfe7ff', cursor: 'pointer' }}>Critical alarm sound · On</button>
            <button type="button" onClick={() => setNotice('Auto-escalation is active.')} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '8px 0', background: 'transparent', color: '#dfe7ff', cursor: 'pointer' }}>Auto-escalation · On</button>
          </div>}
          {notice && <div style={{ position: 'absolute', top: 68, right: 20, zIndex: 2, background: 'rgba(25,118,185,0.94)', color: '#fff', borderRadius: 7, padding: '9px 12px', fontFamily: 'Inter', fontSize: 12 }}>{notice}</div>}

          {/* Animated radar canvas */}
          <div style={{ flex: 1, position: 'relative', minHeight: 400 }}>
            <RadarMap threatLevel={threatLevel} />
            <button type="button" onClick={() => { setSelectedMarker('BGC Tower'); setNotice('BGC Tower marker selected: 24 guards secure.') }} style={{ position: 'absolute', top: '35%', left: '35%', border: '1px solid #34c759', background: 'rgba(15,30,34,0.88)', color: '#8bf0a7', borderRadius: 5, padding: '5px 7px', fontFamily: 'JetBrains Mono', fontSize: 10, cursor: 'pointer' }}>BGC TOWER</button>
            <button type="button" onClick={() => { setSelectedMarker('Manila Port'); setNotice('Manila Port marker selected: incident detected.') }} style={{ position: 'absolute', bottom: '30%', right: '20%', border: '1px solid #ef4444', background: 'rgba(38,16,24,0.9)', color: '#ff8d86', borderRadius: 5, padding: '5px 7px', fontFamily: 'JetBrains Mono', fontSize: 10, cursor: 'pointer' }}>MANILA PORT</button>
            {selectedMarker && <div style={{ position: 'absolute', left: 14, bottom: 14, background: 'rgba(16,40,61,0.92)', border: '1px solid rgba(125,211,252,0.3)', borderRadius: 6, padding: '6px 9px', color: '#dfe7ff', fontFamily: 'Inter', fontSize: 11 }}>Selected marker: {selectedMarker}</div>}
          </div>
        </div>

        {/* ── Right: Telemetry Feed Alarm Queue ── */}
        <div
          style={{
            width: 360,
            flexShrink: 0,
            background: 'rgba(13,10,30,0.75)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}
          >
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F06522" strokeWidth="2" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: '#e8eaf0' }}>
                Telemetry Feed Alarm Queue
              </span>
            </div>
            <button onClick={() => { setShowRoster(value => !value); setShowSettings(false); setNotice('') }} style={{ fontFamily: 'Inter', fontSize: 12, color: '#F06522', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              Dispatcher Roster
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>

          {showRoster ? (
            <div className="flex flex-col">
              {[
                ['Dispatcher Cruz, A.', 'Command Lead', 'ONLINE'],
                ['Dispatcher Villanueva, K.', 'Incident Desk', 'ONLINE'],
                ['Dispatcher Aquino, R.', 'Telemetry Desk', 'ON CALL'],
              ].map(([name, role, status]) => <div key={name} className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}><div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: '#e8eaf0' }}>{name}</div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'Inter', fontSize: 11, color: '#94a3b8' }}><span>{role}</span><span style={{ color: status === 'ONLINE' ? '#22c55e' : '#f59e0b' }}>{status}</span></div></div>)}
            </div>
          ) : <div className="flex flex-col">
              {alarmQueue.map((a, i) => {
              return (
              <div
                key={a.id}
                style={{
                  padding: '16px 20px',
                  borderTop: a.critical ? '1px solid rgba(239,68,68,0.25)' : 'none',
                  borderLeft: a.critical ? '1px solid rgba(239,68,68,0.25)' : 'none',
                  borderRight: a.critical ? '1px solid rgba(239,68,68,0.25)' : 'none',
                  borderBottom: a.critical
                    ? '1px solid rgba(239,68,68,0.25)'
                    : i < alarms.length - 1
                    ? '1px solid rgba(255,255,255,0.05)'
                    : 'none',
                  background: a.critical ? 'rgba(239,68,68,0.05)' : 'transparent',
                  cursor: 'default',
                  opacity: 1,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!a.critical) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { if (!a.critical) e.currentTarget.style.background = 'transparent' }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: '#e8eaf0', marginBottom: 3 }}>
                      {a.site}
                    </div>
                    <div style={{ fontFamily: 'Inter', fontSize: 12, color: '#5a6478' }}>{a.sensor}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#5a6478' }}>{a.age}</span>
                    <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: a.statusColor }}>
                      {a.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={threatLevel} onChange={event => { setThreatLevel(event.target.value as typeof threatLevel); addActivity('Tactical Room', 'THREAT_LEVEL', `Threat level changed to ${event.target.value}`) }} style={{ background: '#0b1c2d', color: threatLevel === 'CRITICAL' ? '#ff8d86' : '#fbbf24', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 5, padding: '5px 6px', fontFamily: 'JetBrains Mono', fontSize: 10 }} aria-label="Threat level">
                      <option>ELEVATED</option><option>HIGH</option><option>CRITICAL</option>
                    </select>
                    <button type="button" onClick={refreshTelemetry} style={{ fontFamily: 'Inter', fontSize: 11, color: '#7dd3fc', background: 'transparent', border: '1px solid rgba(125,211,252,0.3)', borderRadius: 5, padding: '5px 7px', cursor: 'pointer' }}>Refresh</button>
                  </div>
                </div>
                  <button type="button" onClick={() => acknowledgeAlarm(a)} style={{ marginTop: 10, fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: a.statusColor, background: 'transparent', border: `1px solid ${a.statusColor}`, borderRadius: 5, padding: '4px 8px', cursor: 'pointer' }}>Acknowledge Alarm</button>
              </div>
              )
            })}
          </div>}

          {alarmHistory.length > 0 && <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-5 py-3" style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 12, color: '#dfe7ff' }}>Alarm History</div>
            {alarmHistory.map(alarm => <div key={`history-${alarm.id}`} className="flex items-center justify-between px-5 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}><span style={{ fontFamily: 'Inter', fontSize: 11, color: '#94a3b8' }}>{alarm.site}</span><span style={{ fontFamily: 'Inter', fontSize: 10, color: '#22c55e' }}>ACKNOWLEDGED</span></div>)}
          </div>}

          {/* Live feed status strip */}
          <div
            className="flex items-center gap-2 px-5 py-3 mt-auto"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5a6478', letterSpacing: '0.08em' }}>
              TELEMETRY FEED LIVE · {alarmQueue.length} ACTIVE ALARMS · {systemTime.toLocaleTimeString('en-PH', { hour12: false })}
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
