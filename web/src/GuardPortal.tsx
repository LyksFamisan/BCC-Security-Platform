import { useCallback, useEffect, useState, type FormEvent } from "react"
import "./guard.css"
import AttendanceCamera from "./AttendanceCamera"

const API = import.meta.env.VITE_API_URL || "/api"
type Identity = { id: string; name: string; role: string }
type RecordRow = { id: string; data: Record<string, any>; site_id: string; subject_id?: string }
type Incident = { id: string; title: string; description: string; location: string; status: string; site_name?: string }
type Site = { id: string; name: string }
type Tab = "duty" | "reports" | "new" | "profile"

export default function GuardPortal() {
  const [session, setSession] = useState<{ token: string; user: Identity } | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [gpsStatus, setGpsStatus] = useState("GPS not checked")
  const [cameraShift,setCameraShift]=useState<{id:string;title:string}|null>(null)
  const [attendancePhoto,setAttendancePhoto]=useState<{shiftId:string;file:File}|null>(null)
  const [attendancePreview,setAttendancePreview]=useState<string|null>(null)
  useEffect(()=>{if(!attendancePhoto){setAttendancePreview(null);return}const url=URL.createObjectURL(attendancePhoto.file);setAttendancePreview(url);return()=>URL.revokeObjectURL(url)},[attendancePhoto])
  const [photoView,setPhotoView]=useState<string|null>(null)
  useEffect(()=>()=>{if(photoView)URL.revokeObjectURL(photoView)},[photoView])
  const [tab, setTab] = useState<Tab>("duty")
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState("")
  const [shifts, setShifts] = useState<RecordRow[]>([])
  const [attendance, setAttendance] = useState<RecordRow[]>([])
  const [reports, setReports] = useState<Incident[]>([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)

  const request = useCallback(async (path: string, options: RequestInit = {}, token = session?.token) => {
    if (!token) throw Error("Please sign in.")
    const response = await fetch(API + path, {
      ...options,
      headers: { Authorization: "Bearer " + token, ...options.headers },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 401) setSession(null)
      throw Error(data.error || "Request failed (" + response.status + ")")
    }
    return data
  }, [session?.token])

  const refresh = useCallback(async () => {
    if (!session) return
    try {
      const [identity, siteRows, shiftRows, attendanceRows, incidentRows] = await Promise.all([
        request("/auth/me"), request("/sites"), request("/operations/shifts"),
        request("/operations/attendance"), request("/incidents"),
      ])
      if (identity.role !== "guard") throw Error("Only security guard accounts can use this portal.")
      setSites(siteRows)
      setSiteId(prev => prev || siteRows[0]?.id || "")
      setShifts(shiftRows)
      setAttendance(attendanceRows)
      setReports(incidentRows)
      setError("")
    } catch (e) { setError((e as Error).message) }
  }, [request, session])
  useEffect(() => { if (session) void refresh() }, [session, refresh])
  useEffect(() => {
    if (!session) return
    const timer = window.setInterval(() => { void refresh() }, 15000)
    return () => window.clearInterval(timer)
  }, [session, refresh])

  async function login(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("")
    try {
      const res = await fetch(API + "/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, app_role: "guard" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw Error(data.error || "Unable to sign in")
      if (data.user.role !== "guard") throw Error("Only security guards can sign in here.")
      setPassword(""); setSession(data)
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function logout() {
    if (session) await request("/auth/logout", { method: "POST" }).catch(() => {})
    setSession(null); setCameraShift(null); setAttendancePhoto(null); setPhotoView(null); setReports([]); setAttendance([]); setShifts([]); setError(""); setNotice("")
  }
  function getPosition(): Promise<GeolocationCoordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(Error("GPS is unavailable on this device."))
      setGpsStatus("Getting precise GPS…")
      navigator.geolocation.getCurrentPosition(p => {
        if (!Number.isFinite(p.coords.latitude) || !Number.isFinite(p.coords.longitude) || !Number.isFinite(p.coords.accuracy) || p.coords.accuracy > 100) {
          setGpsStatus("GPS accuracy too low")
          return reject(Error("GPS accuracy is too low. Enable precise location, move outdoors and retry."))
        }
        setGpsStatus("GPS ready · ±" + Math.round(p.coords.accuracy) + " m")
        resolve(p.coords)
      }, e => {
        setGpsStatus("GPS unavailable")
        reject(Error(e.code === 1 ? "Allow precise location in your browser and phone Settings, then retry." : e.code === 3 ? "GPS timed out. Enable Location/GPS, move outdoors and retry." : "GPS position unavailable. Check phone Location/GPS and retry."))
      }, {
        enableHighAccuracy: true, timeout: 20000, maximumAge: 0,
      })
    })
  }
  async function markAttendance(event: "in" | "out", shiftId: string) {
    setBusy(true); setError(""); setNotice("")
    try {
      if(!attendancePhoto || attendancePhoto.shiftId !== shiftId) throw Error("Take or attach a new photo before recording attendance.")
      if(attendancePhoto.file.size > 3*1024*1024 || !["image/jpeg","image/png","image/webp"].includes(attendancePhoto.file.type)) throw Error("Attendance photo must be JPEG, PNG or WebP, under 3 MB.")
      const gps = await getPosition()
      const form=new FormData()
      for(const [key,value] of Object.entries({shift_id:shiftId,event,latitude:gps.latitude,longitude:gps.longitude,accuracy:gps.accuracy})) form.append(key,String(value))
      form.append("photo",attendancePhoto.file)
      await request("/attendance", {method:"POST",body:form})
      setAttendancePhoto(null)
      setNotice(event === "in" ? "Check-in recorded successfully." : "Check-out recorded successfully.")
      await refresh()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function updatePosition() {
    setBusy(true); setError(""); setNotice("")
    try {
      if (!siteId) throw Error("Select your assigned site first.")
      const gps = await getPosition()
      const result = await request("/location/check-in", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: siteId, location: { latitude: gps.latitude, longitude: gps.longitude, accuracy: gps.accuracy } }),
      })
      setNotice("Location recorded. Geofence: " + (result.data?.geofence_status || "Unknown"))
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function submitReport(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("")
    try {
      if (!siteId || !photo) throw Error("Please choose your site and attach an evidence photo.")
      if (photo.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type))
        throw Error("Use a JPEG, PNG or WebP photo under 5 MB.")
      const form = new FormData()
      form.append("title", title.trim()); form.append("description", description.trim())
      form.append("location", location.trim()); form.append("site_id", siteId)
      form.append("photo", photo)
      await request("/incidents", { method: "POST", body: form })
      setTitle(""); setDescription(""); setLocation(""); setPhoto(null)
      setNotice("Incident report submitted."); setTab("reports"); await refresh()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function viewAttendancePhoto(id:string) {
    try {
      const response=await fetch(API+"/attendance/"+id+"/photo",{headers:{Authorization:"Bearer "+session?.token}})
      if(!response.ok) throw Error("Unable to load attendance photo")
      setPhotoView(URL.createObjectURL(await response.blob()))
    } catch(e){setError((e as Error).message)}
  }
  const active = attendance.filter(a => a.data?.event === "in").length - attendance.filter(a => a.data?.event === "out").length
  return <div className="guard-page">
    {cameraShift && <AttendanceCamera title={cameraShift.title} onClose={()=>setCameraShift(null)} onCapture={file=>{setAttendancePhoto({shiftId:cameraShift.id,file});setCameraShift(null)}} />}
    {photoView && <div role="dialog" aria-label="Attendance photo" className="attendance-photo-dialog"><button onClick={()=>setPhotoView(null)}>Close attendance photo</button><img src={photoView} alt="Attendance evidence with server timestamp and GPS" /></div>}
    <div className="guard-shell">
      <header className="guard-head">
        <div className="guard-logos"><img src="/assets/BCC_logo.jpg" alt="BCC" /><img src="/assets/CAT_logo.jpg" alt="CAT" /></div>
        <div><strong>CAT Security Services</strong><span>Security Guard Portal</span></div>
        {session && <button className="guard-signout" onClick={() => void logout()}>Sign out</button>}
      </header>
      {!session ? <main className="guard-login">
        <div className="guard-hero"><div className="guard-shield">◆</div><p>SECURE FIELD OPERATIONS</p><h1>Welcome back, Officer.</h1><span>Access your assigned shifts, record attendance and submit field reports — connected to your operations team.</span></div>
        <form className="guard-panel" onSubmit={login}>
          <h2>Guard Sign In</h2><p>Use your assigned security personnel account.</p>
          <label>Email address<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="guard@company.com" /></label>
          <label htmlFor="guard-password">Password</label><div className="guard-password"><input id="guard-password" required type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" /><button type="button" onClick={() => setShowPassword(x => !x)}>{showPassword ? "Hide" : "Show"}</button></div>
          {error && <p role="alert" className="guard-error">{error}</p>}
          <button className="guard-primary" disabled={busy}>{busy ? "Signing in…" : "Sign In Securely"}</button>
          <a href="/">Admin / Operations Login</a>
        </form>
      </main> : <>
        <main className="guard-content">
          <div className="guard-greeting"><p>FIELD OPERATIONS</p><h1>Hello, {session.user.name.split(" ")[0]} <span>👋</span></h1><small>Keep your shift and incident updates accurate.</small></div>
          {error && <p role="alert" className="guard-error">{error}</p>}
          {notice && <p role="status" className="guard-notice">{notice}</p>}
          {tab === "duty" && <>
            <section className="guard-statgrid"><div><small>Assigned Shifts</small><strong>{shifts.length}</strong></div><div><small>Duty Status</small><strong>{active > 0 ? "On Duty" : "Off Duty"}</strong></div></section>
            <h2>My Duty Schedule</h2>
            {shifts.length === 0 ? <div className="guard-card">No shifts assigned. Contact your supervisor to set up your duty schedule.</div> : shifts.map(shift => {
              const events = attendance.filter(a => a.data.shift_id === shift.id)
              const checkedIn = events.some(a => a.data.event === "in")
              const checkedOut = events.some(a => a.data.event === "out")
              return <article className="guard-card" key={shift.id}><div className="guard-row"><strong>{shift.data.title || "Duty Shift"}</strong><span className="guard-pill">{checkedOut ? "Completed" : checkedIn ? "On Duty" : shift.data.status || "Scheduled"}</span></div><p>{shift.data.post || "Assigned post"}</p><small>{new Date(shift.data.start).toLocaleString()} – {new Date(shift.data.end).toLocaleString()}</small>{!checkedOut && shift.data.status !== "Cancelled" && <div className="attendance-capture"><button type="button" className="guard-secondary" disabled={busy} onClick={()=>setCameraShift({id:shift.id,title:checkedIn?"Time Out photo":"Time In photo"})}>{attendancePhoto?.shiftId===shift.id ? "Retake attendance photo" : "Open camera"}</button>{attendancePhoto?.shiftId===shift.id && attendancePreview && <img className="attendance-captured-thumb" src={attendancePreview} alt="Attendance photo ready to submit" />}</div>}<button className="guard-primary" disabled={busy || checkedOut || shift.data.status === "Cancelled"} onClick={() => void markAttendance(checkedIn ? "out" : "in", shift.id)}>{checkedIn ? "Time Out with GPS" : "Time In with GPS"}</button></article>
            })}
            <h2>Attendance history</h2>{attendance.map(a=><article className="guard-card" key={a.id}><strong>{a.data.event === "in" ? "Time In" : "Time Out"}</strong><p>{new Date(a.data.recorded_at).toLocaleString()}</p><p>GPS: {a.data.latitude ?? "—"}, {a.data.longitude ?? "—"} · {a.data.geofence_status || a.data.source || "Legacy record"}</p>{a.data.photo_id && <button className="guard-secondary" onClick={()=>void viewAttendancePhoto(a.id)}>View attendance photo</button>}</article>)}
            <h2>GPS Check-in</h2><p role="status">{gpsStatus}</p><section className="guard-card"><p>Share your current location with operations. GPS permission and internet connectivity are required.</p><button className="guard-secondary" disabled={busy} onClick={() => { setBusy(true); setError(""); void getPosition().catch(e => setError(e.message)).finally(() => setBusy(false)) }}>Check GPS</button><label>Assigned site<select value={siteId} onChange={e => setSiteId(e.target.value)}>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button className="guard-secondary" disabled={busy || !siteId} onClick={() => void updatePosition()}>Send Current Location</button></section>
          </>}
          {tab === "reports" && <><div className="guard-row"><h2>My Incident Reports</h2><button className="guard-secondary" onClick={() => void refresh()}>Refresh</button></div>{reports.length === 0 ? <div className="guard-card">No incident reports yet.</div> : reports.map(r => <article key={r.id} className="guard-card"><div className="guard-row"><strong>{r.title}</strong><span className="guard-pill">{r.status}</span></div><p>{r.description}</p><small>{r.site_name || r.location}</small></article>)}</>}
          {tab === "new" && <form className="guard-card guard-form" onSubmit={submitReport}><h2>New Incident Report</h2><p>Submit verified details and an evidence photo to your operations team.</p><label>Site<select required value={siteId} onChange={e => setSiteId(e.target.value)}>{sites.length === 0 && <option value="">No assigned sites</option>}{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Incident title<input required minLength={3} maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label><label>Description<textarea required minLength={5} maxLength={5000} rows={5} value={description} onChange={e => setDescription(e.target.value)} /></label><label>Location / post<input required minLength={2} maxLength={300} value={location} onChange={e => setLocation(e.target.value)} /></label><label>Evidence photo (JPEG, PNG, WebP — max 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" required onChange={e => setPhoto(e.target.files?.[0] || null)} /></label><button disabled={busy} className="guard-primary">{busy ? "Submitting…" : "Submit Incident Report"}</button></form>}
          {tab === "profile" && <section className="guard-card"><h2>My Profile</h2><p><strong>{session.user.name}</strong></p><p>Role: Security Guard</p><p>Assigned Sites: {sites.map(s => s.name).join(", ") || "None"}</p><p className="guard-muted">Your account permissions and assignments are managed by BCC Operations.</p></section>}
        </main>
        <nav className="guard-nav" aria-label="Guard navigation">{([["duty", "⌖", "Duty"], ["reports", "▤", "Reports"], ["new", "+", "New Report"], ["profile", "◯", "Profile"]] as const).map(([key, icon, label]) => <button key={key} className={tab === key ? "selected" : ""} onClick={() => { setTab(key); setError(""); setNotice("") }}><b>{icon}</b><span>{label}</span></button>)}</nav>
      </>}
    </div>
  </div>
}

