import { useState } from 'react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import SplashScreen from './components/SplashScreen'
import LoginPortal, { type UserRole } from './components/LoginPortal'
import DashboardModule from './modules/DashboardModule'
import ManpowerModule from './modules/ManpowerModule'
import EquipmentModule from './modules/EquipmentModule'
import IncidentModule from './modules/IncidentModule'
import TacticalModule from './modules/TacticalModule'
import GuardModule from './modules/GuardModule'
import AdminModule from './modules/AdminModule'
import { PortalDataProvider, usePortalData } from './state/PortalDataContext'

import {moduleMeta,roleModules,type Module} from './prototypeMeta';

const roleDefaultModule: Record<UserRole, Module> = {
  guard: 'guard',
  supervisor: 'manpower',
  operations: 'dashboard',
  admin: 'admin',
}

type Screen = 'splash' | 'portal' | 'app'

function AppContent() {
  const [screen, setScreen] = useState<Screen>('splash')
  const [role, setRole] = useState<UserRole | null>(null)
  const [active, setActive] = useState<Module>('dashboard')
  const [darkMode, setDarkMode] = useState(true)
  const { addActivity, recordLogin } = usePortalData()

  if (screen === 'splash') {
    return <SplashScreen darkMode={darkMode} onToggleTheme={() => setDarkMode(value => !value)} onEnter={() => setScreen('portal')} />
  }

  if (screen === 'portal' || !role) {
    return (
      <LoginPortal
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(value => !value)}
        onBackHome={() => setScreen('splash')}
        onLogin={(r, email) => {
          const source = r === 'guard' ? 'Security Personnel' : r === 'supervisor' ? 'Supervisor / Site In-Charge' : r === 'operations' ? 'Operations Management (SSD)' : 'System Administrator'
          recordLogin(source, email, r)
          addActivity(source, 'LOGIN', `${source} portal login completed`)
          setRole(r)
          setActive(roleDefaultModule[r])
          setScreen('app')
        }}
      />
    )
  }

  const allowed = roleModules[role]
  const safeActive = allowed.includes(active) ? active : allowed[0]
  const meta = moduleMeta[safeActive]

  return (
    <div
      className="app-shell flex flex-col h-screen overflow-hidden"
      style={{
        background: darkMode ? "linear-gradient(180deg, rgba(7, 10, 24, 0.78), rgba(20, 13, 48, 0.86)), url('/assets/bg.jpg') center / cover fixed" : 'linear-gradient(180deg, rgba(244,251,255,0.98) 0%, rgba(218,240,252,0.98) 100%)',
        border: darkMode ? '1px solid rgba(148,163,184,0.16)' : '1px solid rgba(54,126,171,0.16)',
        boxShadow: darkMode ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.8)',
      }}
    >
      <TopBar darkMode={darkMode} onToggleTheme={() => setDarkMode(value => !value)} section={meta.section} title={meta.title} onLogout={() => { setRole(null); setScreen('splash') }} />
      <div className="app-content flex flex-1 overflow-hidden" style={{ position: 'relative' }}>
        <Sidebar darkMode={darkMode} active={safeActive} onChange={setActive} role={role} allowed={allowed} />
        <main key={role} className={`app-main flex-1 overflow-auto ${darkMode ? 'theme-dark' : 'theme-light'}`} style={{ background: darkMode ? "linear-gradient(180deg, rgba(7, 10, 24, 0.88), rgba(20, 13, 48, 0.82)), url('/assets/bg.jpg') center / cover fixed" : 'linear-gradient(180deg, rgba(239,249,255,0.90) 0%, rgba(220,241,252,0.78) 100%)' }}>
          <div style={{ padding: '10px 24px', color: darkMode ? '#dbeafe' : '#16476d', fontSize: 13 }}>
            <strong>{role === 'admin' ? 'System Administrator · Technical configuration only' : role === 'operations' ? 'Operations Management (SSD) · All sites and clients' : role === 'supervisor' ? 'Supervisor / Site In-Charge · Assigned sites and clients' : 'Security Personnel (Guards) · Own records'}</strong>
            <div>Phase 1 demo · Sample records. {role === 'supervisor' ? 'Demo assignment: BGC Financial Tower. Connected API enforces actual site assignments.' : 'Operational changes in this mode stay in this browser.'}</div>
          </div>
          {safeActive === 'dashboard' && role === 'supervisor' && <section style={{ padding: 24, color: darkMode ? '#dbeafe' : '#16476d' }}><h2>Assigned Site Dashboard</h2><h3>BGC Financial Tower</h3><p>Fictional assigned site · BCC Holdings</p><p>Review deployment, attendance, equipment accountability and incidents using the assigned-site modules.</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>{(['manpower', 'equipment', 'incidents'] as Module[]).map(module => <button key={module} onClick={() => setActive(module)} style={{ padding: 12, borderRadius: 8, background: '#1976b9', color: '#fff', border: 0 }}>{moduleMeta[module].title}</button>)}</div></section>}
          {safeActive === 'dashboard' && role === 'operations' && <DashboardModule canEdit={role === 'operations' || role === 'supervisor'} onNavigate={setActive} />}
          {safeActive === 'manpower' && <ManpowerModule assignedOnly={role === 'supervisor'} canEdit={role === 'operations' || role === 'supervisor'} />}
          {safeActive === 'equipment' && <EquipmentModule assignedOnly={role === 'supervisor'} canEdit={role === 'operations'} canReport={role === 'operations' || role === 'supervisor'} />}
          {safeActive === 'incidents' && <IncidentModule assignedOnly={role === 'supervisor'} canEdit={role === 'operations' || role === 'supervisor'} canReport={role === 'operations' || role === 'supervisor'} />}
          {safeActive === 'tactical' && <TacticalModule canEdit={role === 'operations' || role === 'supervisor'} />}
          {safeActive === 'guard' && <GuardModule />}
          {safeActive === 'admin' && <AdminModule />}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return <PortalDataProvider><AppContent /></PortalDataProvider>
}
