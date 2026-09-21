import { useState, useEffect } from 'react'
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

const detachments = [
  { name: 'BGC Financial Tower', client: 'BCC Holdings', clientLogo: null, status: 'Secure', statusColor: '#16a34a', deployed: 24, required: 24 },
  { name: 'Manila Port Terminal 3', client: 'National Transit', clientLogo: null, status: 'Elevated Risk', statusColor: '#d97706', deployed: 42, required: 45 },
  { name: 'Subic Logistics Depot', client: 'CAT Storage', clientLogo: null, status: 'Secure', statusColor: '#16a34a', deployed: 18, required: 18 },
  { name: 'Makati Central Mall', client: 'Filinvest Group', clientLogo: null, status: 'Shortage Alert', statusColor: '#dc2626', deployed: 28, required: 32 },
]

const escalations = [
  { time: '08:31', title: 'Understaffing Detected', site: 'Makati Central Mall', level: 'HIGH', levelColor: '#d97706', levelBg: 'rgba(217,119,6,0.1)', critical: false },
  { time: '08:14', title: 'Unscheduled Firearms Vault Lockout', site: 'Manila Port T3', level: 'CRITICAL', levelColor: '#dc2626', levelBg: 'rgba(220,38,38,0.08)', critical: true },
  { time: '07:45', title: 'Communication Drop – SatRadio-04', site: 'Subic Depot', level: 'LOW', levelColor: '#6b7280', levelBg: 'rgba(107,114,128,0.1)', critical: false },
]

const slaTarget = 99.5
const slaActual = 99.4

export default function DashboardModule() {
  const { addActivity } = usePortalData()
  const [, setTick] = useState(0)
  const [reportView, setReportView] = useState<'operations' | 'management'>('operations')
  const [enabledKpis, setEnabledKpis] = useState(['roster', 'sla', 'detachments', 'critical'])
  const [acknowledged, setAcknowledged] = useState<string[]>([])
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  const kpis = [
    { id: 'roster', label: 'ACTIVE GUARD ROSTER', value: '1,142', sub: '/ 1,160', badge: '+4.2%', badgeUp: true, valueColor: '#F06522' },
    { id: 'sla', label: 'CLIENT SERVICE LEVEL', value: '99.4%', sub: null, badge: '+0.1%', badgeUp: true, valueColor: '#F06522' },
    { id: 'detachments', label: 'ACTIVE DETACHMENTS', value: '38', sub: '/ 38', badge: '100%', badgeUp: true, valueColor: '#F06522' },
    { id: 'critical', label: 'CRITICAL DISPATCHES', value: '03', sub: null, badge: '-2', badgeUp: false, valueColor: '#dc2626' },
  ]

  const toggleKpi = (id: string) => {
    setEnabledKpis(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  return (
    <div className="p-6 flex flex-col gap-5 min-h-full" style={{ background: 'transparent' }}>

      {/* KPI Row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {kpis.filter(k => enabledKpis.includes(k.id)).map((k) => (
          <div key={k.label} style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, padding: '20px 22px', boxShadow: L.shadow }}>
            <div style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 500, color: L.muted, letterSpacing: '0.06em', marginBottom: 14 }}>{k.label}</div>
            <div className="flex items-baseline gap-1" style={{ flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
              <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: k.sub ? 32 : 36, color: k.valueColor, lineHeight: 1 }}>{k.value}</span>
              {k.sub && <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 32, color: k.valueColor, lineHeight: 1 }}>{k.sub}</span>}
              <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: k.badgeUp ? '#16a34a' : '#dc2626', marginLeft: 4, whiteSpace: 'nowrap' }}>
                {k.badgeUp ? '↑' : '↓'} {k.badge}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, padding: '14px 18px', boxShadow: L.shadow }}>
        <div className="flex items-center justify-between gap-4" style={{ flexWrap: 'wrap' }}>
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 13, color: L.heading }}>Dashboard View</span>
            {(['operations', 'management'] as const).map(view => (
              <button key={view} type="button" onClick={() => setReportView(view)} style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: reportView === view ? '#fff' : L.body, background: reportView === view ? '#1976b9' : 'transparent', border: `1px solid ${reportView === view ? '#1976b9' : L.cardBorder}`, borderRadius: 6, padding: '6px 11px', cursor: 'pointer' }}>{view === 'operations' ? 'Operations' : 'Executive Report'}</button>
            ))}
          </div>
          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted }}>Show KPI:</span>
            {kpis.map(kpi => (
              <button key={kpi.id} type="button" onClick={() => toggleKpi(kpi.id)} style={{ fontFamily: 'Inter', fontSize: 11, color: enabledKpis.includes(kpi.id) ? '#1976b9' : L.subtle, background: enabledKpis.includes(kpi.id) ? 'rgba(25,118,185,0.08)' : 'transparent', border: `1px solid ${enabledKpis.includes(kpi.id) ? 'rgba(25,118,185,0.35)' : L.cardBorder}`, borderRadius: 6, padding: '5px 8px', cursor: 'pointer' }}>{kpi.label.replace('ACTIVE ', '').replace('CLIENT ', '')}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Main 2-col */}
      <div className="grid gap-4 flex-1" style={{ gridTemplateColumns: '1fr 380px', alignItems: 'start' }}>

        {/* Active Client Detachments */}
        <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: L.shadow }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F06522" strokeWidth="2" strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: L.heading }}>Active Client Detachments</span>
            </div>
            <button onClick={() => setReportView('management')} style={{ fontFamily: 'Inter', fontSize: 12, color: '#F06522', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              All Detachments
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
          <div className="flex flex-col">
            {detachments.map((d, i) => (
              <div
                key={d.name}
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: i < detachments.length - 1 ? `1px solid ${L.divider}` : 'none', cursor: 'default', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = L.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: L.heading }}>{d.name}</div>
                    <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, marginTop: 2 }}>{d.client}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.statusColor }} />
                    <span style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 500, color: d.statusColor }}>{d.status}</span>
                  </div>
                  <div style={{ fontFamily: 'Inter', fontSize: 13, color: L.muted, minWidth: 90, textAlign: 'right' }}>
                    <span style={{ fontWeight: 600, color: L.heading }}>{d.deployed}/{d.required}</span>
                    <span style={{ color: L.subtle, marginLeft: 4 }}>deploy</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Critical Escalations Log */}
        <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: L.shadow }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F06522" strokeWidth="2" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: L.heading }}>Critical Escalations Log</span>
            </div>
            <button onClick={() => setReportView('management')} style={{ fontFamily: 'Inter', fontSize: 12, color: '#F06522', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              Manage Dispatches
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
          <div className="flex flex-col">
            {escalations.map((e, i) => (
              <div
                key={i}
                style={{
                  padding: '14px 20px',
                  borderBottom: i < escalations.length - 1 ? `1px solid ${L.divider}` : 'none',
                  background: e.critical ? 'rgba(220,38,38,0.03)' : 'transparent',
                  borderLeft: e.critical ? '3px solid #dc2626' : '3px solid transparent',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: L.subtle, flexShrink: 0, marginTop: 1 }}>{e.time}</span>
                    <div>
                      <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: L.heading, marginBottom: 3 }}>{e.title}</div>
                      <div style={{ fontFamily: 'Inter', fontSize: 11, color: L.muted }}>{e.site}</div>
                    </div>
                  </div>
                  <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', color: e.levelColor, background: e.levelBg, padding: '3px 8px', borderRadius: 4, flexShrink: 0 }}>
                    {e.level}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SLA Bar */}
      <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, padding: '18px 24px', boxShadow: L.shadow }}>
        <div className="flex items-center justify-between gap-6">
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: L.heading }}>SLA Performance Threshold: {slaTarget.toFixed(2)}% Target</div>
            <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, marginTop: 3 }}>Across all active detachments in Luzon central deployment.</div>
          </div>
          <div className="flex items-center gap-4" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ flex: 1, height: 10, background: 'rgba(0,0,0,0.07)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ width: `${(slaActual / 100) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #F06522 0%, #16a34a 100%)', borderRadius: 5, transition: 'width 0.5s ease' }} />
            </div>
            <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 16, color: L.heading, flexShrink: 0 }}>{slaActual.toFixed(2)}%</span>
          </div>
          <button
            onClick={() => setReportView('management')}
            style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#F06522', background: 'transparent', border: '1px solid #F06522', borderRadius: 7, padding: '9px 18px', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(240,101,34,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Run Executive Report
          </button>
        </div>
      </div>

      {reportView === 'management' && (
        <div className="grid gap-4" style={{ gridTemplateColumns: '1.15fr 1fr' }}>
          <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: L.shadow }}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
              <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 15, color: L.heading }}>Management Site & Client Report</div>
              <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, marginTop: 3 }}>Service level and deployment visibility by account</div>
            </div>
            {detachments.map(site => {
              const utilization = Math.round((site.deployed / site.required) * 100)
              return (
                <div key={site.name} className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: `1px solid ${L.divider}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: L.heading }}>{site.name}</div>
                    <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, marginTop: 2 }}>{site.client}</div>
                  </div>
                  <div style={{ width: 130 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Inter', fontSize: 11, color: L.muted, marginBottom: 5 }}><span>Deployment</span><span>{utilization}%</span></div>
                    <div style={{ height: 7, background: 'rgba(54,126,171,0.12)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${Math.min(utilization, 100)}%`, height: '100%', background: site.statusColor, borderRadius: 4 }} /></div>
                  </div>
                  <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 700, color: site.statusColor, minWidth: 90, textAlign: 'right' }}>{site.status}</span>
                </div>
              )
            })}
          </div>

          <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, overflow: 'hidden', boxShadow: L.shadow }}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
              <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 15, color: L.heading }}>Automated Notifications</div>
              <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, marginTop: 3 }}>Escalation management and alert acknowledgement</div>
            </div>
            {escalations.map(alert => {
              const isAcknowledged = acknowledged.includes(alert.title)
              return (
                <div key={alert.title} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: `1px solid ${L.divider}`, opacity: isAcknowledged ? 0.55 : 1 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: alert.levelColor, boxShadow: `0 0 6px ${alert.levelColor}`, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}><div style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: L.heading }}>{alert.title}</div><div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted }}>{alert.site}</div></div>
                  <button type="button" disabled={isAcknowledged} onClick={() => { setAcknowledged(current => [...current, alert.title]); addActivity('Executive Dashboard', 'ESCALATION', `Escalation acknowledged: ${alert.title}`) }} style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: isAcknowledged ? L.subtle : alert.levelColor, background: 'transparent', border: `1px solid ${isAcknowledged ? L.cardBorder : alert.levelColor}`, borderRadius: 6, padding: '5px 8px', cursor: isAcknowledged ? 'default' : 'pointer' }}>{isAcknowledged ? 'Acknowledged' : 'Acknowledge'}</button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
