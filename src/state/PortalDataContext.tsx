import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export type PortalActivity = {
  id: string
  source: string
  type: string
  message: string
  createdAt: string
}

export type PortalSession = {
  id: string
  source: string
  email: string
  role: string
  loginAt: string
  lastSeenAt: string
}

export type IncidentRecord = {
  id: string
  filedBy: string
  type: string
  location: string
  severity: string
  description: string
  evidence?: string
  status: 'Submitted' | 'Under Review' | 'Closed'
  createdAt: string
}

export type DutyRecord = {
  checkedIn: boolean
  checkInTime: string
  checkOutTime: string
  checkInPhoto?: string
  checkOutPhoto?: string
  checkInLocation?: { latitude: number; longitude: number; accuracy: number; source: 'live' | 'assigned-site' }
  checkOutLocation?: { latitude: number; longitude: number; accuracy: number; source: 'live' | 'assigned-site' }
  checkInPhotoAt?: string
  checkOutPhotoAt?: string
}

export type ManagedUser = { id: string; name: string; email: string; role: string; status: 'Active' | 'Inactive'; lastLogin: string }
export type ApprovalRequest = { id: string; requester: string; type: string; detail: string; status: 'Pending' | 'Approved' | 'Rejected' }

export type SharedPortalData = {
  activities: PortalActivity[]
  sessions: PortalSession[]
  duty: DutyRecord
  incidentReports: number
  incidentHistory: IncidentRecord[]
  equipmentFaults: number
  managedUsers: ManagedUser[]
  approvalRequests: ApprovalRequest[]
}

type PortalDataContextValue = {
  activities: PortalActivity[]
  sessions: PortalSession[]
  duty: DutyRecord
  incidentReports: number
  incidentHistory: IncidentRecord[]
  equipmentFaults: number
  managedUsers: ManagedUser[]
  approvalRequests: ApprovalRequest[]
  lastUpdated: string | null
  isLive: boolean
  addActivity: (source: string, type: string, message: string) => void
  recordLogin: (source: string, email: string, role: string) => void
  setDuty: (duty: DutyRecord) => void
  recordIncident: () => void
  addIncidentRecord: (record: Omit<IncidentRecord, 'id' | 'createdAt' | 'status'>) => void
  recordEquipmentFault: () => void
  createManagedUser: (user: Omit<ManagedUser, 'id' | 'lastLogin'>) => void
  updateManagedUser: (id: string, changes: Partial<ManagedUser>) => void
  resolveApprovalRequest: (id: string, status: 'Approved' | 'Rejected') => void
  clearActivities: () => void
}

const STORAGE_KEY = 'cat-security-portal-data'
const CHANNEL_NAME = 'cat-security-portal-live'
const PHOTO_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const PortalDataContext = createContext<PortalDataContextValue | null>(null)

const defaultDuty: DutyRecord = { checkedIn: false, checkInTime: '', checkOutTime: '' }
const defaultManagedUsers: ManagedUser[] = [
  { id: 'USR-001', name: 'Gen. R. Santos', email: 'rsantos@bcccat.com', role: 'Executive', status: 'Active', lastLogin: '2h ago' },
  { id: 'USR-002', name: 'Maj. D. Cruz', email: 'dcruz@bcccat.com', role: 'Operations Staff', status: 'Active', lastLogin: '5h ago' },
  { id: 'USR-003', name: 'Cpt. L. Reyes', email: 'lreyes@bcccat.com', role: 'Incident Manager', status: 'Active', lastLogin: '1d ago' },
  { id: 'USR-004', name: 'Pfc. J. Dela Cruz', email: 'jdelacruz@bcccat.com', role: 'Guard', status: 'Active', lastLogin: '30m ago' },
  { id: 'USR-005', name: 'Pfc. M. Santos', email: 'msantos@bcccat.com', role: 'Guard', status: 'Inactive', lastLogin: '14d ago' },
  { id: 'USR-006', name: 'Lt. R. Garcia', email: 'rgarcia@bcccat.com', role: 'Operations Staff', status: 'Active', lastLogin: '3h ago' },
]
const defaultApprovalRequests: ApprovalRequest[] = [
  { id: 'REQ-1042', requester: 'Pfc. M. Santos', type: 'New guard account', detail: 'Guard access for NCR-02 deployment', status: 'Pending' },
  { id: 'REQ-1043', requester: 'Maj. D. Cruz', type: 'Role change', detail: 'Operations Staff · Tactical Room access', status: 'Pending' },
]

function pruneDutyPhotos(duty: DutyRecord): DutyRecord {
  const nextDuty = { ...duty }
  const now = Date.now()
  if (nextDuty.checkInPhoto && (!nextDuty.checkInPhotoAt || now - new Date(nextDuty.checkInPhotoAt).getTime() >= PHOTO_RETENTION_MS)) {
    delete nextDuty.checkInPhoto
    delete nextDuty.checkInPhotoAt
    delete nextDuty.checkInLocation
  }
  if (nextDuty.checkOutPhoto && (!nextDuty.checkOutPhotoAt || now - new Date(nextDuty.checkOutPhotoAt).getTime() >= PHOTO_RETENTION_MS)) {
    delete nextDuty.checkOutPhoto
    delete nextDuty.checkOutPhotoAt
    delete nextDuty.checkOutLocation
  }
  return nextDuty
}

function readStoredData(): SharedPortalData & { updatedAt: string | null } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { activities: [], sessions: [], duty: defaultDuty, incidentReports: 0, incidentHistory: [], equipmentFaults: 0, managedUsers: defaultManagedUsers, approvalRequests: defaultApprovalRequests, updatedAt: null }
    const parsed = JSON.parse(saved)
    const storedDuty = parsed.duty ?? defaultDuty
    const now = new Date().toISOString()
    const dutyWithTimestamps = {
      ...storedDuty,
      checkInPhotoAt: storedDuty.checkInPhoto && !storedDuty.checkInPhotoAt ? now : storedDuty.checkInPhotoAt,
      checkOutPhotoAt: storedDuty.checkOutPhoto && !storedDuty.checkOutPhotoAt ? now : storedDuty.checkOutPhotoAt,
    }
    return { activities: parsed.activities ?? [], sessions: parsed.sessions ?? [], duty: pruneDutyPhotos(dutyWithTimestamps), incidentReports: parsed.incidentReports ?? 0, incidentHistory: parsed.incidentHistory ?? [], equipmentFaults: parsed.equipmentFaults ?? 0, managedUsers: parsed.managedUsers ?? defaultManagedUsers, approvalRequests: parsed.approvalRequests ?? defaultApprovalRequests, updatedAt: parsed.updatedAt ?? null }
  } catch {
    return { activities: [], sessions: [], duty: defaultDuty, incidentReports: 0, incidentHistory: [], equipmentFaults: 0, managedUsers: defaultManagedUsers, approvalRequests: defaultApprovalRequests, updatedAt: null }
  }
}

export function PortalDataProvider({ children }: { children: ReactNode }) {
  const initialData = readStoredData()
  const [activities, setActivities] = useState<PortalActivity[]>(initialData.activities)
  const [sessions, setSessions] = useState<PortalSession[]>(initialData.sessions)
  const [duty, setDuty] = useState<DutyRecord>(initialData.duty)
  const [incidentReports, setIncidentReports] = useState(initialData.incidentReports)
  const [incidentHistory, setIncidentHistory] = useState<IncidentRecord[]>(initialData.incidentHistory)
  const [equipmentFaults, setEquipmentFaults] = useState(initialData.equipmentFaults)
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>(initialData.managedUsers)
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>(initialData.approvalRequests)
  const [lastUpdated, setLastUpdated] = useState<string | null>(initialData.updatedAt)
  const serializedRef = useRef(JSON.stringify(initialData))
  const channelRef = useRef<BroadcastChannel | null>(null)
  const applyingRemoteRef = useRef(false)

  useEffect(() => {
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false
      return
    }
    const updatedAt = new Date().toISOString()
    setLastUpdated(updatedAt)
    const data = { activities, sessions, duty, incidentReports, incidentHistory, equipmentFaults, managedUsers, approvalRequests, updatedAt }
    serializedRef.current = JSON.stringify(data)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    channelRef.current?.postMessage(data)
  }, [activities, sessions, duty, incidentReports, incidentHistory, equipmentFaults, managedUsers, approvalRequests])

  useEffect(() => {
    const retentionCheck = window.setInterval(() => {
      setDuty(current => {
        const nextDuty = pruneDutyPhotos(current)
        return JSON.stringify(nextDuty) === JSON.stringify(current) ? current : nextDuty
      })
    }, 60 * 1000)
    return () => window.clearInterval(retentionCheck)
  }, [])

  useEffect(() => {
    const sync = (data: Partial<SharedPortalData> & { updatedAt: string | null }) => {
      const nextActivities = data.activities ?? []
      const serialized = JSON.stringify(data)
      if (serialized === serializedRef.current) return
      serializedRef.current = serialized
      applyingRemoteRef.current = true
      setActivities(nextActivities)
      setSessions(data.sessions ?? [])
      setDuty(pruneDutyPhotos(data.duty ?? defaultDuty))
      setIncidentReports(data.incidentReports ?? 0)
      setIncidentHistory(data.incidentHistory ?? [])
      setEquipmentFaults(data.equipmentFaults ?? 0)
      setManagedUsers(data.managedUsers ?? defaultManagedUsers)
      setApprovalRequests(data.approvalRequests ?? defaultApprovalRequests)
      setLastUpdated(data.updatedAt)
    }
    const syncStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      const data = readStoredData()
      sync(data)
    }
    const refresh = () => {
      const data = readStoredData()
      sync(data)
    }
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null
    channelRef.current = channel
    if (channel) channel.onmessage = event => sync(event.data)
    const interval = window.setInterval(refresh, 1000)
    window.addEventListener('storage', syncStorage)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('storage', syncStorage)
      channel?.close()
      channelRef.current = null
    }
  }, [])

  const value = useMemo<PortalDataContextValue>(() => ({
    activities,
    sessions,
    duty,
    incidentReports,
    incidentHistory,
    equipmentFaults,
    managedUsers,
    approvalRequests,
    lastUpdated,
    isLive: true,
    addActivity(source, type, message) {
      setActivities(current => [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, source, type, message, createdAt: new Date().toISOString() },
        ...current,
      ].slice(0, 100))
    },
    recordLogin(source, email, role) {
      const now = new Date().toISOString()
      setSessions(current => [{ id: `${email}-${role}`, source, email, role, loginAt: now, lastSeenAt: now }, ...current.filter(session => session.id !== `${email}-${role}`)].slice(0, 50))
    },
    setDuty(nextDuty) {
      setDuty(nextDuty)
    },
    recordIncident() {
      setIncidentReports(current => current + 1)
    },
    addIncidentRecord(record) {
      const createdAt = new Date().toISOString()
      setIncidentHistory(current => [{ ...record, id: `INC-${Date.now()}`, status: 'Submitted', createdAt }, ...current].slice(0, 100))
      setIncidentReports(current => current + 1)
    },
    recordEquipmentFault() {
      setEquipmentFaults(current => current + 1)
    },
    createManagedUser(user) {
      setManagedUsers(current => [...current, { ...user, id: `USR-${String(current.length + 1).padStart(3, '0')}`, lastLogin: 'Never' }])
    },
    updateManagedUser(id, changes) {
      setManagedUsers(current => current.map(user => user.id === id ? { ...user, ...changes } : user))
    },
    resolveApprovalRequest(id, status) {
      setApprovalRequests(current => current.map(request => request.id === id ? { ...request, status } : request))
    },
    clearActivities() {
      setActivities([])
    },
  }), [activities, sessions, duty, incidentReports, incidentHistory, equipmentFaults, managedUsers, approvalRequests, lastUpdated])

  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>
}

export function usePortalData() {
  const context = useContext(PortalDataContext)
  if (!context) throw new Error('usePortalData must be used inside PortalDataProvider')
  return context
}