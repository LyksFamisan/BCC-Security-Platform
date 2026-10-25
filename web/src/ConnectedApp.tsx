import { useEffect, useState, useRef, type FormEvent } from "react"
import { io } from "socket.io-client"
import "./connected.css"
import OperationsWorkspace from "./OperationsWorkspace"
const api = import.meta.env.VITE_API_URL || "http://localhost:3001"
type User = { id: string; name: string; role: string }
type AuditEvent = {
  id: string
  action: string
  details: Record<string, unknown>
  created_at: string
  actor_name: string
}
type Incident = {
  id: string
  title: string
  description: string
  location: string
  status: string
  reporter_name: string
  site_name: string
  assignee_id: string | null
  classification: string
  severity: string
  approval: string
  investigation: string
  root_cause: string
  version: number
  due_at: string | null
  photo_key: string
}
export default function ConnectedApp() {
  const [session, setSession] = useState<{ token: string; user: User } | null>(
      null,
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false)
  const [reports, setReports] = useState<Incident[]>([]),
    [users, setUsers] = useState<User[]>([]),
    [audit, setAudit] = useState<AuditEvent[]>([]),
    [photo, setPhoto] = useState<string | null>(null),
    [live, setLive] = useState(false)
  const [view, setView] = useState<"workspace" | "incidents">("workspace")
  const activeSession = useRef(session)
  activeSession.current = session
  function clearSession(message = "") {
    activeSession.current = null
    setSession(null)
    setReports([])
    setUsers([])
    setAudit([])
    setPhoto(null)
    setLive(false)
    setError(message)
  }
  function isCurrent(token: string) {
    return activeSession.current?.token === token
  }
  useEffect(() => {
    if (!session) return
    let active = true
    const controller = new AbortController()
    async function refresh() {
      try {
        const res = await fetch(api + "/incidents", {
          headers: { Authorization: "Bearer " + session!.token },
          signal: controller.signal,
        })
        if (res.status === 401) {
          if (active && isCurrent(session!.token)) {
            clearSession("Session expired. Sign in again.")
          }
          return
        }
        if (!res.ok) throw Error("Unable to load reports")
        const rows = await res.json()
        if (active && isCurrent(session!.token)) {
          setReports(rows)
          setError("")
        }
      } catch (e) {
        if (active && isCurrent(session!.token)) {
          setError((e as Error).message)
        }
      }
    }
    if (session.user.role === "admin") return
    void refresh()
    if (["operations", "supervisor"].includes(session.user.role))
      fetch(api + "/users", {
        headers: { Authorization: "Bearer " + session.token },
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((v) => {
          if (active && isCurrent(session!.token)) setUsers(v)
        })
        .catch(() => {})
    const socket = io(api, { auth: { token: session.token } })
    socket.on("connect", () => {
      setLive(true)
      void refresh()
    })
    socket.on("disconnect", () => setLive(false))
    socket.on("connect_error", () => setLive(false))
    socket.on("incidents:changed", () => void refresh())
    const timer = setInterval(refresh, 15000)
    window.addEventListener("online", refresh)
    window.addEventListener("focus", refresh)
    return () => {
      active = false
      controller.abort()
      socket.disconnect()
      clearInterval(timer)
      window.removeEventListener("online", refresh)
      window.removeEventListener("focus", refresh)
    }
  }, [session])
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo)
    },
    [photo],
  )
  async function login(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const res = await fetch(api + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw Error(data.error)
      if (!["admin", "operations", "supervisor"].includes(data.user.role))
        throw Error("Guards should use the mobile app.")
      clearSession()
      activeSession.current = data
      setSession(data)
      setPassword("")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function request(url: string, options: RequestInit = {}) {
    const token = session!.token
    const res = await fetch(api + url, {
      ...options,
      headers: {
        Authorization: "Bearer " + token,
        ...options.headers,
      },
    })
    if (!isCurrent(token)) throw Error("Session changed")
    if (!res.ok) {
      if (res.status === 401) clearSession("Session expired. Sign in again.")
      const data = await res.json().catch(() => ({}))
      throw Error(data.error || "Request failed (" + res.status + ")")
    }
    return res
  }
  async function update(id: string, changes: object) {
    const token = session!.token
    setBusy(true)
    try {
      await request("/incidents/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      })
      const res = await request("/incidents")
      const rows = await res.json()
      if (isCurrent(token)) {
        setReports(rows)
        setError("")
      }
    } catch (e) {
      if (isCurrent(token)) setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function inspect(i: Incident, kind: "photo" | "audit") {
    const token = session!.token
    try {
      const res = await request("/incidents/" + i.id + "/" + kind)
      if (kind === "audit") {
        const rows = await res.json()
        if (isCurrent(token)) setAudit(rows)
      } else {
        const blob = await res.blob()
        if (isCurrent(token)) setPhoto(URL.createObjectURL(blob))
      }
    } catch (e) {
      if (isCurrent(token)) setError((e as Error).message)
    }
  }
  return (
    <div className="connected">
      <header>
        <p>BCC / CAT • CONNECTED OPERATIONS</p>
        <h1>Security Services Platform</h1>
        <p>
          {session
            ? `${session.user.name} · ${session.user.role} · ${
                live ? "Live updates connected" : "Polling / reconnecting"
              }`
            : "Sign in with your server-issued SSD, Supervisor or System Administrator account."}
        </p>
        {session && (
          <button
            onClick={() => {
              void request("/auth/logout", { method: "POST" }).catch(() => {})
              clearSession()
            }}
          >
            Sign out
          </button>
        )}
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!session ? (
        <form onSubmit={login} className="login">
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p>Use the account provided by your administrator.</p>
        </form>
      ) : session.user.role === "admin" || view === "workspace" ? (
        <OperationsWorkspace
          key={session.token}
          role={session.user.role}
          request={request}
          onIncidents={() => setView("incidents")}
        />
      ) : (
        <>
          <button onClick={() => setView("workspace")}>← Operations</button>
          <h2>Incident center</h2>
          <p>
            {reports.length} accessible reports · updates also refresh every 15
            seconds.
          </p>
          <section className="report-grid">
            {reports.map((i) => (
              <article key={i.id}>
                <small>
                  {i.site_name} · {i.reporter_name}
                </small>
                <h2>{i.title}</h2>
                <p>{i.description}</p>
                <p>Location: {i.location}</p>
                <strong>{i.status}</strong>
                {["operations", "supervisor"].includes(session.user.role) && (
                  <>
                    <label>
                      Status
                      <select
                        aria-label="Status"
                        disabled={busy}
                        value={i.status}
                        onChange={(e) =>
                          void update(i.id, { status: e.target.value })
                        }
                      >
                        {[
                          "Submitted",
                          "Under Review",
                          "In Progress",
                          "Resolved",
                        ].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Assign report
                      <select
                        aria-label="Assign report"
                        disabled={busy}
                        value={i.assignee_id || ""}
                        onChange={(e) =>
                          void update(i.id, {
                            assignee_id: e.target.value || null,
                            version: i.version,
                          })
                        }
                      >
                        <option value="">Unassigned</option>
                        {users.map((u) => (
                          <option value={u.id} key={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Classification
                      <input
                        aria-label="Classification"
                        defaultValue={i.classification}
                        key={i.id + "classification" + i.version}
                        onBlur={(e) => {
                          if (e.target.value !== i.classification)
                            void update(i.id, {
                              classification: e.target.value,
                              version: i.version,
                            })
                        }}
                      />
                    </label>
                    <label>
                      Severity
                      <select
                        aria-label="Severity"
                        disabled={busy}
                        value={i.severity}
                        onChange={(e) =>
                          void update(i.id, {
                            severity: e.target.value,
                            version: i.version,
                          })
                        }
                      >
                        {["Low", "Medium", "High", "Critical"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Approval
                      <select
                        aria-label="Approval"
                        disabled={busy}
                        value={i.approval}
                        onChange={(e) =>
                          void update(i.id, {
                            approval: e.target.value,
                            version: i.version,
                          })
                        }
                      >
                        {["Pending", "Approved", "Returned"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <p>
                      Resolution due:{" "}
                      {i.due_at
                        ? new Date(i.due_at).toLocaleString()
                        : "Not set"}
                    </p>
                    {["investigation", "root_cause"].map((field) => (
                      <label key={field}>
                        {field === "investigation"
                          ? "Investigation notes"
                          : "Root cause"}
                        <textarea
                          aria-label={
                            field === "investigation"
                              ? "Investigation notes"
                              : "Root cause"
                          }
                          key={i.id + field + i.version}
                          defaultValue={
                            i[(field as "investigation" | "root_cause")]
                          }
                          onBlur={(e) => {
                            if (
                              e.target.value !==
                              i[(field as "investigation" | "root_cause")]
                            )
                              void update(i.id, {
                                [field]: e.target.value,
                                version: i.version,
                              })
                          }}
                        />
                      </label>
                    ))}
                    <small>
                      The server accepts only assignees belonging to this site.
                    </small>
                  </>
                )}
                <div>
                  <button onClick={() => void inspect(i, "photo")}>
                    View photo
                  </button>
                  {session.user.role === "operations" && (
                    <button onClick={() => void inspect(i, "audit")}>
                      Audit trail
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>
          {reports.length === 0 && (
            <p>No accessible reports. Submit one from the Guard mobile app.</p>
          )}
          {photo && (
            <section>
              <button onClick={() => setPhoto(null)}>Close photo</button>
              <img
                src={photo}
                alt="Incident evidence"
                style={{ maxWidth: "100%", maxHeight: 500 }}
              />
            </section>
          )}
          {audit.length > 0 && (
            <section>
              <h2>Report audit trail</h2>
              <button onClick={() => setAudit([])}>Close audit</button>
              {audit.map((a) => (
                <p key={a.id}>
                  {new Date(a.created_at).toLocaleString()} · {a.actor_name} ·{" "}
                  {a.action} · {JSON.stringify(a.details)}
                </p>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
