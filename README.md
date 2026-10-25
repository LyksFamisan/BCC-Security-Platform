# BCC Security Services Platform

React/Vite web, separate Expo Guard and Supervisor apps, shared Express API and PostgreSQL. This branch adds database-backed manpower, equipment, training, case follow-up, notifications, reports and technical administration to the connected incident workflow.

**Hosted activation:** the production website now opens the authenticated application directly. Its same-origin `/api` runs on Vercel Functions and connects to PostgreSQL in the existing Neon Free organization. No simulated-login or prototype toggle is served. See [TOR-COVERAGE.md](TOR-COVERAGE.md) for the feature-by-feature scope, partial integrations and acceptance limits. There is no signed APK or paid infrastructure created by this change.

## Applications and access

| Role | Application | Server-enforced scope |
|---|---|---|
| Security Personnel / Guard | `mobile/` | Own roster, attendance, GPS check-ins, issued equipment, training, certifications, assessments, incident reports and alerts |
| Supervisor / Site In-Charge | `mobile-supervisor/`, `web/` | Assigned sites only; roster, equipment assignments, assessments, incident review, actions and escalations |
| Operations Management / SSD | `web/` | All operational sites, records, analytics, exports and authorized audit |
| System Administrator | `web/` | Accounts, site assignments/geofences, workflow settings, integration settings, audit metadata, health and encrypted backup management; no operational report/photo access |

`Own` does not grant permission to edit training/license records. Supervisors can view training, licenses, inventory and maintenance but cannot change them. Guard evidence and incident history remain isolated. The backend role is authoritative.

## Local setup

Use Node 22.12+ (Node 24 recommended), npm and PostgreSQL. Docker Compose is provided for a loopback-only local database.

```sh
npm run setup
docker compose up -d
cp backend/.env.example backend/.env
cp web/.env.example web/.env
cp mobile/.env.example mobile/.env
cp mobile-supervisor/.env.example mobile-supervisor/.env
```

Edit the local `.env` files; never commit real credentials:

- `backend/.env`: local `DATABASE_URL`, a random `JWT_SECRET` of at least 32 characters and a `DEMO_PASSWORD` of at least 12 characters if using fictional seed accounts.
- Optional `PHOTO_ENCRYPTION_KEY` and `BACKUP_ENCRYPTION_KEY`: separate, random 32-byte keys encoded as base64. Keep recovery copies separately from application data. Generate each locally with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Do not paste keys into chat or GitHub.
- `web/.env`: `VITE_API_URL=http://localhost:3001`.
- Both mobile `.env` files: `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:3001`.

```sh
cd backend
npm run migrate
npm run seed
npm run dev
```

Seeding is explicit and optional. It creates only fictional `@demo.invalid` users and fictional roster, radio, assignment, training, certification, assessment and maintenance records. Rerunning resets demo passwords but does not replace operational records. Demo shifts are created relative to the **first** seed; create a new shift if they expire. Remove fictional data before real use.

In another terminal, from the repository root:

```sh
npm run dev
```

Web: `http://localhost:8443`. API: `http://localhost:3001`; `/health` verifies database connectivity. Use `FIGMA_DEV_SERVER_HOST=127.0.0.1 npm run dev` if container interface enumeration is restricted. If changing the web port, update `WEB_ORIGINS` on the API.

Fictional logins use your own `DEMO_PASSWORD`:

| Email | Role |
|---|---|
| `admin@demo.invalid` | System Administrator |
| `operations@demo.invalid` | SSD |
| `supervisor@demo.invalid` | Supervisor, Demo Site 1 |
| `guard@demo.invalid` | Guard, Demo Site 1 |
| `guard2@demo.invalid` | Guard, Demo Site 2 |

## Test the mobile applications

Install an Expo Go client compatible with SDK 54, or make a development build. SDK 54 is retained deliberately; this branch does not perform an unrelated SDK upgrade. Installable APKs use the supplied EAS preview profiles and require your Expo project/signing setup.

```sh
cd mobile
npm ci
npx expo start -c --port 8081
```

```sh
cd mobile-supervisor
npm ci
npx expo start -c --port 8082
```

Use the corresponding QR code. The phone and computer must be on the same network, with local inbound API port 3001 allowed. `localhost` on the phone is the phone itself. For hosted use, set the same HTTPS API URL in both apps and restart/rebuild them. Vite/Expo public environment variables contain public URLs only, never database or server keys.

Guard app: Duty → Schedule / Equipment / Training / Licenses / Assessments / Faults; Report and Reports are separate bottom tabs. Supervisor app: site operations plus incident reporting and review. Both use the existing web BCC/CAT logos and blue/orange theme.

## End-to-end acceptance walkthrough

1. **System Administrator:** create a site and its client label, required staffing, latitude/longitude and geofence radius. Create/enable users and assign them to sites. Defaults are examples; confirm workflow/SLA ownership with BCC.
2. **SSD or assigned Supervisor:** add a shift with a Guard, start/end and duty post. Overlapping shifts are rejected. Schedule changes after attendance are blocked to preserve recorded timekeeping.
3. **Guard on an actual phone:** within 30 minutes before the shift through its end, grant foreground location access and tap Time in. The API validates ownership, duplicate events, site assignment, GPS accuracy and distance. Time out requires a previous Time in. Location/GPS is user-triggered; there is no hidden continuous/background tracking. Mobile GPS spoofing resistance is limited and requires device testing.
4. **Web:** verify attendance and latest GPS check-in under the assigned site. Overview shows coverage, utilization, incidents, SLA and trend totals derived from scoped records.
5. **SSD:** create equipment. **Supervisor:** issue it to an assigned Guard. **Guard:** acknowledge receipt and report a fault. The server prevents double issue and changing a recipient's acknowledgment. Return equipment before retiring it.
6. **SSD:** add training/license records; **Supervisor:** view them and record a competency assessment. **Guard:** view only own records.
7. **Guard:** submit an incident with title, location, description and a camera/gallery image. On the web, review its classification, severity, approval, investigation and root cause. Add corrective/preventive actions and escalations for that incident/site. Approval and completion of outstanding actions are required before resolution when the approval policy is enabled. Guard refresh/reconnect recovers the new status.
8. **Notifications:** verify missing check-in, staffing shortage, overdue maintenance, expiring license, unacknowledged equipment, open faults and overdue SLA/action alerts. They are computed from current database records and can be marked read. These are in-app notifications, not OS push, email or SMS.
9. **Reports:** filter by accessible site and record creation dates, download CSV, save the report preference and choose dashboard widgets. Time values are recorded in UTC and displayed using the client locale. No export includes records outside the caller's scope.
10. **System Administrator:** disable an account or change assignments; prior tokens fail on the next authenticated API request. Sign-out revokes the JWT server-side. Audit metadata is visible without operational payloads.

Socket.IO events contain no operational payload; clients refetch authorized data. Incident screens have reconnect recovery; operation screens poll every 15 seconds and refresh when re-opened. An internet connection is required; no zero-rated cellular service, offline sync queue or external biometric connection is included.

## API summary

JWT `Authorization: Bearer ...` is required except login and health. JWTs expire after one hour. Web stores tokens in memory; mobile uses SecureStore. Disabled accounts and changed account revisions are rejected server-side.

| Endpoint | Function |
|---|---|
| `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` | Credentials, current account and server-side revocation |
| `GET /sites`, `GET /users` | Authorized site/assignment choices |
| `/incidents`, `/incidents/:id` | Multipart submission, scoped list, review/assignment/status update |
| `GET /incidents/:id/photo` | Authenticated evidence, no-store |
| `GET /incidents/:id/audit` | SSD-only incident audit; record scope checked first |
| `GET /operations/catalog` | Allowed modules and validated form schema |
| `GET/POST /operations/:kind`, `PATCH /operations/:kind/:id` | Validated operational records; edits require current `version` |
| `POST /attendance` | Own geofenced shift Time in/out with server timestamp |
| `POST /location/check-in` | Own explicit foreground GPS point |
| `POST /equipment/:assignmentId/acknowledge` | Current Guard recipient acknowledgment |
| `GET /dashboard`, `GET /notifications`, `POST /notifications/read` | Scoped metrics and in-app alerts |
| `GET /reports/export?kind=...&site_id=...&from=...&to=...` | CSV with permission filtering; dates refer to creation timestamp |
| `GET/PUT /preferences` | Scoped dashboard/report preferences |
| `/system/users`, `/system/sites` | Admin-only account lifecycle, roles, assignments and geofences |
| `GET/PUT /system/config` | Admin-only approval policy and severity SLA durations |
| `GET/PUT /system/integrations` | Admin-only timekeeping import enablement/source label |
| `POST /integrations/attendance` | SSD-authenticated timekeeping import contract |
| `GET /system/audit` | SSD full operation audit; Admin metadata only |
| `GET /system/health` | Admin-only runtime/database and configuration diagnostics |
| `GET/POST /system/backups`, `GET /system/backups/:id` | Admin-only encrypted backup creation/list/download |

Timekeeping contract example (fictional identifiers; use real assigned shift IDs from your deployment):

```json
{"events":[{"external_id":"FICTIONAL-CLOCK-0001","shift_id":"30000000-0000-4000-8000-000000000001","event":"in","recorded_at":"2026-10-25T00:00:00Z"}]}
```

Enable the source as Admin, then call with an SSD token. Imports are transactional, limited to 100 events, scoped to valid shifts and idempotent for the same external ID. Invalid timing, conflicting IDs and duplicate shift events are rejected. This is a working adapter contract, **not** a connection to BCC's unnamed vendor; provider credentials, field mapping, scheduling and acceptance testing are still required. Do not embed an SSD credential in an untrusted biometric device or mobile client.

## Encryption, backups and restore

Photo uploads are restricted to JPEG/PNG/WebP under 5 MB and decoded/re-encoded with metadata removed. New evidence is AES-256-GCM encrypted when `PHOTO_ENCRYPTION_KEY` is set; existing unencrypted evidence stays readable and requires a separate migration if encryption is mandated for historical uploads. Database-at-rest encryption is controlled by the hosting provider; no UI toggle claims to change it.

Backup snapshots include the database tables and evidence bytes. They are AES-256-GCM encrypted with `BACKUP_ENCRYPTION_KEY`; a missing key blocks backup creation. Local snapshots are bounded to 100 MB total / 70 MB evidence; larger deployments require provider backups or a streaming `pg_dump`/object-store workflow. Downloaded archives remain encrypted. Keys are not included in archives; retain both the backup key and any photo key separately.

For restore, run all migrations into an **isolated empty** PostgreSQL database. Configure `RESTORE_DATABASE_URL`, `RESTORE_UPLOAD_DIR`, and the original backup key on a secure operator machine. Keep the application's original `DATABASE_URL` set so the script can reject that target.

```sh
node --env-file=.env src/restore-backup.js /secure/path/snapshot.bccbackup --confirm-target=HOST/DATABASE
```

The script refuses the active application database and any database containing records. Evidence files are created exclusively; existing evidence is never overwritten. Verify the isolated restore before any controlled cutover. Scheduling, offsite replication, retention, provider failover and production restore approval are deployment tasks, not enabled by this source change.

Use HTTPS on hosted clients. Set `REQUIRE_HTTPS=true` and `TRUST_PROXY_HOPS` only for the actual trusted proxy topology. Require verified database TLS through the database provider. No keys or passwords are committed.

## Verification

```sh
npm test
npm run build
cd web && npx tsc --noEmit
cd ../mobile && npm run typecheck
cd ../mobile-supervisor && npm run typecheck
```

Browser regression: `npm run test:browser` after installing Chromium with `cd web && npx playwright install chromium`, or point `CHROMIUM_EXECUTABLE_PATH` to an existing compatible executable.

Android JavaScript exports: in each mobile folder, `npx expo export --platform android`. This verifies bundling; it does not generate a signed APK or replace physical-device tests.

The tests use PGlite, a PostgreSQL engine, real HTTP/JWT/image processing and Socket.IO. They cover role/site/own-record restrictions, roster collisions, geofence/accuracy failures, duplicate attendance, double-issued equipment, acknowledgment, training visibility, stale-version conflicts, approvals/actions, imports, backup encryption/restore and revoked sessions. Browser tests exercise actual roster/site forms and the original incident/reconnect/session flow. See `VERIFICATION.md` for the exact execution status.

## Hosting and release

- **Web:** existing Vercel project, or AWS Amplify using the supplied `amplify.yml` and monorepo root `web`. Set `VITE_API_URL` before building.
- **API (current hosted release):** `api/index.js` runs the existing Express API on Vercel Node Functions in Singapore. Hosted clients use authenticated polling with reconnect recovery; the local standalone Socket.IO server remains available. For an alternative persistent Node deployment, Install backend dependencies, inject server environment variables, run all migrations once, then `npm start`. Do not run the fictional seed against production data.
- **Database:** hosted PostgreSQL with verified TLS, backups and access controls. Credentials remain on the API server.
- **Evidence/backups (current hosted release):** encrypted bytes persist in the private PostgreSQL `private_files` table with `FILE_STORAGE=postgres`, rather than ephemeral function storage. Local development still supports private directories. Hosted uploads are limited to 3 MB. Larger datasets/backup downloads require an object-storage/streaming export strategy; Vercel function payload limits still apply.
- **Mobile:** both apps use the same HTTPS API URL; build/install separately. Vercel hosting does not publish a native Android app.

The hosted schema has been applied without fictional seed data. First use requires the private, one-time administrator activation link delivered to the owner; passwords are chosen by the owner and are never committed. That link can create only the first administrator, then becomes unusable. No paid plan upgrade or store release was initiated. Vendor connections, physical-device QA and BCC acceptance remain separate tasks.

## Hosted first use

1. Open the private activation link supplied to the owner and choose your administrator email/password. Do not publish that link.
2. Sign in, create real sites/geofences and user accounts, then assign Guard/Supervisor site access. No demonstration accounts or fictional records were loaded into the hosted database.
3. Both mobile projects now default to `https://bcc-security-platform.vercel.app/api`. Existing local `.env` values override that default; update an old local URL when taking this release. Use the latest source/rebuild; an installed APK does not change automatically.
4. Hosted polling refreshes incidents/operations in approximately 10–15 seconds and on reconnect/foreground. Actual Android sensor/install testing and the external biometric vendor connection are still outstanding.

`004_hosted_storage.sql` adds durable private-file storage and persistent account sign-in throttling. Vercel stores server credentials only in sensitive production environment variables; no production credentials are shared with preview branches or committed to GitHub.
