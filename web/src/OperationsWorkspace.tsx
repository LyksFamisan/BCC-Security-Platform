import { useEffect, useState, useRef, type FormEvent } from "react"
import "./operations.css"
type Row = {
  id: string
  site_id: string
  subject_id?: string
  site_name?: string
  subject_name?: string
  version: number
  data: Record<string, unknown>
}
type Field = {
  type?: string
  enum?: string[]
  format?: string
  default?: unknown
  anyOf?: Field[]
}
type Module = {
  key: string
  label: string
  group: string
  writable: boolean
  requires_subject: boolean
  schema: { properties: Record<string, Field>; required?: string[] }
}
type Choice = { id: string; name: string; role?: string }
type Request = (url: string, options?: RequestInit) => Promise<Response>
const labels: Record<string, string> = {
  start: "Start",
  end: "End",
  post: "Duty post",
  subject_id: "Person",
  equipment_id: "Equipment",
  incident_id: "Incident",
  completed_at: "Completed on",
  expires_at: "Expires on",
  assessed_at: "Assessed on",
  acquired_at: "Acquired on",
  issued_at: "Issued on",
  returned_at: "Returned on",
  due_at: "Due on",
  acknowledged: "Recipient acknowledgment",
}
function label(k: string) {
  return (
    labels[k] || k.replaceAll("_", " ").replace(/^./, (s) => s.toUpperCase())
  )
}
function timeValue(v: unknown) {
  if (!v) return ""
  const d = new Date(String(v))
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}
export default function OperationsWorkspace({
  role,
  request,
  onIncidents,
}: {
  role: string
  request: Request
  onIncidents: () => void
}) {
  const [catalog, setCatalog] = useState<Module[]>([]),
    [section, setSection] = useState(
      role === "admin" ? "accounts" : "dashboard",
    ),
    [rows, setRows] = useState<Row[]>([]),
    [sites, setSites] = useState<Choice[]>([]),
    [users, setUsers] = useState<Choice[]>([]),
    [assets, setAssets] = useState<Choice[]>([]),
    [incidents, setIncidents] = useState<Choice[]>([])
  const [dashboard, setDashboard] = useState<any>(null),
    [alerts, setAlerts] = useState<any[]>([]),
    [audit, setAudit] = useState<any[]>([]),
    [accounts, setAccounts] = useState<any[]>([]),
    [siteRows, setSiteRows] = useState<any[]>([]),
    [config, setConfig] = useState<any>(null),
    [health, setHealth] = useState<any>(null),
    [backups, setBackups] = useState<any[]>([]),
    [integration, setIntegration] = useState<any>(null),
    [importData, setImportData] = useState('{"events":[]}'),
    [reportFrom, setReportFrom] = useState(""),
    [reportTo, setReportTo] = useState(""),
    [reportSite, setReportSite] = useState("")
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Row | null>(null),
    [draft, setDraft] = useState<Record<string, any>>({}),
    [site, setSite] = useState(""),
    [person, setPerson] = useState(""),
    [search, setSearch] = useState(""),
    [reportKind, setReportKind] = useState("attendance"),
    [widgets, setWidgets] = useState([
      "incidents",
      "attendance",
      "equipment",
      "sites",
    ]),
    [revision, setRevision] = useState(0)
  const [accountDraft, setAccountDraft] = useState<any>(null),
    [siteDraft, setSiteDraft] = useState<any>(null)
  const preferencesLoaded = useRef(false)
  const module = catalog.find((m) => m.key === section)
  const json = async (url: string, options?: RequestInit) =>
    (await request(url, options)).json()
  const send = (url: string, data: object, method = "POST") =>
    json(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  useEffect(() => {
    let active = true
    async function load() {
      try {
        if (role === "admin") {
          const [a, s, c, h] = await Promise.all(
            [
              "/system/users",
              "/system/sites",
              "/system/config",
              "/system/health",
            ].map((p) => json(p)),
          )
          if (!active) return
          setAccounts(a)
          setSiteRows(s)
          setSites(s)
          setConfig((previous: any) => previous ?? c)
          setHealth(h)
          if (section === "audit") {
            const a = await json("/system/audit")
            if (active) setAudit(a)
          }
          if (section === "integrations") {
            const i = await json("/system/integrations")
            if (active) setIntegration((previous: any) => previous ?? i)
          }
          if (section === "backups") {
            const b = await json("/system/backups")
            if (active) setBackups(b)
          }
        } else {
          const [c, s, u, d, n, p] = await Promise.all([
            json("/operations/catalog"),
            json("/sites"),
            json("/users"),
            json("/dashboard"),
            json("/notifications"),
            json("/preferences"),
          ])
          if (!active) return
          setCatalog(c)
          setSites(s)
          setUsers(u)
          setDashboard(d)
          setAlerts(n)
          if (!preferencesLoaded.current) {
            if (p.dashboard) setWidgets(p.dashboard)
            if (p.report_kind) setReportKind(p.report_kind)
            preferencesLoaded.current = true
          }
          if (section === "audit") {
            const a = await json("/system/audit")
            if (active) setAudit(a)
          }
          if (
            c.some((m: Module) => m.key === section) ||
            ["attendance", "gps"].includes(section)
          ) {
            const r = await json("/operations/" + section)
            if (active) setRows(r)
          }
          if (c.some((m: Module) => m.key === section)) {
            const [eq, inc] = await Promise.all([
              json("/operations/equipment"),
              json("/incidents"),
            ])
            if (active) {
              setAssets(
                eq.map((r: Row) => ({
                  id: r.id,
                  name: String(r.data.title) + " · " + r.site_name,
                })),
              )
              setIncidents(inc.map((r: any) => ({ id: r.id, name: r.title })))
            }
          }
        }
        if (active) setError("")
      } catch (e) {
        if (active) setError((e as Error).message)
      }
    }
    void load()
    const timer = setInterval(load, 15000)
    window.addEventListener("focus", load)
    window.addEventListener("online", load)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener("focus", load)
      window.removeEventListener("online", load)
    }
  }, [role, section, revision])
  function select(next: string) {
    setSection(next)
    setEditing(null)
    setDraft({})
    setSearch("")
    setError("")
    setNotice("")
  }
  function edit(row?: Row) {
    setEditing(row || null)
    const values: Record<string, unknown> = {}
    for (const [k, f] of Object.entries(module!.schema.properties)) {
      const base = f.anyOf?.find((x) => x.type !== "null") || f
      values[k] =
        row?.data[k] ??
        f.default ??
        base.default ??
        (base.type === "boolean" ? false : (base.enum?.[0] ?? ""))
    }
    setDraft(values)
    setSite(row?.site_id || sites[0]?.id || "")
    setPerson(row?.subject_id || "")
  }
  async function mutate(fn: () => Promise<unknown>) {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await fn()
      setRevision((n) => n + 1)
      setNotice("Saved")
      setDraft({})
      setEditing(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function saveRecord(e: FormEvent) {
    e.preventDefault()
    if (!module) return
    await mutate(async () => {
      const data = { ...draft }
      for (const [k, f] of Object.entries(module.schema.properties)) {
        const nullable = !!f.anyOf?.some((x) => x.type === "null"),
          base = f.anyOf?.find((x) => x.type !== "null") || f
        if (base.format === "date-time")
          data[k] = data[k] ? new Date(data[k]).toISOString() : null
        if (base.type === "number" || base.type === "integer")
          data[k] = Number(data[k])
        if (nullable && data[k] === "") data[k] = null
      }
      await send(
        "/operations/" + module.key + (editing ? "/" + editing.id : ""),
        editing
          ? { version: editing.version, data }
          : {
              site_id: site,
              subject_id: module.requires_subject ? person : undefined,
              data,
            },
        editing ? "PATCH" : "POST",
      )
    })
  }
  async function exportReport() {
    setBusy(true)
    try {
      const query = new URLSearchParams({ kind: reportKind })
      if (reportSite) query.set("site_id", reportSite)
      if (reportFrom) query.set("from", new Date(reportFrom).toISOString())
      if (reportTo) query.set("to", new Date(reportTo).toISOString())
      const response = await request("/reports/export?" + query)
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        a = document.createElement("a")
      a.href = url
      a.download = reportKind + ".csv"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const nav =
    role === "admin"
      ? [
          ["accounts", "Users & permissions"],
          ["site-config", "Sites & geofences"],
          ["config", "Workflow & SLA"],
          ["integrations", "Timekeeping integration"],
          ["audit", "Audit log"],
          ["health", "System health"],
          ["backups", "Backup & recovery"],
        ]
      : [
          ["dashboard", "Overview"],
          ...catalog.map((m) => [m.key, m.label]),
          ["attendance", "Attendance"],
          ["gps", "Location check-ins"],
          ["notifications", "Notifications"],
          ["reports", "Reports"],
          ...(role === "operations" ? [["audit", "Audit log"]] : []),
        ]
  return (
    <div className="ops-shell">
      <aside className="ops-sidebar">
        <p>
          {role === "admin"
            ? "System administration"
            : role === "operations"
              ? "Operations management"
              : "Assigned sites"}
        </p>
        <nav aria-label="Operations modules">
          {nav.map(([key, title]) => (
            <button
              key={key}
              className={section === key ? "active" : ""}
              onClick={() => select(key)}
            >
              {title}
            </button>
          ))}
          {role !== "admin" && (
            <button onClick={onIncidents}>Incident center ↗</button>
          )}
        </nav>
      </aside>
      <main className="ops-main">
        <div className="ops-heading">
          <div>
            <h2>{module?.label || nav.find((n) => n[0] === section)?.[1]}</h2>
          </div>
          <button onClick={() => setRevision((n) => n + 1)} disabled={busy}>
            Refresh
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="ops-success">
            {notice}
          </p>
        )}
        {section === "dashboard" && dashboard && (
          <>
            <div className="ops-stats">
              {Object.entries(dashboard.counts)
                .filter(([k]) =>
                  widgets.includes(
                    k.includes("equipment")
                      ? "equipment"
                      : k.includes("incident")
                        ? "incidents"
                        : "attendance",
                  ),
                )
                .map(([k, v]) => (
                  <article key={k}>
                    <small>{label(k)}</small>
                    <strong>{String(v)}</strong>
                  </article>
                ))}
            </div>
            {widgets.includes("sites") && (
              <section className="ops-panel">
                <h3>Site coverage</h3>
                <div className="ops-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Site</th>
                        <th>Client</th>
                        <th>Required</th>
                        <th>Scheduled</th>
                        <th>Present</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.sites.map((s: any) => (
                        <tr key={s.id}>
                          <td>{s.name}</td>
                          <td>{s.client_name || "—"}</td>
                          <td>{s.required}</td>
                          <td>{s.scheduled}</td>
                          <td>{s.present}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            <section className="ops-panel">
              <h3>Utilization & SLA</h3>
              {dashboard.kpi &&
                Object.entries(dashboard.kpi).map(([k, v]) => (
                  <p key={k}>
                    {label(k)}: <strong>{String(v)}</strong>
                  </p>
                ))}
              <h3>Incident trend</h3>
              {Object.entries(dashboard.incident_trend).map(([day, count]) => (
                <p key={day}>
                  {day}{" "}
                  <meter
                    min={0}
                    max={Math.max(1, dashboard.counts.incidents)}
                    value={Number(count)}
                  />{" "}
                  {String(count)}
                </p>
              ))}
              {!Object.keys(dashboard.incident_trend).length && (
                <p>No incident history yet.</p>
              )}
            </section>
            <section className="ops-panel">
              <h3>Dashboard widgets</h3>
              {["incidents", "attendance", "equipment", "sites"].map((w) => (
                <label className="ops-check" key={w}>
                  <input
                    type="checkbox"
                    checked={widgets.includes(w)}
                    onChange={(e) =>
                      setWidgets((prev) =>
                        e.target.checked
                          ? [...prev, w]
                          : prev.filter((x) => x !== w),
                      )
                    }
                  />
                  {label(w)}
                </label>
              ))}
              <button
                disabled={busy}
                onClick={() =>
                  void mutate(() =>
                    send(
                      "/preferences",
                      { dashboard: widgets, report_kind: reportKind },
                      "PUT",
                    ),
                  )
                }
              >
                Save layout
              </button>
            </section>
          </>
        )}
        {(module || ["attendance", "gps"].includes(section)) && (
          <>
            <div className="ops-heading">
              <input
                aria-label="Search records"
                placeholder="Search records"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {module?.writable && (
                <button className="ops-primary" onClick={() => edit()}>
                  + Add record
                </button>
              )}
            </div>
            {module && Object.keys(draft).length > 0 && (
              <form className="ops-panel ops-form" onSubmit={saveRecord}>
                <h3>{editing ? "Edit record" : "New record"}</h3>
                {!editing && (
                  <>
                    <label>
                      Site
                      <select
                        aria-label="Site"
                        required
                        value={site}
                        onChange={(e) => setSite(e.target.value)}
                      >
                        <option value="">Choose site</option>
                        {sites.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {module.requires_subject && (
                      <label>
                        Person
                        <select
                          aria-label="Person"
                          required
                          value={person}
                          onChange={(e) => setPerson(e.target.value)}
                        >
                          <option value="">Choose person</option>
                          {users
                            .filter((u) => u.role !== "admin")
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                  </>
                )}
                {Object.entries(module.schema.properties)
                  .filter(([k]) => k !== "acknowledged")
                  .map(([k, f]) => {
                    const base = f.anyOf?.find((x) => x.type !== "null") || f,
                      required =
                        module.schema.required?.includes(k) &&
                        !f.anyOf?.some((x) => x.type === "null"),
                      choices =
                        k === "equipment_id"
                          ? assets
                          : k === "incident_id"
                            ? incidents
                            : null
                    return (
                      <label key={k}>
                        {label(k)}
                        {choices ? (
                          <select
                            aria-label={label(k)}
                            required
                            value={draft[k] || ""}
                            onChange={(e) =>
                              setDraft({ ...draft, [k]: e.target.value })
                            }
                          >
                            <option value="">Choose {label(k)}</option>
                            {choices.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        ) : base.enum ? (
                          <select
                            aria-label={label(k)}
                            value={draft[k] || base.enum[0]}
                            onChange={(e) =>
                              setDraft({ ...draft, [k]: e.target.value })
                            }
                          >
                            {base.enum.map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                        ) : base.type === "boolean" ? (
                          <input
                            type="checkbox"
                            checked={!!draft[k]}
                            onChange={(e) =>
                              setDraft({ ...draft, [k]: e.target.checked })
                            }
                          />
                        ) : ["notes", "description"].includes(k) ? (
                          <textarea
                            value={draft[k] || ""}
                            onChange={(e) =>
                              setDraft({ ...draft, [k]: e.target.value })
                            }
                          />
                        ) : (
                          <input
                            required={required}
                            type={
                              base.format === "date-time"
                                ? "datetime-local"
                                : base.type === "number" ||
                                    base.type === "integer"
                                  ? "number"
                                  : "text"
                            }
                            value={
                              base.format === "date-time"
                                ? timeValue(draft[k])
                                : (draft[k] ?? "")
                            }
                            onChange={(e) =>
                              setDraft({ ...draft, [k]: e.target.value })
                            }
                          />
                        )}
                      </label>
                    )
                  })}
                <div>
                  <button disabled={busy} className="ops-primary">
                    {busy ? "Saving…" : "Save record"}
                  </button>
                  <button type="button" onClick={() => setDraft({})}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
            <div className="ops-records">
              {rows
                .filter((r) =>
                  JSON.stringify(r)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((row) => (
                  <article className="ops-panel" key={row.id}>
                    <small>
                      {row.site_name} · {row.subject_name || ""}
                    </small>
                    <h3>
                      {String(
                        row.data.title ||
                          row.data.event ||
                          row.data.status ||
                          module?.label ||
                          label(section),
                      )}
                    </h3>
                    <dl>
                      {Object.entries(row.data).map(([key, value]) => (
                        <div key={key}>
                          <dt>{label(key)}</dt>
                          <dd>
                            {key === "equipment_id"
                              ? assets.find((a) => a.id === value)?.name ||
                                String(value)
                              : key === "incident_id"
                                ? incidents.find((i) => i.id === value)?.name ||
                                  String(value)
                                : value === null
                                  ? "—"
                                  : typeof value === "boolean"
                                    ? value
                                      ? "Yes"
                                      : "No"
                                    : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {module?.writable && (
                      <button onClick={() => edit(row)}>Edit</button>
                    )}
                  </article>
                ))}
            </div>
            {!rows.length && <p className="ops-empty">No records yet.</p>}
          </>
        )}
        {section === "notifications" && (
          <section className="ops-panel">
            {alerts.map((a) => (
              <div className="ops-alert" key={a.key}>
                <p>{a.title}</p>
                <button
                  disabled={a.read || busy}
                  onClick={() =>
                    void mutate(() =>
                      send("/notifications/read", { key: a.key }),
                    )
                  }
                >
                  {a.read ? "Read" : "Mark read"}
                </button>
              </div>
            ))}
            {!alerts.length && <p>No active alerts.</p>}
          </section>
        )}
        {section === "reports" && (
          <section className="ops-panel ops-form">
            <h3>Operational reports</h3>
            <label>
              Report
              <select
                aria-label="Report"
                value={reportKind}
                onChange={(e) => setReportKind(e.target.value)}
              >
                {[
                  "shifts",
                  "attendance",
                  "equipment",
                  "assignments",
                  "maintenance",
                  "actions",
                  "escalations",
                  "training",
                  "certifications",
                ].map((k) => (
                  <option key={k} value={k}>
                    {label(k)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Site
              <select
                aria-label="Report site"
                value={reportSite}
                onChange={(e) => setReportSite(e.target.value)}
              >
                <option value="">All accessible sites</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Created from
              <input
                type="datetime-local"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
              />
            </label>
            <label>
              Created to
              <input
                type="datetime-local"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
              />
            </label>
            <button
              className="ops-primary"
              disabled={busy}
              onClick={() => void exportReport()}
            >
              Download CSV
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void mutate(() =>
                  send(
                    "/preferences",
                    { dashboard: widgets, report_kind: reportKind },
                    "PUT",
                  ),
                )
              }
            >
              Save report preference
            </button>
            {role === "operations" && (
              <>
                <h3>Timekeeping import</h3>
                <label>
                  Attendance JSON
                  <textarea
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                  />
                </label>
                <button
                  disabled={busy}
                  onClick={() =>
                    void mutate(() =>
                      send("/integrations/attendance", JSON.parse(importData)),
                    )
                  }
                >
                  Import events
                </button>

              </>
            )}
          </section>
        )}
        {section === "accounts" && (
          <>
            <button
              className="ops-primary"
              onClick={() =>
                setAccountDraft({
                  name: "",
                  email: "",
                  password: "",
                  role: "guard",
                  active: true,
                  site_ids: [],
                })
              }
            >
              + Add user
            </button>
            {accountDraft && (
              <form
                className="ops-panel ops-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void mutate(async () => {
                    const { id, ...data } = accountDraft
                    if (!data.password) delete data.password
                    await send(
                      "/system/users" + (id ? "/" + id : ""),
                      data,
                      id ? "PUT" : "POST",
                    )
                    setAccountDraft(null)
                  })
                }}
              >
                <h3>{accountDraft.id ? "Edit user" : "New user"}</h3>
                {["name", "email", "password"].map((k) => (
                  <label key={k}>
                    {k === "password" && accountDraft.id
                      ? "New password (optional)"
                      : label(k)}
                    <input
                      required={k !== "password" || !accountDraft.id}
                      type={
                        k === "password"
                          ? "password"
                          : k === "email"
                            ? "email"
                            : "text"
                      }
                      minLength={k === "password" ? 12 : undefined}
                      value={accountDraft[k] || ""}
                      onChange={(e) =>
                        setAccountDraft({
                          ...accountDraft,
                          [k]: e.target.value,
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  Role
                  <select
                    aria-label="Role"
                    value={accountDraft.role}
                    onChange={(e) =>
                      setAccountDraft({ ...accountDraft, role: e.target.value })
                    }
                  >
                    {["guard", "supervisor", "operations", "admin"].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label className="ops-check">
                  <input
                    type="checkbox"
                    checked={accountDraft.active}
                    onChange={(e) =>
                      setAccountDraft({
                        ...accountDraft,
                        active: e.target.checked,
                      })
                    }
                  />
                  Active
                </label>
                <fieldset>
                  <legend>Assigned sites</legend>
                  {sites.map((s) => (
                    <label className="ops-check" key={s.id}>
                      <input
                        type="checkbox"
                        checked={accountDraft.site_ids.includes(s.id)}
                        onChange={(e) =>
                          setAccountDraft({
                            ...accountDraft,
                            site_ids: e.target.checked
                              ? [...accountDraft.site_ids, s.id]
                              : accountDraft.site_ids.filter(
                                  (id: string) => id !== s.id,
                                ),
                          })
                        }
                      />
                      {s.name}
                    </label>
                  ))}
                </fieldset>

                <button disabled={busy}>Save user</button>
                <button type="button" onClick={() => setAccountDraft(null)}>
                  Cancel
                </button>
              </form>
            )}
            <div className="ops-records">
              {accounts.map((u) => (
                <article className="ops-panel" key={u.id}>
                  <h3>{u.name}</h3>
                  <p>{u.email}</p>
                  <p>
                    {u.role} · {u.active ? "Active" : "Disabled"}
                  </p>
                  <button
                    onClick={() => setAccountDraft({ ...u, password: "" })}
                  >
                    Edit access
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
        {section === "site-config" && (
          <>
            <button
              className="ops-primary"
              onClick={() =>
                setSiteDraft({
                  name: "",
                  client_name: "",
                  required_guards: 1,
                  latitude: null,
                  longitude: null,
                  radius_m: 300,
                })
              }
            >
              + Add site
            </button>
            {siteDraft && (
              <form
                className="ops-panel ops-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void mutate(async () => {
                    const { id, ...data } = siteDraft
                    await send(
                      "/system/sites" + (id ? "/" + id : ""),
                      data,
                      id ? "PUT" : "POST",
                    )
                    setSiteDraft(null)
                  })
                }}
              >
                <h3>Site configuration</h3>
                {[
                  "name",
                  "client_name",
                  "required_guards",
                  "latitude",
                  "longitude",
                  "radius_m",
                ].map((k) => (
                  <label key={k}>
                    {label(k)}
                    <input
                      type={
                        ["name", "client_name"].includes(k) ? "text" : "number"
                      }
                      step="any"
                      required={
                        !["latitude", "longitude", "client_name"].includes(k)
                      }
                      value={siteDraft[k] ?? ""}
                      onChange={(e) =>
                        setSiteDraft({
                          ...siteDraft,
                          [k]: ["name", "client_name"].includes(k)
                            ? e.target.value
                            : e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                ))}
                <button disabled={busy}>Save site</button>
                <button type="button" onClick={() => setSiteDraft(null)}>
                  Cancel
                </button>
              </form>
            )}
            <div className="ops-records">
              {siteRows.map((s) => (
                <article className="ops-panel" key={s.id}>
                  <h3>{s.name}</h3>
                  <p>{s.client_name || "No client set"}</p>
                  <p>Required guards: {s.required_guards || 1}</p>
                  <button
                    onClick={() =>
                      setSiteDraft({
                        id: s.id,
                        name: s.name,
                        client_name: s.client_name || "",
                        required_guards: s.required_guards || 1,
                        latitude: s.latitude ?? null,
                        longitude: s.longitude ?? null,
                        radius_m: s.radius_m || 300,
                      })
                    }
                  >
                    Configure
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
        {section === "config" && config && (
          <form
            className="ops-panel ops-form"
            onSubmit={(e) => {
              e.preventDefault()
              void mutate(() => send("/system/config", config, "PUT"))
            }}
          >
            <h3>Resolution SLA</h3>
            {["critical_hours", "high_hours", "standard_hours"].map((k) => (
              <label key={k}>
                {label(k)}
                <input
                  type="number"
                  min={1}
                  required
                  value={config[k]}
                  onChange={(e) =>
                    setConfig({ ...config, [k]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
            <label className="ops-check">
              <input
                type="checkbox"
                checked={config.require_approval}
                onChange={(e) =>
                  setConfig({ ...config, require_approval: e.target.checked })
                }
              />
              Require approval before resolution
            </label>
            <button disabled={busy}>Save workflow</button>

          </form>
        )}
        {section === "audit" && (
          <section className="ops-panel ops-table">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.created_at).toLocaleString()}</td>
                    <td>{a.actor_name}</td>
                    <td>{a.action}</td>
                    <td>{a.record_id || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        {section === "integrations" && integration && (
          <form
            className="ops-panel ops-form"
            onSubmit={(e) => {
              e.preventDefault()
              void mutate(() =>
                send("/system/integrations", integration, "PUT"),
              )
            }}
          >
            <h3>Timekeeping integration</h3>
            <label>
              Source name
              <input
                required
                value={integration.source_name}
                onChange={(e) =>
                  setIntegration({
                    ...integration,
                    source_name: e.target.value,
                  })
                }
              />
            </label>
            <label className="ops-check">
              <input
                type="checkbox"
                checked={integration.enabled}
                onChange={(e) =>
                  setIntegration({ ...integration, enabled: e.target.checked })
                }
              />
              Enable authenticated attendance imports
            </label>
            <button disabled={busy}>Save integration</button>

          </form>
        )}
        {section === "backups" && (
          <section className="ops-panel">
            <h3>Encrypted snapshots</h3>
            <button
              disabled={busy}
              className="ops-primary"
              onClick={() => void mutate(() => send("/system/backups", {}))}
            >
              Create backup
            </button>

            {backups.map((b) => (
              <div key={b.id}>
                <code>{b.id}</code>
                <button
                  onClick={() =>
                    void mutate(async () => {
                      const response = await request("/system/backups/" + b.id),
                        url = URL.createObjectURL(await response.blob()),
                        a = document.createElement("a")
                      a.href = url
                      a.download = b.id + ".bccbackup"
                      a.click()
                      URL.revokeObjectURL(url)
                    })
                  }
                >
                  Download encrypted backup
                </button>
              </div>
            ))}
          </section>
        )}
        {section === "health" && health && (
          <section className="ops-panel">
            <h3>Runtime health</h3>
            <dl>
              {Object.entries(health).map(([k, v]) => (
                <div key={k}>
                  <dt>{label(k)}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </main>
    </div>
  )
}
