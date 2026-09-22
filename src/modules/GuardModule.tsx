import { useState, useEffect, useRef } from 'react'
import { usePortalData } from '../state/PortalDataContext'

const ACC = '#F06522'
const ASSIGNED_SITE_LOCATION = { latitude: 14.5547, longitude: 121.0244, accuracy: 0 }
const PERSONNEL_ID = 'Pfc. J. Reyes'

const L = {
  card: 'rgba(255,255,255,0.94)',
  cardBorder: 'rgba(0,0,0,0.08)',
  heading: '#111827',
  body: '#374151',
  muted: '#6b7280',
  subtle: '#9ca3af',
  divider: 'rgba(0,0,0,0.07)',
  shadow: '0 1px 4px rgba(0,0,0,0.06)',
  inset: 'rgba(0,0,0,0.04)',
}

const duties = [
  { time: '06:00', task: 'Post 1 – Main Gate', status: 'done' },
  { time: '08:00', task: 'Perimeter Walk – North', status: 'done' },
  { time: '10:00', task: 'Firearm Check & Log', status: 'done' },
  { time: '12:00', task: 'Relief – Lunch Break', status: 'active' },
  { time: '14:00', task: 'Post 1 – Main Gate', status: 'pending' },
  { time: '16:00', task: 'Perimeter Walk – South', status: 'pending' },
  { time: '18:00', task: 'End-of-Shift Report', status: 'pending' },
]

const announcements = [
  { tag: 'MEMO', text: 'Updated firearms vault access protocol effective Oct 15.', color: '#d97706' },
  { tag: 'SCHED', text: 'Shift rotation for Manila Port – check new deployment chart.', color: ACC },
  { tag: 'ALERT', text: 'Mandatory re-certification for guards assigned to BGC Tower.', color: '#dc2626' },
]

function ClockWidget() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const time = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const date = now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <div className="personnel-clock" style={{ textAlign: 'center', minWidth: 320 }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 38, color: ACC, letterSpacing: '0.04em', lineHeight: 1, whiteSpace: 'nowrap' }}>{time}</div>
      <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.muted, marginTop: 6 }}>{date}</div>
    </div>
  )
}

function AttendancePhotoGallery({
  checkInPhoto,
  checkOutPhoto,
  checkInTime,
  checkOutTime,
  checkInLocation,
  checkOutLocation,
}: {
  checkInPhoto?: string
  checkOutPhoto?: string
  checkInTime: string
  checkOutTime: string
  checkInLocation?: { latitude: number; longitude: number; accuracy: number; source: 'live' | 'assigned-site' }
  checkOutLocation?: { latitude: number; longitude: number; accuracy: number; source: 'live' | 'assigned-site' }
}) {
  const [viewingPhoto, setViewingPhoto] = useState<{ label: string; photo: string } | null>(null)
  const photos = [
    { label: 'Check In Photo', photo: checkInPhoto, time: checkInTime, mode: 'check-in', savedLocation: checkInLocation },
    { label: 'Check Out Photo', photo: checkOutPhoto, time: checkOutTime, mode: 'check-out', savedLocation: checkOutLocation },
  ].filter(item => item.photo)

  return (
    <>
    <section className="personnel-attendance-gallery" style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '16px 18px', boxShadow: L.shadow }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 15, color: L.heading }}>Attendance Photos</div>
          <div style={{ fontFamily: 'Inter', fontSize: 11, color: L.muted }}>Check In and Check Out evidence with recorded location · retained for 7 days</div>
        </div>
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#7C3AED' }}>{photos.length} RECORD{photos.length === 1 ? '' : 'S'}</span>
      </div>
      {photos.length === 0 ? (
        <div style={{ border: `1px dashed ${L.cardBorder}`, borderRadius: 8, padding: '24px 16px', textAlign: 'center', fontFamily: 'Inter', fontSize: 13, color: L.muted }}>No attendance photos recorded yet.</div>
      ) : <div className="personnel-attendance-photos" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {photos.map(item => (
          <div key={item.mode} style={{ width: 180, background: L.inset, border: `1px solid ${L.cardBorder}`, borderRadius: 8, padding: 7 }}>
            <img src={item.photo} alt={item.label} style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 5 }} />
            <div style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, color: L.heading, marginTop: 6 }}>{item.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: L.muted, marginTop: 2 }}>{item.time || 'Recorded'}</div>
            {item.savedLocation && <div style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: '#7C3AED', lineHeight: 1.45, marginTop: 5 }}>LAT {item.savedLocation.latitude.toFixed(4)}<br />LON {item.savedLocation.longitude.toFixed(4)}<br />{item.savedLocation.source === 'live' ? 'LIVE GPS' : 'ASSIGNED SITE'}</div>}
            <div className="flex gap-1" style={{ marginTop: 6 }}>
              <button type="button" onClick={() => setViewingPhoto({ label: item.label, photo: item.photo })} style={{ flex: 1, border: `1px solid ${L.cardBorder}`, background: 'transparent', color: L.body, borderRadius: 5, padding: '4px 3px', fontFamily: 'Inter', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>View</button>
              <a href={item.photo} download={`security-personnel-${item.mode}.jpg`} aria-label={`Download ${item.label}`} style={{ flex: 1, textAlign: 'center', borderRadius: 5, padding: '4px 3px', background: '#8B5CF6', color: '#fff', fontFamily: 'Inter', fontSize: 10, fontWeight: 600, textDecoration: 'none' }}>Download</a>
            </div>
          </div>
        ))}
      </div>}
    </section>
    {viewingPhoto && <div role="dialog" aria-modal="true" aria-label={viewingPhoto.label} onClick={() => setViewingPhoto(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(2,6,23,0.84)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={event => event.stopPropagation()} style={{ width: 'min(100%, 560px)', background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}><strong style={{ fontFamily: 'Inter', fontSize: 14, color: '#111827' }}>{viewingPhoto.label}</strong><button type="button" onClick={() => setViewingPhoto(null)} aria-label="Close photo" style={{ border: 0, background: 'transparent', color: '#6b7280', fontSize: 22, cursor: 'pointer' }}>×</button></div>
        <img src={viewingPhoto.photo} alt={viewingPhoto.label} style={{ display: 'block', width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8, background: '#0f172a' }} />
        <a href={viewingPhoto.photo} download={`security-personnel-${viewingPhoto.label.toLowerCase().replaceAll(' ', '-')}.jpg`} style={{ display: 'block', marginTop: 10, textAlign: 'center', borderRadius: 7, padding: '10px 12px', background: '#8B5CF6', color: '#fff', fontFamily: 'Inter', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Download Photo</a>
      </div>
    </div>}
    </>
  )
}

export default function GuardModule() {
  const { addActivity, duty, setDuty, addIncidentRecord, recordEquipmentFault, incidentHistory, activities, incidentReports, equipmentFaults, isLive, lastUpdated } = usePortalData()
  const personnelIncidentHistory = incidentHistory.filter(record => record.filedBy === PERSONNEL_ID)
  const { checkedIn, checkInTime, checkOutTime, checkInPhoto, checkOutPhoto, checkInLocation, checkOutLocation, checkInPhotoAt, checkOutPhotoAt } = duty
  const [cameraMode, setCameraMode] = useState<'check-in' | 'check-out' | null>(null)
  const [cameraError, setCameraError] = useState('')
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null)
  const [locationError, setLocationError] = useState('')
  const [locationStatus, setLocationStatus] = useState<'waiting' | 'active' | 'site'>('waiting')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'incident' | 'photos' | 'history' | 'equipment'>('dashboard')
  const [incidentForm, setIncidentForm] = useState({ type: '', location: '', description: '', severity: 'LOW' })
  const [incidentEvidence, setIncidentEvidence] = useState('')
  const [equipmentAcknowledged, setEquipmentAcknowledged] = useState<string[]>([])
  const [equipmentReportOpen, setEquipmentReportOpen] = useState(false)
  const [equipmentReportAsset, setEquipmentReportAsset] = useState('')
  const [equipmentReportDetails, setEquipmentReportDetails] = useState('')
  const [equipmentReportSubmitted, setEquipmentReportSubmitted] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  useEffect(() => () => stopCamera(), [])

  useEffect(() => {
    if (!cameraMode) return
    if (!navigator.geolocation) {
      setLocation(ASSIGNED_SITE_LOCATION)
      setLocationStatus('site')
      setLocationError('Live GPS is unavailable; showing assigned site location.')
      return
    }

    setLocationStatus('waiting')
    setLocationError('')
    const watchId = navigator.geolocation.watchPosition(
      position => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy })
        setLocationStatus('active')
        setLocationError('')
      },
      error => {
        setLocation(ASSIGNED_SITE_LOCATION)
        setLocationStatus('site')
        setLocationError(error.code === error.PERMISSION_DENIED ? 'Live GPS permission was not granted; showing assigned site location.' : 'Live GPS is unavailable; showing assigned site location.')
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [cameraMode])

  const openFaceCheck = async (mode: 'check-in' | 'check-out') => {
    setCameraMode(mode)
    setCameraError('')
    setCapturedPhoto(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setCameraError('Camera permission was not granted. Allow camera access to continue face check-in.')
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const context = canvas.getContext('2d')
    if (!context) return null
    context.translate(canvas.width, 0)
    context.scale(-1, 1)
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const photo = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedPhoto(photo)
    return photo
  }

  const completeFaceCheck = () => {
    const photo = capturedPhoto ?? capturePhoto()
    if (cameraMode === 'check-in') {
      setDuty({ checkedIn: true, checkInTime: new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false }), checkOutTime: '', checkInPhoto: photo ?? undefined, checkOutPhoto, checkInPhotoAt: photo ? new Date().toISOString() : undefined, checkOutPhotoAt, checkInLocation: location ? { ...location, source: locationStatus === 'active' ? 'live' : 'assigned-site' } : undefined, checkOutLocation })
      addActivity('Security Personnel', 'ATTENDANCE', 'Face Check In completed at BGC Financial Tower')
    } else {
      setDuty({ checkedIn: false, checkInTime, checkOutTime: new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false }), checkInPhoto, checkOutPhoto: photo ?? undefined, checkInPhotoAt, checkOutPhotoAt: photo ? new Date().toISOString() : undefined, checkInLocation, checkOutLocation: location ? { ...location, source: locationStatus === 'active' ? 'live' : 'assigned-site' } : undefined })
      addActivity('Security Personnel', 'ATTENDANCE', 'Face Check Out completed at BGC Financial Tower')
    }
    stopCamera()
    setCameraMode(null)
    setCameraError('')
  }

  const cancelFaceCheck = () => {
    stopCamera()
    setCameraMode(null)
    setCameraError('')
    setLocationError('')
    setLocationStatus('waiting')
  }

  const handleCheckIn = () => {
    openFaceCheck('check-in')
  }

  const handleCheckOut = () => {
    openFaceCheck('check-out')
  }

  const handleSubmitIncident = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    addIncidentRecord({ filedBy: PERSONNEL_ID, type: incidentForm.type || 'General incident', location: incidentForm.location || 'Assigned post', severity: incidentForm.severity, description: incidentForm.description, evidence: incidentEvidence || undefined })
    addActivity('Security Personnel', 'INCIDENT', `Incident reported: ${incidentForm.type || 'General incident'} at ${incidentForm.location || 'assigned post'}`)
    setTimeout(() => { setSubmitted(false); setIncidentForm({ type: '', location: '', description: '', severity: 'LOW' }); setIncidentEvidence('') }, 3000)
  }

  const tabs = [
    { id: 'dashboard' as const, label: 'My Duty' },
    { id: 'incident' as const, label: 'File Incident' },
    { id: 'photos' as const, label: `Attendance Photos${checkInPhoto || checkOutPhoto ? ' · 1+' : ''}` },
    { id: 'history' as const, label: `My Incident History${personnelIncidentHistory.length ? ` · ${personnelIncidentHistory.length}` : ''}` },
    { id: 'equipment' as const, label: 'My Equipment' },
  ]

  const inputStyle = {
    width: '100%',
    background: 'rgba(248,249,252,0.9)',
    border: `1px solid ${L.cardBorder}`,
    borderRadius: 8,
    padding: '10px 14px',
    fontFamily: 'Inter',
    fontSize: 13,
    color: L.heading,
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  return (
    <div className="personnel-app-shell p-5 flex flex-col gap-5" style={{ background: 'transparent', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 20, color: L.heading, margin: 0 }}>Guard Dashboard</h2>
          <p style={{ fontFamily: 'Inter', fontSize: 13, color: L.muted, margin: '4px 0 0' }}>Pfc. J. Reyes · Post 1 – BGC Financial Tower</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: checkedIn ? 'rgba(22,163,74,0.08)' : 'rgba(240,101,34,0.08)', border: `1px solid ${checkedIn ? '#16a34a' : ACC}`, borderRadius: 8, padding: '6px 14px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: checkedIn ? '#16a34a' : ACC }} />
          <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: checkedIn ? '#16a34a' : ACC }}>
            {checkedIn ? `On Duty · ${checkInTime}` : 'OFF DUTY'}
          </span>
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {[
          { label: 'ASSIGNMENT ORDER (AO)', value: 'AO-2026-0915', detail: 'Day Shift · 06:00–18:00' },
          { label: 'DUTY DETAIL ORDER (DDO)', value: 'DDO-BGC-001', detail: 'Post 1 · Main Gate' },
          { label: 'ASSIGNED SITE / DETACHMENT', value: 'BGC Financial Tower', detail: 'NCR-01 Detachment' },
          { label: 'DEPLOYMENT STATUS', value: checkedIn ? 'ON DUTY' : 'OFF DUTY', detail: 'Mobile monitoring enabled' },
        ].map(item => <div key={item.label} style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 9, padding: '11px 13px', boxShadow: L.shadow }}><div style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 700, color: L.muted, letterSpacing: '0.05em' }}>{item.label}</div><div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: item.label === 'DEPLOYMENT STATUS' && checkedIn ? '#16a34a' : L.heading, marginTop: 5 }}>{item.value}</div><div style={{ fontFamily: 'Inter', fontSize: 10, color: L.subtle, marginTop: 3 }}>{item.detail}</div></div>)}
      </div>

      {cameraMode && (
        <div style={{ background: L.card, border: `1px solid ${ACC}`, borderRadius: 12, padding: 22, boxShadow: '0 12px 30px rgba(240,101,34,0.18)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 16, color: L.heading }}>Face Check {cameraMode === 'check-in' ? 'In' : 'Out'}</div>
              <div style={{ fontFamily: 'Inter', fontSize: 13, color: L.muted, marginTop: 4 }}>Center your face in the camera frame to verify attendance.</div>
            </div>
            <button type="button" onClick={cancelFaceCheck} style={{ border: 'none', background: 'transparent', color: L.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }} aria-label="Close camera">×</button>
          </div>
          <div style={{ position: 'relative', width: '100%', maxWidth: 420, aspectRatio: '16 / 10', margin: '0 auto 16px', background: '#071827', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(25,118,185,0.35)' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            {!streamRef.current && !cameraError && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dfe7ff', fontFamily: 'Inter', fontSize: 13 }}>Starting camera...</div>}
            <div style={{ position: 'absolute', inset: '16% 25%', border: '2px solid rgba(125,211,252,0.85)', borderRadius: '50%', pointerEvents: 'none' }} />
          </div>
          <div style={{ maxWidth: 420, margin: '0 auto 16px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, padding: '10px 12px', fontFamily: 'JetBrains Mono', fontSize: 11 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
              <span style={{ color: L.heading, fontFamily: 'Inter', fontWeight: 700 }}>Realtime Location</span>
              <span style={{ color: locationStatus === 'active' ? '#16a34a' : locationStatus === 'site' ? '#8B5CF6' : '#d97706', fontWeight: 700 }}>{locationStatus === 'active' ? 'LIVE GPS' : locationStatus === 'site' ? 'ASSIGNED SITE' : 'LOCATING...'}</span>
            </div>
            {location ? <div style={{ color: L.muted }}>LAT {location.latitude.toFixed(6)} · LON {location.longitude.toFixed(6)} · {locationStatus === 'active' ? `±${Math.round(location.accuracy)}m` : 'BGC Financial Tower'}</div> : <div style={{ color: L.muted }}>{locationError || 'Waiting for GPS coordinates...'}</div>}
            {locationError && locationStatus === 'site' && <div style={{ color: '#8B5CF6', marginTop: 4 }}>{locationError}</div>}
          </div>
          {capturedPhoto && (
            <div style={{ maxWidth: 420, margin: '0 auto 16px', border: `1px solid ${ACC}`, borderRadius: 10, padding: 10, background: '#fff' }}>
              <div style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 700, color: L.heading, marginBottom: 8 }}>Captured Attendance Photo</div>
              <img src={capturedPhoto} alt="Captured attendance" style={{ display: 'block', width: '100%', borderRadius: 7, aspectRatio: '16 / 10', objectFit: 'cover' }} />
              <div className="flex justify-end gap-2" style={{ marginTop: 9 }}>
                <button type="button" onClick={() => window.open(capturedPhoto, '_blank', 'noopener,noreferrer')} style={{ border: `1px solid ${L.cardBorder}`, background: 'transparent', color: L.body, borderRadius: 6, padding: '6px 11px', fontFamily: 'Inter', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View</button>
                <a href={capturedPhoto} download={`security-personnel-${cameraMode}-${Date.now()}.jpg`} style={{ borderRadius: 6, padding: '6px 11px', background: '#8B5CF6', color: '#fff', fontFamily: 'Inter', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Download</a>
              </div>
            </div>
          )}
          {cameraError && <div style={{ color: '#dc2626', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 7, padding: '9px 12px', fontFamily: 'Inter', fontSize: 13, marginBottom: 14 }}>{cameraError}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelFaceCheck} style={{ border: `1px solid ${L.cardBorder}`, background: 'transparent', color: L.body, borderRadius: 7, padding: '9px 16px', fontFamily: 'Inter', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="button" onClick={capturePhoto} disabled={Boolean(cameraError)} style={{ border: '1px solid #8B5CF6', background: 'rgba(139,92,246,0.08)', color: '#7C3AED', borderRadius: 7, padding: '9px 16px', fontFamily: 'Inter', fontWeight: 700, fontSize: 13, cursor: cameraError ? 'not-allowed' : 'pointer' }}>Capture Photo</button>
            <button type="button" onClick={completeFaceCheck} disabled={Boolean(cameraError)} style={{ border: 'none', background: cameraError ? '#9ca3af' : ACC, color: '#fff', borderRadius: 7, padding: '9px 18px', fontFamily: 'Inter', fontWeight: 700, fontSize: 13, cursor: cameraError ? 'not-allowed' : 'pointer' }}>Confirm Face Check</button>
          </div>
        </div>
      )}

      {/* Clock + Check-in */}
      <div className="personnel-duty-card" style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '24px 28px', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 18, boxShadow: L.shadow }}>
        <ClockWidget />
        <div className="personnel-duty-controls" style={{ display: 'flex', width: '100%', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {!checkedIn ? (
            <button
              onClick={handleCheckIn}
              style={{ background: ACC, border: 'none', borderRadius: 9, padding: '12px 28px', fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(240,101,34,0.3)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Check In – Start Duty
            </button>
          ) : (
            <button
              onClick={handleCheckOut}
              style={{ background: 'transparent', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 9, padding: '12px 28px', fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: '#dc2626', cursor: 'pointer' }}
            >
              Check Out – End Duty
            </button>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ textAlign: 'center', background: L.inset, borderRadius: 8, padding: '8px 16px', minWidth: 104 }}>
              <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 11, color: '#16a34a', letterSpacing: '0.04em' }}>CHECK IN</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: L.heading, marginTop: 4 }}>{checkInTime || 'Not recorded'}</div>
            </div>
            <div style={{ textAlign: 'center', background: L.inset, borderRadius: 8, padding: '8px 16px', minWidth: 104 }}>
              <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 11, color: '#dc2626', letterSpacing: '0.04em' }}>CHECK OUT</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: L.heading, marginTop: 4 }}>{checkOutTime || 'Not recorded'}</div>
            </div>
            <div style={{ textAlign: 'center', background: L.inset, borderRadius: 8, padding: '8px 16px' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 18, color: ACC }}>8h</div>
              <div style={{ fontFamily: 'Inter', fontSize: 10, color: L.muted }}>Shift</div>
            </div>
            <div style={{ textAlign: 'center', background: L.inset, borderRadius: 8, padding: '8px 16px' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 18, color: '#16a34a' }}>97%</div>
              <div style={{ fontFamily: 'Inter', fontSize: 10, color: L.muted }}>Attendance</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="personnel-tabs flex gap-2">
        {tabs.map(t => (
          <button
            key={t.id}
            className="personnel-tab"
            onClick={() => setActiveTab(t.id)}
            style={{
              fontFamily: 'Inter', fontSize: 13, fontWeight: 600, padding: '8px 20px', borderRadius: 8, border: 'none',
              background: activeTab === t.id ? ACC : 'rgba(255,255,255,0.8)',
              color: activeTab === t.id ? '#fff' : L.muted,
              cursor: 'pointer', transition: 'all 0.15s',
              boxShadow: activeTab === t.id ? '0 4px 14px rgba(240,101,34,0.3)' : L.shadow,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'photos' && <AttendancePhotoGallery checkInPhoto={checkInPhoto} checkOutPhoto={checkOutPhoto} checkInTime={checkInTime} checkOutTime={checkOutTime} checkInLocation={checkInLocation} checkOutLocation={checkOutLocation} />}

      {activeTab === 'history' && (
        <section style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '18px', boxShadow: L.shadow }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 15, color: L.heading }}>Incident Report History</div>
              <div style={{ fontFamily: 'Inter', fontSize: 11, color: L.muted }}>Reports filed by {PERSONNEL_ID} and current review status</div>
            </div>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#dc2626' }}>{personnelIncidentHistory.length} REPORT{personnelIncidentHistory.length === 1 ? '' : 'S'}</span>
          </div>
          {personnelIncidentHistory.length === 0 ? <div style={{ border: `1px dashed ${L.cardBorder}`, borderRadius: 8, padding: '24px 16px', textAlign: 'center', fontFamily: 'Inter', fontSize: 13, color: L.muted }}>No incident reports filed by you yet.</div> : (
            <div className="flex flex-col gap-2">
              {personnelIncidentHistory.map(record => (
                <article key={record.id} style={{ border: `1px solid ${L.cardBorder}`, borderRadius: 8, padding: '12px 14px', background: L.inset }}>
                  <div className="flex items-center justify-between gap-3">
                    <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 13, color: L.heading }}>{record.type} · {record.location}</div>
                    <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, color: record.severity === 'CRITICAL' ? '#dc2626' : '#d97706' }}>{record.severity}</span>
                  </div>
                  <div style={{ fontFamily: 'Inter', fontSize: 12, color: L.body, marginTop: 6 }}>{record.description}</div>
                  {record.evidence && <div style={{ fontFamily: 'Inter', fontSize: 11, color: '#7C3AED', marginTop: 5 }}>Evidence: {record.evidence}</div>}
                  <div className="flex items-center justify-between" style={{ marginTop: 8, fontFamily: 'JetBrains Mono', fontSize: 10, color: L.muted }}><span>{new Date(record.createdAt).toLocaleString('en-PH')}</span><span style={{ color: '#1976b9', fontWeight: 700 }}>{record.status}</span></div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'dashboard' && (
        <div className="personnel-dashboard-grid grid gap-5" style={{ gridTemplateColumns: '1fr 320px' }}>

          {/* Duty Timeline */}
          <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: L.shadow }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${L.divider}`, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(248,249,252,0.97)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={ACC} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: L.heading }}>Today's Duty Schedule</span>
            </div>
            <div className="flex flex-col">
              {duties.map((d, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3" style={{ borderBottom: i < duties.length - 1 ? `1px solid ${L.divider}` : 'none' }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: L.subtle, width: 48, flexShrink: 0 }}>{d.time}</span>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: d.status === 'done' ? '#16a34a' : d.status === 'active' ? ACC : '#e5e7eb',
                    boxShadow: d.status === 'active' ? `0 0 8px ${ACC}` : 'none',
                  }} />
                  <span style={{ fontFamily: 'Inter', fontSize: 13, color: d.status === 'pending' ? L.subtle : L.heading, fontWeight: d.status === 'active' ? 600 : 400 }}>{d.task}</span>
                  {d.status === 'done' && <span style={{ marginLeft: 'auto', fontFamily: 'Inter', fontSize: 11, color: '#16a34a', fontWeight: 600 }}>DONE</span>}
                  {d.status === 'active' && <span style={{ marginLeft: 'auto', fontFamily: 'Inter', fontSize: 11, color: ACC, fontWeight: 600 }}>ACTIVE</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Announcements + GPS */}
          <div className="flex flex-col gap-4">
            <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, overflow: 'hidden', boxShadow: L.shadow }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${L.divider}`, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(248,249,252,0.97)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACC} strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: L.heading }}>Announcements</span>
              </div>
              <div className="flex flex-col">
                {announcements.map((a, i) => (
                  <div key={i} style={{ padding: '12px 18px', borderBottom: i < announcements.length - 1 ? `1px solid ${L.divider}` : 'none' }}>
                    <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, color: a.color, letterSpacing: '0.08em', marginRight: 8 }}>{a.tag}</span>
                    <span style={{ fontFamily: 'Inter', fontSize: 12, color: L.body, lineHeight: 1.5 }}>{a.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* GPS Status */}
            <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '18px', boxShadow: L.shadow }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACC} strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: L.heading }}>GPS Status</span>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', marginLeft: 'auto' }} />
                <span style={{ fontFamily: 'Inter', fontSize: 11, color: '#16a34a', fontWeight: 600 }}>ACTIVE</span>
              </div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: L.muted, lineHeight: 1.8 }}>
                <div>LAT: <span style={{ color: ACC }}>14.5547° N</span></div>
                <div>LON: <span style={{ color: ACC }}>121.0244° E</span></div>
                <div>SITE: <span style={{ color: L.heading }}>BGC Financial Tower</span></div>
                <div>LAST PING: <span style={{ color: '#16a34a' }}>12s ago</span></div>
              </div>
            </div>

            <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '18px', boxShadow: L.shadow }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: L.heading }}>Connected Command Data</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: isLive ? '#16a34a' : '#dc2626' }}>{isLive ? 'LIVE' : 'OFFLINE'}</span>
              </div>
              <div className="flex flex-col gap-2" style={{ fontFamily: 'Inter', fontSize: 11, color: L.muted }}>
                <div className="flex items-center justify-between"><span>Incident reports</span><strong style={{ color: '#dc2626' }}>{incidentReports}</strong></div>
                <div className="flex items-center justify-between"><span>Equipment issues</span><strong style={{ color: '#d97706' }}>{equipmentFaults}</strong></div>
                <div style={{ borderTop: `1px solid ${L.divider}`, paddingTop: 7, fontSize: 10 }}>{activities[0] ? `${activities[0].source}: ${activities[0].message}` : 'No shared activity yet.'}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: L.subtle }}>{lastUpdated ? `SYNC ${new Date(lastUpdated).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}` : 'SYNC WAITING'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'incident' && (
        <div style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '28px', maxWidth: 640, boxShadow: L.shadow }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: L.heading }}>File Incident Report</span>
          </div>
          {submitted ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 16, color: '#16a34a', marginBottom: 8 }}>✓ Report Submitted</div>
              <div style={{ fontFamily: 'Inter', fontSize: 13, color: L.muted }}>Your incident report has been filed and routed to the duty officer.</div>
            </div>
          ) : (
            <form onSubmit={handleSubmitIncident} className="flex flex-col gap-4">
              <div>
                <label style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: L.muted, display: 'block', marginBottom: 6 }}>Incident Type</label>
                <select value={incidentForm.type} onChange={e => setIncidentForm(p => ({ ...p, type: e.target.value }))} style={{ ...inputStyle, appearance: 'none' }} required>
                  <option value="">Select type...</option>
                  <option>Unauthorized Entry</option>
                  <option>Suspicious Person</option>
                  <option>Theft / Pilferage</option>
                  <option>Altercation / Fight</option>
                  <option>Medical Emergency</option>
                  <option>Fire / Hazard</option>
                  <option>Equipment Malfunction</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: L.muted, display: 'block', marginBottom: 6 }}>Photo / Evidence</label>
                <input type="file" accept="image/*,.pdf" onChange={event => setIncidentEvidence(event.target.files?.[0]?.name ?? '')} style={{ ...inputStyle, padding: '8px 10px' }} />
                {incidentEvidence && <div style={{ fontFamily: 'Inter', fontSize: 11, color: '#7C3AED', marginTop: 5 }}>Attached: {incidentEvidence}</div>}
              </div>
              <div>
                <label style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: L.muted, display: 'block', marginBottom: 6 }}>Location / Post</label>
                <input value={incidentForm.location} onChange={e => setIncidentForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Main Gate, Post 2, Vault B..." style={inputStyle} required />
              </div>
              <div>
                <label style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: L.muted, display: 'block', marginBottom: 6 }}>Severity</label>
                <div className="flex gap-2">
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => {
                    const col = s === 'CRITICAL' ? '#dc2626' : s === 'HIGH' ? '#d97706' : s === 'MEDIUM' ? ACC : '#16a34a'
                    const active = incidentForm.severity === s
                    return (
                      <button key={s} type="button" onClick={() => setIncidentForm(p => ({ ...p, severity: s }))}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 7,
                          border: `1px solid ${active ? col : L.cardBorder}`,
                          background: active ? `${col}15` : 'transparent',
                          fontFamily: 'Inter', fontSize: 11, fontWeight: 700,
                          color: active ? col : L.subtle,
                          cursor: 'pointer', letterSpacing: '0.06em',
                        }}
                      >{s}</button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: L.muted, display: 'block', marginBottom: 6 }}>Description</label>
                <textarea value={incidentForm.description} onChange={e => setIncidentForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe what happened, who was involved, and any actions taken..." rows={4}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} required />
              </div>
              <button type="submit" style={{ background: '#dc2626', border: 'none', borderRadius: 9, padding: '12px', fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(220,38,38,0.3)' }}>
                Submit Incident Report
              </button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'equipment' && (
        <section style={{ background: L.card, border: `1px solid ${L.cardBorder}`, borderRadius: 12, padding: '18px', boxShadow: L.shadow }}>
          <div style={{ marginBottom: 12 }}><div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 15, color: L.heading }}>Assigned Equipment</div><div style={{ fontFamily: 'Inter', fontSize: 11, color: L.muted }}>Equipment assigned to {PERSONNEL_ID}</div></div>
          {[
            { id: 'RD-0114', name: 'Motorola DP4400e Radio', status: 'Serviceable', color: '#16a34a' },
            { id: 'FN-0021', name: 'Beretta M9 Firearm', status: 'Serviceable', color: '#16a34a' },
          ].map(asset => {
            const acknowledged = equipmentAcknowledged.includes(asset.id)
            return <div key={asset.id} className="flex items-center justify-between gap-3" style={{ border: `1px solid ${L.cardBorder}`, borderRadius: 8, padding: '12px 14px', marginTop: 8, background: L.inset }}><div><div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: ACC }}>{asset.id}</div><div style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: L.heading }}>{asset.name}</div><div style={{ fontFamily: 'Inter', fontSize: 11, color: asset.color }}>{asset.status}</div></div><button type="button" disabled={acknowledged} onClick={() => { setEquipmentAcknowledged(current => [...current, asset.id]); addActivity('Security Personnel', 'EQUIPMENT_ACK', `Acknowledged assignment ${asset.id}`) }} style={{ border: `1px solid ${acknowledged ? L.cardBorder : '#1976b9'}`, background: acknowledged ? 'transparent' : '#1976b9', color: acknowledged ? L.muted : '#fff', borderRadius: 6, padding: '7px 10px', fontFamily: 'Inter', fontSize: 11, fontWeight: 600, cursor: acknowledged ? 'default' : 'pointer' }}>{acknowledged ? 'Acknowledged' : 'Acknowledge Receipt'}</button></div>
          })}
          {equipmentReportSubmitted ? <div style={{ marginTop: 12, border: '1px solid rgba(22,163,74,0.25)', background: 'rgba(22,163,74,0.06)', color: '#16a34a', borderRadius: 7, padding: '10px', fontFamily: 'Inter', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>Equipment issue submitted and shared with Operations and Administrator.</div> : equipmentReportOpen ? (
            <form className="flex flex-col gap-2" onSubmit={event => { event.preventDefault(); recordEquipmentFault(); addActivity('Security Personnel', 'EQUIPMENT_FAULT', `${equipmentReportAsset}: ${equipmentReportDetails}`); setEquipmentReportSubmitted(true); setEquipmentReportOpen(false); setEquipmentReportAsset(''); setEquipmentReportDetails('') }} style={{ marginTop: 12, padding: 12, border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, background: 'rgba(220,38,38,0.04)' }}>
              <select value={equipmentReportAsset} onChange={event => setEquipmentReportAsset(event.target.value)} required style={{ ...inputStyle, padding: '8px 10px' }}><option value="">Select assigned equipment...</option><option>RD-0114 · Motorola DP4400e Radio</option><option>FN-0021 · Beretta M9 Firearm</option></select>
              <input value={equipmentReportDetails} onChange={event => setEquipmentReportDetails(event.target.value)} required placeholder="Describe damage or defect..." style={{ ...inputStyle, padding: '8px 10px' }} />
              <div className="flex gap-2"><button type="button" onClick={() => setEquipmentReportOpen(false)} style={{ flex: 1, border: `1px solid ${L.cardBorder}`, background: 'transparent', color: L.body, borderRadius: 6, padding: 8, fontFamily: 'Inter', fontSize: 11, cursor: 'pointer' }}>Cancel</button><button type="submit" style={{ flex: 1, border: 'none', background: '#dc2626', color: '#fff', borderRadius: 6, padding: 8, fontFamily: 'Inter', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Submit Report</button></div>
            </form>
          ) : <button type="button" onClick={() => setEquipmentReportOpen(true)} style={{ width: '100%', marginTop: 12, border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)', color: '#dc2626', borderRadius: 7, padding: '9px', fontFamily: 'Inter', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Report Damaged / Defective Equipment</button>}
        </section>
      )}
    </div>
  )
}
