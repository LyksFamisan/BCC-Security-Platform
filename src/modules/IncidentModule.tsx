import { useState } from 'react'
import { usePortalData } from '../state/PortalDataContext'
import { downloadCsv } from '../utils/download'

type Tab = 'list' | 'detail' | 'workflow' | 'analytics'

const incidents = [
  { id: 'INC-2026-0847', title: 'Armed Robbery Attempt — BGC Gate 5', type: 'Armed Robbery', severity: 'P1', site: 'BGC Financial Tower', client: 'Aegis Holdings', reportedBy: 'SG Santos, Ricardo P.', reportedAt: '2026-09-20 03:42', status: 'open', assignedTo: 'Det. Commander Cruz, A.', description: 'Unknown male attempted armed robbery at Gate 5 during early morning hours. Guard Santos raised alarm; suspect fled. CCTV footage secured.', rootCause: 'Pending investigation', action: 'Coordinating with PNP BGC; reviewing CCTV. Increased post frequency at Gate 5.', severityLabel: 'Priority 1 — Immediate' },
  { id: 'INC-2026-0846', title: 'Unscheduled Firearms Vault Lockout', type: 'Equipment', severity: 'P1', site: 'Manila Port Terminal 3', client: 'National Transit', reportedBy: 'SGL Fernandez, M.', reportedAt: '2026-09-20 08:14', status: 'escalated', assignedTo: 'OPS Manager Villanueva, K.', description: 'Firearms vault engaged automatic lockout protocol after failed biometric attempts. 3 guards unable to draw assigned firearms before shift.', rootCause: 'Biometric reader malfunction — sensor humidity damage.', action: 'Armorer dispatched. Temporary manual override authorized by OIC. Sensor replacement ordered.', severityLabel: 'Priority 1 — Immediate' },
  { id: 'INC-2026-0844', title: 'Understaffing — Makati Central Mall', type: 'Personnel', severity: 'P2', site: 'Makati Central Mall', client: 'Filinvest Group', reportedBy: 'Det. Commander Reyes, L.', reportedAt: '2026-09-20 06:00', status: 'escalated', assignedTo: 'OPS Manager Villanueva, K.', description: '4 guards failed to report for duty. Emergency manpower request submitted to NCR reserve pool.', rootCause: 'Under investigation — alleged illness, one confirmed AWL.', action: 'Relief guards deployed from NCR reserve. HR notified. AWL guard placed on preventive suspension.', severityLabel: 'Priority 2 — High' },
  { id: 'INC-2026-0839', title: 'Vehicle Vandalism — Subic Depot', type: 'Vandalism', severity: 'P3', site: 'Subic Logistics Depot', client: 'CAT Storage', reportedBy: 'SG Bautista, Jose L.', reportedAt: '2026-09-18 14:30', status: 'closed', assignedTo: 'SGL Pascual, E.', description: 'Three vehicles vandalized in Parking Zone B. Scratches and broken windshield reported.', rootCause: 'Blind spot in camera coverage.', action: 'Additional camera installed. Case forwarded to client security. Closed.', severityLabel: 'Priority 3 — Moderate' },
  { id: 'INC-2026-0831', title: 'Communication Drop — SatRadio-04', type: 'Equipment', severity: 'P3', site: 'Subic Logistics Depot', client: 'CAT Storage', reportedBy: 'SG Torres, Maria C.', reportedAt: '2026-09-20 07:45', status: 'under-investigation', assignedTo: 'Tech Aquino, R.', description: 'SatRadio-04 lost communication for 38 minutes during overnight shift. Backup radio activated.', rootCause: 'Battery failure during cold-weather conditions.', action: 'Radio returned to armory. Replacement issued. All radios scheduled for battery inspection.', severityLabel: 'Priority 3 — Moderate' },
]

const severityStyle: Record<string, { color: string; bg: string }> = {
  P1: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  P2: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  P3: { color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
}

const statusStyle: Record<string, { color: string; bg: string }> = {
  open: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  escalated: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  'under-investigation': { color: '#F06522', bg: 'rgba(0,212,255,0.08)' },
  closed: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
}

function SBadge({ s, label }: { s: { color: string; bg: string }; label: string }) {
  return (
    <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: s.color, background: s.bg, padding: '3px 8px', borderRadius: 4 }}>
      {label}
    </span>
  )
}

const trendData = [
  { month: 'Apr', count: 8 }, { month: 'May', count: 11 }, { month: 'Jun', count: 7 },
  { month: 'Jul', count: 14 }, { month: 'Aug', count: 9 }, { month: 'Sep', count: 6 },
]
const trendMax = Math.max(...trendData.map(d => d.count))

const tabs: { id: Tab; label: string }[] = [
  { id: 'list', label: 'Incident Register' },
  { id: 'detail', label: 'Case Detail' },
  { id: 'workflow', label: 'Digital Workflow' },
  { id: 'analytics', label: 'Analytics & Trends' },
]

// Dark home-page theme tokens
const L = {
  appBg: '#eaf6ff',
  panel: '#ffffff',
  panelAlt: '#edf8ff',
  card: '#ffffff',
  cardSoft: '#f3faff',
  cardBorder: 'rgba(54,126,171,0.16)',
  heading: '#12304a',
  body: '#244d6b',
  muted: '#52718b',
  subtle: '#7190a7',
  divider: 'rgba(54,126,171,0.14)',
  rowHover: 'rgba(76,169,223,0.08)',
  inset: 'rgba(0,0,0,0.04)',
  filterIdle: 'rgba(255,255,255,0.04)',
  filterIdleBorder: 'rgba(148,163,184,0.14)',
}

export default function IncidentModule({ canEdit = false, canReport = false }: { canEdit?: boolean; canReport?: boolean }) {
  const { addActivity, recordIncident, incidentHistory, isLive } = usePortalData()
  const [tab, setTab] = useState<Tab>('list')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [workflowState, setWorkflowState] = useState({ approved: false, investigationStarted: false, rootCauseReviewed: false, actionsClosed: false })
  const [reportOpen, setReportOpen] = useState(false)
  const [reportType, setReportType] = useState('')
  const [reportSite, setReportSite] = useState('')
  const [reportSeverity, setReportSeverity] = useState('P2')
  const [reportDescription, setReportDescription] = useState('')

  const filtered = incidents.filter(i => filter === 'all' || i.severity === filter)
  const selectedInc = incidents.find(i => i.id === selected)

  const downloadIncidents = () => downloadCsv('bcc-cat-incident-register.csv', ['Case ID', 'Title', 'Type', 'Severity', 'Site', 'Client', 'Status', 'Assigned To'], incidents.map(incident => [incident.id, incident.title, incident.type, incident.severity, incident.site, incident.client, incident.status, incident.assignedTo]))

  function openCase(id: string) {
    setSelected(id)
    setTab('detail')
  }

  return (
    <div className="p-6 flex flex-col gap-5 min-h-full" style={{ background: 'transparent' }}>
      <div>
        <div style={{ fontFamily: 'Inter', fontSize: 12, color: '#9bb3d1', letterSpacing: '0.08em', marginBottom: 8 }}>INCIDENT RESOLUTION</div>
        <div className="flex items-center justify-between gap-3">
          <h1 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 32, color: L.heading, margin: 0, letterSpacing: '-0.04em' }}>Incident Reporting & Case Management</h1>
          <div className="flex items-center gap-2">{canReport && <button type="button" onClick={() => setReportOpen(value => !value)} style={{ background: '#F06522', border: 'none', borderRadius: 8, padding: '10px 14px', color: '#fff', fontFamily: 'Inter', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{reportOpen ? 'Close Report' : 'New Incident Report'}</button>}<button type="button" onClick={downloadIncidents} style={{ background: '#1976b9', border: 'none', borderRadius: 8, padding: '10px 14px', color: '#fff', fontFamily: 'Inter', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Download CSV</button></div>
        </div>
      </div>

      <div style={{ background: '#ffffff', border: `1px solid ${L.cardBorder}`, borderRadius: 10, padding: '12px 16px', boxShadow: '0 10px 22px rgba(54,126,171,0.08)' }}>
        <div className="flex items-center justify-between"><div><div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 13, color: L.heading }}>Personnel Portal Reports</div><div style={{ fontFamily: 'Inter', fontSize: 11, color: L.muted }}>Shared submissions from Security Personnel · {isLive ? 'Live sync' : 'Offline'}</div></div><span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#dc2626' }}>{incidentHistory.length} TOTAL</span></div>
        {incidentHistory.length > 0 && <div className="flex flex-col gap-1" style={{ marginTop: 9 }}>{incidentHistory.slice(0, 3).map(record => <div key={record.id} className="flex items-center justify-between gap-3" style={{ borderTop: `1px solid ${L.divider}`, paddingTop: 7, fontFamily: 'Inter', fontSize: 11, color: L.body }}><span>{record.type} · {record.location} · {record.severity}</span><span style={{ color: '#1976b9', fontWeight: 700 }}>{record.status}</span></div>)}</div>}
      </div>

      {reportOpen && (
        <form
          onSubmit={event => {
            event.preventDefault()
            recordIncident()
            addActivity('Operations Staff', 'INCIDENT_REPORT', `${reportSeverity} ${reportType || 'incident'} reported at ${reportSite || 'assigned site'}`)
            setReportOpen(false)
            setReportType('')
            setReportSite('')
            setReportSeverity('P2')
            setReportDescription('')
          }}
          style={{ background: '#ffffff', border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: 18, boxShadow: '0 12px 24px rgba(54,126,171,0.12)' }}
        >
          <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: L.heading, marginBottom: 12 }}>Operational Incident Intake</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 140px' }}>
            <input value={reportType} onChange={event => setReportType(event.target.value)} placeholder="Incident type" required style={{ background: '#f3faff', border: `1px solid ${L.cardBorder}`, borderRadius: 7, padding: '9px 11px', fontFamily: 'Inter', fontSize: 13, color: L.heading }} />
            <input value={reportSite} onChange={event => setReportSite(event.target.value)} placeholder="Site / post / detachment" required style={{ background: '#f3faff', border: `1px solid ${L.cardBorder}`, borderRadius: 7, padding: '9px 11px', fontFamily: 'Inter', fontSize: 13, color: L.heading }} />
            <select value={reportSeverity} onChange={event => setReportSeverity(event.target.value)} style={{ background: '#f3faff', border: `1px solid ${L.cardBorder}`, borderRadius: 7, padding: '9px 11px', fontFamily: 'Inter', fontSize: 13, color: L.heading }}><option>P1</option><option>P2</option><option>P3</option></select>
          </div>
          <textarea value={reportDescription} onChange={event => setReportDescription(event.target.value)} placeholder="Describe the event, personnel involved, and immediate action taken..." required rows={3} style={{ width: '100%', marginTop: 10, background: '#f3faff', border: `1px solid ${L.cardBorder}`, borderRadius: 7, padding: '9px 11px', fontFamily: 'Inter', fontSize: 13, color: L.heading, resize: 'vertical' }} />
          <div className="flex justify-end" style={{ marginTop: 10 }}><button type="submit" style={{ background: '#dc2626', border: 'none', borderRadius: 7, padding: '9px 14px', color: '#fff', fontFamily: 'Inter', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Submit Incident</button></div>
        </form>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        {[
          { label: 'OPEN CASES', value: incidents.filter(i => i.status === 'open').length, color: '#ef4444' },
          { label: 'ESCALATED', value: incidents.filter(i => i.status === 'escalated').length, color: '#f59e0b' },
          { label: 'UNDER INVESTIGATION', value: incidents.filter(i => i.status === 'under-investigation').length, color: '#F06522' },
          { label: 'CLOSED (30D)', value: incidents.filter(i => i.status === 'closed').length, color: '#22c55e' },
          { label: 'P1 ACTIVE', value: incidents.filter(i => i.severity === 'P1' && i.status !== 'closed').length, color: '#ef4444' },
        ].map(s => (
          <div key={s.label} style={{ background: L.card, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 12, padding: '18px 20px 16px', boxShadow: '0 12px 22px rgba(2,6,23,0.18)', minHeight: 104 }}>
            <div style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, color: '#5a6475', letterSpacing: '0.08em', marginBottom: 10 }}>{s.label}</div>
            <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 38, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ borderBottom: `1px solid ${L.divider}` }}>
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                fontFamily: 'Inter', fontWeight: 500, fontSize: 14,
                color: tab === t.id ? '#F06522' : '#90a6c5',
                background: 'none', border: 'none',
                borderBottom: tab === t.id ? '2px solid #F06522' : '2px solid transparent',
                padding: '10px 18px', cursor: 'pointer', marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'list' && (
        <div>
          <div className="flex gap-2 mb-4">
            {['all', 'P1', 'P2', 'P3'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontFamily: 'Inter', fontSize: 12, fontWeight: 600, padding: '7px 15px', borderRadius: 8, cursor: 'pointer',
                  background: filter === f ? '#F06522' : 'rgba(255,255,255,0.04)',
                  color: filter === f ? '#fff' : '#16476d',
                  border: filter === f ? 'none' : `1px solid ${L.filterIdleBorder}`,
                  boxShadow: filter === f ? '0 10px 18px rgba(240,101,34,0.20)' : 'none',
                }}
              >
                {f === 'all' ? 'All Incidents' : f}
              </button>
            ))}
          </div>

          <div style={{ background: '#ffffff', border: `1px solid ${L.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 14px 30px rgba(54,126,171,0.12)' }}>
            <div className="grid px-5 py-3" style={{ gridTemplateColumns: '150px 1.5fr 180px 160px 120px 90px', borderBottom: `1px solid ${L.divider}`, background: 'rgba(255,255,255,0.03)' }}>
              {['Case ID', 'Title', 'Severity', 'Site', 'Status', 'Action'].map(h => (
                <div key={h} style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, color: '#a8bdd9', letterSpacing: '0.08em' }}>{h}</div>
              ))}
            </div>

            {filtered.map((inc, i) => (
              <div
                key={inc.id}
                className="grid px-5 py-3 items-center"
                style={{
                  gridTemplateColumns: '150px 1.5fr 180px 160px 120px 90px',
                  borderBottom: i < filtered.length - 1 ? `1px solid ${L.divider}` : 'none',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)')}
              >
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#ffb37c', fontWeight: 600 }}>{inc.id}</div>
                <div>
                  <div style={{ fontFamily: 'Inter', fontSize: 14, color: L.heading, fontWeight: 600 }}>{inc.title}</div>
                  <div style={{ fontFamily: 'Inter', fontSize: 11, color: '#9bb0cc', marginTop: 2 }}>{inc.reportedAt} · {inc.reportedBy}</div>
                </div>
                <div><SBadge s={severityStyle[inc.severity]} label={`${inc.severity} — ${inc.type}`} /></div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.body }}>{inc.site}</div>
                <div><SBadge s={statusStyle[inc.status]} label={inc.status.replace('-', ' ').toUpperCase()} /></div>
                <div>
                  <button
                    onClick={() => openCase(inc.id)}
                    style={{
                      fontFamily: 'Inter', fontSize: 12, color: '#F06522', background: 'transparent',
                      border: '1px solid rgba(240,101,34,0.55)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
                    }}
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'detail' && selectedInc && (
        <div style={{ background: '#ffffff', border: `1px solid ${L.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 14px 30px rgba(54,126,171,0.12)' }}>
          <div className="flex items-start justify-between px-6 py-5" style={{ borderBottom: `1px solid ${L.divider}`, background: 'rgba(255,255,255,0.04)' }}>
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: '#ffb37c', fontWeight: 600 }}>{selectedInc.id}</span>
                <SBadge s={severityStyle[selectedInc.severity]} label={selectedInc.severityLabel} />
                <SBadge s={statusStyle[selectedInc.status]} label={selectedInc.status.replace('-', ' ').toUpperCase()} />
              </div>
              <h2 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 23, color: L.heading, margin: 0 }}>{selectedInc.title}</h2>
            </div>
          </div>

          <div className="grid px-6 py-5 gap-6" style={{ gridTemplateColumns: '1.3fr 300px' }}>
            <div className="flex flex-col gap-5">
              {[
                { label: 'INCIDENT DESCRIPTION', content: selectedInc.description },
                { label: 'ROOT CAUSE ANALYSIS', content: selectedInc.rootCause },
                { label: 'CORRECTIVE & PREVENTIVE ACTIONS', content: selectedInc.action },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, color: '#9bb3d1', letterSpacing: '0.08em', marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontFamily: 'Inter', fontSize: 13, color: L.body, lineHeight: 1.7, background: '#f3faff', padding: '14px 16px', borderRadius: 10, border: `1px solid ${L.cardBorder}` }}>{s.content}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              {[['Case ID', selectedInc.id], ['Type', selectedInc.type], ['Site', selectedInc.site], ['Client', selectedInc.client], ['Reported By', selectedInc.reportedBy], ['Date / Time', selectedInc.reportedAt], ['Assigned To', selectedInc.assignedTo]].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, color: '#9bb3d1', letterSpacing: '0.08em', marginBottom: 3 }}>{k}</div>
                  <div style={{ fontFamily: 'Inter', fontSize: 13, color: L.heading }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'detail' && !selectedInc && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: L.muted, fontFamily: 'Inter', fontSize: 14 }}>
          Select a case from the Incident Register to view details.
        </div>
      )}

      {tab === 'workflow' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between" style={{ background: '#ffffff', border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '16px 20px', boxShadow: '0 14px 30px rgba(54,126,171,0.12)' }}>
            <div>
              <div style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, color: L.muted, letterSpacing: '0.08em', marginBottom: 5 }}>ACTIVE CASE WORKFLOW</div>
              <div style={{ fontFamily: 'Inter', fontSize: 16, fontWeight: 700, color: L.heading }}>{(selectedInc ?? incidents[0]).id} · {(selectedInc ?? incidents[0]).title}</div>
            </div>
            <SBadge s={statusStyle[(selectedInc ?? incidents[0]).status]} label={(selectedInc ?? incidents[0]).status.replace('-', ' ').toUpperCase()} />
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {[
              { key: 'approved' as const, step: '01', title: 'Approval & Classification', detail: 'Assign severity, owner, and approval route', done: workflowState.approved, action: 'Approve Case' },
              { key: 'investigationStarted' as const, step: '02', title: 'Investigation Tracking', detail: 'Track evidence, interviews, and case progress', done: workflowState.investigationStarted, action: 'Start Investigation' },
              { key: 'rootCauseReviewed' as const, step: '03', title: 'Root Cause Review', detail: 'Document cause and validate findings', done: workflowState.rootCauseReviewed, action: 'Review Root Cause' },
              { key: 'actionsClosed' as const, step: '04', title: 'Corrective / Preventive Action', detail: 'Assign CAPA owners and close actions', done: workflowState.actionsClosed, action: 'Close Actions' },
            ].map(step => (
              <div key={step.key} style={{ background: '#ffffff', border: `1px solid ${step.done ? 'rgba(34,197,94,0.35)' : L.cardBorder}`, borderRadius: 12, padding: '18px', boxShadow: '0 14px 30px rgba(54,126,171,0.10)' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: step.done ? '#16a34a' : '#1976b9', fontWeight: 700 }}>STEP {step.step}</span>
                  <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 700, color: step.done ? '#16a34a' : L.muted }}>{step.done ? 'COMPLETED' : 'PENDING'}</span>
                </div>
                <div style={{ fontFamily: 'Inter', fontSize: 15, fontWeight: 700, color: L.heading, marginBottom: 7 }}>{step.title}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, lineHeight: 1.5, minHeight: 38 }}>{step.detail}</div>
                <button type="button" disabled={step.done || !canEdit} onClick={() => { setWorkflowState(current => ({ ...current, [step.key]: true })); addActivity('Incident Manager', 'WORKFLOW', `${step.action} completed for ${(selectedInc ?? incidents[0]).id}`) }} style={{ width: '100%', marginTop: 16, fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: step.done || !canEdit ? (step.done ? '#16a34a' : L.muted) : '#fff', background: step.done ? 'rgba(34,197,94,0.08)' : canEdit ? '#1976b9' : 'rgba(107,114,128,0.1)', border: step.done ? '1px solid rgba(34,197,94,0.25)' : '1px solid transparent', borderRadius: 7, padding: '9px 10px', cursor: step.done || !canEdit ? 'not-allowed' : 'pointer' }}>{step.done ? 'Completed' : canEdit ? step.action : 'Admin action'}</button>
              </div>
            ))}
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ background: '#ffffff', border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '20px 22px', boxShadow: '0 14px 30px rgba(54,126,171,0.10)' }}>
              <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 15, color: L.heading, marginBottom: 14 }}>Case Classification</div>
              {[['Severity', (selectedInc ?? incidents[0]).severityLabel], ['Incident Type', (selectedInc ?? incidents[0]).type], ['Assigned Investigator', (selectedInc ?? incidents[0]).assignedTo], ['Approval Route', 'Operations Manager → Executive Review']].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between" style={{ borderBottom: `1px solid ${L.divider}`, padding: '10px 0' }}>
                  <span style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted }}>{label}</span>
                  <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: L.heading, textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#ffffff', border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '20px 22px', boxShadow: '0 14px 30px rgba(54,126,171,0.10)' }}>
              <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 15, color: L.heading, marginBottom: 14 }}>Investigation Notes & CAPA</div>
              <div style={{ background: '#f3faff', border: `1px solid ${L.cardBorder}`, borderRadius: 8, padding: 12, fontFamily: 'Inter', fontSize: 13, color: L.body, lineHeight: 1.6, marginBottom: 12 }}>{(selectedInc ?? incidents[0]).rootCause}</div>
              <div style={{ background: '#f3faff', border: `1px solid ${L.cardBorder}`, borderRadius: 8, padding: 12, fontFamily: 'Inter', fontSize: 13, color: L.body, lineHeight: 1.6 }}>{(selectedInc ?? incidents[0]).action}</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {[
              { label: 'AVG RESOLUTION TIME', value: '18.4h', sub: 'P1–P3 incidents', color: '#60a5fa' },
              { label: 'P1 INCIDENTS (YTD)', value: '9', sub: '2 unresolved', color: '#ef4444' },
              { label: 'REPEAT INCIDENT RATE', value: '12%', sub: 'Same site / same type', color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} style={{ background: '#ffffff', border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '20px 24px', boxShadow: '0 14px 30px rgba(54,126,171,0.12)' }}>
                <div style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, color: '#9bb3d1', letterSpacing: '0.08em', marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 40, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, marginTop: 8 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#ffffff', border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '22px 24px', boxShadow: '0 14px 30px rgba(54,126,171,0.12)' }}>
            <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: L.heading, marginBottom: 16 }}>Incident Volume — Last 6 Months</div>
            <div className="flex items-end gap-3" style={{ height: 90 }}>
              {trendData.map((d, i) => (
                <div key={d.month} className="flex flex-col items-center gap-2 flex-1">
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#9bb3d1' }}>{d.count}</div>
                  <div style={{ width: '100%', background: i === trendData.length - 1 ? '#F06522' : 'rgba(96,165,250,0.35)', borderRadius: 4, height: `${(d.count / trendMax) * 58}px` }} />
                  <div style={{ fontFamily: 'Inter', fontSize: 11, color: '#9bb3d1' }}>{d.month}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#ffffff', border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '22px 24px', boxShadow: '0 14px 30px rgba(54,126,171,0.12)' }}>
            <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: L.heading, marginBottom: 16 }}>Incidents by Type</div>
            {[
              { type: 'Trespassing', count: 18, pct: 35 },
              { type: 'Theft / Robbery', count: 11, pct: 22 },
              { type: 'Personnel / Absenteeism', count: 9, pct: 18 },
              { type: 'Medical Emergency', count: 7, pct: 14 },
              { type: 'Vandalism', count: 5, pct: 10 },
            ].map(t => (
              <div key={t.type} className="flex items-center gap-4 mb-3">
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.body, width: 190 }}>{t.type}</div>
                <div style={{ flex: 1, height: 8, background: 'rgba(148,163,184,0.12)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${t.pct}%`, height: '100%', background: 'linear-gradient(90deg, #F06522 0%, #f59e0b 100%)', borderRadius: 999 }} />
                </div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#9bb3d1', width: 28, textAlign: 'right' }}>{t.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
