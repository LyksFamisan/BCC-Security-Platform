import type { ReactElement } from 'react'
import type { Module } from '../App'
import type { UserRole } from './LoginPortal'
import { usePortalData } from '../state/PortalDataContext'

interface NavItem {
  id: Module
  label: string
  icon: ReactElement
}

const allNav: NavItem[] = [
  {
    id: 'guard',
    label: 'My Duty',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: 'dashboard',
    label: 'Executive Overview',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'manpower',
    label: 'Manpower Deployment',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'equipment',
    label: 'Equipment Accountability',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: 'incidents',
    label: 'Incident Resolution',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    id: 'tactical',
    label: 'Live Tactical Room',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  {
    id: 'admin',
    label: 'System Administration',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
      </svg>
    ),
  },
]

const roleLabel: Record<UserRole, string> = {
  guard: 'Security Personnel',
  operations: 'Operations Staff',
  admin: 'Administrator',
}

const roleColor: Record<UserRole, string> = {
  guard: '#8B5CF6',
  operations: '#F06522',
  admin: '#dc2626',
}

export default function Sidebar({
  darkMode,
  active,
  onChange,
  role,
  allowed,
}: {
  darkMode: boolean
  active: Module
  onChange: (m: Module) => void
  role: UserRole
  allowed: Module[]
}) {
  const nav = allNav.filter(n => allowed.includes(n.id))
  const color = roleColor[role]
  const { incidentReports, equipmentFaults, activities, isLive } = usePortalData()
  const latestPersonnelUpdate = activities.find(activity => activity.source === 'Security Personnel')

  return (
    <aside
      className={`app-sidebar flex flex-col shrink-0 ${darkMode ? 'theme-sidebar-dark' : ''}`}
      style={{
        width: 228,
        background: 'linear-gradient(180deg, #d9effc 0%, #cbe8f8 100%)',
        borderRight: '1px solid rgba(54,126,171,0.18)',
        height: '100%',
        boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.7)',
      }}
    >
      <div
        className="sidebar-brand flex items-center gap-2 px-4"
        style={{ height: 64, borderBottom: '1px solid rgba(54,126,171,0.14)', background: 'rgba(255,255,255,0.38)' }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: '#000', boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }}>
          <img src="/assets/CAT_logo.jpg" alt="CAT Security" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: '#fff', border: '1px solid rgba(148,163,184,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/assets/BCC_logo.jpg" alt="BCC" style={{ width: '90%', height: '90%', objectFit: 'contain', display: 'block' }} />
        </div>
        <div style={{ marginLeft: 4 }}>
          <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 13, color: '#12304a', letterSpacing: '0.02em' }}>
            BCC/CAT Security
          </div>
          <div style={{ fontFamily: 'Inter', fontSize: 10, color: '#F06522', fontWeight: 600, letterSpacing: '0.06em' }}>
            COMMAND SYSTEM
          </div>
        </div>
      </div>

      <div style={{ margin: '10px 12px 4px', background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 10px ${color}` }} />
        <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color, letterSpacing: '0.04em' }}>{roleLabel[role]}</span>
      </div>

      {(incidentReports > 0 || equipmentFaults > 0) && role !== 'guard' && <div className="sidebar-updates" style={{ margin: '6px 12px 0', background: darkMode ? 'rgba(240,101,34,0.10)' : 'rgba(240,101,34,0.08)', border: '1px solid rgba(240,101,34,0.28)', borderRadius: 8, padding: '7px 10px' }}>
        <div className="flex items-center justify-between" style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, color: '#F06522' }}><span>PERSONNEL UPDATES</span><span style={{ color: isLive ? '#16a34a' : '#dc2626' }}>{isLive ? 'LIVE' : 'OFFLINE'}</span></div>
        <div style={{ fontFamily: 'Inter', fontSize: 10, color: darkMode ? '#fff' : '#52718b', marginTop: 4 }}>{incidentReports} incident · {equipmentFaults} equipment</div>
        {latestPersonnelUpdate && <div style={{ fontFamily: 'Inter', fontSize: 9, color: darkMode ? '#cbd5e1' : '#6b7280', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{latestPersonnelUpdate.message}</div>}
      </div>}

      <nav className="flex-1 px-3 py-3 flex flex-col gap-1">
        {nav.map((item) => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className="flex items-center gap-3 text-left w-full transition-all"
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: isActive ? 'linear-gradient(135deg, #F06522 0%, #ff7b3f 100%)' : 'transparent',
                border: isActive ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                cursor: 'pointer',
                color: isActive ? '#fff' : '#16476d',
                boxShadow: isActive ? '0 10px 18px rgba(240,101,34,0.25)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(125,211,252,0.08)'
                  e.currentTarget.style.borderColor = 'rgba(125,211,252,0.18)'
                  e.currentTarget.style.color = '#12304a'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.color = '#16476d'
                }
              }}
            >
                <span style={{ color: isActive ? '#fff' : '#1976b9', flexShrink: 0 }}>
                {item.icon}
              </span>
              <span style={{ fontFamily: 'Inter', fontWeight: isActive ? 600 : 500, fontSize: 13, flex: 1 }}>
                {item.label}
              </span>
              {item.id === 'incidents' && incidentReports > 0 && <span style={{ minWidth: 20, padding: '2px 5px', borderRadius: 10, background: isActive ? 'rgba(255,255,255,0.22)' : '#dc2626', color: '#fff', fontFamily: 'JetBrains Mono', fontSize: 9, textAlign: 'center' }}>{incidentReports}</span>}
              {item.id === 'equipment' && equipmentFaults > 0 && <span style={{ minWidth: 20, padding: '2px 5px', borderRadius: 10, background: isActive ? 'rgba(255,255,255,0.22)' : '#d97706', color: '#fff', fontFamily: 'JetBrains Mono', fontSize: 9, textAlign: 'center' }}>{equipmentFaults}</span>}
            </button>
          )
        })}
      </nav>

      <div className="sidebar-node px-4 pb-3">
        <div
          style={{
            background: 'rgba(255,255,255,0.48)',
            border: '1px solid rgba(54,126,171,0.16)',
            borderRadius: 10,
            padding: '10px 12px',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
          }}
        >
          <div style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.1em', marginBottom: 4 }}>
            COMMAND NODE
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', flexShrink: 0 }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#e2e8f0', fontWeight: 600 }}>HQ-CENTRAL-01</span>
          </div>
        </div>
      </div>

      <div
        className="sidebar-profile flex items-center gap-3 px-4 py-3"
        style={{ borderTop: '1px solid rgba(148,163,184,0.12)', background: 'rgba(15,23,42,0.2)' }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(125,211,252,0.20) 0%, rgba(59,130,246,0.2) 100%)',
            border: '1px solid rgba(125,211,252,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 700, color: '#e0f2fe' }}>GS</span>
        </div>
        <div>
          <div style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>Gen. R. Santos</div>
          <div style={{ fontFamily: 'Inter', fontSize: 10, color: '#94a3b8' }}>Chief of Operations</div>
        </div>
      </div>
    </aside>
  )
}
