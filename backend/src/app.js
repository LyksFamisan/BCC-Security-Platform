import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import multer from "multer"
import sharp from "sharp"
import { z } from "zod"
import { randomUUID } from "node:crypto"
import { mkdir, writeFile, unlink, readFile } from "node:fs/promises"
import path from "node:path"
import { encodePhoto, decodePhoto, encryptionKey } from "./photo-storage.js"
import { mountOperations } from "./operations.js"
import { scope, statuses } from "./policy.js"
export function createApp(pool, secret, notify = () => {}) {
  encryptionKey()
  const app = express(),
    origins = (process.env.WEB_ORIGINS || "http://localhost:8443").split(",")
  const uploads = path.resolve(process.env.UPLOAD_DIR || "uploads")
  if (process.env.TRUST_PROXY_HOPS)
    app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS))
  app.use((req, res, next) => {
    if (
      process.env.REQUIRE_HTTPS === "true" &&
      !req.secure &&
      req.path !== "/health"
    )
      return res.status(426).json({ error: "HTTPS is required" })
    next()
  })
  app.use(helmet(), cors({ origin: origins }), express.json({ limit: "32kb" }))
  app.use(rateLimit({ windowMs: 60000, limit: 180 }))
  app.get("/health", async (req, res) => {
    await pool.query("SELECT 1")
    res.json({ ok: true })
  })
  async function identity(token) {
    const claims = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "bcc-api",
      audience: "bcc-apps",
    })
    const { rows } = await pool.query(
      "SELECT u.id,u.name,u.email,u.role,COALESCE(c.active,true) AS active,COALESCE(c.revision,0) AS revision FROM users u LEFT JOIN account_controls c ON c.user_id=u.id WHERE u.id=$1",
      [claims.sub],
    )
    if (
      !rows[0] ||
      !rows[0].active ||
      (claims.revision ?? 0) !== rows[0].revision
    )
      throw Error("Invalid identity")
    if (
      claims.jti &&
      (
        await pool.query(
          "SELECT id FROM revoked_sessions WHERE id=$1 AND expires_at>now()",
          [claims.jti],
        )
      ).rows.length
    )
      throw Error("Revoked session")
    if (claims.app_role && claims.app_role !== rows[0].role)
      throw Error("App access changed")
    return rows[0]
  }
  app.locals.identity = identity
  app.post(
    "/auth/login",
    rateLimit({ windowMs: 15 * 60000, limit: 20 }),
    async (req, res) => {
      const parsed = z
        .object({
          email: z.email(),
          password: z.string().min(1).max(128),
          app_role: z.enum(["guard", "supervisor"]).optional(),
        })
        .safeParse(req.body)
      if (!parsed.success)
        return res.status(400).json({ error: "Email and password required" })
      const { rows } = await pool.query("SELECT * FROM users WHERE email=$1", [
        parsed.data.email.toLowerCase(),
      ])
      if (
        !rows[0] ||
        !(await bcrypt.compare(parsed.data.password, rows[0].password_hash))
      )
        return res.status(401).json({ error: "Invalid credentials" })
      const u = rows[0]
      const control = (
        await pool.query("SELECT * FROM account_controls WHERE user_id=$1", [
          u.id,
        ])
      ).rows[0]
      if (control && !control.active)
        return res.status(401).json({ error: "Account is disabled" })
      if (parsed.data.app_role && parsed.data.app_role !== u.role)
        return res
          .status(403)
          .json({
            error: "This account is not authorized for the selected mobile app",
          })
      await pool.query(
        "INSERT INTO audit_events(actor_id,action) VALUES($1,'LOGIN')",
        [u.id],
      )
      res.json({
        token: jwt.sign(
          {
            revision: control?.revision ?? 0,
            ...(parsed.data.app_role ? { app_role: parsed.data.app_role } : {}),
          },
          secret,
          {
            jwtid: randomUUID(),
            subject: u.id,
            expiresIn: "1h",
            issuer: "bcc-api",
            audience: "bcc-apps",
          },
        ),
        user: { id: u.id, name: u.name, role: u.role },
      })
    },
  )
  app.use(async (req, res, next) => {
    try {
      req.user = await identity(
        req.headers.authorization?.replace(/^Bearer /, ""),
      )
      next()
    } catch {
      res.status(401).json({ error: "Session expired. Sign in again." })
    }
  })
  app.get("/auth/me", (req, res) =>
    res.json({ id: req.user.id, name: req.user.name, role: req.user.role }),
  )
  mountOperations(app, pool, notify)
  app.get("/sites", async (req, res) => {
    if (req.user.role === "admin") return res.json([])
    const { rows } = await pool.query(
      req.user.role === "operations"
        ? "SELECT * FROM sites ORDER BY name"
        : "SELECT s.* FROM sites s JOIN user_sites us ON us.site_id=s.id WHERE us.user_id=$1 ORDER BY s.name",
      req.user.role === "operations" ? [] : [req.user.id],
    )
    res.json(rows)
  })
  app.get("/users", async (req, res) => {
    if (!["admin", "operations", "supervisor"].includes(req.user.role))
      return res.sendStatus(403)
    res.json(
      (
        await pool.query(
          req.user.role === "supervisor"
            ? "SELECT DISTINCT u.id,u.name,u.role FROM users u JOIN user_sites us ON us.user_id=u.id JOIN user_sites mine ON mine.site_id=us.site_id WHERE mine.user_id=$1 ORDER BY u.name"
            : "SELECT id,name,role FROM users ORDER BY name",
          req.user.role === "supervisor" ? [req.user.id] : [],
        )
      ).rows,
    )
  })
  function visibleIncident(user, row) {
    if (user.role !== "guard") return row
    const { root_cause, classification, severity, ...allowed } = row
    return allowed
  }
  app.get("/incidents", async (req, res) => {
    const s = scope(req.user)
    res.json(
      (
        await pool.query(
          `SELECT i.*,u.name AS reporter_name,s.name AS site_name FROM incidents i JOIN users u ON u.id=i.reporter_id JOIN sites s ON s.id=i.site_id WHERE ${s.sql} ORDER BY i.created_at DESC`,
          s.values,
        )
      ).rows.map((row) => visibleIncident(req.user, row)),
    )
  })
  async function incident(req, res, next) {
    if (!z.uuid().safeParse(req.params.id).success) return res.sendStatus(404)
    const s = scope(req.user, "i", 2)
    const { rows } = await pool.query(
      `SELECT i.* FROM incidents i WHERE i.id=$1 AND ${s.sql}`,
      [req.params.id, ...s.values],
    )
    if (!rows[0]) return res.sendStatus(404)
    req.incident = rows[0]
    next()
  }
  app.get(
    "/incidents/:id/audit",
    incident,
    (req, res, next) =>
      req.user.role === "operations" ? next() : res.sendStatus(403),
    async (req, res) =>
      res.json(
        (
          await pool.query(
            "SELECT a.id,a.action,a.details,a.created_at,u.name AS actor_name FROM audit_events a JOIN users u ON u.id=a.actor_id WHERE incident_id=$1 ORDER BY a.id",
            [req.params.id],
          )
        ).rows,
      ),
  )
  app.get("/incidents/:id/photo", incident, async (req, res) => {
    if (!req.incident.photo_key) return res.sendStatus(404)
    const data = await readFile(path.join(uploads, req.incident.photo_key))
    res
      .set({
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
      })
      .send(decodePhoto(data))
  })
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 },
    fileFilter(req, file, cb) {
      cb(
        null,
        ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype),
      )
    },
  })
  app.post(
    "/incidents",
    (req, res, next) => {
      if (!["guard", "supervisor", "operations"].includes(req.user.role))
        return res.sendStatus(403)
      next()
    },
    upload.single("photo"),
    async (req, res) => {
      const parsed = z
        .object({
          title: z.string().trim().min(3).max(160),
          description: z.string().trim().min(5).max(5000),
          location: z.string().trim().min(2).max(300),
          site_id: z.uuid(),
        })
        .strict()
        .safeParse(req.body)
      if (!parsed.success) return res.status(400).json({
          error: "Valid title, description, location and site are required",
        })
      const d = parsed.data
      if (
        req.user.role !== "operations" &&
        !(
          await pool.query(
            "SELECT 1 FROM user_sites WHERE user_id=$1 AND site_id=$2",
            [req.user.id, d.site_id],
          )
        ).rowCount
      )
        return res.sendStatus(403)
      if (!req.file)
        return res
          .status(400)
          .json({ error: "A JPEG, PNG or WebP photo up to 5 MB is required" })
      let image
      try {
        const p = sharp(req.file.buffer, { limitInputPixels: 25000000 })
        const meta = await p.metadata()
        if (!["jpeg", "png", "webp"].includes(meta.format)) throw Error()
        image = await p
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer()
      } catch {
        return res.status(400).json({ error: "Invalid or oversized image" })
      }
      const id = randomUUID(),
        key = randomUUID() + ".jpg"
      await mkdir(uploads, { recursive: true })
      await writeFile(path.join(uploads, key), encodePhoto(image), {
        mode: 0o600,
      })
      const c = await pool.connect()
      let row
      try {
        await c.query("BEGIN")
        row = (
          await c.query(
            "INSERT INTO incidents(id,title,description,location,site_id,reporter_id,photo_key) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
            [
              id,
              d.title,
              d.description,
              d.location,
              d.site_id,
              req.user.id,
              key,
            ],
          )
        ).rows[0]
        await c.query(
          "INSERT INTO audit_events(incident_id,actor_id,action) VALUES($1,$2,'SUBMITTED')",
          [id, req.user.id],
        )
        const workflow = (
          await c.query(
            "SELECT value FROM technical_settings WHERE key='workflow'",
          )
        ).rows[0]?.value
        row = (
          await c.query(
            "UPDATE incidents SET due_at=now()+($2*interval '1 hour') WHERE id=$1 RETURNING *",
            [id, workflow?.standard_hours || 72],
          )
        ).rows[0]
        await c.query("COMMIT")
      } catch (e) {
        await c.query("ROLLBACK")
        await unlink(path.join(uploads, key)).catch(() => {})
        throw e
      } finally {
        c.release()
      }
      notify(row)
      res.status(201).json(visibleIncident(req.user, row))
    },
  )
  app.patch("/incidents/:id", incident, async (req, res) => {
    if (!["operations", "supervisor"].includes(req.user.role))
      return res.sendStatus(403)
    const parsed = z
      .object({
        status: z.enum(statuses).optional(),
        assignee_id: z.uuid().nullable().optional(),
        classification: z.string().trim().min(1).max(100).optional(),
        severity: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
        approval: z.enum(["Pending", "Approved", "Returned"]).optional(),
        investigation: z.string().trim().max(5000).optional(),
        root_cause: z.string().trim().max(5000).optional(),
        version: z.number().int().positive().optional(),
      })
      .strict()
      .refine((v) => Object.keys(v).length > 0)
      .safeParse(req.body)
    if (!parsed.success)
      return res.status(400).json({ error: "Invalid status or assignee" })
    const d = parsed.data
    if (
      d.assignee_id &&
      !(
        await pool.query(
          "SELECT 1 FROM users u JOIN user_sites us ON us.user_id=u.id WHERE u.id=$1 AND us.site_id=$2 AND u.role IN ('guard','supervisor','operations')",
          [d.assignee_id, req.incident.site_id],
        )
      ).rowCount
    )
      return res
        .status(400)
        .json({ error: "Assignee must belong to the incident site" })
    const c = await pool.connect()
    let row
    try {
      await c.query("BEGIN")
      const current = (
        await c.query("SELECT * FROM incidents WHERE id=$1 FOR UPDATE", [
          req.params.id,
        ])
      ).rows[0]
      if (d.version !== undefined && d.version !== current.version) {
        await c.query("ROLLBACK")
        return res
          .status(409)
          .json({ error: "Report changed. Refresh before saving" })
      }
      const config = (
        await c.query(
          "SELECT value FROM technical_settings WHERE key='workflow'",
        )
      ).rows[0]?.value || {
        require_approval: true,
        critical_hours: 4,
        high_hours: 24,
        standard_hours: 72,
      }
      const approval = d.approval || current.approval
      if (
        d.status === "Resolved" &&
        config.require_approval &&
        approval !== "Approved"
      ) {
        await c.query("ROLLBACK")
        return res
          .status(409)
          .json({ error: "Approve the incident before resolving it" })
      }
      if (d.status === "Resolved" && current.status !== "Resolved") {
        const outstanding = await c.query(
          "SELECT id FROM operational_records WHERE kind='actions' AND data->>'incident_id'=$1 AND data->>'status'<>'Completed'",
          [current.id],
        )
        if (outstanding.rows.length) {
          await c.query("ROLLBACK")
          return res
            .status(409)
            .json({
              error:
                "Complete outstanding corrective and preventive actions first",
            })
        }
      }
      const severity = d.severity || current.severity
      const hours =
        severity === "Critical"
          ? config.critical_hours
          : severity === "High"
            ? config.high_hours
            : config.standard_hours
      row = (
        await c.query(
          "UPDATE incidents SET status=COALESCE($2,status),assignee_id=CASE WHEN $3 THEN $4::uuid ELSE assignee_id END,classification=COALESCE($5,classification),severity=COALESCE($6,severity),approval=COALESCE($7,approval),investigation=COALESCE($8,investigation),root_cause=COALESCE($9,root_cause),due_at=CASE WHEN $10 THEN created_at+($11*interval '1 hour') ELSE due_at END,resolved_at=CASE WHEN $2='Resolved' THEN COALESCE(resolved_at,now()) WHEN $2 IS NOT NULL THEN NULL ELSE resolved_at END,version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
          [
            current.id,
            d.status ?? null,
            "assignee_id" in d,
            d.assignee_id ?? null,
            d.classification ?? null,
            d.severity ?? null,
            d.approval ?? null,
            d.investigation ?? null,
            d.root_cause ?? null,
            !!d.severity,
            hours,
          ],
        )
      ).rows[0]
      await c.query(
        "INSERT INTO audit_events(incident_id,actor_id,action,details) VALUES($1,$2,'UPDATED',$3)",
        [row.id, req.user.id, JSON.stringify(d)],
      )
      await c.query("COMMIT")
    } catch (e) {
      await c.query("ROLLBACK")
      throw e
    } finally {
      c.release()
    }
    notify(row)
    res.json(row)
  })
  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError)
      return res
        .status(400)
        .json({ error: "Upload must be one photo up to 5 MB" })
    if (err.status) return res.status(err.status).json({ error: err.message })
    if (["23503", "23505"].includes(err.code))
      return res
        .status(409)
        .json({ error: "Referenced record is missing or already exists" })
    console.error(err.message)
    res.status(500).json({ error: "Unable to complete request" })
  })
  return app
}
