import { useState } from 'react'
import { usePortalData } from '../state/PortalDataContext'

const ACC = '#F06522'

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

type AdminTab = 'users' | 'approvals' | 'roles' | 'workflows' | 'system'

type AdminUser = { id: string; name: string; email: string; role: string; status: 'Active' | 'Inactive'; lastLogin: string }

const initialUsers: AdminUser[] = [
  { id: 'USR-001', name: 'Gen. R. Santos', email: 'rsantos@bcccat.com', role: 'Executive', status: 'Active', lastLogin: '2h ago' },
  { id: 'USR-002', name: 'Maj. D. Cruz', email: 'dcruz@bcccat.com', role: 'Operations Staff', status: 'Active', lastLogin: '5h ago' },
  { id: 'USR-003', name: 'Cpt. L. Reyes', email: 'lreyes@bcccat.com', role: 'Incident Manager', status: 'Active', lastLogin: '1d ago' },
  { id: 'USR-004', name: 'Pfc. J. Dela Cruz', email: 'jdelacruz@bcccat.com', role: 'Guard', status: 'Active', lastLogin: '30m ago' },
  { id: 'USR-005', name: 'Pfc. M. Santos', email: 'msantos@bcccat.com', role: 'Guard', status: 'Inactive', lastLogin: '14d ago' },
  { id: 'USR-006', name: 'Lt. R. Garcia', email: 'rgarcia@bcccat.com', role: 'Operations Staff', status: 'Active', lastLogin: '3h ago' },
]

const roles = [
  { name: 'Administrator', users: 1, color: '#dc2626', permissions: ['All Modules', 'User Management', 'System Config', 'Audit Logs'] },
  { name: 'Executive', users: 3, color: '#7c3aed', permissions: ['Dashboard', 'KPI Reports', 'SLA Monitoring', 'Analytics'] },
  { name: 'Operations Staff', users: 8, color: ACC, permissions: ['Operational Dashboard', 'AO / DDO Monitoring', 'GPS & Attendance View', 'Reports'] },
  { name: 'Incident Manager', users: 5, color: '#d97706', permissions: ['Incident Register', 'Case Management', 'Approvals', 'Evidence'] },
  { name: 'Guard', users: 48, color: '#16a34a', permissions: ['My Dashboard', 'Check-In/Out', 'GPS Tracking', 'File Incident'] },
]

const workflows = [
  { name: 'Incident Escalation', trigger: 'New incident filed', steps: 4, status: 'Active' },
  { name: 'Guard Attendance Alert', trigger: 'Missed check-in > 15min', steps: 3, status: 'Active' },
  { name: 'Firearm Vault Audit', trigger: 'Unscheduled access detected', steps: 5, status: 'Active' },
  { name: 'SLA Breach Notification', trigger: 'SLA drops below 99%', steps: 2, status: 'Active' },
  { name: 'New User Onboarding', trigger: 'Account created', steps: 6, status: 'Draft' },
]

const systemItems = [
  { label: 'Platform Version', value: 'v2.5.1-stable', type: 'info' },
  { label: 'Database Status', value: 'Connected · 14ms', type: 'good' },
  { label: 'API Gateway', value: 'Online · 99.98% uptime', type: 'good' },
  { label: 'Last Backup', value: '2 hours ago', type: 'info' },
  { label: 'Active Sessions', value: '24 users', type: 'info' },
  { label: 'SMS Gateway', value: 'Operational', type: 'good' },
  { label: 'Email Service', value: 'Operational', type: 'good' },
  { label: 'Audit Log Retention', value: '90 days', type: 'info' },
]

const initialApprovalRequests = [
  { id: 'REQ-1042', requester: 'Pfc. M. Santos', type: 'New guard account', detail: 'Guard access for NCR-02 deployment', status: 'Pending' },
  { id: 'REQ-1043', requester: 'Maj. D. Cruz', type: 'Role change', detail: 'Operations Staff · Tactical Room access', status: 'Pending' },
]

export default function AdminModule() {
  const { activities, sessions, clearActivities, isLive, lastUpdated, duty, incidentReports, incidentHistory, equipmentFaults, addActivity } = usePortalData()
  const [tab, setTab] = useState<AdminTab>('users')
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>(initialUsers)
  const [search, setSearch] = useState('')
  const [showAddUser, setShowAddUser] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Guard' })
  const [approvalRequests, setApprovalRequests] = useState(initialApprovalRequests)
  const [feedback, setFeedback] = useState('')

  const filteredUsers = adminUsers.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  )

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'users', label: 'User Management',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    },
    {
      id: 'roles', label: 'Roles & Permissions',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    },
    {
      id: 'approvals', label: 'Approval Queue',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
    },
    {
      id: 'workflows', label: 'Workflows',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    },
    {
      id: 'system', label: 'System Config',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>
    },
  ]

  const roleColor: Record<string, string> = {
    'Executive': '#7c3aed', 'Operations Staff': ACC, 'Incident Manager': '#d97706', 'Guard': '#16a34a', 'Administrator': '#dc2626',
  }

  const downloadUsers = () => {
    const csv = ['ID,Name,Email,Role,Status,Last Login', ...adminUsers.map(user => [user.id, user.name, user.email, user.role, user.status, user.lastLogin].map(value => `"${value.replaceAll('"', '""')}"`).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'bcc-cat-users.csv'
    link.click()
    URL.revokeObjectURL(url)
    setFeedback('User directory downloaded.')
  }

  const addUser = (event: React.FormEvent) => {
    event.preventDefault()
    const id = `USR-${String(adminUsers.length + 1).padStart(3, '0')}`
    setAdminUsers(current => [...current, { ...newUser, id, status: 'Active', lastLogin: 'Never' }])
    setNewUser({ name: '', email: '', role: 'Guard' })
    setShowAddUser(false)
    addActivity('Administrator', 'USER_CREATED', `${newUser.name} added as ${newUser.role}`)
    setFeedback(`${newUser.name} was added with ${newUser.role} access.`)
  }

  return (
    <div className="p-5 flex flex-col gap-5" style={{ background: 'transparent', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 20, color: L.heading, margin: 0 }}>System Administration</h2>
          <p style={{ fontFamily: 'Inter', fontSize: 13, color: L.muted, margin: '4px 0 0' }}>Manage users, roles, workflows, and system configuration</p>
        </div>
        <div className="flex items-center gap-3">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 7, padding: '5px 12px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
            <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: '#16a34a' }}>All Systems Operational</span>
          </div>
        </div>
      </div>
      {feedback && <div style={{ background: 'rgba(25,118,185,0.10)', border: '1px solid rgba(25,118,185,0.25)', color: '#1976b9', borderRadius: 7, padding: '9px 12px', fontFamily: 'Inter', fontSize: 12 }}>{feedback}</div>}

      <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, padding: '14px 18px', boxShadow: L.shadow }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: L.heading }}>Connected Portal Activity</div>
            <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted }}>Shared Security Personnel and Operations Portal events · {isLive ? 'Live' : 'Offline'} · {incidentHistory.length} incident records</div>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: L.subtle }}>{lastUpdated ? new Date(lastUpdated).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Waiting'}</span>
            <button type="button" onClick={clearActivities} style={{ fontFamily: 'Inter', fontSize: 11, color: L.muted, background: 'transparent', border: `1px solid ${L.cardBorder}`, borderRadius: 6, padding: '5px 9px', cursor: 'pointer' }}>Clear Feed</button>
          </div>
        </div>
        {activities.length === 0 ? <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.subtle }}>No portal activity yet.</div> : activities.slice(0, 5).map(activity => (
          <div key={activity.id} className="flex items-center gap-3" style={{ borderTop: `1px solid ${L.divider}`, padding: '8px 0' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, color: ACC, minWidth: 108 }}>{activity.source}</span>
            <span style={{ fontFamily: 'Inter', fontSize: 12, color: L.body, flex: 1 }}>{activity.message}</span>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: L.subtle }}>{new Date(activity.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'GUARD DUTY STATUS', value: duty.checkedIn ? 'ON DUTY' : 'OFF DUTY', color: duty.checkedIn ? '#16a34a' : '#d97706' },
          { label: 'LAST CHECK IN', value: duty.checkInTime || 'Not recorded', color: '#1976b9' },
          { label: 'INCIDENT REPORTS', value: String(incidentReports), color: '#dc2626' },
          { label: 'EQUIPMENT FAULTS', value: String(equipmentFaults), color: '#d97706' },
        ].map(item => <div key={item.label} style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 9, padding: '12px 14px', boxShadow: L.shadow }}><div style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, color: L.muted, letterSpacing: '0.06em' }}>{item.label}</div><div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 17, color: item.color, marginTop: 6 }}>{item.value}</div></div>)}
      </div>

      {/* Stat bar */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Total Users', value: '65', sub: '5 roles', color: ACC },
          { label: 'Active Sessions', value: String(sessions.length), sub: 'shared portal logins', color: '#16a34a' },
          { label: 'Active Workflows', value: '4', sub: '1 draft', color: '#7c3aed' },
          { label: 'System Health', value: '99.9%', sub: 'uptime', color: '#16a34a' },
        ].map(s => (
          <div key={s.label} style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, padding: '16px 20px', boxShadow: L.shadow }}>
            <div style={{ fontFamily: 'Inter', fontSize: 11, color: L.muted, marginBottom: 8, letterSpacing: '0.05em' }}>{s.label}</div>
            <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 24, color: s.color }}>{s.value}</div>
            <div style={{ fontFamily: 'Inter', fontSize: 11, color: L.subtle, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 10, padding: 4, boxShadow: L.shadow }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '9px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t.id ? ACC : 'transparent',
              color: tab === t.id ? '#fff' : L.muted,
              fontFamily: 'Inter', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Users Tab ── */}
      {tab === 'users' && (
        <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: L.shadow }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${L.divider}`, display: 'flex', alignItems: 'center', gap: 12, background: L.cardAlt }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users or roles..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.9)', border: `1px solid ${L.cardBorder}`, borderRadius: 7, padding: '8px 14px', fontFamily: 'Inter', fontSize: 13, color: L.heading, outline: 'none' }} />
            <button onClick={() => setShowAddUser(v => !v)}
              style={{ background: ACC, border: 'none', borderRadius: 8, padding: '9px 18px', fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(240,101,34,0.3)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add User
            </button>
            <button type="button" onClick={downloadUsers} style={{ background: 'transparent', border: `1px solid ${L.cardBorder}`, borderRadius: 8, padding: '9px 12px', fontFamily: 'Inter', fontWeight: 600, fontSize: 12, color: L.body, cursor: 'pointer', whiteSpace: 'nowrap' }}>Download CSV</button>
          </div>
          {showAddUser && <form onSubmit={addUser} className="flex items-center gap-2" style={{ padding: '12px 20px', borderBottom: `1px solid ${L.divider}`, background: 'rgba(240,101,34,0.04)' }}>
            <input required value={newUser.name} onChange={event => setNewUser(current => ({ ...current, name: event.target.value }))} placeholder="Full name" style={{ flex: 1, background: '#fff', border: `1px solid ${L.cardBorder}`, borderRadius: 7, padding: '8px 10px', fontFamily: 'Inter', fontSize: 13, color: L.heading }} />
            <input required type="email" value={newUser.email} onChange={event => setNewUser(current => ({ ...current, email: event.target.value }))} placeholder="Email" style={{ flex: 1, background: '#fff', border: `1px solid ${L.cardBorder}`, borderRadius: 7, padding: '8px 10px', fontFamily: 'Inter', fontSize: 13, color: L.heading }} />
            <select value={newUser.role} onChange={event => setNewUser(current => ({ ...current, role: event.target.value }))} style={{ background: '#fff', border: `1px solid ${L.cardBorder}`, borderRadius: 7, padding: '8px 10px', fontFamily: 'Inter', fontSize: 13, color: L.heading }}><option>Guard</option><option>Operations Staff</option><option>Incident Manager</option><option>Executive</option><option>Administrator</option></select>
            <button type="submit" style={{ background: '#16a34a', border: 'none', borderRadius: 7, padding: '8px 12px', color: '#fff', fontFamily: 'Inter', fontWeight: 700, cursor: 'pointer' }}>Create</button>
          </form>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 100px 100px 80px', gap: 0, padding: '10px 20px', borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
            {['Name', 'Email', 'Role', 'Status', 'Last Login', ''].map(h => (
              <span key={h} style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: L.muted, letterSpacing: '0.06em' }}>{h}</span>
            ))}
          </div>
          {filteredUsers.map((u, i) => (
            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 100px 100px 80px', gap: 0, padding: '14px 20px', borderBottom: i < filteredUsers.length - 1 ? `1px solid ${L.divider}` : 'none', alignItems: 'center', transition: 'background 0.15s', cursor: 'default' }}
              onMouseEnter={e => (e.currentTarget.style.background = L.rowHover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div>
                <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: L.heading }}>{u.name}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 11, color: L.subtle }}>{u.id}</div>
              </div>
              {editingUser === u.id ? <input value={u.email} onChange={event => setAdminUsers(current => current.map(user => user.id === u.id ? { ...user, email: event.target.value } : user))} style={{ width: '100%', border: `1px solid ${ACC}`, borderRadius: 5, padding: '5px 7px', fontFamily: 'Inter', fontSize: 12, color: L.heading }} /> : <span style={{ fontFamily: 'Inter', fontSize: 13, color: L.body }}>{u.email}</span>}
              {editingUser === u.id ? <select value={u.role} onChange={event => setAdminUsers(current => current.map(user => user.id === u.id ? { ...user, role: event.target.value } : user))} style={{ border: `1px solid ${ACC}`, borderRadius: 5, padding: '5px 7px', fontFamily: 'Inter', fontSize: 12, color: L.heading }}><option>Guard</option><option>Operations Staff</option><option>Incident Manager</option><option>Executive</option><option>Administrator</option></select> : <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: roleColor[u.role] || ACC }}>{u.role}</span>}
              <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: u.status === 'Active' ? '#16a34a' : L.muted, background: u.status === 'Active' ? 'rgba(22,163,74,0.1)' : 'rgba(107,114,128,0.1)', borderRadius: 20, padding: '3px 10px', display: 'inline-block' }}>{u.status}</span>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: L.subtle }}>{u.lastLogin}</span>
              <div className="flex gap-2">
                <button onClick={() => { setEditingUser(editingUser === u.id ? null : u.id); setFeedback(editingUser === u.id ? `${u.name} changes saved.` : `Editing ${u.name}.`) }} style={{ fontFamily: 'Inter', fontSize: 11, color: ACC, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{editingUser === u.id ? 'Save' : 'Edit'}</button>
                <button onClick={() => { setAdminUsers(current => current.map(user => user.id === u.id ? { ...user, status: user.status === 'Active' ? 'Inactive' : 'Active' } : user)); setFeedback(`${u.name} access ${u.status === 'Active' ? 'disabled' : 'enabled'}.`) }} style={{ fontFamily: 'Inter', fontSize: 11, color: L.subtle, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{u.status === 'Active' ? 'Disable' : 'Enable'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'approvals' && (
        <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: L.shadow }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
            <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: L.heading }}>Pending Approval Requests</div>
            <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, marginTop: 3 }}>Review access, account, and operational requests before activation.</div>
          </div>
          {approvalRequests.length === 0 ? <div style={{ padding: 32, textAlign: 'center', fontFamily: 'Inter', fontSize: 13, color: L.subtle }}>No pending approval requests.</div> : approvalRequests.map(request => (
            <div key={request.id} className="flex items-center justify-between gap-4" style={{ padding: '16px 20px', borderBottom: `1px solid ${L.divider}` }}>
              <div>
                <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 13, color: L.heading }}>{request.type} · {request.id}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.body, marginTop: 4 }}>{request.requester} · {request.detail}</div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setApprovalRequests(current => current.filter(item => item.id !== request.id)); addActivity('Administrator', 'REQUEST_APPROVED', `${request.id} approved`); setFeedback(`${request.id} approved.`) }} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 11px', fontFamily: 'Inter', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Approve</button>
                <button type="button" onClick={() => { setApprovalRequests(current => current.filter(item => item.id !== request.id)); addActivity('Administrator', 'REQUEST_REJECTED', `${request.id} rejected`); setFeedback(`${request.id} rejected.`) }} style={{ background: 'transparent', color: '#dc2626', border: '1px solid rgba(220,38,38,0.35)', borderRadius: 6, padding: '7px 11px', fontFamily: 'Inter', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Roles Tab ── */}
      {tab === 'roles' && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {roles.map(r => (
            <div key={r.name} style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '22px', boxShadow: L.shadow }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color }} />
                  <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: L.heading }}>{r.name}</span>
                </div>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: r.color, fontWeight: 600 }}>{r.users} users</span>
              </div>
              <div className="flex flex-col gap-2">
                {r.permissions.map(p => (
                  <div key={p} className="flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={r.color} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span style={{ fontFamily: 'Inter', fontSize: 12, color: L.body }}>{p}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setFeedback(`Permission editor opened for ${r.name}.`)} style={{ marginTop: 16, width: '100%', padding: '8px', borderRadius: 7, border: `1px solid ${r.color}40`, background: `${r.color}08`, fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: r.color, cursor: 'pointer' }}>
                Edit Permissions
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Workflows Tab ── */}
      {tab === 'workflows' && (
        <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: L.shadow }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${L.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: L.cardAlt }}>
            <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: L.heading }}>Automation Workflows</span>
            <button onClick={() => setFeedback('New workflow creation started.')} style={{ background: ACC, border: 'none', borderRadius: 7, padding: '8px 16px', fontFamily: 'Inter', fontWeight: 600, fontSize: 12, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(240,101,34,0.25)' }}>+ New Workflow</button>
          </div>
          {workflows.map((w, i) => (
            <div key={w.name} style={{ padding: '18px 20px', borderBottom: i < workflows.length - 1 ? `1px solid ${L.divider}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onMouseEnter={e => (e.currentTarget.style.background = L.rowHover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div>
                <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: L.heading, marginBottom: 4 }}>{w.name}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted }}>Trigger: {w.trigger} · {w.steps} steps</div>
              </div>
              <div className="flex items-center gap-3">
                <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 600, color: w.status === 'Active' ? '#16a34a' : L.muted, background: w.status === 'Active' ? 'rgba(22,163,74,0.1)' : 'rgba(107,114,128,0.1)', borderRadius: 20, padding: '3px 10px' }}>{w.status}</span>
                <button onClick={() => setFeedback(`Workflow editor opened for ${w.name}.`)} style={{ fontFamily: 'Inter', fontSize: 12, color: ACC, background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>
                <button onClick={() => setFeedback(`${w.name} ${w.status === 'Active' ? 'paused' : 'activated'}.`)} style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, background: 'none', border: 'none', cursor: 'pointer' }}>{w.status === 'Active' ? 'Pause' : 'Activate'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── System Config Tab ── */}
      {tab === 'system' && (
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: L.shadow }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${L.divider}`, background: L.cardAlt }}>
              <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: L.heading }}>System Status</span>
            </div>
            {systemItems.map((s, i) => (
              <div key={s.label} style={{ padding: '14px 20px', borderBottom: i < systemItems.length - 1 ? `1px solid ${L.divider}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Inter', fontSize: 13, color: L.body }}>{s.label}</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: s.type === 'good' ? '#16a34a' : L.heading }}>{s.value}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-4">
            <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '22px', boxShadow: L.shadow }}>
              <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: L.heading, marginBottom: 16 }}>Notification Settings</div>
              {['SMS alerts for critical incidents', 'Email daily summary reports', 'Push alerts for SLA breach', 'Firearm audit notifications'].map(n => (
                <div key={n} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${L.divider}` }}>
                  <span style={{ fontFamily: 'Inter', fontSize: 13, color: L.body }}>{n}</span>
                  <div style={{ width: 36, height: 20, background: ACC, borderRadius: 10, position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                    <div style={{ width: 14, height: 14, background: '#fff', borderRadius: '50%', position: 'absolute', right: 3, top: 3 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '22px', boxShadow: L.shadow }}>
              <div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: L.heading, marginBottom: 14 }}>Danger Zone</div>
              <div className="flex flex-col gap-3">
                <button onClick={() => setFeedback('Data synchronization completed successfully.')} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid rgba(217,119,6,0.4)', background: 'rgba(217,119,6,0.04)', fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: '#d97706', cursor: 'pointer' }}>Force Sync All Data</button>
                <button onClick={() => setFeedback('Audit log clear request recorded for administrator approval.')} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid rgba(220,38,38,0.4)', background: 'rgba(220,38,38,0.04)', fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}>Clear Audit Logs</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
