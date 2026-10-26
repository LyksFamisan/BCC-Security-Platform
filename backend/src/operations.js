import {reportNames,reportTable,reportTime,reportCsv,reportPdf} from "./report-export.js"
import {mountMobileSync} from "./mobile-sync.js"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import bcrypt from "bcryptjs"
import multer from "multer"
import sharp from "sharp"
import {encodePhoto,decodePhoto} from "./photo-storage.js"
import jwt from "jsonwebtoken"
import { createBackup, listBackups } from "./backups.js"
import {fileStore} from "./file-store.js"
import path from "node:path"
import { encryptionKey } from "./photo-storage.js"

const text = z.string().trim().min(1).max(300)
const note = z.string().trim().max(4000).default("")
const date = z.iso.datetime({ offset: true })
const optionalDate = date.nullable().default(null)
const uuid = z.uuid()
const assetStates = ["Available", "In Service", "Maintenance", "Retired"]
export const resources = {
  offline_attendance: {label:"Historical attendance reviews",group:"Manpower",write:[],own:true,subject:true,schema:z.object({}).strict()},
  shifts: {
    label: "Duty roster",
    group: "Manpower",
    write: ["operations", "supervisor"],
    own: true,
    subject: true,
    schema: z
      .object({
        title: text,
        start: date,
        end: date,
        post: text,
        instructions: z.string().trim().max(4000).optional(),
        status: z.enum(["Scheduled", "Cancelled"]).default("Scheduled"),
      })
      .strict(),
  },
  training: {
    label: "Training",
    group: "Manpower",
    write: ["operations"],
    own: true,
    subject: true,
    schema: z
      .object({
        title: text,
        completed_at: date,
        expires_at: optionalDate,
        notes: note,
      })
      .strict(),
  },
  certifications: {
    label: "Licenses & certifications",
    group: "Manpower",
    write: ["operations"],
    own: true,
    subject: true,
    schema: z
      .object({ title: text, number: text, expires_at: date, notes: note })
      .strict(),
  },
  assessments: {
    label: "Competency assessments",
    group: "Manpower",
    write: ["operations", "supervisor"],
    own: true,
    subject: true,
    schema: z
      .object({
        title: text,
        score: z.number().int().min(0).max(100),
        assessed_at: date,
        notes: note,
      })
      .strict(),
  },
  equipment: {
    label: "Equipment inventory",
    group: "Equipment",
    write: ["operations"],
    own: true,
    schema: z
      .object({
        title: text,
        serial: text,
        category: z.enum(["Radio", "Firearm", "Protective gear", "Uniform", "Communication device", "Security tools", "Vehicle", "Electronics", "Other"]),
        location_region: z.string().trim().max(100).default(""),
        location_city: z.string().trim().max(100).default(""),
        status: z.enum(assetStates),
        acquired_at: date,
        notes: note,
      })
      .strict(),
  },
  assignments: {
    label: "Equipment accountability",
    group: "Equipment",
    write: ["operations", "supervisor"],
    own: true,
    subject: true,
    schema: z
      .object({
        equipment_id: uuid,
        issued_at: date,
        returned_at: optionalDate,
        condition: text,
        acknowledged: z.boolean().default(false),
      })
      .strict(),
  },
  maintenance: {
    label: "Preventive maintenance",
    group: "Equipment",
    write: ["operations"],
    own: false,
    schema: z
      .object({
        equipment_id: uuid,
        title: text,
        due_at: date,
        status: z.enum(["Scheduled", "In Progress", "Completed"]),
        completed_at: optionalDate,
        notes: note,
      })
      .strict(),
  },
  defects: {
    label: "Fault & defect reports",
    group: "Equipment",
    write: ["operations", "supervisor", "guard"],
    own: true,
    schema: z
      .object({
        equipment_id: uuid,
        title: text,
        description: note,
        status: z
          .enum(["Reported", "In Progress", "Resolved"])
          .default("Reported"),
      })
      .strict(),
  },
  actions: {
    label: "Corrective & preventive actions",
    group: "Incidents",
    write: ["operations", "supervisor"],
    own: false,
    subject: true,
    schema: z
      .object({
        incident_id: uuid,
        title: text,
        type: z.enum(["Corrective", "Preventive"]),
        due_at: date,
        status: z.enum(["Open", "In Progress", "Completed"]),
        notes: note,
      })
      .strict(),
  },
  escalations: {
    label: "Escalations",
    group: "Incidents",
    write: ["operations", "supervisor"],
    own: false,
    subject: true,
    schema: z
      .object({
        incident_id: uuid,
        title: text,
        reason: text,
        due_at: date,
        status: z.enum(["Open", "Acknowledged", "Closed"]),
      })
      .strict(),
  },
}
const attendanceSchema = z
  .object({
    id:uuid.optional(),
    shift_id: uuid,
    event: z.enum(["in", "out"]),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(10000),
  })
  .strict()
const gpsSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(10000),
  })
  .strict()
function problem(status, message) {
  throw Object.assign(new Error(message), { status })
}
function valid(schema, value) {
  const p = schema.safeParse(value)
  if (!p.success)
    problem(
      400,
      p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    )
  return p.data
}
function role(req, allowed) {
  if (!allowed.includes(req.user.role)) problem(403, "Access denied")
}
function haversine(a, b, c, d) {
  const r = Math.PI / 180
  const x =
    Math.sin(((c - a) * r) / 2) ** 2 +
    Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}
export function mountOperations(app, pool, notify) {
  async function transaction(fn) {
    const c = await pool.connect()
    try {
      await c.query("BEGIN")
      const v = await fn(c)
      await c.query("COMMIT")
      return v
    } catch (e) {
      await c.query("ROLLBACK")
      throw e
    } finally {
      c.release()
    }
  }
  async function audit(
    c,
    user,
    action,
    record = null,
    site = null,
    details = {},
  ) {
    await c.query(
      "INSERT INTO operation_audit(actor_id,action,record_id,site_id,details) VALUES($1,$2,$3,$4,$5)",
      [user.id, action, record, site, JSON.stringify(details)],
    )
  }
  async function siteAccess(user, site, c = pool) {
    if (user.role === "admin")
      problem(403, "Operational records are restricted")
    if (!uuid.safeParse(site).success) problem(400, "Choose a valid site")
    const result = await c.query(
      user.role === "operations"
        ? "SELECT id FROM sites WHERE id=$1"
        : "SELECT site_id FROM user_sites WHERE site_id=$1 AND user_id=$2",
      user.role === "operations" ? [site] : [site, user.id],
    )
    if (!result.rows.length) problem(403, "Site is not assigned")
  }
  async function subjectAccess(id, site, c) {
    if (!id) return
    const r = await c.query(
      "SELECT u.id FROM users u JOIN user_sites us ON us.user_id=u.id LEFT JOIN account_controls ac ON ac.user_id=u.id WHERE u.id=$1 AND us.site_id=$2 AND u.role IN ('guard','supervisor','operations') AND COALESCE(ac.active,true)",
      [id, site],
    )
    if (!r.rows.length)
      problem(400, "Person must be active and assigned to the site")
  }
  function visibility(user, kind) {
    if (user.role === "admin") return { sql: "FALSE", args: [] }
    if (user.role === "operations") return { sql: "TRUE", args: [] }
    if (user.role === "supervisor")
      return {
        sql: "EXISTS(SELECT 1 FROM user_sites us WHERE us.site_id=r.site_id AND us.user_id=$1)",
        args: [user.id],
      }
    if (kind === "attendance" || kind === "gps" || resources[kind]?.own)
      return {
        sql:
          kind === "equipment"
            ? "EXISTS(SELECT 1 FROM operational_records a WHERE a.kind='assignments' AND a.subject_id=$1 AND a.data->>'equipment_id'=r.id::text AND a.data->>'returned_at' IS NULL)"
            : "(r.subject_id=$1 OR r.created_by=$1)",
        args: [user.id],
      }
    return { sql: "FALSE", args: [] }
  }
  async function list(user, kind, c = pool) {
    const v = visibility(user, kind)
    const attendanceKind=kind === "attendance"
    return (
      await c.query(
        `SELECT r.*,s.name AS site_name,u.name AS subject_name FROM operational_records r JOIN sites s ON s.id=r.site_id LEFT JOIN users u ON u.id=r.subject_id WHERE ${v.sql} AND ${attendanceKind ? "r.kind IN ('attendance','attendance_punch')" : "r.kind=$"+(v.args.length+1)} ORDER BY r.created_at DESC`,
        attendanceKind ? v.args : [...v.args, kind],
      )
    ).rows
  }
  async function find(req, kind, c = pool) {
    if (!uuid.safeParse(req.params.id).success) problem(404, "Record not found")
    const rows = await list(req.user, kind, c)
    const r = rows.find((r) => r.id === req.params.id)
    if (!r) problem(404, "Record not found")
    return r
  }
  async function validateLinks(kind, data, site, user, subject, id, c) {
    if (kind === "shifts") {
      const attended = await c.query(
        "SELECT id FROM operational_records WHERE kind IN ('attendance','attendance_punch') AND data->>'shift_id'=$1",
        [id],
      )
      if (attended.rows.length)
        problem(409, "Cannot change a shift after attendance has been recorded")
      if (new Date(data.end) <= new Date(data.start))
        problem(400, "Shift must end after it starts")
      if (data.status !== "Cancelled") {
        // Lock the person so two concurrent roster/attendance operations cannot race.
        await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [subject])
        const { rows } = await c.query(
          "SELECT id FROM operational_records WHERE kind='shifts' AND subject_id=$1 AND id<>$2 AND data->>'status'<>'Cancelled' AND (data->>'start')::timestamptz<$3::timestamptz AND (data->>'end')::timestamptz>$4::timestamptz",
          [subject, id, data.end, data.start],
        )
        if (rows.length) problem(409, "Person already has an overlapping shift")
      }
    }
    if (data.equipment_id) {
      const { rows } = await c.query(
        "SELECT * FROM operational_records WHERE id=$1 AND kind='equipment' AND site_id=$2 FOR UPDATE",
        [data.equipment_id, site],
      )
      if (!rows.length)
        problem(400, "Equipment must belong to the selected site")
      if (kind === "assignments" && !data.returned_at) {
        if (
          rows[0].data.status !== "Available" &&
          rows[0].data.status !== "In Service"
        )
          problem(409, "Equipment is unavailable")
        const open = await c.query(
          "SELECT id FROM operational_records WHERE kind='assignments' AND id<>$1 AND data->>'equipment_id'=$2 AND data->>'returned_at' IS NULL",
          [id, data.equipment_id],
        )
        if (open.rows.length) problem(409, "Equipment is already issued")
      }
      if (kind === "defects" && user.role === "guard") {
        const own = await c.query(
          "SELECT id FROM operational_records WHERE kind='assignments' AND subject_id=$1 AND data->>'equipment_id'=$2 AND data->>'returned_at' IS NULL",
          [user.id, data.equipment_id],
        )
        if (!own.rows.length)
          problem(403, "Report faults only for your assigned equipment")
      }
    }
    if (data.incident_id) {
      const { rows } = await c.query(
        "SELECT id FROM incidents WHERE id=$1 AND site_id=$2",
        [data.incident_id, site],
      )
      if (!rows.length)
        problem(400, "Incident must belong to the selected site")
    }
    if (
      kind === "assignments" &&
      data.returned_at &&
      new Date(data.returned_at) < new Date(data.issued_at)
    )
      problem(400, "Return cannot precede issue")
    if (
      kind === "maintenance" &&
      (data.status === "Completed") !== !!data.completed_at
    )
      problem(400, "Completed maintenance requires completion date")
    if (kind === "equipment" && data.status === "Retired") {
      const open = await c.query(
        "SELECT id FROM operational_records WHERE kind='assignments' AND data->>'equipment_id'=$1 AND data->>'returned_at' IS NULL",
        [id],
      )
      if (open.rows.length)
        problem(409, "Return issued equipment before retirement")
    }
  }
  mountMobileSync(app,pool,{transaction,siteAccess,audit,notify})
  app.get("/operations/catalog", (req, res) => {
    role(req, ["guard", "supervisor", "operations"])
    res.json(
      Object.entries(resources)
        .filter(([, v]) => req.user.role !== "guard" || v.own)
        .map(([key, v]) => ({
          key,
          label: v.label,
          group: v.group,
          writable: v.write.includes(req.user.role),
          requires_subject: !!v.subject,
          schema: z.toJSONSchema(v.schema),
        })),
    )
  })
  app.get("/operations/:kind", async (req, res) => {
    const kind = req.params.kind
    if (!resources[kind] && !["attendance", "gps"].includes(kind))
      problem(404, "Module not found")
    role(req, ["guard", "supervisor", "operations"])
    if (req.user.role === "guard" && resources[kind] && !resources[kind].own)
      problem(403, "Access denied")
    res.json(await list(req.user, kind))
  })
  app.post("/operations/:kind", async (req, res) => {
    const kind = req.params.kind,
      def = resources[kind]
    if (!def) problem(404, "Module not found")
    role(req, def.write)
    const body = valid(
        z
          .object({
            site_id: uuid,
            subject_id: uuid.nullable().optional(),
            data: z.unknown(),
          })
          .strict(),
        req.body,
      ),
      data = valid(def.schema, body.data),
      id = randomUUID()
    if (
      req.user.role === "guard" &&
      kind === "defects" &&
      data.status !== "Reported"
    )
      problem(403, "Guards submit faults; supervisors manage resolution")
    if (kind === "assignments" && data.acknowledged)
      problem(400, "Only the recipient can acknowledge receipt")
    const subject = def.subject
      ? body.subject_id
      : req.user.role === "guard"
        ? req.user.id
        : null
    if (def.subject && !subject) problem(400, "Choose a person")
    const row = await transaction(async (c) => {
      await siteAccess(req.user, body.site_id, c)
      await subjectAccess(subject, body.site_id, c)
      await validateLinks(kind, data, body.site_id, req.user, subject, id, c)
      const r = (
        await c.query(
          "INSERT INTO operational_records(id,kind,site_id,subject_id,created_by,data) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
          [id, kind, body.site_id, subject, req.user.id, JSON.stringify(data)],
        )
      ).rows[0]
      await audit(c, req.user, "CREATE_" + kind, id, body.site_id, { data })
      return r
    })
    notify({ site_id: row.site_id, reporter_id: row.subject_id || req.user.id })
    res.status(201).json(row)
  })
  app.patch("/operations/:kind/:id", async (req, res) => {
    const kind = req.params.kind,
      def = resources[kind]
    if (!def) problem(404, "Module not found")
    role(
      req,
      def.write.filter((r) => r !== "guard"),
    )
    const body = valid(
        z
          .object({ version: z.number().int().positive(), data: z.unknown() })
          .strict(),
        req.body,
      ),
      data = valid(def.schema, body.data)
    const row = await transaction(async (c) => {
      const old = await find(req, kind, c)
      if (
        kind === "assignments" &&
        (data.acknowledged !== old.data.acknowledged ||
          data.equipment_id !== old.data.equipment_id)
      )
        problem(
          400,
          "Equipment and recipient acknowledgment cannot be replaced",
        )
      await validateLinks(
        kind,
        data,
        old.site_id,
        req.user,
        old.subject_id,
        old.id,
        c,
      )
      const r = (
        await c.query(
          "UPDATE operational_records SET data=$1,version=version+1,updated_at=now() WHERE id=$2 AND version=$3 RETURNING *",
          [JSON.stringify(data), old.id, body.version],
        )
      ).rows[0]
      if (!r) problem(409, "Record changed. Refresh before saving")
      await audit(c, req.user, "UPDATE_" + kind, r.id, r.site_id, {
        before: old.data,
        after: data,
      })
      return r
    })
    notify({ site_id: row.site_id, reporter_id: row.subject_id || req.user.id })
    res.json(row)
  })
  app.post("/equipment/:id/acknowledge", async (req, res) => {
    role(req, ["guard"])
    const row = await transaction(async (c) => {
      const old = await find(req, "assignments", c)
      if (old.subject_id !== req.user.id || old.data.returned_at)
        problem(403, "Only the current recipient can acknowledge")
      const r = (
        await c.query(
          "UPDATE operational_records SET data=jsonb_set(data,'{acknowledged}','true'),version=version+1,updated_at=now() WHERE id=$1 RETURNING *",
          [old.id],
        )
      ).rows[0]
      await audit(c, req.user, "ACKNOWLEDGE_EQUIPMENT", r.id, r.site_id)
      return r
    })
    notify({ site_id: row.site_id, reporter_id: req.user.id })
    res.json(row)
  })
  const attendanceUpload = multer({storage:multer.memoryStorage(),limits:{fileSize:Math.min(Number(process.env.MAX_UPLOAD_BYTES || 3*1024*1024),3*1024*1024),files:1,fields:6},fileFilter:(req,file,cb)=>cb(null,["image/jpeg","image/png","image/webp"].includes(file.mimetype))})
  app.get("/attendance/:id/photo", async (req,res) => {
    role(req,["guard","supervisor","operations"])
    const id=valid(uuid,req.params.id)
    const row=(await pool.query("SELECT * FROM operational_records WHERE id=$1 AND kind IN ('attendance','attendance_punch','offline_attendance')",[id])).rows[0]
    if(!row) problem(404,"Attendance not found")
    await siteAccess(req.user,row.site_id)
    if(req.user.role === "guard" && row.subject_id !== req.user.id) problem(403,"Own attendance only")
    if(!row.data.photo_id) problem(404,"No attendance photo")
    const bytes=await fileStore(pool).read("evidence/"+row.data.photo_id+".jpg")
    await audit(pool,req.user,"VIEW_ATTENDANCE_PHOTO",row.id,row.site_id)
    res.set({"Content-Type":"image/jpeg","Cache-Control":"private, no-store"}).send(decodePhoto(bytes))
  })
  app.post("/attendance", (req,res,next)=>{role(req,["guard"]);next()}, attendanceUpload.single("photo"), async (req, res) => {
    const body={...req.body}
    for(const key of ["latitude","longitude","accuracy"]) if(typeof body[key] === "string" && body[key].trim() !== "") body[key]=Number(body[key])
    const d = valid(attendanceSchema, body)
    if(!req.file) problem(400,"A time-in/time-out photo (JPEG, PNG or WebP, max 3 MB) is required")
    let source
    try {
      const input=sharp(req.file.buffer,{limitInputPixels:25000000})
      if(!["jpeg","png","webp"].includes((await input.metadata()).format)) throw Error()
      source=await input.rotate().resize({width:1000,height:1400,fit:"inside"}).jpeg({quality:85}).toBuffer()
    } catch { problem(400,"Invalid attendance photo") }
    let storedPhoto
    let row
    try { row = await transaction(async (c) => {
      await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        req.user.id,
      ])
      if(d.id){const old=(await c.query("SELECT * FROM operational_records WHERE id=$1",[d.id])).rows[0];if(old){if(old.kind!=="attendance_punch" || old.subject_id!==req.user.id || old.data.shift_id!==d.shift_id || old.data.event!==d.event)problem(409,"Capture ID already used");await siteAccess(req.user,old.site_id,c);return old}}
      const shift = (
        await c.query(
          "SELECT * FROM operational_records WHERE id=$1 AND kind='shifts' AND subject_id=$2",
          [d.shift_id, req.user.id],
        )
      ).rows[0]
      if (!shift) problem(404, "Shift not found")
      await siteAccess(req.user, shift.site_id, c)
      if (shift.data.status === "Cancelled") problem(409, "Shift cancelled")
      const now = Date.now()
      if (
        d.event === "in" &&
        (now < new Date(shift.data.start).getTime() - 30 * 60000 ||
          now > new Date(shift.data.end).getTime())
      )
        problem(
          409,
          "Check-in is available 30 minutes before the shift until its end",
        )
      const history = await c.query(
        "SELECT data FROM operational_records WHERE kind IN ('attendance','attendance_punch') AND subject_id=$1 AND data->>'shift_id'=$2",
        [req.user.id, shift.id],
      )
      const lastCycle=history.rows.reduce((n,r)=>Math.max(n,Number(r.data.cycle || 1)),0)
      const current=history.rows.filter(r=>Number(r.data.cycle || 1) === lastCycle)
      const open=current.some(r=>r.data.event === "in") && !current.some(r=>r.data.event === "out")
      if(d.event !== (open ? "out" : "in")) problem(409,open ? "Time Out is required before another Time In" : "Time In is required before Time Out")
      const cycle=open ? lastCycle : lastCycle+1
      const settings = (
        await c.query("SELECT * FROM site_settings WHERE site_id=$1", [
          shift.site_id,
        ])
      ).rows[0]
      const hasGeofence=!!settings && settings.latitude != null && settings.longitude != null
      if(d.accuracy > (hasGeofence ? Math.min(settings.radius_m,100) : 100))
        problem(400,"Location accuracy is too low. Try again outdoors")
      const distance=hasGeofence ? haversine(settings.latitude,settings.longitude,d.latitude,d.longitude) : null
      if(hasGeofence && distance > settings.radius_m)
        problem(403,"You are outside the assigned site geofence")
      const geofence_status=hasGeofence ? "Inside" : "Not configured"
      const geofence_label=hasGeofence ? `Inside site geofence · ${Math.round(distance)} m from centre · radius ${settings.radius_m} m` : "Geofence not configured · GPS location captured"
      const recorded_at=new Date().toISOString(), photo_id=randomUUID()
      const siteName=(await c.query("SELECT name FROM sites WHERE id=$1",[shift.site_id])).rows[0]?.name || "Assigned site"
      const location_label=siteName+" · "+shift.data.post
      const xml=value=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]))
      const width=(await sharp(source).metadata()).width
      const stamp=`<svg width="${width}" height="144"><rect width="100%" height="100%" fill="#071a2c"/><g fill="white" font-family="sans-serif" font-size="18"><text x="16" y="28">${d.event === "in" ? "TIME IN" : "TIME OUT"} · ${new Date(recorded_at).toLocaleString("en-PH",{timeZone:"Asia/Manila",hour12:false})} (Asia/Manila)</text><text x="16" y="58">GPS ${d.latitude.toFixed(6)}, ${d.longitude.toFixed(6)} · accuracy ±${Math.round(d.accuracy)} m</text><text x="16" y="88">${xml(location_label.slice(0,90))}</text><text x="16" y="120">${geofence_label}</text></g></svg>`
      const image=await sharp(source).extend({bottom:144,background:"#071a2c"}).composite([{input:Buffer.from(stamp),gravity:"south"}]).jpeg({quality:85}).toBuffer()
      storedPhoto="evidence/"+photo_id+".jpg"
      await fileStore(c).write(storedPhoto,encodePhoto(image))
      const data = {...d,cycle,location_label,recorded_at,distance_m:distance===null?null:Math.round(distance),radius_m:hasGeofence?settings.radius_m:null,geofence_status,photo_id}
      const r = (
        await c.query(
          "INSERT INTO operational_records(id,kind,site_id,subject_id,created_by,data) VALUES($1,'attendance_punch',$2,$3,$3,$4) RETURNING *",
          [d.id || randomUUID(), shift.site_id, req.user.id, JSON.stringify(data)],
        )
      ).rows[0]
      await audit(
        c,
        req.user,
        "ATTENDANCE_" + d.event.toUpperCase(),
        r.id,
        r.site_id,
        { shift_id: shift.id },
      )
      return r
    }) } catch(error) {
      if(storedPhoto && process.env.FILE_STORAGE !== "postgres") await fileStore(pool).remove(storedPhoto).catch(()=>{})
      throw error
    }
    notify({ site_id: row.site_id, reporter_id: req.user.id })
    res.status(201).json(row)
  })
  app.post("/location/check-in", async (req, res) => {
    role(req, ["guard"])
    const d = valid(
      z.object({ site_id: uuid, location: gpsSchema }).strict(),
      req.body,
    )
    await siteAccess(req.user, d.site_id)
    const row = await transaction(async (c) => {
      const settings = (await c.query("SELECT * FROM site_settings WHERE site_id=$1", [d.site_id])).rows[0]
      let geofence = { geofence_status: "Not configured", distance_m: null, radius_m: null }
      if (settings?.latitude != null && settings?.longitude != null) {
        const distance = haversine(settings.latitude, settings.longitude, d.location.latitude, d.location.longitude)
        const accuracy = d.location.accuracy
        geofence = {
          geofence_status: accuracy > Math.min(settings.radius_m, 100) ? "Uncertain" : distance + accuracy <= settings.radius_m ? "Inside" : distance - accuracy > settings.radius_m ? "Outside" : "Uncertain",
          distance_m: Math.round(distance),
          radius_m: settings.radius_m,
        }
      }
      const r = (
        await c.query(
          "INSERT INTO operational_records(id,kind,site_id,subject_id,created_by,data) VALUES($1,'gps',$2,$3,$3,$4) RETURNING *",
          [
            randomUUID(),
            d.site_id,
            req.user.id,
            JSON.stringify({
              ...d.location,
              ...geofence,
              recorded_at: new Date().toISOString(),
            }),
          ],
        )
      ).rows[0]
      await audit(c, req.user, "GPS_CHECK_IN", r.id, r.site_id)
      return r
    })
    notify({ site_id: row.site_id, reporter_id: req.user.id })
    res.status(201).json(row)
  })
  async function snapshot(user) {
    const kinds = Object.keys(resources).concat(["attendance", "gps"])
    const values = await Promise.all(kinds.map((k) => list(user, k)))
    const records = Object.fromEntries(kinds.map((k, i) => [k, values[i]]))
    const s =
      user.role === "operations"
        ? { sql: "TRUE", args: [] }
        : user.role === "supervisor"
          ? {
              sql: "EXISTS(SELECT 1 FROM user_sites us WHERE us.site_id=i.site_id AND us.user_id=$1)",
              args: [user.id],
            }
          : { sql: "i.reporter_id=$1", args: [user.id] }
    const incidents = (
      await pool.query(
        `SELECT i.*,s.name AS site_name FROM incidents i JOIN sites s ON s.id=i.site_id WHERE ${s.sql}`,
        s.args,
      )
    ).rows
    const sites = (
      await pool.query(
        user.role === "operations"
          ? "SELECT s.id,s.name,ss.* FROM sites s LEFT JOIN site_settings ss ON ss.site_id=s.id"
          : "SELECT s.id,s.name,ss.* FROM sites s JOIN user_sites us ON us.site_id=s.id LEFT JOIN site_settings ss ON ss.site_id=s.id WHERE us.user_id=$1",
        user.role === "operations" ? [] : [user.id],
      )
    ).rows
    return { records, incidents, sites }
  }
  const startReminder=(start,now)=>+new Date(start)>=now && +new Date(start)<=now+30*60000
  function alertsFor(data, user) {
    const now = Date.now(),
      alerts = []
    function add(key, title, site, subject = null) {
      alerts.push({ key, title, site_id: site, subject_id: subject })
    }
    // Only the latest recent sample per guard/site can raise a boundary alert.
    const latestLocations = new Map()
    for (const point of data.records.gps) {
      const key = point.subject_id + ":" + point.site_id
      if (!latestLocations.has(key) || +new Date(point.data.recorded_at) > +new Date(latestLocations.get(key).data.recorded_at)) latestLocations.set(key, point)
    }
    for (const point of latestLocations.values()) {
      const age = now - +new Date(point.data.recorded_at)
      const onDuty = data.records.shifts.some(s => s.subject_id === point.subject_id && s.site_id === point.site_id && s.data.status !== "Cancelled" && +new Date(s.data.start) <= now && +new Date(s.data.end) > now && data.records.attendance.some(a=>a.data.shift_id===s.id && a.data.event==="in" && !data.records.attendance.some(o=>o.data.shift_id===s.id && Number(o.data.cycle||1)===Number(a.data.cycle||1) && o.data.event==="out")))
      if (point.data.geofence_status === "Outside" && age >= 0 && age < 15 * 60000 && onDuty)
        add("geofence:" + point.id, `Outside site boundary: ${point.subject_name || "Guard"} · ${point.site_name}`, point.site_id, point.subject_id)
    }
    for(const r of data.records.offline_attendance) if(r.data.status === "Pending review") add("offline:"+r.id,"Offline attendance needs review: "+(r.subject_name || "Your capture"),r.site_id,r.subject_id)
    for (const shift of data.records.shifts) {
      if (shift.data.status === "Cancelled") continue
      if(+new Date(shift.data.end)<now-86400000)continue
      add("shift:"+shift.id+":"+shift.version,`Duty assignment: ${shift.site_name} · ${shift.data.post} · ${new Date(shift.data.start).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}`,shift.site_id,shift.subject_id)
      if(startReminder(shift.data.start,now)) add("reminder:"+shift.id,"Shift starts within 30 minutes: "+shift.data.post,shift.site_id,shift.subject_id)
      const start = +new Date(shift.data.start),
        end = +new Date(shift.data.end)
      if (
        start < now &&
        end > now &&
        !data.records.attendance.some(
          (a) => a.data.shift_id === shift.id && a.data.event === "in",
        )
      )
        add(
          "absent:" + shift.id,
          `Missing check-in: ${shift.subject_name}`,
          shift.site_id,
          shift.subject_id,
        )
    }
    if (user.role !== "guard")
      for (const site of data.sites) {
        const active = data.records.shifts.filter(
          (s) =>
            s.site_id === site.id &&
            s.data.status !== "Cancelled" &&
            +new Date(s.data.start) <= now &&
            +new Date(s.data.end) > now,
        )
        const expected = site.required_guards || 1
        if (active.length < expected)
          add("shortage:" + site.id, "Understaffed: " + site.name, site.id)
      }
    if (user.role !== "guard")
      for (const m of data.records.maintenance)
        if (m.data.status !== "Completed" && +new Date(m.data.due_at) < now)
          add(
            "maintenance:" + m.id,
            "Overdue maintenance: " + m.data.title,
            m.site_id,
          )
    for (const c of data.records.certifications)
      if (+new Date(c.data.expires_at) < now + 30 * 86400000)
        add(
          "license:" + c.id,
          "License expiring: " + c.data.title,
          c.site_id,
          c.subject_id,
        )
    for (const a of data.records.assignments)
      if (!a.data.returned_at && !a.data.acknowledged)
        add(
          "issue:" + a.id,
          "Equipment receipt awaiting acknowledgment",
          a.site_id,
          a.subject_id,
        )
    for (const d of data.records.defects)
      if (d.data.status !== "Resolved")
        add(
          "defect:" + d.id,
          "Equipment issue: " + d.data.title,
          d.site_id,
          d.subject_id || d.created_by,
        )
    for(const i of data.incidents) add("incident:"+i.id+":"+i.version,`Incident update: ${i.title} · ${i.status}`,i.site_id,i.reporter_id)
    for (const i of data.incidents)
      if (i.status !== "Resolved" && i.due_at && +new Date(i.due_at) < now)
        add(
          "sla:" + i.id,
          "Overdue incident: " + i.title,
          i.site_id,
          i.reporter_id,
        )
    for (const a of [...data.records.actions, ...data.records.escalations])
      if (
        !["Completed", "Closed"].includes(a.data.status) &&
        +new Date(a.data.due_at) < now
      )
        add(
          "action:" + a.id,
          "Overdue: " + a.data.title,
          a.site_id,
          a.subject_id,
        )
    return alerts
  }
  const integrationSchema = z
    .object({ enabled: z.boolean(), source_name: text })
    .strict()
  app.get("/system/integrations", async (req, res) => {
    role(req, ["admin"])
    res.json(
      (
        await pool.query(
          "SELECT value FROM technical_settings WHERE key='timekeeping'",
        )
      ).rows[0]?.value || { enabled: false, source_name: "Timekeeping import" },
    )
  })
  app.put("/system/integrations", async (req, res) => {
    role(req, ["admin"])
    const d = valid(integrationSchema, req.body)
    await transaction(async (c) => {
      await c.query(
        "INSERT INTO technical_settings(key,value,updated_by) VALUES('timekeeping',$1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=now()",
        [JSON.stringify(d), req.user.id],
      )
      await audit(c, req.user, "CONFIGURE_TIMEKEEPING", null, null, d)
    })
    res.json(d)
  })
  app.post("/integrations/attendance", async (req, res) => {
    role(req, ["operations"])
    const config = (
      await pool.query(
        "SELECT value FROM technical_settings WHERE key='timekeeping'",
      )
    ).rows[0]?.value
    if (!config?.enabled)
      problem(409, "Enable timekeeping import in System Administration first")
    const body = valid(
      z
        .object({
          events: z
            .array(
              z
                .object({
                  external_id: text,
                  shift_id: uuid,
                  event: z.enum(["in", "out"]),
                  recorded_at: date,
                })
                .strict(),
            )
            .min(1)
            .max(100),
        })
        .strict(),
      req.body,
    )
    const result = await transaction(async (c) => {
      let imported = 0,
        duplicates = 0
      for (const event of body.events) {
        const shift = (
          await c.query(
            "SELECT * FROM operational_records WHERE id=$1 AND kind='shifts' FOR UPDATE",
            [event.shift_id],
          )
        ).rows[0]
        if (!shift || shift.data.status === "Cancelled")
          problem(400, "Valid scheduled shift required")
        await subjectAccess(shift.subject_id, shift.site_id, c)
        await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
          shift.subject_id,
        ])
        const old = (
          await c.query(
            "SELECT data FROM operational_records WHERE kind IN ('attendance','attendance_punch') AND data->>'external_id'=$1",
            [event.external_id],
          )
        ).rows[0]
        if (old) {
          if (
            old.data.shift_id !== event.shift_id ||
            old.data.event !== event.event ||
            old.data.recorded_at !== event.recorded_at
          )
            problem(
              409,
              "External ID already refers to another attendance event",
            )
          duplicates++
          continue
        }
        if (+new Date(event.recorded_at) > Date.now() + 300000)
          problem(400, "Attendance cannot be in the future")
        if (
          event.event === "in" &&
          (+new Date(event.recorded_at) <
            +new Date(shift.data.start) - 1800000 ||
            +new Date(event.recorded_at) > +new Date(shift.data.end))
        )
          problem(400, "Imported check-in must match the shift window")
        const history = (
          await c.query(
            "SELECT data FROM operational_records WHERE kind IN ('attendance','attendance_punch') AND data->>'shift_id'=$1",
            [shift.id],
          )
        ).rows
        if (history.some((r) => r.data.event === event.event))
          problem(409, "Shift event already recorded")
        if (
          event.event === "out" &&
          (!history.some((r) => r.data.event === "in") ||
            history.some(
              (r) =>
                r.data.event === "in" &&
                +new Date(r.data.recorded_at) > +new Date(event.recorded_at),
            ))
        )
          problem(409, "Check-out must follow check-in")
        const id = randomUUID()
        await c.query(
          "INSERT INTO operational_records(id,kind,site_id,subject_id,created_by,data) VALUES($1,'attendance',$2,$3,$4,$5)",
          [
            id,
            shift.site_id,
            shift.subject_id,
            req.user.id,
            JSON.stringify({ ...event, source: config.source_name }),
          ],
        )
        await audit(c, req.user, "IMPORT_ATTENDANCE", id, shift.site_id, {
          external_id: event.external_id,
          source: config.source_name,
        })
        imported++
      }
      return { imported, duplicates }
    })
    notify({ site_id: "", reporter_id: req.user.id })
    res.json(result)
  })
  app.get("/notifications", async (req, res) => {
    role(req, ["guard", "supervisor", "operations"])
    const data = await snapshot(req.user),
      alerts = alertsFor(data, req.user),
      read = new Set(
        (
          await pool.query(
            "SELECT notification_key FROM notification_reads WHERE user_id=$1",
            [req.user.id],
          )
        ).rows.map((r) => r.notification_key),
      )
    res.json(alerts.map((a) => ({ ...a, read: read.has(a.key) })))
  })
  app.post("/notifications/read", async (req, res) => {
    role(req, ["guard", "supervisor", "operations"])
    const { key } = valid(z.object({ key: text }).strict(), req.body)
    await pool.query(
      "INSERT INTO notification_reads(user_id,notification_key) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [req.user.id, key],
    )
    res.json({ ok: true })
  })
  async function dashboardFor(user) {
    const data = await snapshot(user),
      now = Date.now(),
      today = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())
    const active = data.records.shifts.filter(
      (s) =>
        s.data.status !== "Cancelled" &&
        +new Date(s.data.start) <= now &&
        +new Date(s.data.end) > now,
    )
    const checked = new Set(
      data.records.attendance
        .filter(
          (a) =>
            a.data.event === "in" &&
            !data.records.attendance.some(
              (o) =>
                o.data.shift_id === a.data.shift_id && o.subject_id === a.subject_id && Number(o.data.cycle || 1) === Number(a.data.cycle || 1) && o.data.event === "out",
            ),
        )
        .map((a) => a.subject_id),
    )
    const trends = {}
    for (const i of data.incidents) {
      const day = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(i.created_at))
      trends[day] = (trends[day] || 0) + 1
    }
    const result = {
      as_of: new Date().toISOString(),
      sites: data.sites.map((s) => ({
        id: s.id,
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
        radius_m: s.radius_m,
        client_name: user.role === "guard" ? undefined : s.client_name,
        required: s.required_guards || 1,
        scheduled: active.filter((a) => a.site_id === s.id).length,
        present: active.filter(
          (a) => a.site_id === s.id && checked.has(a.subject_id),
        ).length,
      })),
      counts: {
        incidents: data.incidents.length,
        open_incidents: data.incidents.filter((i) => i.status !== "Resolved")
          .length,
        on_duty: checked.size,
        scheduled: active.length,
        equipment: data.records.equipment.length,
        issued_equipment: data.records.assignments.filter(
          (a) => !a.data.returned_at,
        ).length,
        overdue_incidents: data.incidents.filter(
          (i) =>
            i.status !== "Resolved" && i.due_at && +new Date(i.due_at) < now,
        ).length,
        attendance_today: data.records.attendance.filter((a) =>
          new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(a.data.recorded_at)) === today,
        ).length,
      },
      kpi: {
        resolved_incidents: data.incidents.filter(
          (i) => i.status === "Resolved",
        ).length,
        sla_met: data.incidents.filter(
          (i) =>
            i.resolved_at &&
            i.due_at &&
            +new Date(i.resolved_at) <= +new Date(i.due_at),
        ).length,
        scheduled_hours:
          Math.round(
            data.records.shifts
              .filter((s) => s.data.status !== "Cancelled")
              .reduce(
                (sum, s) =>
                  sum +
                  (+new Date(s.data.end) - +new Date(s.data.start)) / 3600000,
                0,
              ) * 100,
          ) / 100,
        recorded_hours:
          Math.round(
            data.records.attendance
              .filter((a) => a.data.event === "out")
              .reduce((sum, a) => {
                const start = data.records.attendance.find(
                  (i) =>
                    i.data.event === "in" &&
                    i.data.shift_id === a.data.shift_id && i.subject_id === a.subject_id && Number(i.data.cycle || 1) === Number(a.data.cycle || 1),
                )
                return (
                  sum +
                  (start
                    ? (+new Date(a.data.recorded_at) -
                        +new Date(start.data.recorded_at)) /
                      3600000
                    : 0)
                )
              }, 0) * 100,
          ) / 100,
      },
      incident_trend: trends,
      alerts: alertsFor(data, user),
    }
    return result
  }
  app.get("/dashboard",async(req,res)=>{role(req,["guard","supervisor","operations"]);res.json(await dashboardFor(req.user))})
  app.get("/reports/export", async (req, res) => {
    role(req, ["supervisor", "operations"])
    const kind = req.query.kind
    if(typeof kind!=="string" || !Object.hasOwn(reportNames,kind))problem(400,"Select a valid report")
    const format=req.query.format || "csv"
    if(!["csv","pdf"].includes(format))problem(400,"Choose PDF or CSV")
    const filters = valid(
      z
        .object({
          site_id: uuid.optional(),
          from: date.optional(),
          to: date.optional(),
        })
        .strict(),
      Object.fromEntries(
        // Vercel can append its catch-all routing parameter to the query. It is not a report filter.
        Object.entries(req.query).filter(([k]) => !["kind","format","path"].includes(k)),
      ),
    )
    if(filters.from&&filters.to&&+new Date(filters.from)>+new Date(filters.to))problem(400,"From date must be before To date")
    if(filters.site_id)await siteAccess(req.user,filters.site_id)
    const data=kind==='incidents'?await snapshot(req.user):null
    let rows=kind==='overview'?[]:kind==='incidents'?data.incidents:await list(req.user,kind==='billing'?'attendance':kind)
    const dateKey={attendance:'recorded_at',billing:'recorded_at',shifts:'start',training:'completed_at',assessments:'assessed_at',certifications:'expires_at',gps:'recorded_at',assignments:'issued_at',maintenance:'due_at',actions:'due_at',escalations:'due_at',equipment:'acquired_at'}[kind]
    const recordDate=r=>r.data?.[dateKey] || r.created_at
    if(filters.site_id)rows=rows.filter(r=>r.site_id===filters.site_id)
    if(filters.from)rows=rows.filter(r=>+new Date(recordDate(r))>=+new Date(filters.from))
    if(filters.to)rows=rows.filter(r=>+new Date(recordDate(r))<=+new Date(filters.to))
    const related={equipment:await list(req.user,'equipment'),shifts:await list(req.user,'shifts'),incidents:(await snapshot(req.user)).incidents}
    let table=reportTable(kind,rows,related)
    if(kind==='overview'){
      if(filters.from||filters.to||filters.site_id)problem(400,'Overview export is a current snapshot. Use a detailed report for date/site filters.')
      const summary=await dashboardFor(req.user)
      const labels={incidents:'Total incidents',open_incidents:'Unresolved incidents',on_duty:'Guards on duty now',scheduled:'Active duty schedules',equipment:'Equipment items',issued_equipment:'Equipment currently issued',overdue_incidents:'Incidents past target time',attendance_today:'Time In / Out events today',resolved_incidents:'Resolved incidents',sla_met:'Resolved within target time',scheduled_hours:'Scheduled hours (all dates)',recorded_hours:'Recorded hours (all dates)'}
      table=[['Section','Site / metric','Value','Required guards','Scheduled guards','Guards present'],...Object.entries({...summary.counts,...summary.kpi}).map(([key,value])=>['Summary',labels[key] || key,value,'','','']),...summary.sites.map(r=>['Site coverage',r.name,r.client_name || '',r.required,r.scheduled,r.present]),...Object.entries(summary.incident_trend).sort(([a],[b])=>a.localeCompare(b)).map(([day,count])=>['Daily incidents',day,count,'','',''])]
    }
    if(kind === "billing") {
      const shifts=await list(req.user,"shifts")
      const groups=new Map()
      for(const row of rows) {
        const key=row.subject_id+":"+row.data.shift_id+":"+(row.data.cycle || 1)
        if(!groups.has(key)) groups.set(key,{row})
        const g=groups.get(key)
        if(row.data.event === "in") g.in=row
        if(row.data.event === "out") g.out=row
      }
      table=[["Shift reference","Cycle","Site","Guard","Duty post","Time In (Philippine time)","Time Out (Philippine time)","Recorded hours","Review status","Time In latitude","Time In longitude","Time Out latitude","Time Out longitude","Time In photo reference","Time Out photo reference"],...Array.from(groups.values()).map(g=>{
        const a=g.in?.data,b=g.out?.data,shift=shifts.find(s=>s.id === g.row.data.shift_id)
        const hours=a&&b ? (+new Date(b.recorded_at)- +new Date(a.recorded_at))/3600000 : null
        return [g.row.data.shift_id,g.row.data.cycle || 1,g.row.site_name,g.row.subject_name,shift?.data.post || "",reportTime(a?.recorded_at),reportTime(b?.recorded_at),hours === null ? "" : Math.max(0,hours).toFixed(4),g.row.data.demo ? "DEMO - exclude from actual billing" : hours === null ? "Incomplete - review required" : "Recorded hours - review required",a?.latitude ?? "",a?.longitude ?? "",b?.latitude ?? "",b?.longitude ?? "",a?.photo_id ? g.in.id : "",b?.photo_id ? g.out.id : ""]
      })]
    }
    await audit(pool,req.user,"EXPORT_"+kind,null,filters.site_id || null,{count:table.length-1,format,filters})
    const scope=filters.site_id?(await pool.query('SELECT name FROM sites WHERE id=$1',[filters.site_id])).rows[0]?.name:'All authorized sites'
    res.set({'Content-Type':format==='pdf'?'application/pdf':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${kind}.${format}"`,'Cache-Control':'private, no-store'})
    if(format==='pdf')return res.send(await reportPdf({title:reportNames[kind],table,scope,from:filters.from,to:filters.to,actor:req.user.name}))
    res.send(reportCsv(table))
  })

  app.get("/preferences", async (req, res) =>
    res.json(
      (
        await pool.query("SELECT data FROM user_preferences WHERE user_id=$1", [
          req.user.id,
        ])
      ).rows[0]?.data || {},
    ),
  )
  app.put("/preferences", async (req, res) => {
    const d = valid(
      z
        .object({
          dashboard: z
            .array(z.enum(["incidents", "attendance", "equipment", "sites"]))
            .max(4),
          report_kind: z.enum(Object.keys(reportNames)),

        })
        .strict(),
      req.body,
    )
    role(req, ["supervisor", "operations"])
    await pool.query(
      "INSERT INTO user_preferences(user_id,data) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data",
      [req.user.id, JSON.stringify(d)],
    )
    res.json(d)
  })
  app.get("/system/users", async (req, res) => {
    role(req, ["admin"])
    res.json(
      (
        await pool.query(
          "SELECT u.id,u.name,u.email,u.role,COALESCE(ac.active,true) AS active,ARRAY(SELECT site_id FROM user_sites WHERE user_id=u.id) AS site_ids FROM users u LEFT JOIN account_controls ac ON ac.user_id=u.id ORDER BY u.name",
        )
      ).rows,
    )
  })
  app.get("/system/sites", async (req, res) => {
    role(req, ["admin"])
    res.json(
      (
        await pool.query(
          "SELECT s.*,ss.client_name,ss.required_guards,ss.latitude,ss.longitude,ss.radius_m FROM sites s LEFT JOIN site_settings ss ON ss.site_id=s.id ORDER BY s.name",
        )
      ).rows,
    )
  })
  const siteSchema = z
    .object({
      name: text,
      client_name: z.string().trim().max(300),
      required_guards: z.number().int().min(1).max(10000),
      latitude: z.number().min(-90).max(90).nullable(),
      longitude: z.number().min(-180).max(180).nullable(),
      radius_m: z.number().int().min(20).max(10000),
    })
    .strict()
    .refine(
      (d) => (d.latitude === null) === (d.longitude === null),
      "Set both latitude and longitude",
    )
  async function saveSite(req, res) {
    role(req, ["admin"])
    const d = valid(siteSchema, req.body),
      id = req.params.id || randomUUID()
    valid(uuid, id)
    await transaction(async (c) => {
      if (req.params.id) {
        if (
          !(
            await c.query("UPDATE sites SET name=$1 WHERE id=$2 RETURNING id", [
              d.name,
              id,
            ])
          ).rows.length
        )
          problem(404, "Site not found")
      } else
        await c.query("INSERT INTO sites(id,name) VALUES($1,$2)", [id, d.name])
      await c.query(
        "INSERT INTO site_settings(site_id,client_name,required_guards,latitude,longitude,radius_m) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(site_id) DO UPDATE SET client_name=EXCLUDED.client_name,required_guards=EXCLUDED.required_guards,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,radius_m=EXCLUDED.radius_m",
        [
          id,
          d.client_name,
          d.required_guards,
          d.latitude,
          d.longitude,
          d.radius_m,
        ],
      )
      await audit(c, req.user, "CONFIGURE_SITE", id, id, { name: d.name })
    })
    res.status(req.params.id ? 200 : 201).json({ id, ...d })
  }
  app.post("/system/sites", saveSite)
  app.put("/system/sites/:id", saveSite)
  const userSchema = z
    .object({
      name: text,
      email: z.email(),
      role: z.enum(["admin", "operations", "supervisor", "guard"]),
      password: z.string().min(12).max(128).optional(),
      active: z.boolean(),
      site_ids: z.array(uuid).max(100),
    })
    .strict()
  async function saveUser(req, res) {
    role(req, ["admin"])
    const d = valid(userSchema, req.body),
      id = req.params.id || randomUUID()
    valid(uuid, id)
    if (!req.params.id && !d.password)
      problem(400, "A password of 12 or more characters is required")
    if (id === req.user.id && (!d.active || d.role !== "admin"))
      problem(409, "Cannot disable or demote your own administrator account")
    const hash = d.password ? await bcrypt.hash(d.password, 12) : null
    await transaction(async (c) => {
      if (req.params.id) {
        if (
          !(
            await c.query(
              "UPDATE users SET name=$1,email=$2,role=$3,password_hash=COALESCE($4,password_hash) WHERE id=$5 RETURNING id",
              [d.name, d.email.toLowerCase(), d.role, hash, id],
            )
          ).rows.length
        )
          problem(404, "User not found")
      } else
        await c.query(
          "INSERT INTO users(id,name,email,role,password_hash) VALUES($1,$2,$3,$4,$5)",
          [id, d.name, d.email.toLowerCase(), d.role, hash],
        )
      await c.query(
        "INSERT INTO account_controls(user_id,active,revision) VALUES($1,$2,1) ON CONFLICT(user_id) DO UPDATE SET active=EXCLUDED.active,revision=account_controls.revision+1",
        [id, d.active],
      )
      await c.query("DELETE FROM user_sites WHERE user_id=$1", [id])
      for (const site of new Set(d.site_ids))
        await c.query("INSERT INTO user_sites(user_id,site_id) VALUES($1,$2)", [
          id,
          site,
        ])
      await audit(c, req.user, "CONFIGURE_USER", id, null, {
        role: d.role,
        active: d.active,
      })
    })
    res
      .status(req.params.id ? 200 : 201)
      .json({ id, name: d.name, role: d.role, active: d.active })
  }
  app.post("/system/users", saveUser)
  app.put("/system/users/:id", saveUser)
  app.get("/system/audit", async (req, res) => {
    role(req, ["admin", "operations"])
    res.json(
      (
        await pool.query(
          "SELECT a.id,a.actor_id,u.name AS actor_name,a.action,a.record_id,a.site_id,a.created_at" +
            (req.user.role === "operations" ? ",a.details" : "") +
            " FROM operation_audit a JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 500",
        )
      ).rows,
    )
  })
  app.get("/system/health", async (req, res) => {
    role(req, ["admin"])
    await pool.query("SELECT 1")
    res.json({
      database: "connected",
      uptime_seconds: Math.floor(process.uptime()),
      node: process.version,
      transport: req.secure ? "https" : "http",
      photo_storage: process.env.FILE_STORAGE==="postgres"?"private database storage":"private local directory",
      photo_encryption: encryptionKey()
        ? "AES-256-GCM for new uploads"
        : "not configured",
      database_encryption: "Provider-managed",
      backup: process.env.BACKUP_ENCRYPTION_KEY ? "On-demand encrypted snapshots" : "Not configured",
    })
  })
  const configSchema = z
    .object({
      critical_hours: z.number().int().min(1).max(168),
      high_hours: z.number().int().min(1).max(336),
      standard_hours: z.number().int().min(1).max(720),
      require_approval: z.boolean(),
    })
    .strict()
  app.get("/system/config", async (req, res) => {
    role(req, ["admin"])
    res.json(
      (
        await pool.query(
          "SELECT value FROM technical_settings WHERE key='workflow'",
        )
      ).rows[0]?.value || {
        critical_hours: 4,
        high_hours: 24,
        standard_hours: 72,
        require_approval: true,
      },
    )
  })
  app.put("/system/config", async (req, res) => {
    role(req, ["admin"])
    const d = valid(configSchema, req.body)
    await transaction(async (c) => {
      await c.query(
        "INSERT INTO technical_settings(key,value,updated_by) VALUES('workflow',$1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=now()",
        [JSON.stringify(d), req.user.id],
      )
      await audit(c, req.user, "CONFIGURE_WORKFLOW", null, null, d)
    })
    res.json(d)
  })
  app.get("/system/backups", async (req, res) => {
    role(req, ["admin"])
    res.json(await listBackups(pool))
  })
  app.post("/system/backups", async (req, res) => {
    role(req, ["admin"])
    const backup = await createBackup(pool)
    await audit(pool, req.user, "CREATE_BACKUP", null, null, {
      backup_id: backup.id,
    })
    res.status(201).json(backup)
  })
  app.get("/system/backups/:id", async (req, res) => {
    role(req, ["admin"])
    valid(uuid, req.params.id)
    let bytes
    try {
      bytes = await fileStore(pool).read("backups/"+req.params.id+".bccbackup")
    } catch (e) {
      if (e.code === "ENOENT") problem(404, "Backup not found")
      throw e
    }
    await audit(pool, req.user, "DOWNLOAD_ENCRYPTED_BACKUP", null, null, {
      backup_id: req.params.id,
    })
    res
      .set({
        "Content-Type": "application/octet-stream",
        "Content-Disposition":
          'attachment; filename="' + req.params.id + '.bccbackup"',
        "Cache-Control": "no-store",
      })
      .send(bytes)
  })
  app.post("/auth/logout", async (req, res) => {
    const claims = jwt.decode(req.headers.authorization.replace(/^Bearer /, ""))
    if (claims.jti)
      await pool.query(
        "INSERT INTO revoked_sessions(id,expires_at) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [claims.jti, new Date(claims.exp * 1000).toISOString()],
      )
    await audit(pool, req.user, "LOGOUT")
    res.json({ ok: true })
  })
}
