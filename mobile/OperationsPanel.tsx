import React, { useEffect, useState } from "react"
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Platform,
} from "react-native"
import * as Location from "expo-location"
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
type Choice = { id: string; name: string }
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
}: {
  role: string
  request: (url: string, options?: RequestInit) => Promise<any>
}) {
  const s=useThemedStyles(baseStyles)
  const {dark}=useTheme()
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
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await fn()
      setRev((v) => v + 1)
      setNotice("Saved")
      setDraft(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function position() {
    const p = await Location.requestForegroundPermissionsAsync()
    if (!p.granted) throw Error("Allow location access to check in")
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    })
    if (Platform.OS === "android" && loc.mocked)
      throw Error("Turn off mock location before checking in")
    if (loc.coords.accuracy === null)
      throw Error("GPS accuracy unavailable. Try again")
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
    }
  }
  async function punch(shift: Row, event: string) {
    await run(async () => {
      const coords = await position()
      await request(
        "/attendance",
        jsonOptions({ shift_id: shift.id, event, ...coords }),
      )
    })
  }
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
          ["shifts", "Schedule"],
          ["assignments", "Equipment"],
          ["training", "Training"],
          ["certifications", "Licenses"],
          ["assessments", "Assessments"],
          ["defects", "Faults"],
        ]
      : catalog.map((m) => [m.key, m.label])
  return (
    <View style={s.wrap}>
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
            {Object.entries(row.data)
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
            {role === "guard" &&
              section === "shifts" &&
              row.data.status !== "Cancelled" && (
                <View style={s.tabs}>
                  {["in", "out"].map((event) => {
                    const recorded = attendance.some(
                      (a) =>
                        a.data.shift_id === row.id && a.data.event === event,
                    )
                    return (
                      <Pressable
                        key={event}
                        accessibilityRole="button"
                        disabled={busy || recorded}
                        onPress={() => void punch(row, event)}
                        style={[s.button, (busy || recorded) && s.disabled]}
                      >
                        <Text style={s.white}>
                          {recorded ? "Recorded" : "Time " + event}
                        </Text>
                      </Pressable>
                    )
                  })}
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
  selected: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
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
    backgroundColor: "#2563EB",
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
