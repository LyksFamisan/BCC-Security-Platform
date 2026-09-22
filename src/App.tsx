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

export type Module = 'dashboard' | 'manpower' | 'equipment' | 'incidents' | 'tactical' | 'guard' | 'admin'

export const moduleMeta: Record<Module, { section: string; title: string }> = {
  dashboard: { section: 'OVERVIEW', title: 'Operational Command Hub' },
  manpower: { section: 'MANPOWER', title: 'Deployment Management' },
  equipment: { section: 'EQUIPMENT', title: 'Asset Accountability' },
  incidents: { section: 'INCIDENTS', title: 'Incident Resolution Center' },
  tactical: { section: 'OPERATIONS', title: 'Tactical Command Console' },
  guard: { section: 'DUTY', title: 'Guard Dashboard' },
  admin: { section: 'ADMIN', title: 'System Administration' },
}

// Modules each role is allowed to access
export const roleModules: Record<UserRole, Module[]> = {
  guard: ['guard'],
  operations: ['dashboard', 'manpower', 'equipment', 'incidents', 'tactical'],
  admin: ['dashboard', 'manpower', 'equipment', 'incidents', 'tactical', 'admin'],
}

const roleDefaultModule: Record<UserRole, Module> = {
  guard: 'guard',
  operations: 'manpower',
  admin: 'dashboard',
}

type Screen = 'splash' | 'portal' | 'app'

function AppContent() {
  const [screen, setScreen] = useState<Screen>('splash')
  const [role, setRole] = useState<UserRole | null>(null)
  const [active, setActive] = useState<Module>('dashboard')
  const [darkMode, setDarkMode] = useState(false)
  const { addActivity } = usePortalData()

  if (screen === 'splash') {
    return <SplashScreen darkMode={darkMode} onToggleTheme={() => setDarkMode(value => !value)} onEnter={() => setScreen('portal')} />
  }

  if (screen === 'portal' || !role) {
    return (
      <LoginPortal
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(value => !value)}
        onBackHome={() => setScreen('splash')}
        onLogin={(r) => {
          const source = r === 'guard' ? 'Security Personnel' : r === 'operations' ? 'Detachment Staff' : 'Administrator'
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
        <main className={`app-main flex-1 overflow-auto ${darkMode ? 'theme-dark' : 'theme-light'}`} style={{ background: darkMode ? "linear-gradient(180deg, rgba(7, 10, 24, 0.88), rgba(20, 13, 48, 0.82)), url('/assets/bg.jpg') center / cover fixed" : 'linear-gradient(180deg, rgba(239,249,255,0.90) 0%, rgba(220,241,252,0.78) 100%)' }}>
          {safeActive === 'dashboard' && <DashboardModule canEdit={role === 'admin'} />}
          {safeActive === 'manpower' && <ManpowerModule canEdit={role === 'admin'} />}
          {safeActive === 'equipment' && <EquipmentModule canEdit={role === 'admin'} canReport={role === 'admin' || role === 'operations'} />}
          {safeActive === 'incidents' && <IncidentModule canEdit={role === 'admin'} canReport={role === 'admin' || role === 'operations'} />}
          {safeActive === 'tactical' && <TacticalModule canEdit={role === 'admin'} />}
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
