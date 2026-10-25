import { useState, type ReactElement } from 'react'

export type UserRole = 'guard' | 'supervisor' | 'operations' | 'admin'

// ── Shared logo strip ────────────────────────────────────────────────────────
function Logos({ size = 36 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden', background: '#000', flexShrink: 0 }}>
        <img src="/assets/CAT_logo.jpg" alt="CAT" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden', background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src="/assets/BCC_logo.jpg" alt="BCC" style={{ width: '88%', height: '88%', objectFit: 'contain' }} />
      </div>
    </div>
  )
}

// ── Shared form fields ────────────────────────────────────────────────────────
function FormFields({
  accent,
  onLogin,
  submitLabel,
  inputBg,
  inputBorder,
  portalEmail,
  allowedEmails,
}: {
  accent: string
  onLogin: (email?: string) => void
  submitLabel: string
  inputBg: string
  inputBorder: string
  portalEmail?: string
  allowedEmails?: string[]
}) {
  const [email, setEmail] = useState(portalEmail ?? '')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [helpMessage] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !pass) { setErr('Fill in all fields.'); return }
    const normalizedEmail = email.trim().toLowerCase()
    const authorizedEmails = allowedEmails ?? (portalEmail ? [portalEmail] : [])
    if (authorizedEmails.length > 0 && !authorizedEmails.some(authorizedEmail => authorizedEmail.toLowerCase() === normalizedEmail)) { setErr('Email is not authorized for this portal.'); return }
    setErr('')
    setLoading(true)
    setTimeout(() => { setLoading(false); onLogin(normalizedEmail) }, 1100)
  }

  const base: React.CSSProperties = {
    width: '100%', background: inputBg, border: `1px solid ${inputBorder}`,
    borderRadius: 8, padding: '11px 14px', fontFamily: 'Inter', fontSize: 14,
    color: '#e8eaf0', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label htmlFor="demo-email" style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#dfe7ff', display: 'block', marginBottom: 6 }}>Email / Employee ID</label>
        <input id="demo-email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your ID or email"
          style={base}
          onFocus={el => (el.currentTarget.style.borderColor = accent)}
          onBlur={el => (el.currentTarget.style.borderColor = inputBorder)} />
      </div>
      <div>
        <label htmlFor="demo-password" style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#dfe7ff', display: 'block', marginBottom: 6 }}>Password</label>
        <input id="demo-password" autoComplete="current-password" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Enter your password"
          style={base}
          onFocus={el => (el.currentTarget.style.borderColor = accent)}
          onBlur={el => (el.currentTarget.style.borderColor = inputBorder)} />
      </div>
      {err && <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#ef4444', margin: 0, textAlign: 'center' }}>{err}</p>}
      {helpMessage && <p style={{ fontFamily: 'Inter', fontSize: 12, color: accent, margin: 0, textAlign: 'center' }}>{helpMessage}</p>}
      <button type="submit" disabled={loading}
        style={{ width: '100%', padding: '13px', borderRadius: 9, background: loading ? `${accent}99` : accent, border: 'none', fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', transition: 'opacity 0.15s', marginTop: 4 }}>
        {loading ? 'Signing in…' : submitLabel}
      </button>
    </form>
  )
}

function UnifiedLogin({ selectedRole, onBack, onBackHome, onLogin, darkMode, onToggleTheme }: { selectedRole: UserRole; onBack?: () => void; onBackHome: () => void; onLogin: (role: UserRole, email: string) => void; darkMode: boolean; onToggleTheme: () => void }) {
  const roleByEmail: Record<string, UserRole> = {
    'security@gmail.com': 'guard',
    'supervisor@demo.invalid': 'supervisor',
    'ar@gmail.com': 'operations',
    'bcc@gmail.com': 'admin',
  }

  return (
    <div style={{ minHeight: '100vh', background: darkMode ? "linear-gradient(160deg, rgba(8, 10, 24, 0.78), rgba(20, 13, 48, 0.9)), url('/assets/bg.jpg') center / cover fixed" : 'linear-gradient(180deg, #f4fbff 0%, #d9effc 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: 24 }}>
      <div style={{ position: 'fixed', top: 24, left: 28, display: 'flex', gap: 16, zIndex: 2 }}>
        {onBack && <button type="button" onClick={onBack} style={{ fontFamily: 'Inter', fontSize: 12, color: darkMode ? '#dfe7ff' : '#52718b', background: 'none', border: 'none', cursor: 'pointer' }}>← All Portals</button>}
        <button type="button" onClick={onBackHome} style={{ fontFamily: 'Inter', fontSize: 12, color: darkMode ? '#dfe7ff' : '#52718b', background: 'none', border: 'none', cursor: 'pointer' }}>⌂ Home</button>
      </div>
      <button type="button" onClick={onToggleTheme} aria-label="Toggle theme" style={{ position: 'fixed', top: 20, right: 26, border: darkMode ? '1px solid rgba(147,197,253,0.3)' : '1px solid rgba(54,126,171,0.18)', borderRadius: 8, padding: '7px 12px', background: darkMode ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.72)', color: darkMode ? '#dbeafe' : '#16476d', fontFamily: 'Inter', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{darkMode ? '☀ Light Mode' : '☾ Dark Mode'}</button>
      <div style={{ width: '100%', maxWidth: 620, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}><Logos size={44} /></div>
        <div style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: 24, color: darkMode ? '#e8eaf0' : '#12304a', marginBottom: 6 }}>BCC/CAT Security Portal</div>
        <div style={{ fontFamily: 'Inter', fontSize: 13, color: darkMode ? '#a7b7d1' : '#52718b', marginBottom: 24 }}>{cards.find(card => card.id === selectedRole)?.title} · Demo sign-in</div>
        <div style={{ background: 'rgba(13,10,30,0.82)', border: '1px solid rgba(240,101,34,0.25)', borderRadius: 16, padding: '28px 32px', textAlign: 'left', boxShadow: '0 0 60px rgba(240,101,34,0.12)' }}>
          <FormFields accent="#F06522" onLogin={email => onLogin(roleByEmail[email ?? ''], email ?? '')} allowedEmails={Object.keys(roleByEmail).filter(email => roleByEmail[email] === selectedRole)} submitLabel="Sign In" inputBg="#0D0B1E" inputBorder="rgba(255,255,255,0.1)" />
        </div>
        <p style={{ color: darkMode ? '#a7b7d1' : '#52718b', fontSize: 12 }}>Demo only: use the sample email below and any non-empty password.</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
          {Object.keys(roleByEmail).filter(email => roleByEmail[email] === selectedRole).map(email => <span key={email} style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#F06522', background: 'rgba(240,101,34,0.08)', border: '1px solid rgba(240,101,34,0.18)', borderRadius: 20, padding: '5px 10px' }}>{email}</span>)}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PORTAL SELECTOR — Landing page
// ══════════════════════════════════════════════════════════════════════════════
interface PortalCard {
  id: UserRole
  title: string
  subtitle: string
  color: string
  bg: string
  icon: ReactElement
  access: string[]
}

const cards: PortalCard[] = [
  {
    id: 'guard', title: 'Security Personnel (Guards)', subtitle: 'Mobile Application · Own Records',
    color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)',
    icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    access: ['Attendance & Check-In', 'GPS Tracking', 'Duty Schedule', 'File Incident'],
  },
  {
    id: 'supervisor', title: 'Supervisor / Site In-Charge', subtitle: 'Web + Mobile · Assigned Sites & Clients',
    color: '#1976b9', bg: 'rgba(25,118,185,0.08)',
    icon: <span style={{ fontSize: 24 }} aria-hidden="true">◎</span>,
    access: ['Assigned Site Dashboard', 'Deployment & Attendance', 'Equipment Accountability', 'Incident Review & Escalation'],
  },
  {
    id: 'operations', title: 'Operations Management (SSD)', subtitle: 'Web Application · All Sites & Clients',
    color: '#F06522', bg: 'rgba(240,101,34,0.08)',
    icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    access: ['AO / DDO Monitoring', 'Guard Deployment & GPS', 'Equipment & Incidents', 'Reports & Escalations'],
  },
  {
    id: 'admin', title: 'System Administrator', subtitle: 'Web Application · Technical Configuration',
    color: '#f97316', bg: 'rgba(249,115,22,0.08)',
    icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    access: ['User Management', 'Roles & Permissions', 'Workflows', 'System Config'],
  },
]

// ── Root component ────────────────────────────────────────────────────────────
interface Props {
  onLogin: (role: UserRole, email: string) => void
  darkMode: boolean
  onToggleTheme: () => void
  onBackHome: () => void
}

export default function LoginPortal({ onLogin, darkMode, onToggleTheme, onBackHome }: Props) {
  const [selected, setSelected] = useState<UserRole | null>(null)
  const goBack = () => setSelected(null)

  if (selected) return <UnifiedLogin selectedRole={selected} darkMode={darkMode} onToggleTheme={onToggleTheme} onBack={goBack} onBackHome={onBackHome} onLogin={onLogin} />

  return (
    <div className="portal-home-shell" style={{ minHeight: '100vh', background: darkMode ? "linear-gradient(160deg, rgba(8, 10, 24, 0.78), rgba(20, 13, 48, 0.9)), url('/assets/bg.jpg') center / cover fixed" : 'linear-gradient(180deg, #f4fbff 0%, #d9effc 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '52px 24px 40px', position: 'relative', overflow: 'hidden' }}>
      <button type="button" onClick={onBackHome} style={{ position: 'absolute', top: 22, left: 26, zIndex: 2, fontFamily: 'Inter', fontSize: 12, color: darkMode ? '#dfe7ff' : '#52718b', background: 'none', border: 'none', cursor: 'pointer' }}>⌂ Home</button>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 10%, rgba(76,169,223,0.22), transparent 26%), radial-gradient(circle at 80% 18%, rgba(25,118,185,0.12), transparent 24%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #7bc5ec, #1976b9, #4ca9df)' }} />

      <button
        type="button"
        onClick={onToggleTheme}
        aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{ position: 'absolute', top: 22, right: 26, zIndex: 2, display: 'flex', alignItems: 'center', gap: 7, border: darkMode ? '1px solid rgba(147,197,253,0.3)' : '1px solid rgba(54,126,171,0.18)', borderRadius: 8, padding: '7px 12px', background: darkMode ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.72)', color: darkMode ? '#dbeafe' : '#16476d', fontFamily: 'Inter', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
      >
        <span aria-hidden="true">{darkMode ? '☀' : '☾'}</span>
        {darkMode ? 'Light Mode' : 'Dark Mode'}
      </button>

      <div className="portal-home-header" style={{ textAlign: 'center', marginBottom: 52, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Logos size={52} />
        </div>
          <h1 style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: 30, color: darkMode ? '#edf6ff' : '#12304a', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          BCC/CAT Security Group
        </h1>
        <p style={{ fontFamily: 'Inter', fontSize: 14, color: darkMode ? '#a7b7d1' : '#52718b', margin: 0 }}>
          Enterprise Operations Platform · Select your portal to sign in
        </p>
      </div>

      <div className="portal-home-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, width: '100%', maxWidth: 1120, position: 'relative', zIndex: 1 }}>
        {cards.map(c => (
          <button key={c.id} className={`portal-card portal-card-${c.id}`} onClick={() => {
            setSelected(c.id)
          }}
            style={{ background: darkMode ? 'rgba(15,23,42,0.82)' : 'rgba(255,255,255,0.82)', border: darkMode ? '1px solid rgba(148,163,184,0.16)' : '1px solid rgba(54,126,171,0.18)', borderRadius: 16, padding: '26px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease', boxShadow: darkMode ? '0 18px 40px rgba(2,6,23,0.36)' : '0 14px 30px rgba(54,126,171,0.16)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${c.color}66`; e.currentTarget.style.transform = 'translateY(-3px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = darkMode ? 'rgba(148,163,184,0.16)' : 'rgba(54,126,171,0.18)'; e.currentTarget.style.transform = 'none' }}
          >
            <div style={{ width: 50, height: 50, borderRadius: 13, background: `${c.color}18`, border: `1px solid ${c.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color, marginBottom: 18 }}>{c.icon}</div>
            <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 15, color: darkMode ? '#edf6ff' : '#12304a', marginBottom: 3 }}>{c.title}</div>
            <div style={{ fontFamily: 'Inter', fontSize: 11, color: c.color, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 12 }}>{c.subtitle}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 18 }}>
              {c.access.map(a => <span key={a} style={{ fontFamily: 'Inter', fontSize: 10, color: darkMode ? '#cfe7ff' : '#52718b', background: darkMode ? 'rgba(255,255,255,0.06)' : '#e7f5fd', border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(54,126,171,0.12)', borderRadius: 20, padding: '2px 9px' }}>{a}</span>)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: c.color }}>Sign in <span aria-hidden="true">→</span></div>
          </button>
        ))}
      </div>

      <p style={{ fontFamily: 'Inter', fontSize: 11, color: darkMode ? '#a7b7d1' : '#52718b', marginTop: 44, opacity: 0.85, position: 'relative', zIndex: 1 }}>
        BCC/CAT Security Group · Enterprise Operations Platform · {new Date().getFullYear()}
      </p>
    </div>
  )
}
