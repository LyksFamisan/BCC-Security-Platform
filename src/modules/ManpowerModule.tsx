import { useState } from 'react'

const L = {
  card: 'rgba(255,255,255,0.94)',
  cardBorder: 'rgba(0,0,0,0.08)',
  cardAlt: 'rgba(248,249,252,0.97)',
  heading: '#111827',
  body: '#374151',
  muted: '#6b7280',
  subtle: '#9ca3af',
  divider: 'rgba(0,0,0,0.07)',
  rowHover: 'rgba(0,0,0,0.025)',
  shadow: '0 1px 4px rgba(0,0,0,0.06)',
  shellHeading: '#12304a',
  shellMuted: '#52718b',
}

type Tab = 'roster' | 'deployment' | 'monitoring' | 'attendance' | 'training'

const guards = [
  { id: 'SG-00147', name: 'Santos, Ricardo P.', rank: 'Security Guard I', detachment: 'NCR-01', site: 'BGC Financial Tower', shift: 'Day', status: 'on-duty', license: 'SOSIA-2026-0447', licenseExp: '2027-03-15', cert: ['GSTP', 'BSTT'] },
  { id: 'SG-00283', name: 'Reyes, Manuel F.', rank: 'Security Guard II', detachment: 'NCR-02', site: 'Makati Central Mall', shift: 'Day', status: 'absent', license: 'SOSIA-2025-1122', licenseExp: '2026-11-08', cert: ['GSTP'] },
  { id: 'SG-00391', name: 'Dela Cruz, Ana M.', rank: 'Senior Security Guard', detachment: 'NCR-01', site: 'NAIA Terminal 3', shift: 'Night', status: 'on-duty', license: 'SOSIA-2025-0883', licenseExp: '2026-10-03', cert: ['GSTP', 'BSTT', 'FIRST AID'] },
  { id: 'SG-00412', name: 'Bautista, Jose L.', rank: 'Security Guard I', detachment: 'R3-01', site: 'Clark Freeport', shift: 'Day', status: 'on-duty', license: 'SOSIA-2026-0211', licenseExp: '2027-06-20', cert: ['GSTP'] },
  { id: 'SG-00558', name: 'Torres, Maria C.', rank: 'Security Guard II', detachment: 'R7-01', site: 'Subic Logistics', shift: 'Day', status: 'off-duty', license: 'SOSIA-2026-0559', licenseExp: '2027-09-11', cert: ['GSTP', 'BSTT'] },
  { id: 'SG-00614', name: 'Garcia, Roberto E.', rank: 'Security Guard I', detachment: 'R4A-01', site: 'Manila Port T3', shift: 'Day', status: 'absent', license: 'SOSIA-2025-0774', licenseExp: '2026-12-31', cert: ['GSTP'] },
  { id: 'SG-00721', name: 'Mendoza, Carmen R.', rank: 'Senior Security Guard', detachment: 'NCR-03', site: 'NAIA Terminal 3', shift: 'Day', status: 'on-duty', license: 'SOSIA-2024-0332', licenseExp: '2027-04-22', cert: ['GSTP', 'BSTT', 'FIRST AID', 'CPR'] },
  { id: 'SG-00834', name: 'Lopez, Fernando A.', rank: 'Security Guard III', detachment: 'R11-01', site: 'Subic Logistics', shift: 'Night', status: 'on-duty', license: 'SOSIA-2026-0128', licenseExp: '2027-02-09', cert: ['GSTP', 'BSTT'] },
]

const ddo = [
  { post: 'Post 1 – Main Lobby', site: 'BGC Financial Tower', assignee: 'Santos, Ricardo P.', shift: 'Day', timeIn: '06:02', status: 'active' },
  { post: 'Post 3 – Parking Deck B', site: 'Makati Central Mall', assignee: 'VACANT', shift: 'Day', timeIn: '–', status: 'vacant' },
  { post: 'Post 1 – Departure Hall', site: 'NAIA Terminal 3', assignee: 'Dela Cruz, Ana M.', shift: 'Night', timeIn: '18:05', status: 'active' },
  { post: 'Post 2 – Gate A', site: 'Clark Freeport', assignee: 'Bautista, Jose L.', shift: 'Day', timeIn: '06:00', status: 'active' },
  { post: 'Post 4 – Server Room', site: 'Makati Central Mall', assignee: 'VACANT', shift: 'Day', timeIn: '–', status: 'vacant' },
  { post: 'Post 1 – Perimeter Gate', site: 'Manila Port T3', assignee: 'VACANT', shift: 'Day', timeIn: '–', status: 'critical' },
]

const statusMap: Record<string, { color: string; bg: string; label: string }> = {
  'on-duty': { color: '#16a34a', bg: 'rgba(22,163,74,0.1)', label: 'ON DUTY' },
  'off-duty': { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: 'OFF DUTY' },
  'absent': { color: '#dc2626', bg: 'rgba(220,38,38,0.1)', label: 'ABSENT' },
  'active': { color: '#16a34a', bg: 'rgba(22,163,74,0.1)', label: 'ACTIVE' },
  'vacant': { color: '#d97706', bg: 'rgba(217,119,6,0.1)', label: 'VACANT' },
  'critical': { color: '#dc2626', bg: 'rgba(220,38,38,0.1)', label: 'CRITICAL' },
}

function Badge({ status }: { status: string }) {
  const s = statusMap[status] || { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: status.toUpperCase() }
  return (
    <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: s.color, background: s.bg, padding: '3px 8px', borderRadius: 4 }}>
      {s.label}
    </span>
  )
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'roster', label: 'Guard Roster / AO' },
  { id: 'deployment', label: 'DDO — Live Deployment' },
  { id: 'monitoring', label: 'Live Monitoring' },
  { id: 'attendance', label: 'Attendance & Timekeeping' },
  { id: 'training', label: 'Training & Certifications' },
]

export default function ManpowerModule() {
  const [tab, setTab] = useState<Tab>('roster')
  const [search, setSearch] = useState('')

  const filtered = guards.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.id.toLowerCase().includes(search.toLowerCase()) ||
    g.detachment.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 flex flex-col gap-5 min-h-full" style={{ background: 'transparent' }}>
      <div>
        <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.shellMuted, letterSpacing: '0.08em', marginBottom: 8 }}>MANPOWER MONITORING</div>
        <h1 className="page-title" style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 32, color: L.shellHeading, margin: 0, letterSpacing: '-0.04em' }}>Personnel & Deployment Management</h1>
      </div>

      {/* KPI row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'TOTAL GUARDS', value: '1,160', color: '#F06522' },
          { label: 'ON DUTY', value: '1,142', color: '#16a34a' },
          { label: 'ABSENT TODAY', value: '12', color: '#dc2626' },
          { label: 'OFF DUTY', value: '6', color: '#6b7280' },
        ].map(s => (
          <div key={s.label} style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, padding: '16px 20px', boxShadow: L.shadow }}>
            <div style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 500, color: L.muted, letterSpacing: '0.06em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 30, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${L.divider}` }}>
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="theme-tab"
              style={{
                fontFamily: 'Inter', fontWeight: 500, fontSize: 13,
                color: tab === t.id ? '#F06522' : L.shellMuted,
                background: 'none', border: 'none',
                borderBottom: tab === t.id ? '2px solid #F06522' : '2px solid transparent',
                padding: '8px 16px', cursor: 'pointer', marginBottom: -1, transition: 'color 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Roster tab */}
      {tab === 'roster' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <input
              placeholder="Search guard, ID, detachment..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.9)', border: `1px solid ${L.cardBorder}`, borderRadius: 8,
                padding: '9px 14px', fontFamily: 'Inter', fontSize: 13, color: L.heading, width: 280, outline: 'none',
                boxShadow: L.shadow,
              }}
            />
            <span style={{ fontFamily: 'Inter', fontSize: 12, color: L.shellMuted }}>{filtered.length} records</span>
          </div>
          <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: L.shadow }}>
            <div className="grid px-5 py-3" style={{ gridTemplateColumns: '90px 1fr 110px 120px 70px 90px', borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
              {['Guard ID', 'Name / Rank', 'Detachment', 'Site', 'Shift', 'Status'].map(h => (
                <div key={h} style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: L.muted, letterSpacing: '0.06em' }}>{h}</div>
              ))}
            </div>
            {filtered.map((g, i) => (
              <div
                key={g.id}
                className="grid px-5 py-3"
                style={{ gridTemplateColumns: '90px 1fr 110px 120px 70px 90px', borderBottom: i < filtered.length - 1 ? `1px solid ${L.divider}` : 'none', cursor: 'default', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.background = L.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: L.subtle }}>{g.id}</div>
                <div>
                  <div style={{ fontFamily: 'Inter', fontSize: 13, color: L.heading, fontWeight: 500 }}>{g.name}</div>
                  <div style={{ fontFamily: 'Inter', fontSize: 11, color: L.muted }}>{g.rank}</div>
                </div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: L.body }}>{g.detachment}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.body }}>{g.site}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.body }}>{g.shift}</div>
                <div><Badge status={g.status} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DDO tab */}
      {tab === 'deployment' && (
        <div>
          <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.shellMuted, marginBottom: 12 }}>DDO — DUTY DETAIL ORDER · LIVE POST ASSIGNMENTS</div>
          <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: L.shadow }}>
            <div className="grid px-5 py-3" style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 70px 90px', borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
              {['Post', 'Site', 'Assigned Guard', 'Shift', 'Time In', 'Status'].map(h => (
                <div key={h} style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: L.muted, letterSpacing: '0.06em' }}>{h}</div>
              ))}
            </div>
            {ddo.map((d, i) => (
              <div
                key={i}
                className="grid px-5 py-3"
                style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 70px 90px', borderBottom: i < ddo.length - 1 ? `1px solid ${L.divider}` : 'none', background: d.status === 'critical' ? 'rgba(220,38,38,0.03)' : 'transparent', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.background = L.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = d.status === 'critical' ? 'rgba(220,38,38,0.03)' : 'transparent')}
              >
                <div style={{ fontFamily: 'Inter', fontSize: 13, color: L.heading }}>{d.post}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.body }}>{d.site}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 13, color: d.assignee === 'VACANT' ? '#dc2626' : L.heading, fontWeight: d.assignee === 'VACANT' ? 600 : 400 }}>{d.assignee}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.body }}>{d.shift}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: L.muted }}>{d.timeIn}</div>
                <div><Badge status={d.status} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div>
          <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.shellMuted, marginBottom: 12 }}>ATTENDANCE & TIMEKEEPING · {new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}</div>
          <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: L.shadow }}>
            <div className="grid px-5 py-3" style={{ gridTemplateColumns: '90px 1fr 110px 70px 80px 80px 60px', borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
              {['Guard ID', 'Name', 'Detachment', 'Shift', 'Time In', 'Time Out', 'Hours'].map(h => (
                <div key={h} style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: L.muted, letterSpacing: '0.06em' }}>{h}</div>
              ))}
            </div>
            {guards.map((g, i) => (
              <div
                key={g.id}
                className="grid px-5 py-3"
                style={{ gridTemplateColumns: '90px 1fr 110px 70px 80px 80px 60px', borderBottom: i < guards.length - 1 ? `1px solid ${L.divider}` : 'none', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.background = L.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: L.subtle }}>{g.id}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 13, color: L.heading }}>{g.name}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: L.body }}>{g.detachment}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.body }}>{g.shift}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: g.status === 'absent' ? '#dc2626' : L.heading }}>
                  {g.status === 'absent' ? 'ABSENT' : '06:01'}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: L.muted }}>
                  {g.status === 'on-duty' ? '—' : g.status === 'absent' ? '—' : '18:02'}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: L.muted }}>
                  {g.status === 'absent' ? '—' : g.status === 'on-duty' ? (new Date().getHours() - 6).toFixed(1) : '12.0'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'monitoring' && (
        <div className="flex flex-col gap-4">
          <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.shellMuted, marginBottom: 0 }}>MOBILE WORKFORCE · GPS STATUS · MANPOWER UTILIZATION · ESCALATION CONTROL</div>

          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {[
              { label: 'GPS-TRACKED PERSONNEL', value: '1,142 / 1,160', detail: '98.4% reporting live', color: '#1976b9' },
              { label: 'DETACHMENTS ONLINE', value: '38 / 38', detail: 'All command nodes connected', color: '#16a34a' },
              { label: 'MOBILE WORKFORCE', value: '96%', detail: 'Active mobile check-ins', color: '#F06522' },
              { label: 'DEPLOYMENT UTILIZATION', value: '98.4%', detail: 'Against approved AO / DDO', color: '#7c3aed' },
            ].map(metric => (
              <div key={metric.label} style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, padding: '16px 18px', boxShadow: L.shadow }}>
                <div style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: L.muted, letterSpacing: '0.06em', marginBottom: 10 }}>{metric.label}</div>
                <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 25, color: metric.color, lineHeight: 1.1 }}>{metric.value}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.subtle, marginTop: 7 }}>{metric.detail}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
            <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: L.shadow }}>
              <div className="px-5 py-4" style={{ borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
                <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: L.heading }}>Personnel Monitoring by Detachment</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, marginTop: 3 }}>Live location and check-in health</div>
              </div>
              {[
                { name: 'NCR-01 · BGC / NAIA', deployed: '412 / 412', health: 'GPS healthy', color: '#16a34a', width: '100%' },
                { name: 'NCR-02 · Makati', deployed: '286 / 292', health: '6 absent', color: '#dc2626', width: '93%' },
                { name: 'R3-01 · Clark', deployed: '168 / 170', health: '2 pending check-in', color: '#d97706', width: '96%' },
                { name: 'R7-01 · Subic', deployed: '276 / 286', health: '10 posts monitored', color: '#1976b9', width: '97%' },
              ].map(row => (
                <div key={row.name} className="px-5 py-3" style={{ borderBottom: `1px solid ${L.divider}` }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 7 }}>
                    <span style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: L.heading }}>{row.name}</span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: L.body }}>{row.deployed}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div style={{ flex: 1, height: 7, background: 'rgba(54,126,171,0.12)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: row.width, height: '100%', background: row.color, borderRadius: 4 }} />
                    </div>
                    <span style={{ fontFamily: 'Inter', fontSize: 11, color: row.color, minWidth: 112, textAlign: 'right' }}>{row.health}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: L.shadow }}>
              <div className="px-5 py-4" style={{ borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
                <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: L.heading }}>Manpower Escalation Alerts</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, marginTop: 3 }}>Absenteeism, understaffing, and shortages</div>
              </div>
              {[
                { label: 'ABSENTEEISM', count: '12', detail: 'Guards absent today', color: '#dc2626', bg: 'rgba(220,38,38,0.08)' },
                { label: 'UNDERSTAFFING', count: '03', detail: 'Sites below approved DDO', color: '#d97706', bg: 'rgba(217,119,6,0.10)' },
                { label: 'PERSONNEL SHORTAGE', count: '06', detail: 'Vacant posts requiring action', color: '#F06522', bg: 'rgba(240,101,34,0.10)' },
              ].map(alert => (
                <div key={alert.label} className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${L.divider}` }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: alert.bg, color: alert.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{alert.count}</div>
                  <div>
                    <div style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 700, color: alert.color, letterSpacing: '0.05em' }}>{alert.label}</div>
                    <div style={{ fontFamily: 'Inter', fontSize: 13, color: L.body, marginTop: 3 }}>{alert.detail}</div>
                  </div>
                </div>
              ))}
              <div className="px-5 py-4">
                <button type="button" onClick={() => setTab('deployment')} style={{ width: '100%', fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: '#fff', background: '#1976b9', border: 'none', borderRadius: 7, padding: '10px 14px', cursor: 'pointer' }}>Open Escalation Queue</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'training' && (
        <div>
          <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.shellMuted, marginBottom: 12 }}>TRAINING RECORDS · CERTIFICATIONS · LICENSE TRACKING</div>
          <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: L.shadow }}>
            <div className="grid px-5 py-3" style={{ gridTemplateColumns: '1fr 180px 120px auto', borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
              {['Guard', 'SOSIA License No.', 'Expiry', 'Certifications'].map(h => (
                <div key={h} style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: L.muted, letterSpacing: '0.06em' }}>{h}</div>
              ))}
            </div>
            {guards.map((g, i) => {
              const days = daysUntil(g.licenseExp)
              const expColor = days < 30 ? '#dc2626' : days < 90 ? '#d97706' : '#16a34a'
              return (
                <div
                  key={g.id}
                  className="grid px-5 py-3"
                  style={{ gridTemplateColumns: '1fr 180px 120px auto', borderBottom: i < guards.length - 1 ? `1px solid ${L.divider}` : 'none', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.background = L.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div>
                    <div style={{ fontFamily: 'Inter', fontSize: 13, color: L.heading, fontWeight: 500 }}>{g.name}</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: L.subtle }}>{g.id}</div>
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: L.body }}>{g.license}</div>
                  <div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: expColor }}>{g.licenseExp}</div>
                    <div style={{ fontFamily: 'Inter', fontSize: 10, color: expColor }}>{days < 0 ? 'EXPIRED' : `${days}d left`}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {g.cert.map(c => (
                      <span key={c} style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 500, color: '#F06522', background: 'rgba(240,101,34,0.08)', padding: '2px 7px', borderRadius: 4, border: '1px solid rgba(240,101,34,0.2)' }}>{c}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
