import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export type PortalActivity = {
  id: string
  source: string
  type: string
  message: string
  createdAt: string
}

export type DutyRecord = {
  checkedIn: boolean
  checkInTime: string
  checkOutTime: string
}

export type SharedPortalData = {
  activities: PortalActivity[]
  duty: DutyRecord
  incidentReports: number
  equipmentFaults: number
}

type PortalDataContextValue = {
  activities: PortalActivity[]
  duty: DutyRecord
  incidentReports: number
  equipmentFaults: number
  lastUpdated: string | null
  isLive: boolean
  addActivity: (source: string, type: string, message: string) => void
  setDuty: (duty: DutyRecord) => void
  recordIncident: () => void
  recordEquipmentFault: () => void
  clearActivities: () => void
}

const STORAGE_KEY = 'cat-security-portal-data'
const CHANNEL_NAME = 'cat-security-portal-live'
const PortalDataContext = createContext<PortalDataContextValue | null>(null)

const defaultDuty: DutyRecord = { checkedIn: false, checkInTime: '', checkOutTime: '' }

function readStoredData(): SharedPortalData & { updatedAt: string | null } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { activities: [], duty: defaultDuty, incidentReports: 0, equipmentFaults: 0, updatedAt: null }
    const parsed = JSON.parse(saved)
    return { activities: parsed.activities ?? [], duty: parsed.duty ?? defaultDuty, incidentReports: parsed.incidentReports ?? 0, equipmentFaults: parsed.equipmentFaults ?? 0, updatedAt: parsed.updatedAt ?? null }
  } catch {
    return { activities: [], duty: defaultDuty, incidentReports: 0, equipmentFaults: 0, updatedAt: null }
  }
}

export function PortalDataProvider({ children }: { children: ReactNode }) {
  const initialData = readStoredData()
  const [activities, setActivities] = useState<PortalActivity[]>(initialData.activities)
  const [duty, setDuty] = useState<DutyRecord>(initialData.duty)
  const [incidentReports, setIncidentReports] = useState(initialData.incidentReports)
  const [equipmentFaults, setEquipmentFaults] = useState(initialData.equipmentFaults)
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
    const data = { activities, duty, incidentReports, equipmentFaults, updatedAt }
    serializedRef.current = JSON.stringify(data)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    channelRef.current?.postMessage(data)
  }, [activities, duty, incidentReports, equipmentFaults])

  useEffect(() => {
    const sync = (data: Partial<SharedPortalData> & { updatedAt: string | null }) => {
      const nextActivities = data.activities ?? []
      const serialized = JSON.stringify(data)
      if (serialized === serializedRef.current) return
      serializedRef.current = serialized
      applyingRemoteRef.current = true
      setActivities(nextActivities)
      setDuty(data.duty ?? defaultDuty)
      setIncidentReports(data.incidentReports ?? 0)
      setEquipmentFaults(data.equipmentFaults ?? 0)
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
    equipmentFaults,
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
    recordEquipmentFault() {
      setEquipmentFaults(current => current + 1)
    },
    clearActivities() {
      setActivities([])
    },
  }), [activities, duty, incidentReports, equipmentFaults, lastUpdated])

  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>
}

export function usePortalData() {
  const context = useContext(PortalDataContext)
  if (!context) throw new Error('usePortalData must be used inside PortalDataProvider')
  return context
}