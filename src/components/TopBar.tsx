import { useState, useEffect } from 'react'

export default function TopBar({ section, title, darkMode, onToggleTheme, onLogout }: { section: string; title: string; darkMode: boolean; onToggleTheme: () => void; onLogout?: () => void }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeStr = time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <header
      className="flex items-center justify-between shrink-0"
      style={{
        height: 52,
        background: darkMode ? 'rgba(9,14,22,0.96)' : 'rgba(255,255,255,0.88)',
        borderBottom: darkMode ? '1px solid rgba(148,163,184,0.12)' : '1px solid rgba(54,126,171,0.18)',
        paddingLeft: 24,
        paddingRight: 24,
        zIndex: 10,
        boxShadow: darkMode ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : '0 4px 16px rgba(54,126,171,0.08)',
      }}
    >
      <div className="flex items-center gap-2" style={{ fontFamily: 'Inter', fontSize: 13 }}>
        <span style={{ color: darkMode ? '#94a3b8' : '#52718b' }}>CAT OPS</span>
        <span style={{ color: darkMode ? '#475569' : '#9bbbd0' }}>/</span>
        <span style={{ color: darkMode ? '#7dd3fc' : '#1976b9', fontWeight: 600 }}>{section}</span>
        <span style={{ color: darkMode ? '#475569' : '#9bbbd0' }}>/</span>
        <span style={{ color: darkMode ? '#e2e8f0' : '#12304a', fontWeight: 700 }}>{title}</span>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: darkMode ? '#dbeafe' : '#16476d', background: darkMode ? 'rgba(15,23,42,0.85)' : '#e7f5fd', border: darkMode ? '1px solid rgba(148,163,184,0.18)' : '1px solid rgba(54,126,171,0.16)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
        >
          <span aria-hidden="true">{darkMode ? '☀' : '☾'}</span>
          {darkMode ? 'Light' : 'Dark'}
        </button>
        <div
          className="flex items-center gap-2"
          style={{
            background: darkMode ? 'rgba(15,23,42,0.85)' : '#e7f5fd',
            border: darkMode ? '1px solid rgba(148,163,184,0.15)' : '1px solid rgba(54,126,171,0.16)',
            borderRadius: 8,
            padding: '5px 12px',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: darkMode ? '#e2e8f0' : '#16476d', letterSpacing: '0.05em' }}>
            {timeStr}
          </span>
          <span style={{ fontFamily: 'Inter', fontSize: 11, color: darkMode ? '#94a3b8' : '#52718b' }}>UTC+8</span>
        </div>

        <div
          className="flex items-center gap-2"
          style={{
            border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: 8,
            padding: '5px 14px',
            background: 'rgba(245,158,11,0.08)',
          }}
        >
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
          <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: '#fbbf24', letterSpacing: '0.08em' }}>
            DEFCON 4 – GUARDED
          </span>
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'Inter',
              fontSize: 12,
              color: darkMode ? '#cbd5e1' : '#16476d',
              background: darkMode ? 'rgba(15,23,42,0.85)' : '#ffffff',
              border: darkMode ? '1px solid rgba(148,163,184,0.15)' : '1px solid rgba(54,126,171,0.18)',
              borderRadius: 8,
              padding: '5px 12px',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.35)' }}
            onMouseLeave={e => { e.currentTarget.style.color = darkMode ? '#cbd5e1' : '#16476d'; e.currentTarget.style.borderColor = darkMode ? 'rgba(148,163,184,0.15)' : 'rgba(54,126,171,0.18)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log out
          </button>
        )}
      </div>
    </header>
  )
}
