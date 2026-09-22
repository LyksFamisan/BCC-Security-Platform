import { useState, useEffect } from 'react'

interface Props {
  onEnter: () => void
  darkMode: boolean
  onToggleTheme: () => void
}

export default function SplashScreen({ onEnter, darkMode, onToggleTheme }: Props) {
  const [ready, setReady] = useState(false)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t1 = setTimeout(() => setReady(true), 300)
    const t2 = setInterval(() => setTime(new Date()), 1000)
    return () => { clearTimeout(t1); clearInterval(t2) }
  }, [])

  const timeStr = time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const dateStr = time.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div
      className="splash-screen"
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: ready ? 1 : 0,
        transition: 'opacity 0.7s ease',
        background: darkMode ? '#071827' : '#eaf6ff',
      }}
    >
      {/* ── Background image ─────────────────────────────────── */}
      <img
        src="/assets/bg.jpg"
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: darkMode ? 0.55 : 0.12, zIndex: 0, pointerEvents: 'none' }}
      />

      {/* Dark overlay so text stays readable */}
      <div style={{ position: 'absolute', inset: 0, background: darkMode ? 'linear-gradient(160deg, rgba(8,18,40,0.82) 0%, rgba(10,22,48,0.75) 50%, rgba(6,14,30,0.88) 100%)' : 'linear-gradient(160deg, rgba(244,251,255,0.96) 0%, rgba(226,244,253,0.94) 50%, rgba(210,237,251,0.98) 100%)', zIndex: 1, pointerEvents: 'none' }} />

      {/* Extra vignette at edges */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 40%, rgba(76,169,223,0.10) 100%)', zIndex: 1, pointerEvents: 'none' }} />

      {/* Top bar — blue → orange gradient */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #7bc5ec 0%, #4ca9df 50%, #1976b9 100%)', zIndex: 20 }} />

      {/* ── Top HUD row ──────────────────────────────────────── */}
      <div className="splash-clock" style={{ position: 'absolute', top: 20, left: 28, fontFamily: 'JetBrains Mono', fontSize: 11, color: '#52718b', letterSpacing: '0.08em', zIndex: 20 }}>
        {timeStr} <span style={{ color: 'rgba(255,255,255,0.2)' }}>PHT</span>
      </div>

      <div className="splash-status" style={{ position: 'absolute', top: 16, right: 28, display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.62)', border: '1px solid rgba(240,101,34,0.4)', borderRadius: 6, padding: '6px 14px', zIndex: 20 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F06522', boxShadow: '0 0 6px #F06522' }} />
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#F06522', letterSpacing: '0.1em' }}>ALL SYSTEMS OPERATIONAL</span>
      </div>

      <button
        type="button"
        onClick={onToggleTheme}
        aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        className="splash-theme-toggle"
        style={{ position: 'absolute', top: 68, right: 28, zIndex: 20, display: 'flex', alignItems: 'center', gap: 7, border: darkMode ? '1px solid rgba(147,197,253,0.3)' : '1px solid rgba(54,126,171,0.18)', borderRadius: 8, padding: '7px 12px', background: darkMode ? 'rgba(8,18,40,0.7)' : 'rgba(255,255,255,0.7)', color: darkMode ? '#dbeafe' : '#16476d', fontFamily: 'Inter', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
      >
        <span aria-hidden="true">{darkMode ? '☀' : '☾'}</span>
        {darkMode ? 'Light Mode' : 'Dark Mode'}
      </button>

      {/* ── Main content ─────────────────────────────────────── */}
      <div className="splash-content" style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 24px' }}>

        {/* Logos */}
        <div className="splash-logos" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36 }}>
          <div style={{ width: 76, height: 76, borderRadius: 18, overflow: 'hidden', background: '#000', boxShadow: '0 0 0 2px rgba(240,101,34,0.4), 0 8px 32px rgba(240,101,34,0.3)' }}>
            <img src="/assets/CAT_logo.jpg" alt="CAT" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ width: 2, height: 52, background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
          <div style={{ width: 76, height: 76, borderRadius: 18, overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px rgba(59,130,246,0.4), 0 8px 32px rgba(59,130,246,0.25)' }}>
            <img src="/assets/BCC_logo.jpg" alt="BCC" style={{ width: '88%', height: '88%', objectFit: 'contain' }} />
          </div>
        </div>

        {/* Eyebrow tag */}
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.22em', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 4, padding: '5px 16px', color: '#93c5fd', marginBottom: 20 }}>
          BCC / CAT SECURITY GROUP
        </div>

        {/* Headline */}
        <h1 style={{ fontFamily: 'Inter', fontWeight: 900, fontSize: 'clamp(28px, 5vw, 56px)', margin: '0 0 14px', lineHeight: 1.05, letterSpacing: '-0.025em', maxWidth: 720 }}>
          <span style={{ color: darkMode ? '#ffffff' : '#12304a' }}>Security Services Platform</span>
          <br />
          <span style={{ color: darkMode ? '#F06522' : '#1976b9', display: 'inline' }}>
            for CAT Security Group
          </span>
        </h1>

        {/* Sub-headline */}
        <p style={{ fontFamily: 'Inter', fontSize: 16, color: darkMode ? 'rgba(148,163,184,0.8)' : '#52718b', margin: '0 0 48px', maxWidth: 540, lineHeight: 1.7 }}>
          Unified operational command platform for manpower, equipment, incident management, and executive intelligence.
        </p>

        {/* Feature pills */}
        <div className="splash-features" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 52, maxWidth: 660 }}>
          {[
            { label: 'Manpower Monitoring', dot: '#22c55e' },
            { label: 'Equipment Accountability', dot: '#F06522' },
            { label: 'Incident Management', dot: '#f59e0b' },
            { label: 'Executive Dashboard', dot: '#60a5fa' },
            { label: 'Live Tactical Room', dot: '#ef4444' },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.64)', border: '1px solid rgba(54,126,171,0.16)', borderRadius: 24, padding: '7px 18px', backdropFilter: 'blur(8px)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: f.dot, boxShadow: `0 0 6px ${f.dot}`, flexShrink: 0 }} />
              <span style={{ fontFamily: 'Inter', fontSize: 13, color: '#315d79' }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          className="splash-cta"
          onClick={onEnter}
          style={{
            background: darkMode ? 'linear-gradient(135deg, #F06522 0%, #ea580c 100%)' : 'linear-gradient(135deg, #1976b9 0%, #4ca9df 100%)',
            border: 'none',
            borderRadius: 13,
            padding: '16px 52px',
            fontFamily: 'Inter',
            fontWeight: 700,
            fontSize: 16,
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 4px 24px rgba(25,118,185,0.28), 0 0 0 1px rgba(255,255,255,0.5)',
            transition: 'transform 0.15s, box-shadow 0.15s',
            letterSpacing: '0.01em',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 36px rgba(25,118,185,0.36), 0 0 0 1px rgba(255,255,255,0.7)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(25,118,185,0.28), 0 0 0 1px rgba(255,255,255,0.5)' }}
        >
          Access Portal
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#7190a7', marginTop: 18 }}>
          Select your role portal to sign in
        </p>
      </div>

      {/* ── Bottom date strip ───────────────────────────────── */}
      <div className="splash-date" style={{ position: 'absolute', bottom: 20, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#7190a7', letterSpacing: '0.1em' }}>
          {dateStr.toUpperCase()}
        </span>
      </div>

      {/* Corner accents */}
      <svg style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, opacity: 0.4 }} width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M4 28 L4 4 L28 4" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
      <svg style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, opacity: 0.4 }} width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M28 28 L28 4 L4 4" stroke="#F06522" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
      <svg style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 10, opacity: 0.4 }} width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M4 4 L4 28 L28 28" stroke="#F06522" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
      <svg style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 10, opacity: 0.4 }} width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M28 4 L28 28 L4 28" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  )
}
