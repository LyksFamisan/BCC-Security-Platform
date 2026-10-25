import { useEffect, useState, type FormEvent } from "react"
import { io } from "socket.io-client"
import "./connected.css"
const api = import.meta.env.VITE_API_URL || "http://localhost:3001"
type User = { id: string; name: string; role: string }
type Incident = {
  id: string
  title: string
  description: string
  location: string
  status: string
  reporter_name: string
  site_name: string
  assignee_id: string | null
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
    [audit, setAudit] = useState<any[]>([]),
    [photo, setPhoto] = useState<string | null>(null),
    [live, setLive] = useState(false)
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
          setSession(null)
          throw Error("Session expired. Sign in again.")
        }
        if (!res.ok) throw Error("Unable to load reports")
        const rows = await res.json()
        if (active) {
          setReports(rows)
          setError("")
        }
      } catch (e) {
        if (active) setError((e as Error).message)
      }
    }
    void refresh()
    if (session.user.role === "admin")
      fetch(api + "/users", {
        headers: { Authorization: "Bearer " + session.token },
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((v) => {
          if (active) setUsers(v)
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
      if (!["admin", "supervisor"].includes(data.user.role))
        throw Error("Guards should use the mobile app.")
      setSession(data)
      setPassword("")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function request(url: string, options: RequestInit = {}) {
    const res = await fetch(api + url, {
      ...options,
      headers: {
        Authorization: "Bearer " + session!.token,
        ...options.headers,
      },
    })
    if (!res.ok) {
      if (res.status === 401) setSession(null)
      throw Error("Request failed (" + res.status + ")")
    }
    return res
  }
  async function update(id: string, changes: object) {
    setBusy(true)
    try {
      await request("/incidents/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      })
      const res = await request("/incidents")
      setReports(await res.json())
      setError("")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function inspect(i: Incident, kind: "photo" | "audit") {
    try {
      const res = await request("/incidents/" + i.id + "/" + kind)
      if (kind === "audit") setAudit(await res.json())
      else setPhoto(URL.createObjectURL(await res.blob()))
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <div className="connected">
      <header>
        <p>BCC / CAT • CONNECTED OPERATIONS</p>
        <h1>Incident Resolution Center</h1>
        <p>
          {session
            ? `${session.user.name} · ${session.user.role} · ${
                live ? "Live updates connected" : "Polling / reconnecting"
              }`
            : "Sign in with your server-issued Admin or Supervisor account."}
        </p>
        {session && (
          <button
            onClick={() => {
              setSession(null)
              setReports([])
              setAudit([])
              setPhoto(null)
              setUsers([])
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
          <p>
            API: {api}. Demo accounts are created by the local seed command.
          </p>
        </form>
      ) : (
        <>
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
                {session.user.role === "admin" && (
                  <>
                    <label>
                      Status
                      <select
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
                        disabled={busy}
                        value={i.assignee_id || ""}
                        onChange={(e) =>
                          void update(i.id, {
                            assignee_id: e.target.value || null,
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
                    <small>
                      The server accepts only assignees belonging to this site.
                    </small>
                  </>
                )}
                <div>
                  <button onClick={() => void inspect(i, "photo")}>
                    View photo
                  </button>
                  <button onClick={() => void inspect(i, "audit")}>
                    Audit trail
                  </button>
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
