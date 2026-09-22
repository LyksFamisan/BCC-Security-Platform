import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export type PortalActivity = {
  id: string
  source: string
  type: string
  message: string
  createdAt: string
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

export type EquipmentFaultRecord = {
  id: string
  asset: string
  details: string
  filedBy: string
  status: 'Submitted' | 'Under Review' | 'Resolved'
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

export type SharedPortalData = {
  activities: PortalActivity[]
  duty: DutyRecord
  incidentReports: number
  incidentHistory: IncidentRecord[]
  equipmentFaults: number
  equipmentFaultHistory: EquipmentFaultRecord[]
}

type PortalDataContextValue = {
  activities: PortalActivity[]
  duty: DutyRecord
  incidentReports: number
  incidentHistory: IncidentRecord[]
  equipmentFaults: number
  equipmentFaultHistory: EquipmentFaultRecord[]
  lastUpdated: string | null
  isLive: boolean
  addActivity: (source: string, type: string, message: string) => void
  setDuty: (duty: DutyRecord) => void
  recordIncident: () => void
  addIncidentRecord: (record: Omit<IncidentRecord, 'id' | 'createdAt' | 'status'>) => void
  recordEquipmentFault: () => void
  addEquipmentFaultRecord: (record: Omit<EquipmentFaultRecord, 'id' | 'createdAt' | 'status'>) => void
  clearActivities: () => void
}

const STORAGE_KEY = 'cat-security-portal-data'
const CHANNEL_NAME = 'cat-security-portal-live'
const PHOTO_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const PortalDataContext = createContext<PortalDataContextValue | null>(null)

const defaultDuty: DutyRecord = { checkedIn: false, checkInTime: '', checkOutTime: '' }

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
    if (!saved) return { activities: [], duty: defaultDuty, incidentReports: 0, incidentHistory: [], equipmentFaults: 0, equipmentFaultHistory: [], updatedAt: null }
    const parsed = JSON.parse(saved)
    const storedDuty = parsed.duty ?? defaultDuty
    const now = new Date().toISOString()
    const dutyWithTimestamps = {
      ...storedDuty,
      checkInPhotoAt: storedDuty.checkInPhoto && !storedDuty.checkInPhotoAt ? now : storedDuty.checkInPhotoAt,
      checkOutPhotoAt: storedDuty.checkOutPhoto && !storedDuty.checkOutPhotoAt ? now : storedDuty.checkOutPhotoAt,
    }
    return { activities: parsed.activities ?? [], duty: pruneDutyPhotos(dutyWithTimestamps), incidentReports: parsed.incidentReports ?? 0, incidentHistory: parsed.incidentHistory ?? [], equipmentFaults: parsed.equipmentFaults ?? 0, equipmentFaultHistory: parsed.equipmentFaultHistory ?? [], updatedAt: parsed.updatedAt ?? null }
  } catch {
    return { activities: [], duty: defaultDuty, incidentReports: 0, incidentHistory: [], equipmentFaults: 0, equipmentFaultHistory: [], updatedAt: null }
  }
}

export function PortalDataProvider({ children }: { children: ReactNode }) {
  const initialData = readStoredData()
  const [activities, setActivities] = useState<PortalActivity[]>(initialData.activities)
  const [duty, setDuty] = useState<DutyRecord>(initialData.duty)
  const [incidentReports, setIncidentReports] = useState(initialData.incidentReports)
  const [incidentHistory, setIncidentHistory] = useState<IncidentRecord[]>(initialData.incidentHistory)
  const [equipmentFaults, setEquipmentFaults] = useState(initialData.equipmentFaults)
  const [equipmentFaultHistory, setEquipmentFaultHistory] = useState<EquipmentFaultRecord[]>(initialData.equipmentFaultHistory)
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
    const data = { activities, duty, incidentReports, incidentHistory, equipmentFaults, equipmentFaultHistory, updatedAt }
    serializedRef.current = JSON.stringify(data)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    channelRef.current?.postMessage(data)
  }, [activities, duty, incidentReports, incidentHistory, equipmentFaults, equipmentFaultHistory])

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
      setDuty(pruneDutyPhotos(data.duty ?? defaultDuty))
      setIncidentReports(data.incidentReports ?? 0)
      setIncidentHistory(data.incidentHistory ?? [])
      setEquipmentFaults(data.equipmentFaults ?? 0)
      setEquipmentFaultHistory(data.equipmentFaultHistory ?? [])
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
    duty,
    incidentReports,
    incidentHistory,
    equipmentFaults,
    equipmentFaultHistory,
    lastUpdated,
    isLive: true,
    addActivity(source, type, message) {
      setActivities(current => [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, source, type, message, createdAt: new Date().toISOString() },
        ...current,
      ].slice(0, 100))
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
    addEquipmentFaultRecord(record) {
      const createdAt = new Date().toISOString()
      setEquipmentFaultHistory(current => [{ ...record, id: `EQF-${Date.now()}`, status: 'Submitted', createdAt }, ...current].slice(0, 100))
      setEquipmentFaults(current => current + 1)
    },
    clearActivities() {
      setActivities([])
    },
  }), [activities, duty, incidentReports, incidentHistory, equipmentFaults, equipmentFaultHistory, lastUpdated])

  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>
}

export function usePortalData() {
  const context = useContext(PortalDataContext)
  if (!context) throw new Error('usePortalData must be used inside PortalDataProvider')
  return context
}