import React, { useEffect, useState, useRef } from "react"
import {
  View,
  Image,
  Modal,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Platform,
  Linking,
} from "react-native"
import * as ImagePicker from "expo-image-picker"
import {getDutyPosition, geofenceStatus, nextAttendanceEvent, type GpsPosition} from "./gps"
import {useThemedStyles,useTheme} from "./Theme"
import DateTimePicker from "@react-native-community/datetimepicker"
type Row = {
  id: string
  site_id: string
  site_name: string
  subject_id?: string
  subject_name?: string
  version: number
  data: Record<string, any>
}
type Field = {
  type?: string
  enum?: string[]
  format?: string
  default?: any
  anyOf?: Field[]
}
type Module = {
  key: string
  label: string
  writable: boolean
  requires_subject: boolean
  schema: { properties: Record<string, Field>; required?: string[] }
}
type Choice = { id: string; name: string; latitude?:number|null; longitude?:number|null; radius_m?:number|null }
const title = (k: string) =>
  k.replaceAll("_", " ").replace(/^./, (s) => s.toUpperCase())
const jsonOptions = (data: object, method = "POST") => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
})
export default function OperationsPanel({
  role,
  request,
  attendancePhotoSource,
}: {
  role: string
  attendancePhotoSource: (id:string)=>{uri:string;headers:Record<string,string>}
  request: (url: string, options?: RequestInit) => Promise<any>
}) {
  const s=useThemedStyles(baseStyles)
  const {dark}=useTheme()
  const [lastPunch,setLastPunch]=useState<Row|null>(null)
  const [photoRecord,setPhotoRecord]=useState<string|null>(null)
  const [section, setSection] = useState("shifts"),
    [catalog, setCatalog] = useState<Module[]>([]),
    [rows, setRows] = useState<Row[]>([]),
    [attendance, setAttendance] = useState<Row[]>([]),
    [notifications, setNotifications] = useState<any[]>([]),
    [sites, setSites] = useState<Choice[]>([]),
    [people, setPeople] = useState<Choice[]>([]),
    [equipment, setEquipment] = useState<Choice[]>([]),
    [incidents, setIncidents] = useState<Choice[]>([])
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [rev, setRev] = useState(0),
    [draft, setDraft] = useState<Record<string, any> | null>(null),
    [editing, setEditing] = useState<Row | null>(null),
    [site, setSite] = useState(""),
    [person, setPerson] = useState(""),
    [dateField, setDateField] = useState<string | null>(null),
    [dateMode, setDateMode] = useState<"date" | "time">("date")
  const mounted = useRef(true), running = useRef(false)
  const [gps, setGps] = useState<GpsPosition | null>(null)
  const [gpsState, setGpsState] = useState("")
  useEffect(() => { mounted.current=true; return () => { mounted.current=false } }, [])
  const module = catalog.find((m) => m.key === section)
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const [c, s, r, a, n] = await Promise.all([
          request("/operations/catalog"),
          request("/sites"),
          request("/operations/" + section),
          request("/operations/attendance"),
          request("/notifications"),
        ])
        if (!active) return
        setCatalog(c)
        setSites(s)
        setRows(r)
        setAttendance(a)
        setNotifications(n)
        if (role === "supervisor") {
          const [p, eq, i] = await Promise.all([
            request("/users"),
            request("/operations/equipment"),
            request("/incidents"),
          ])
          if (active) {
            setPeople(p.filter((u: any) => u.role !== "admin"))
            setEquipment(eq.map((e: Row) => ({ id: e.id, name: e.data.title })))
            setIncidents(i.map((r: any) => ({ id: r.id, name: r.title })))
          }
        }
        if (role === "guard") {
          const eq = await request("/operations/equipment")
          if (active)
            setEquipment(eq.map((e: Row) => ({ id: e.id, name: e.data.title })))
        }
        if (active) setError("")
      } catch (e) {
        if (active) setError((e as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    const timer = setInterval(load, 15000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [section, rev])
  async function run(fn: () => Promise<any>) {
    if(running.current) return
    running.current=true
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const result = await fn()
      if(!mounted.current) return
      setRev((v) => v + 1)
      setNotice(result?.gps_checked ? "GPS checked. Time In/Time Out will capture a fresh location." : result?.data?.event ? `Time ${result.data.event} recorded · ${new Date(result.data.recorded_at).toLocaleString()}` : result?.data?.geofence_status ? `Location shared · ${result.data.geofence_status} site boundary${result.data.distance_m != null ? ` · ${result.data.distance_m} m from centre` : ""}` : "Saved")
      setDraft(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      running.current=false
      if(mounted.current) setBusy(false)
    }
  }
  async function position() {
    setGpsState("Getting precise GPS…")
    try {
      const coords=await getDutyPosition()
      if(!mounted.current) throw Error("Attendance screen closed. Retry from the app.")
      setGps(coords)
      setGpsState(`GPS ready · ±${Math.round(coords.accuracy)} m`)
      return coords
    } catch(error) {
      if(mounted.current) setGpsState("GPS unavailable · retry")
      throw error
    }
  }
  async function punch(shift: Row, event: string) {
    await run(async () => {
      await request("/auth/me")
      if(event==="in" && (Date.now()<+new Date(shift.data.start)-30*60000 || Date.now()>+new Date(shift.data.end)))throw Error("Time In opens 30 minutes before the assigned shift until its end.")
      const initial=await position()
      const boundary=sites.find(s=>s.id===shift.site_id)
      if(!boundary) throw Error("Assigned site unavailable. Refresh and retry.")
      const fence=geofenceStatus(initial,boundary)
      if(fence.status === "Not configured") throw Error("Site geofence not configured. Ask your administrator to set the actual site location.")
      if(fence.status === "Outside") throw Error("You are outside your assigned site geofence.")
      if(fence.status === "Uncertain") throw Error("GPS cannot confirm the site boundary. Move outdoors or closer to the site centre and retry.")
      const permission=await ImagePicker.requestCameraPermissionsAsync()
      if(!permission.granted) throw Error("Camera permission is required for an attendance photo.")
      const result=await ImagePicker.launchCameraAsync({mediaTypes:["images"],cameraType:ImagePicker.CameraType.front,quality:0.7,allowsEditing:false})
      if(result.canceled) throw Error("Photo cancelled. Attendance was not recorded.")
      const image=result.assets[0]
      if((image.fileSize || 0)>3*1024*1024) throw Error("Attendance photo must be under 3 MB. Retake the photo.")
      const coords = await position()
      const form=new FormData()
      const id='xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return (c==='x'?r:(r&3)|8).toString(16)})
      for(const [key,value] of Object.entries({id,shift_id:shift.id,event,...coords}))form.append(key,String(value))
      form.append("photo",{uri:image.uri,name:image.fileName || "attendance.jpg",type:image.mimeType || "image/jpeg"} as any)
      const saved=await request("/attendance",{method:"POST",body:form})
      if(mounted.current) {
        setAttendance(current=>[saved,...current.filter(row=>row.id!==saved.id)])
        setLastPunch(saved)
      }
      return saved

    })
  }
  const timeInAvailable=(row:Row)=>Date.now()>=+new Date(row.data.start)-30*60000 && Date.now()<=+new Date(row.data.end)
  const eligibleShifts=section === "shifts" ? rows.filter(row=>row.data.status!=="Cancelled") : []
  const currentShift=eligibleShifts.find(row=>nextAttendanceEvent(attendance,row.id)==="out") || eligibleShifts.find(timeInAvailable)
  const currentEvent=currentShift ? nextAttendanceEvent(attendance,currentShift.id) : "in"
  function start(row?: Row) {
    if (!module) return
    const d: Record<string, any> = {}
    for (const [k, f] of Object.entries(module.schema.properties)) {
      const b = f.anyOf?.find((x) => x.type !== "null") || f
      d[k] =
        row?.data[k] ??
        f.default ??
        b.default ??
        (b.type === "boolean"
          ? false
          : (b.enum?.[0] ??
            (b.format === "date-time"
              ? f.anyOf?.some((x) => x.type === "null")
                ? null
                : new Date().toISOString()
              : "")))
    }
    setDraft(d)
    setEditing(row || null)
    setSite(row?.site_id || sites[0]?.id || "")
    setPerson(row?.subject_id || "")
  }
  async function save() {
    if (!module || !draft) return
    await run(async () => {
      const data = { ...draft }
      for (const [k, f] of Object.entries(module.schema.properties)) {
        const b = f.anyOf?.find((x) => x.type !== "null") || f
        if (b.type === "number" || b.type === "integer")
          data[k] = Number(data[k])
        if (f.anyOf?.some((x) => x.type === "null") && data[k] === "")
          data[k] = null
      }
      await request(
        "/operations/" + section + (editing ? "/" + editing.id : ""),
        jsonOptions(
          editing
            ? { version: editing.version, data }
            : {
                site_id: site,
                subject_id: module.requires_subject ? person : undefined,
                data,
              },
          editing ? "PATCH" : "POST",
        ),
      )
    })
  }
  const tabs =
    role === "guard"
      ? [
          ["shifts", "Attendance"],
          ["attendance", "History"],
          ["assignments", "Equipment"],
          ["training", "Training"],
          ["certifications", "Licenses"],
          ["assessments", "Assessments"],
          ["defects", "Faults"],
        ]
      : catalog.map((m) => [m.key, m.label])
  return (
    <View style={s.wrap}>
      <Modal visible={!!photoRecord} transparent onRequestClose={()=>setPhotoRecord(null)}><View style={{flex:1,backgroundColor:"#061326f5",padding:24,justifyContent:"center"}}><Pressable accessibilityRole="button" onPress={()=>setPhotoRecord(null)} style={s.button}><Text style={s.white}>Close attendance photo</Text></Pressable>{photoRecord && <Image accessibilityLabel="Attendance photo with timestamp and GPS" source={attendancePhotoSource(photoRecord)} style={{width:"100%",height:"80%"}} resizeMode="contain" onError={()=>setError("Could not load attendance photo. Check connection and retry.")} />}</View></Modal>
      <View style={s.heading}>
        <Text style={s.headingText}>
          {role === "guard" ? "My duty" : "Site operations"}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => setRev((v) => v + 1)}
          style={s.mini}
        >
          <Text style={s.link}>Refresh</Text>
        </Pressable>
      </View>
      <View style={s.tabs}>
        {tabs.map(([key, name]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: section === key }}
            style={[s.chip, key === section && s.selected]}
            onPress={() => {
              setSection(key)
              setDraft(null)
              setError("")
              setNotice("")
              setLoading(true)
            }}
          >
            <Text style={key === section ? s.selectedText : s.link}>
              {name}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={s.success}>
          {notice}
        </Text>
      ) : null}
      {loading ? <ActivityIndicator color="#2563EB" /> : null}
      {role === "guard" && section === "shifts" && <>
        <View style={{backgroundColor:"#10253d",borderRadius:22,padding:22,gap:14,borderTopWidth:3,borderTopColor:"#ee8b42"}}>
          <Text style={{color:"#ffa765",fontSize:11,fontWeight:"800",letterSpacing:2}}>CAT FIELD ATTENDANCE</Text>
          <Text style={{color:"#fff",fontSize:26,fontWeight:"800"}}>Your shift, verified.</Text>
          <Text accessibilityLiveRegion="polite" style={{color:"#c8d8ec",fontSize:14}}>{gpsState || "Enable Location · Capture photo · Record attendance"}</Text>
          {gps && <Text style={{color:"#c8d8ec",fontSize:12}}>{gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)} · ±{Math.round(gps.accuracy)} m</Text>}
          {currentShift && <Text style={{color:"#e1ebfb",fontSize:14}}>{currentShift.site_name} · {currentShift.data.post}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel={currentEvent==="out" ? "Time Out with selfie and GPS" : "Time In with selfie and GPS"} disabled={busy || loading || !currentShift} style={[s.button,(busy || loading || !currentShift) && s.disabled]} onPress={()=>currentShift && void punch(currentShift,currentEvent)}><Text style={s.white}>{busy ? "Verifying attendance…" : currentEvent==="out" ? "Time Out · Open selfie camera" : "Time In · Open selfie camera"}</Text></Pressable>
          {!loading && !currentShift && <Text style={{color:"#ffa765",fontSize:13}}>No active shift. Ask your supervisor to assign a current duty schedule.</Text>}
          {lastPunch && <View style={{gap:10,backgroundColor:"#173952",borderRadius:16,padding:14}}>
            <Text style={{color:"#fff",fontWeight:"800"}}>{lastPunch.data.event==="in" ? "Time In" : "Time Out"} saved to Operations</Text>
            <Text style={{color:"#e1ebfb"}}>{new Date(lastPunch.data.recorded_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"})} · Philippine time</Text>
            <Text style={{color:"#e1ebfb"}}>{lastPunch.data.location_label}</Text>
            <Text style={{color:"#e1ebfb"}}>GPS {Number(lastPunch.data.latitude).toFixed(6)}, {Number(lastPunch.data.longitude).toFixed(6)} · ±{Math.round(lastPunch.data.accuracy)} m · {lastPunch.data.geofence_status} geofence</Text>
            <Pressable accessibilityRole="button" onPress={()=>setPhotoRecord(lastPunch.id)}><Text style={{color:"#ffa765",fontWeight:"700"}}>View saved selfie with location & timestamp</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={()=>void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lastPunch.data.latitude},${lastPunch.data.longitude}`).catch(()=>setError("Could not open map"))}><Text style={{color:"#ffa765",fontWeight:"700"}}>View attendance location on map</Text></Pressable>
          </View>}
          <Pressable accessibilityRole="button" disabled={busy} style={[s.button,busy && s.disabled]} onPress={()=>void run(async()=>{await position();return {gps_checked:true}})}><Text style={s.white}>{busy ? "Getting location…" : "Check GPS & geofence"}</Text></Pressable>
          <Pressable accessibilityRole="button" style={{padding:10,alignItems:"center"}} onPress={()=>{void (Platform.OS === "android" ? Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS") : Linking.openSettings()).catch(()=>setError("Open phone settings and enable Location/GPS and precise location permission."))}}><Text style={{color:"#e1ebfb",fontSize:13,fontWeight:"600"}}>Open Location settings</Text></Pressable>
        </View>
        {sites.map(site=>{const fence=gps?geofenceStatus(gps,site):null;return <View style={[s.card,{borderLeftWidth:4,borderLeftColor:fence?.status==="Inside"?"#188565":fence?.status==="Outside"?"#d44435":"#7656cf"}]} key={"fence-"+site.id}><Text style={s.title}>{site.name}</Text><Text style={s.caption}>Geofence · {site.radius_m || "—"} m radius</Text>{site.latitude!=null&&site.longitude!=null&&<Pressable accessibilityRole="button" onPress={()=>void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${site.latitude},${site.longitude}`).catch(()=>setError("Could not open map"))}><Text style={s.link}>Open site map</Text></Pressable>}<Text style={s.value}>{fence ? fence.status+(fence.distance!=null?` · ${fence.distance} m from centre`:"") : site.latitude==null || site.longitude==null ? "Boundary not configured" : "Check GPS to verify your location"}</Text></View>})}
        {!loading && !rows.length && <View style={s.card}><Text style={s.caption}>No assigned shifts. Your supervisor must create your duty schedule before you can time in.</Text></View>}
      </>}

      {role === "guard" &&
        section === "shifts" &&
        sites.map((site) => (
          <Pressable
            key={site.id}
            accessibilityRole="button"
            disabled={busy}
            style={s.button}
            onPress={() =>
              void run(async () =>
                request(
                  "/location/check-in",
                  jsonOptions({ site_id: site.id, location: await position() }),
                ),
              )
            }
          >
            <Text style={s.white}>Share GPS check-in · {site.name}</Text>
          </Pressable>
        ))}
      {module?.writable && !draft && (
        <Pressable
          accessibilityRole="button"
          style={s.button}
          disabled={busy}
          onPress={() => start()}
        >
          <Text style={s.white}>
            + {section === "defects" ? "Report a fault" : "Add record"}
          </Text>
        </Pressable>
      )}
      {draft && module && (
        <View style={s.card}>
          <Text style={s.title}>{editing ? "Edit record" : "New record"}</Text>
          {!editing && (
            <>
              <ChoiceField
                label="Site"
                choices={sites}
                value={site}
                onChange={setSite}
              />
              {module.requires_subject && (
                <ChoiceField
                  label="Person"
                  choices={people}
                  value={person}
                  onChange={setPerson}
                />
              )}
            </>
          )}
          {Object.entries(module.schema.properties)
            .filter(([k]) => k !== "acknowledged")
            .map(([k, f]) => {
              const b = f.anyOf?.find((x) => x.type !== "null") || f
              const choices =
                k === "equipment_id"
                  ? equipment
                  : k === "incident_id"
                    ? incidents
                    : null
              return (
                <View key={k} style={s.field}>
                  <Text style={s.label}>{title(k)}</Text>
                  {choices ? (
                    <ChoiceField
                      choices={choices}
                      value={draft[k]}
                      onChange={(v) => setDraft({ ...draft, [k]: v })}
                    />
                  ) : b.enum ? (
                    <ChoiceField
                      choices={b.enum.map((v) => ({ id: v, name: v }))}
                      value={draft[k]}
                      onChange={(v) => setDraft({ ...draft, [k]: v })}
                    />
                  ) : b.type === "boolean" ? (
                    <Switch
                      accessibilityLabel={title(k)}
                      value={!!draft[k]}
                      onValueChange={(v) => setDraft({ ...draft, [k]: v })}
                    />
                  ) : b.format === "date-time" ? (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={title(k)}
                        onPress={() => {
                          setDateField(k)
                          setDateMode("date")
                        }}
                        style={s.input}
                      >
                        <Text style={s.value}>
                          {draft[k]
                            ? new Date(draft[k]).toLocaleString()
                            : "Choose date"}
                        </Text>
                      </Pressable>
                      {f.anyOf?.some((x) => x.type === "null") && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setDraft({ ...draft, [k]: null })}
                          style={s.mini}
                        >
                          <Text style={s.link}>Clear</Text>
                        </Pressable>
                      )}
                    </>
                  ) : (
                    <TextInput keyboardAppearance={dark?"dark":"light"}
                      accessibilityLabel={title(k)}
                      value={String(draft[k] ?? "")}
                      onChangeText={(v) => setDraft({ ...draft, [k]: v })}
                      keyboardType={
                        b.type === "integer" || b.type === "number"
                          ? "numeric"
                          : "default"
                      }
                      multiline={["notes", "description"].includes(k)}
                      style={s.input}
                    />
                  )}
                </View>
              )
            })}
          {dateField && (
            <DateTimePicker themeVariant={dark?"dark":"light"}
              value={new Date(draft[dateField] || Date.now())}
              mode={dateMode}
              onChange={(event, value) => {
                if (event.type === "dismissed" || !value) {
                  setDateField(null)
                  return
                }
                const key = dateField
                setDraft({ ...draft, [key]: value.toISOString() })
                if (dateMode === "date") setDateMode("time")
                else setDateField(null)
              }}
            />
          )}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void save()}
            style={s.button}
          >
            <Text style={s.white}>{busy ? "Saving…" : "Save"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDraft(null)}
            style={s.mini}
          >
            <Text style={s.link}>Cancel</Text>
          </Pressable>
        </View>
      )}
      {!draft &&
        rows.map((row) => (
          <View key={row.id} style={s.card}>
            <Text style={s.caption}>
              {row.site_name}
              {row.subject_name ? " · " + row.subject_name : ""}
            </Text>
            <Text style={s.title}>
              {String(
                row.data.title ||
                  equipment.find((e) => e.id === row.data.equipment_id)?.name ||
                  module?.label ||
                  section,
              )}
            </Text>
            {section === "shifts" && <><Text style={s.value}>{row.data.post}</Text>{!!row.data.instructions&&<Text style={s.value}>{row.data.instructions}</Text>}<Text style={s.caption}>{new Date(row.data.start).toLocaleString()} → {new Date(row.data.end).toLocaleString()}</Text></>}
            {Object.entries(section === "shifts" ? {} : row.data)
              .filter(([k]) => !k.endsWith("_id") && k !== "title")
              .map(([k, v]) => (
                <View key={k} style={s.detail}>
                  <Text style={s.caption}>{title(k)}</Text>
                  <Text style={s.value}>
                    {v === null
                      ? "—"
                      : typeof v === "boolean"
                        ? v
                          ? "Yes"
                          : "No"
                        : String(v)}
                  </Text>
                </View>
              ))}
            {section === "attendance" && row.data.photo_id && <Pressable accessibilityRole="button" style={s.button} onPress={()=>setPhotoRecord(row.id)}><Text style={s.white}>View attendance photo</Text></Pressable>}
            {role === "guard" &&
              section === "shifts" &&
              row.data.status !== "Cancelled" && (
                <View style={{gap:10}}>
                  <Text style={s.caption}>{nextAttendanceEvent(attendance,row.id)==="out" ? "On duty · next: Time Out" : "Ready · next: Time In"}</Text>
                  <Pressable accessibilityRole="button" disabled={busy || (nextAttendanceEvent(attendance,row.id)==="in" && !timeInAvailable(row))} onPress={()=>void punch(row,nextAttendanceEvent(attendance,row.id))} style={[s.button,busy && s.disabled]}><Text style={s.white}>{busy ? "Please wait…" : nextAttendanceEvent(attendance,row.id)==="out" ? "Time Out · Camera + GPS" : !timeInAvailable(row) ? (+new Date(row.data.end)<Date.now()?"Shift ended":"Scheduled · Time In opens before duty") : "Time In · Camera + GPS"}</Text></Pressable>
                </View>
              )}
            {role === "guard" &&
              section === "assignments" &&
              !row.data.returned_at &&
              !row.data.acknowledged && (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() =>
                    void run(() =>
                      request(
                        "/equipment/" + row.id + "/acknowledge",
                        jsonOptions({}),
                      ),
                    )
                  }
                  style={s.button}
                >
                  <Text style={s.white}>Acknowledge receipt</Text>
                </Pressable>
              )}
            {module?.writable && role === "supervisor" && (
              <Pressable
                accessibilityRole="button"
                onPress={() => start(row)}
                style={s.mini}
              >
                <Text style={s.link}>Edit record</Text>
              </Pressable>
            )}
          </View>
        ))}
      {!loading && !rows.length && !draft && (
        <Text style={s.caption}>No records yet.</Text>
      )}
      <View style={s.card}>
        <Text style={s.title}>Notifications</Text>
        {notifications.length ? (
          notifications.map((n) => (
            <View key={n.key} style={s.detail}>
              <Text style={s.value}>{n.title}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={n.read || busy}
                onPress={() =>
                  void run(() =>
                    request("/notifications/read", jsonOptions({ key: n.key })),
                  )
                }
                style={s.mini}
              >
                <Text style={s.link}>{n.read ? "Read" : "Mark read"}</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={s.caption}>All caught up.</Text>
        )}
      </View>
    </View>
  )
}
function ChoiceField({
  label,
  choices,
  value,
  onChange,
}: {
  label?: string
  choices: Choice[]
  value: string
  onChange: (v: string) => void
}) {
  const s=useThemedStyles(baseStyles)
  return (
    <View style={s.field}>
      {label && <Text style={s.label}>{label}</Text>}
      <View style={s.tabs}>
        {choices.map((c) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel={c.name}
            accessibilityState={{ selected: value === c.id }}
            key={c.id}
            onPress={() => onChange(c.id)}
            style={[s.chip, value === c.id && s.selected]}
          >
            <Text style={value === c.id ? s.selectedText : s.link}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>
      {!choices.length && <Text style={s.caption}>No available records.</Text>}
    </View>
  )
}
const baseStyles = StyleSheet.create({
  wrap: { gap: 16 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headingText: { fontSize: 24, fontWeight: "800", color: "#12304a" },
  title: { fontSize: 17, fontWeight: "700", color: "#12304a" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    padding: 12,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d6e5f0",
    justifyContent: "center",
  },
  selected: { backgroundColor: "#6D50BD", borderColor: "#6D50BD" },
  selectedText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  link: { color: "#2563EB", fontSize: 12, fontWeight: "600" },
  card: { backgroundColor: "#fff", padding: 18, borderRadius: 18, gap: 12 },
  caption: { fontSize: 12, color: "#52718b" },
  field: { gap: 8 },
  label: { fontSize: 12, fontWeight: "600", color: "#12304a" },
  input: {
    backgroundColor: "#F4F8FF",
    padding: 14,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d6e5f0",
    color: "#12304a",
  },
  button: {
    padding: 14,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#C94E18",
    alignItems: "center",
    justifyContent: "center",
  },
  white: { color: "#fff", fontWeight: "700", fontSize: 13 },
  mini: { minHeight: 44, justifyContent: "center", padding: 8 },
  detail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#edf3f8",
    paddingVertical: 6,
  },
  value: { fontSize: 12, color: "#12304a", flexShrink: 1 },
  error: {
    padding: 14,
    backgroundColor: "#fce8e4",
    color: "#973e36",
    borderRadius: 12,
  },
  success: {
    padding: 14,
    backgroundColor: "#e1f4eb",
    color: "#235d43",
    borderRadius: 12,
  },
  disabled: { opacity: 0.45 },
})
