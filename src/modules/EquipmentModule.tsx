import { useState } from 'react'
import { usePortalData } from '../state/PortalDataContext'

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
}

type Tab = 'inventory' | 'maintenance' | 'controls' | 'reports'

const firearms = [
  { id: 'FN-0021', model: 'Beretta M9', serial: 'BM9-PH-204471', caliber: '9mm', assignee: 'Santos, Ricardo P.', site: 'BGC Financial Tower', status: 'serviceable', lastPM: '2026-06-15', nextPM: '2026-12-15' },
  { id: 'FN-0029', model: 'Glock 17', serial: 'GL17-PH-118823', caliber: '9mm', assignee: 'Unassigned', site: 'Armory NCR', status: 'due-pm', lastPM: '2025-12-01', nextPM: '2026-06-01' },
  { id: 'FN-0047', model: 'Mossberg 500', serial: 'M500-PH-003347', caliber: '12GA', assignee: 'Dela Cruz, Ana M.', site: 'NAIA Terminal 3', status: 'serviceable', lastPM: '2026-07-20', nextPM: '2027-01-20' },
  { id: 'FN-0061', model: 'Beretta M9', serial: 'BM9-PH-204502', caliber: '9mm', assignee: 'Mendoza, Carmen R.', site: 'NAIA Terminal 3', status: 'under-repair', lastPM: '2026-05-10', nextPM: '2026-11-10' },
  { id: 'FN-0082', model: 'M16A1', serial: 'M16-PH-001188', caliber: '5.56mm', assignee: 'Bautista, Jose L.', site: 'Clark Freeport', status: 'serviceable', lastPM: '2026-08-01', nextPM: '2027-02-01' },
]

const radios = [
  { id: 'RD-0114', model: 'Motorola DP4400e', serial: 'MDP-PH-884421', assignee: 'Santos, Ricardo P.', site: 'BGC Tower', status: 'serviceable', battery: 87 },
  { id: 'RD-0128', model: 'Kenwood TK-3402', serial: 'KTK-PH-221347', assignee: 'Reyes, Manuel F.', site: 'Makati Mall', status: 'lost', battery: 0 },
  { id: 'RD-0133', model: 'Motorola DP4400e', serial: 'MDP-PH-884455', assignee: 'Dela Cruz, Ana M.', site: 'NAIA T3', status: 'serviceable', battery: 62 },
  { id: 'RD-0151', model: 'Kenwood TK-3402', serial: 'KTK-PH-221401', assignee: 'Unassigned', site: 'Armory NCR', status: 'charging', battery: 34 },
  { id: 'RD-0167', model: 'Motorola DP4400e', serial: 'MDP-PH-884507', assignee: 'Garcia, Roberto E.', site: 'Manila Port', status: 'defective', battery: 0 },
]

const maintenance = [
  { wo: 'WO-2026-0441', equipment: 'FN-0029 — Glock 17', type: 'Preventive Maintenance', priority: 'High', due: '2026-06-01', tech: 'Armorer Villareal, D.', status: 'overdue' },
  { wo: 'WO-2026-0448', equipment: 'FN-0061 — Beretta M9', type: 'Corrective Repair', priority: 'Critical', due: '2026-09-20', tech: 'Armorer Santos, M.', status: 'in-progress' },
  { wo: 'WO-2026-0455', equipment: 'RD-0167 — Motorola DP4400e', type: 'Corrective Repair', priority: 'Medium', due: '2026-09-28', tech: 'Tech Aquino, R.', status: 'scheduled' },
  { wo: 'WO-2026-0461', equipment: 'FN-0082 — M16A1', type: 'Preventive Maintenance', priority: 'Low', due: '2027-02-01', tech: 'Armorer Villareal, D.', status: 'scheduled' },
]

const statusMap: Record<string, { color: string; bg: string }> = {
  serviceable: { color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  'due-pm': { color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
  'under-repair': { color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  overdue: { color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
  'in-progress': { color: '#F06522', bg: 'rgba(240,101,34,0.08)' },
  scheduled: { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  lost: { color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
  defective: { color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
  charging: { color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
}

function Badge({ status }: { status: string }) {
  const s = statusMap[status] || { color: '#6b7280', bg: 'rgba(107,114,128,0.1)' }
  return (
    <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', color: s.color, background: s.bg, padding: '3px 8px', borderRadius: 4 }}>
      {status.replace('-', ' ').toUpperCase()}
    </span>
  )
}

function BatteryBar({ pct }: { pct: number }) {
  const color = pct > 50 ? '#16a34a' : pct > 20 ? '#d97706' : '#dc2626'
  return (
    <div className="flex items-center gap-2">
      <div style={{ width: 44, height: 8, background: 'rgba(0,0,0,0.07)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: L.muted }}>{pct}%</span>
    </div>
  )
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'inventory', label: 'Inventory & Assignment' },
  { id: 'maintenance', label: 'Maintenance Scheduling' },
  { id: 'controls', label: 'Lifecycle & Alerts' },
  { id: 'reports', label: 'Utilization Reports' },
]

export default function EquipmentModule({ canEdit = false, canReport = false }: { canEdit?: boolean; canReport?: boolean }) {
  const { addActivity, recordEquipmentFault, equipmentFaults, activities, isLive } = usePortalData()
  const [tab, setTab] = useState<Tab>('inventory')
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<string[]>([])
  const [faultFormOpen, setFaultFormOpen] = useState(false)
  const [faultSubmitted, setFaultSubmitted] = useState(false)
  const [faultAsset, setFaultAsset] = useState('')
  const [faultDescription, setFaultDescription] = useState('')

  return (
    <div className="p-6 flex flex-col gap-5 min-h-full" style={{ background: 'transparent' }}>
      <div>
        <div style={{ fontFamily: 'Inter', fontSize: 11, color: L.muted, letterSpacing: '0.08em', marginBottom: 4 }}>EQUIPMENT ACCOUNTABILITY</div>
        <h1 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 24, color: L.heading, margin: 0 }}>Assets & Equipment Management</h1>
      </div>

      <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, padding: '12px 16px', boxShadow: L.shadow }}>
        <div className="flex items-center justify-between"><div><div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 13, color: L.heading }}>Personnel Equipment Updates</div><div style={{ fontFamily: 'Inter', fontSize: 11, color: L.muted }}>Shared assignments and defect reports · {isLive ? 'Live sync' : 'Offline'}</div></div><span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#d97706' }}>{equipmentFaults} ISSUES</span></div>
        {activities.find(activity => activity.type === 'EQUIPMENT_FAULT') && <div style={{ borderTop: `1px solid ${L.divider}`, marginTop: 8, paddingTop: 7, fontFamily: 'Inter', fontSize: 11, color: L.body }}>{activities.find(activity => activity.type === 'EQUIPMENT_FAULT')?.message}</div>}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {[
          { label: 'TOTAL ASSETS', value: '1,289', color: '#F06522' },
          { label: 'FIREARMS', value: '194', color: L.heading },
          { label: 'RADIOS', value: '317', color: L.heading },
          { label: 'SERVICEABLE', value: '1,204', color: '#16a34a' },
          { label: 'REQUIRING ACTION', value: '85', color: '#dc2626' },
        ].map(s => (
          <div key={s.label} style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, padding: '14px 18px', boxShadow: L.shadow }}>
            <div style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 500, color: L.muted, letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 26, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ borderBottom: `1px solid ${L.divider}` }}>
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); addActivity('Detachment Staff', 'VIEW', `Opened equipment view: ${t.label}`) }}
              style={{
                fontFamily: 'Inter', fontWeight: 500, fontSize: 13,
                color: tab === t.id ? '#F06522' : L.muted,
                background: 'none', border: 'none',
                borderBottom: tab === t.id ? '2px solid #F06522' : '2px solid transparent',
                padding: '8px 16px', cursor: 'pointer', marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'inventory' && (
        <div className="flex flex-col gap-5">
          <div>
            <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: L.muted, letterSpacing: '0.04em', marginBottom: 10 }}>FIREARMS</div>
            <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: L.shadow }}>
              <div className="grid px-5 py-3" style={{ gridTemplateColumns: '80px 160px 160px 60px 160px 100px 100px', borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
                {['Asset ID', 'Model / Serial', 'Assigned To', 'Cal.', 'Site', 'Last PM', 'Status'].map(h => (
                  <div key={h} style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: L.muted, letterSpacing: '0.06em' }}>{h}</div>
                ))}
              </div>
              {firearms.map((f, i) => (
                <div
                  key={f.id}
                  className="grid px-5 py-3"
                  style={{ gridTemplateColumns: '80px 160px 160px 60px 160px 100px 100px', borderBottom: i < firearms.length - 1 ? `1px solid ${L.divider}` : 'none', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.background = L.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#F06522', fontWeight: 500 }}>{f.id}</div>
                  <div>
                    <div style={{ fontFamily: 'Inter', fontSize: 13, color: L.heading }}>{f.model}</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: L.subtle }}>{f.serial}</div>
                  </div>
                  <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.body }}>{f.assignee}</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: L.body }}>{f.caliber}</div>
                  <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.body }}>{f.site}</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: L.muted }}>{f.lastPM}</div>
                  <div><Badge status={f.status} /></div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: L.muted, letterSpacing: '0.04em', marginBottom: 10 }}>RADIO COMMUNICATIONS</div>
            <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: L.shadow }}>
              <div className="grid px-5 py-3" style={{ gridTemplateColumns: '80px 200px 160px 160px 100px 100px', borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
                {['Asset ID', 'Model', 'Serial', 'Assigned To', 'Battery', 'Status'].map(h => (
                  <div key={h} style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: L.muted, letterSpacing: '0.06em' }}>{h}</div>
                ))}
              </div>
              {radios.map((r, i) => (
                <div
                  key={r.id}
                  className="grid px-5 py-3"
                  style={{ gridTemplateColumns: '80px 200px 160px 160px 100px 100px', borderBottom: i < radios.length - 1 ? `1px solid ${L.divider}` : 'none', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.background = L.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#6366f1', fontWeight: 500 }}>{r.id}</div>
                  <div style={{ fontFamily: 'Inter', fontSize: 13, color: L.heading }}>{r.model}</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: L.subtle }}>{r.serial}</div>
                  <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.body }}>{r.assignee}</div>
                  <BatteryBar pct={r.battery} />
                  <div><Badge status={r.status} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'maintenance' && (
        <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: L.shadow }}>
          <div className="grid px-5 py-3" style={{ gridTemplateColumns: '130px 1fr 160px 80px 110px 160px 110px', borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
            {['Work Order', 'Equipment', 'Type', 'Priority', 'Due Date', 'Technician', 'Status'].map(h => (
              <div key={h} style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: L.muted, letterSpacing: '0.06em' }}>{h}</div>
            ))}
          </div>
          {maintenance.map((m, i) => (
            <div
              key={m.wo}
              className="grid px-5 py-3"
              style={{ gridTemplateColumns: '130px 1fr 160px 80px 110px 160px 110px', borderBottom: i < maintenance.length - 1 ? `1px solid ${L.divider}` : 'none', background: m.status === 'overdue' ? 'rgba(220,38,38,0.03)' : 'transparent', alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = L.rowHover)}
              onMouseLeave={e => (e.currentTarget.style.background = m.status === 'overdue' ? 'rgba(220,38,38,0.03)' : 'transparent')}
            >
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#d97706', fontWeight: 500 }}>{m.wo}</div>
              <div style={{ fontFamily: 'Inter', fontSize: 13, color: L.heading }}>{m.equipment}</div>
              <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.body }}>{m.type}</div>
              <div style={{ fontFamily: 'Inter', fontSize: 12, color: m.priority === 'Critical' ? '#dc2626' : m.priority === 'High' ? '#d97706' : L.muted, fontWeight: 500 }}>{m.priority}</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: m.status === 'overdue' ? '#dc2626' : L.muted }}>{m.due}</div>
              <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.body }}>{m.tech}</div>
              <div><Badge status={m.status} /></div>
            </div>
          ))}
        </div>
      )}

      {tab === 'reports' && (
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {[
            { title: 'Firearms Serviceability Rate', value: '94.2%', sub: '183 serviceable of 194 total', color: '#16a34a' },
            { title: 'Radios Serviceability Rate', value: '89.1%', sub: '283 serviceable of 317 total', color: '#d97706' },
            { title: 'Overdue Preventive Maintenance', value: '7', sub: 'Requires immediate scheduling', color: '#dc2626' },
            { title: 'Assets Under Repair', value: '12', sub: '8 firearms · 4 radios', color: '#6366f1' },
          ].map(r => (
            <div key={r.title} style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, padding: '24px', boxShadow: L.shadow }}>
              <div style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: L.muted, letterSpacing: '0.06em', marginBottom: 10 }}>{r.title.toUpperCase()}</div>
              <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 44, color: r.color, lineHeight: 1 }}>{r.value}</div>
              <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, marginTop: 8 }}>{r.sub}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'controls' && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {[
              { label: 'ASSETS IN SERVICE', value: '1,204', detail: '93.4% of registered assets', color: '#16a34a' },
              { label: 'DUE FOR MAINTENANCE', value: '07', detail: 'Preventive work orders overdue', color: '#dc2626' },
              { label: 'FAULT / DEFECT REPORTS', value: '12', detail: '8 firearms · 4 radios', color: '#d97706' },
              { label: 'ASSET RETIREMENTS', value: '04', detail: 'Pending lifecycle review', color: '#6366f1' },
            ].map(metric => (
              <div key={metric.label} style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, padding: '16px 18px', boxShadow: L.shadow }}>
                <div style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: L.muted, letterSpacing: '0.06em', marginBottom: 8 }}>{metric.label}</div>
                <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 30, color: metric.color }}>{metric.value}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.subtle, marginTop: 5 }}>{metric.detail}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: '1.15fr 1fr' }}>
            <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: L.shadow }}>
              <div className="px-5 py-4" style={{ borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
                <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: L.heading }}>Asset Lifecycle Register</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, marginTop: 3 }}>Acquisition, assignment, maintenance, and retirement status</div>
              </div>
              <div className="grid px-5 py-3" style={{ gridTemplateColumns: '100px 1fr 115px 110px', borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
                {['Asset', 'Assigned To', 'Lifecycle', 'Next Action'].map(h => <div key={h} style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: L.muted, letterSpacing: '0.06em' }}>{h}</div>)}
              </div>
              {[
                { asset: 'FN-0021', owner: 'Santos, Ricardo P.', stage: 'IN SERVICE', next: 'Routine PM', color: '#16a34a' },
                { asset: 'FN-0061', owner: 'Mendoza, Carmen R.', stage: 'UNDER REPAIR', next: 'Close WO-0448', color: '#6366f1' },
                { asset: 'RD-0167', owner: 'Garcia, Roberto E.', stage: 'DEFECTIVE', next: 'Replace radio', color: '#d97706' },
                { asset: 'FN-0029', owner: 'Unassigned · Armory NCR', stage: 'OVERDUE PM', next: 'Schedule PM', color: '#dc2626' },
              ].map((item, index, rows) => (
                <div key={item.asset} className="grid px-5 py-3" style={{ gridTemplateColumns: '100px 1fr 115px 110px', borderBottom: index < rows.length - 1 ? `1px solid ${L.divider}` : 'none', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#F06522', fontWeight: 600 }}>{item.asset}</span>
                  <span style={{ fontFamily: 'Inter', fontSize: 12, color: L.body }}>{item.owner}</span>
                  <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, color: item.color }}>{item.stage}</span>
                  <span style={{ fontFamily: 'Inter', fontSize: 11, color: L.muted }}>{item.next}</span>
                </div>
              ))}
            </div>

            <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: L.shadow }}>
              <div className="px-5 py-4" style={{ borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
                <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: L.heading }}>Equipment Issue Alerts</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, marginTop: 3 }}>Overdue maintenance and reported defects</div>
              </div>
              {[
                { id: 'pm-0029', title: 'Preventive maintenance overdue', detail: 'FN-0029 · Glock 17 · 112 days', color: '#dc2626' },
                { id: 'fault-0167', title: 'Radio marked defective', detail: 'RD-0167 · Motorola DP4400e', color: '#d97706' },
                { id: 'repair-0061', title: 'Critical repair in progress', detail: 'FN-0061 · Follow up WO-2026-0448', color: '#6366f1' },
              ].map(alert => {
                const acknowledged = acknowledgedAlerts.includes(alert.id)
                return (
                  <div key={alert.id} className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${L.divider}`, opacity: acknowledged ? 0.55 : 1 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: alert.color, boxShadow: `0 0 7px ${alert.color}`, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: L.heading }}>{alert.title}</div>
                      <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, marginTop: 3 }}>{alert.detail}</div>
                    </div>
                    <button type="button" disabled={acknowledged || !canEdit} onClick={() => setAcknowledgedAlerts(current => [...current, alert.id])} style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: acknowledged || !canEdit ? L.subtle : alert.color, background: 'transparent', border: `1px solid ${acknowledged || !canEdit ? L.cardBorder : alert.color}`, borderRadius: 6, padding: '5px 9px', cursor: acknowledged || !canEdit ? 'not-allowed' : 'pointer' }}>{acknowledged ? 'Acknowledged' : canEdit ? 'Acknowledge' : 'Admin action'}</button>
                  </div>
                )
              })}
              <div className="px-5 py-4">
                {!canReport && <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, background: 'rgba(25,118,185,0.06)', border: `1px solid ${L.cardBorder}`, borderRadius: 7, padding: '9px 12px', textAlign: 'center' }}>Fault and defect updates are managed by Administrator Portal.</div>}
                {canReport && (faultSubmitted ? (
                  <div style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: '#16a34a', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 7, padding: '10px 14px', textAlign: 'center' }}>Fault report submitted to Equipment Control.</div>
                ) : faultFormOpen ? (
                  <form className="flex flex-col gap-2" onSubmit={event => { event.preventDefault(); setFaultSubmitted(true); setFaultFormOpen(false); recordEquipmentFault(); addActivity('Equipment Control', 'FAULT_REPORT', `Fault reported for ${faultAsset}: ${faultDescription}`) }}>
                    <select value={faultAsset} onChange={event => setFaultAsset(event.target.value)} required style={{ background: L.cardSoft, border: `1px solid ${L.cardBorder}`, borderRadius: 6, padding: '8px 10px', fontFamily: 'Inter', fontSize: 13, color: L.heading }}>
                      <option value="">Select asset...</option>
                      <option>FN-0061 — Beretta M9</option>
                      <option>RD-0167 — Motorola DP4400e</option>
                      <option>RD-0128 — Kenwood TK-3402</option>
                    </select>
                    <input value={faultDescription} onChange={event => setFaultDescription(event.target.value)} required placeholder="Describe the fault or defect..." style={{ background: L.cardSoft, border: `1px solid ${L.cardBorder}`, borderRadius: 6, padding: '8px 10px', fontFamily: 'Inter', fontSize: 13, color: L.heading }} />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFaultFormOpen(false)} style={{ flex: 1, fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: L.body, background: 'transparent', border: `1px solid ${L.cardBorder}`, borderRadius: 6, padding: '8px', cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" style={{ flex: 1, fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: '#fff', background: '#1976b9', border: 'none', borderRadius: 6, padding: '8px', cursor: 'pointer' }}>Submit Report</button>
                    </div>
                  </form>
                ) : (
                  <button type="button" onClick={() => setFaultFormOpen(true)} style={{ width: '100%', fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: '#fff', background: '#1976b9', border: 'none', borderRadius: 7, padding: '10px 14px', cursor: 'pointer' }}>Report Fault / Defect</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
