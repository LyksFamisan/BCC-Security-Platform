import { useState, type ReactElement } from 'react'

export type UserRole = 'guard' | 'operations' | 'admin'

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
  const [helpMessage, setHelpMessage] = useState('')

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
        <label style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#dfe7ff', display: 'block', marginBottom: 6 }}>Email / Employee ID</label>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your ID or email"
          style={base}
          onFocus={el => (el.currentTarget.style.borderColor = accent)}
          onBlur={el => (el.currentTarget.style.borderColor = inputBorder)} />
      </div>
      <div>
        <label style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#dfe7ff', display: 'block', marginBottom: 6 }}>Password</label>
        <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Enter your password"
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

// ══════════════════════════════════════════════════════════════════════════════
// PORTAL 1 — Guard (dark green military)
// ══════════════════════════════════════════════════════════════════════════════
function GuardLogin({ onBack, onLogin }: { onBack: () => void; onLogin: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: 'rgba(6,14,9,0.88)', display: 'flex', position: 'relative', overflow: 'hidden' }} className="personnel-login-shell">
      {/* Hex-grid watermark */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04, pointerEvents: 'none' }} viewBox="0 0 400 400">
        {Array.from({ length: 8 }).map((_, row) =>
          Array.from({ length: 8 }).map((_, col) => {
            const x = col * 50 + (row % 2 === 0 ? 0 : 25)
            const y = row * 44
            const pts = Array.from({ length: 6 }).map((_, i) => {
              const a = (Math.PI / 3) * i
              return `${x + 22 * Math.cos(a)},${y + 22 * Math.sin(a)}`
            }).join(' ')
            return <polygon key={`${row}-${col}`} points={pts} fill="none" stroke="#8B5CF6" strokeWidth="1" />
          })
        )}
      </svg>

      {/* Left panel – branding */}
      <div className="personnel-login-brand" style={{ width: '42%', background: 'rgba(139,92,246,0.06)', borderRight: '1px solid rgba(139,92,246,0.15)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 48px', position: 'relative' }}>
        <Logos size={44} />
        <div style={{ marginTop: 32 }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#8B5CF6', letterSpacing: '0.2em', marginBottom: 12 }}>SECURITY PERSONNEL</div>
          <h1 style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: 32, color: '#e8eaf0', margin: '0 0 14px', lineHeight: 1.1 }}>Security Personnel<br />Portal</h1>
          <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#dfe7ff', lineHeight: 1.7, margin: 0 }}>Mobile duty monitoring, GPS attendance check-in, deployment tracking and incident reporting.</p>
        </div>
        <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['Duty Schedule & Check-In', 'GPS Location Tracking', 'Incident Reporting', 'Announcement Feed'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#8B5CF6', flexShrink: 0 }} />
              <span style={{ fontFamily: 'Inter', fontSize: 13, color: '#e5f4ec' }}>{f}</span>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', bottom: 28, left: 48, fontFamily: 'JetBrains Mono', fontSize: 9, color: 'rgba(139,92,246,0.3)', letterSpacing: '0.1em' }}>
          BCC/CAT SECURITY · PERSONNEL ACCESS
        </div>
      </div>

      {/* Right panel – form */}
      <div className="personnel-login-form" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 56px' }}>
        <button onClick={onBack} style={{ position: 'absolute', top: 28, right: 28, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter', fontSize: 12, color: 'rgba(139,92,246,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}>
          ← All Portals
        </button>
        <div style={{ maxWidth: 360, width: '100%' }}>
          <div style={{ display: 'inline-block', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#8B5CF6', letterSpacing: '0.15em', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 4, padding: '4px 10px', marginBottom: 20 }}>SECURITY PERSONNEL LOGIN</div>
          <h2 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 24, color: '#e8eaf0', margin: '0 0 8px' }}>Sign in to duty</h2>
          <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#dfe7ff', margin: '0 0 28px' }}>Use your Employee ID or registered email address.</p>
          <FormFields accent="#8B5CF6" onLogin={onLogin} submitLabel="Sign In" portalEmail="security@gmail.com" inputBg="rgba(139,92,246,0.05)" inputBorder="rgba(139,92,246,0.2)" />
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PORTAL 2 — Operations Staff (orange tactical)
// ══════════════════════════════════════════════════════════════════════════════
function OpsLogin({ onBack, onLogin, darkMode, onToggleTheme }: { onBack: () => void; onLogin: () => void; darkMode: boolean; onToggleTheme: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: darkMode ? "linear-gradient(160deg, rgba(8, 10, 24, 0.78), rgba(20, 13, 48, 0.9)), url('/assets/bg.jpg') center / cover fixed" : 'linear-gradient(180deg, #f4fbff 0%, #d9effc 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: 24 }}>
      {/* Diagonal stripe accent */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: 320, height: '100%', background: 'linear-gradient(135deg, transparent 40%, rgba(240,101,34,0.07) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: 180, height: 180, background: 'radial-gradient(circle, rgba(240,101,34,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <button onClick={onBack} style={{ position: 'fixed', top: 24, left: 28, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter', fontSize: 12, color: darkMode ? '#dfe7ff' : '#52718b', background: 'none', border: 'none', cursor: 'pointer' }}>← All Portals</button>
      <button type="button" onClick={onToggleTheme} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} style={{ position: 'fixed', top: 20, right: 26, zIndex: 2, display: 'flex', alignItems: 'center', gap: 7, border: darkMode ? '1px solid rgba(147,197,253,0.3)' : '1px solid rgba(54,126,171,0.18)', borderRadius: 8, padding: '7px 12px', background: darkMode ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.72)', color: darkMode ? '#dbeafe' : '#16476d', fontFamily: 'Inter', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
        <span aria-hidden="true">{darkMode ? '☀' : '☾'}</span>{darkMode ? 'Light Mode' : 'Dark Mode'}
      </button>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
        <Logos size={40} />
        <div>
          <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 16, color: darkMode ? '#e8eaf0' : '#12304a' }}>BCC/CAT Security</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#F06522', letterSpacing: '0.12em' }}>OPERATIONS PORTAL</div>
        </div>
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 480, background: 'rgba(13,10,30,0.75)', border: '1px solid rgba(240,101,34,0.2)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 0 60px rgba(240,101,34,0.12)' }}>
        {/* Orange header bar */}
        <div style={{ background: 'linear-gradient(135deg, #F06522 0%, #d4521a 100%)', padding: '24px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <div>
              <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 18, color: '#fff' }}>Detachment / Operations Staff</div>
              <div style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Roster · Deployment · Attendance Monitoring</div>
            </div>
          </div>
        </div>
        <div style={{ padding: '32px' }}>
          <FormFields accent="#F06522" onLogin={onLogin} submitLabel="Sign In" portalEmail="ar@gmail.com" inputBg="#0D0B1E" inputBorder="rgba(255,255,255,0.1)" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, marginTop: 28 }}>
        {['AO / DDO Roster', 'Guard Deployment', 'GPS Monitoring', 'Attendance & Reports'].map(a => (
          <span key={a} style={{ fontFamily: 'Inter', fontSize: 11, color: '#dfe7ff', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '4px 12px' }}>{a}</span>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Legacy incident and executive layouts remain unused; their workflows are now accessed through Operations Portal.
// ══════════════════════════════════════════════════════════════════════════════
function IncidentLogin({ onBack, onLogin }: { onBack: () => void; onLogin: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: 'rgba(15,10,0,0.88)', display: 'flex', position: 'relative', overflow: 'hidden' }}>
      {/* Pulsing ring watermark */}
      <div style={{ position: 'absolute', top: '50%', left: '38%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
        {[280, 220, 160].map((r, i) => (
          <div key={r} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: r, height: r, borderRadius: '50%', border: `1px solid rgba(245,158,11,${0.06 - i * 0.015})` }} />
        ))}
      </div>

      {/* Right panel – form */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 56px' }}>
        <button onClick={onBack} style={{ position: 'absolute', top: 28, left: 28, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter', fontSize: 12, color: '#5a4a20', background: 'none', border: 'none', cursor: 'pointer' }}>← All Portals</button>
        <div style={{ maxWidth: 380, width: '100%' }}>
          <Logos size={40} />
          <div style={{ marginTop: 28, marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#f59e0b', letterSpacing: '0.15em' }}>INCIDENT MANAGEMENT</span>
            </div>
            <h2 style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: 28, color: '#e8eaf0', margin: '0 0 8px' }}>Case Portal</h2>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#f9fafb', margin: 0 }}>Incident reporting, case investigation, approvals & evidence management.</p>
          </div>
          <FormFields accent="#f59e0b" onLogin={onLogin} submitLabel="Access Case Portal" inputBg="rgba(245,158,11,0.04)" inputBorder="rgba(245,158,11,0.18)" />
        </div>
      </div>

      {/* Right decorative panel */}
      <div style={{ width: '38%', background: 'rgba(245,158,11,0.05)', borderLeft: '1px solid rgba(245,158,11,0.12)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '48px', gap: 12 }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: 'rgba(245,158,11,0.35)', letterSpacing: '0.1em', marginBottom: 16 }}>AUTHORIZED ACCESS</div>
        {[
          { label: 'Incident Register', icon: '📋' },
          { label: 'Case Investigation', icon: '🔍' },
          { label: 'Approval Workflows', icon: '✓' },
          { label: 'Evidence & Logs', icon: '📁' },
        ].map(item => (
          <div key={item.label} style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span style={{ fontFamily: 'Inter', fontSize: 13, color: '#7a6030' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PORTAL 4 — Executive (purple prestige)
// ══════════════════════════════════════════════════════════════════════════════
function ExecutiveLogin({ onBack, onLogin }: { onBack: () => void; onLogin: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: 'rgba(10,8,32,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: 24 }}>
      {/* Top gradient bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #4A2BA0, #a78bfa, #4A2BA0)' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(ellipse at 80% 20%, rgba(167,139,250,0.08) 0%, transparent 60%)', pointerEvents: 'none' }} />

      <button onClick={onBack} style={{ position: 'fixed', top: 28, left: 32, fontFamily: 'Inter', fontSize: 12, color: '#dfe7ff', background: 'none', border: 'none', cursor: 'pointer' }}>← All Portals</button>

      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        {/* Logo centred */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <Logos size={48} />
        </div>
        <div style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: 22, color: '#e8eaf0', marginBottom: 4 }}>BCC/CAT Security Group</div>
<div style={{ fontFamily: 'Inter', fontSize: 12, color: '#e9d5ff', letterSpacing: '0.1em', marginBottom: 36 }}>EXECUTIVE COMMAND PORTAL</div>

        {/* Glassy card */}
        <div style={{ background: 'rgba(74,43,160,0.12)', backdropFilter: 'blur(20px)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 18, padding: '36px 36px 32px', boxShadow: '0 24px 80px rgba(74,43,160,0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>
          </div>
          <h3 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 20, color: '#e8eaf0', margin: '0 0 6px' }}>Management Access</h3>
          <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#f3f4f6', margin: '0 0 28px' }}>Dashboard · KPI Reports · SLA Monitoring · Analytics</p>
          <FormFields accent="#a78bfa" onLogin={onLogin} submitLabel="Enter Command Portal" inputBg="rgba(74,43,160,0.15)" inputBorder="rgba(167,139,250,0.2)" />
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PORTAL 5 — Administrator (red critical)
// ══════════════════════════════════════════════════════════════════════════════
function AdminLogin({ onBack, onLogin }: { onBack: () => void; onLogin: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: 'rgba(13,6,6,0.9)', display: 'flex', position: 'relative', overflow: 'hidden' }}>
      {/* Scan-line effect */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(239,68,68,0.015) 2px, rgba(239,68,68,0.015) 4px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: '#ef4444', opacity: 0.6 }} />

      {/* Centred form */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
        <button onClick={onBack} style={{ position: 'fixed', top: 24, left: 28, fontFamily: 'Inter', fontSize: 12, color: '#ffe5e5', background: 'none', border: 'none', cursor: 'pointer' }}>← All Portals</button>

        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <Logos size={38} />
            <div>
              <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: '#e8eaf0' }}>BCC/CAT Security</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#ef4444', letterSpacing: '0.15em' }}>ADMINISTRATOR · RESTRICTED</div>
            </div>
          </div>

          {/* Warning banner */}
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
            <span style={{ fontFamily: 'Inter', fontSize: 12, color: '#ffe5e5' }}>Restricted area. Unauthorized access is logged and reported.</span>
          </div>

          <div style={{ background: 'rgba(26,8,8,0.92)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '28px', boxShadow: '0 0 40px rgba(239,68,68,0.1)' }}>
            <h2 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 20, color: '#e8eaf0', margin: '0 0 4px' }}>System Administrator</h2>
            <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#f3f4f6', margin: '0 0 24px' }}>Full access to users, roles, workflows & system configuration.</p>
            <FormFields accent="#ef4444" onLogin={onLogin} submitLabel="Sign In" portalEmail="BCC@gmail.com" inputBg="rgba(239,68,68,0.04)" inputBorder="rgba(239,68,68,0.2)" />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20, justifyContent: 'center' }}>
            {['User Management', 'Roles & Permissions', 'Workflows', 'System Config', 'All Modules', 'Audit Logs'].map(a => (
              <span key={a} style={{ fontFamily: 'Inter', fontSize: 11, color: '#fef2f2', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 20, padding: '3px 10px' }}>{a}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function UnifiedLogin({ onBack, onBackHome, onLogin, darkMode, onToggleTheme }: { onBack?: () => void; onBackHome: () => void; onLogin: (role: UserRole, email: string) => void; darkMode: boolean; onToggleTheme: () => void }) {
  const roleByEmail: Record<string, UserRole> = {
    'security@gmail.com': 'guard',
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
        <div style={{ fontFamily: 'Inter', fontSize: 13, color: darkMode ? '#a7b7d1' : '#52718b', marginBottom: 24 }}>Sign in with your authorized email to access the correct portal.</div>
        <div style={{ background: 'rgba(13,10,30,0.82)', border: '1px solid rgba(240,101,34,0.25)', borderRadius: 16, padding: '28px 32px', textAlign: 'left', boxShadow: '0 0 60px rgba(240,101,34,0.12)' }}>
          <FormFields accent="#F06522" onLogin={email => onLogin(roleByEmail[email ?? ''], email ?? '')} allowedEmails={Object.keys(roleByEmail)} submitLabel="Sign In" inputBg="#0D0B1E" inputBorder="rgba(255,255,255,0.1)" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
          {Object.keys(roleByEmail).map(email => <span key={email} style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#F06522', background: 'rgba(240,101,34,0.08)', border: '1px solid rgba(240,101,34,0.18)', borderRadius: 20, padding: '5px 10px' }}>{email}</span>)}
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
    id: 'guard', title: 'Security Personnel', subtitle: 'Security Personnel Portal',
    color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)',
    icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    access: ['Attendance & Check-In', 'GPS Tracking', 'Duty Schedule', 'File Incident'],
  },
  {
    id: 'operations', title: 'Detachment Staff', subtitle: 'Operations Portal',
    color: '#F06522', bg: 'rgba(240,101,34,0.08)',
    icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    access: ['AO / DDO Monitoring', 'Guard Deployment & GPS', 'Equipment & Incidents', 'Reports & Escalations'],
  },
  {
    id: 'admin', title: 'Administrator', subtitle: 'System Portal',
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
  const [selected, setSelected] = useState<UserRole | null>('operations')
  const goBack = () => setSelected(null)

  if (selected) return <UnifiedLogin darkMode={darkMode} onToggleTheme={onToggleTheme} onBack={goBack} onBackHome={onBackHome} onLogin={onLogin} />

  return (
    <div style={{ minHeight: '100vh', background: darkMode ? "linear-gradient(160deg, rgba(8, 10, 24, 0.78), rgba(20, 13, 48, 0.9)), url('/assets/bg.jpg') center / cover fixed" : 'linear-gradient(180deg, #f4fbff 0%, #d9effc 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '52px 24px 40px', position: 'relative', overflow: 'hidden' }}>
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

      <div style={{ textAlign: 'center', marginBottom: 52, position: 'relative', zIndex: 1 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, width: '100%', maxWidth: 1120, position: 'relative', zIndex: 1 }}>
        {cards.map(c => (
          <button key={c.id} onClick={() => setSelected(c.id)}
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
