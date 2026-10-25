# BCC Security Services Platform

Connected incident MVP: React/Vite web for SSD, Supervisor and System Administrator, Expo React Native Android app for Guards and Supervisors, Express API and shared PostgreSQL. Existing manpower, equipment, tactical, duty and administration screens remain available through **View preserved prototype**. Those screens use simulated login and browser-local data; they are explicitly not connected or production features. The connected incident app is the default.

## Structure

- `web/`: connected dashboard and original prototype, styles and assets.
- `mobile/`: Expo Guard app, secure token storage, incident/photo submission and own-report tracking.
- `backend/`: authenticated REST API, Socket.IO notifications, migration, fictional seed and integration tests.
- `compose.yaml`: local PostgreSQL only. No cloud resources are created.
- `amplify.yml`: web build configuration. Existing Vercel root config points to `web/dist`; automatic Vercel deployment is disabled for this review branch.

## Run locally

Use Node 22.12+ (Node 24 recommended), npm and Docker Compose. From the repository root:

```sh
npm run setup
docker compose up -d
cp backend/.env.example backend/.env
cp web/.env.example web/.env
cp mobile/.env.example mobile/.env
```

Edit `backend/.env`: set `JWT_SECRET` to a random value (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) and `DEMO_PASSWORD` to a password of at least 12 characters. The committed database password in Compose is for loopback-only local development; never reuse it remotely. Never commit `.env` files.

```sh
cd backend
npm run migrate
npm run seed
npm run dev
```

In a second terminal, from the root:

```sh
npm run dev
```

Web runs at `http://localhost:8443`. In containers where network interface enumeration is blocked, use `FIGMA_DEV_SERVER_HOST=127.0.0.1 npm run dev`. If occupied, Vite prints another port; update `WEB_ORIGINS` accordingly and restart the API. API runs at `http://localhost:3001`; `/health` checks the database. No demo credentials are prefilled or bundled in clients.

Seed accounts (all use your chosen `DEMO_PASSWORD`):

| Email | Role | Access |
|---|---|---|
| operations@demo.invalid | Operations Management (SSD) | All incidents; update status and assign |
| admin@demo.invalid | System Administrator | Technical role; no incident or evidence access |
| supervisor@demo.invalid | Supervisor | Review and update reports at Demo Site 1 |
| guard@demo.invalid | Guard | Own reports; submit at Demo Site 1 |
| guard2@demo.invalid | Guard | Own reports; submit at Demo Site 2 |

The seed is explicit and opt-in; re-running it resets these demo users' passwords. No real client records are included. Users/sites are managed through SQL for this MVP, not the preserved prototype's administration screen.

## Test on a physical Android phone

1. Put the phone and computer on the same Wi-Fi. Find the computer's LAN IP.
2. Set `mobile/.env` to `EXPO_PUBLIC_API_URL=http://COMPUTER_LAN_IP:3001`. `localhost` on the phone refers to the phone, not your computer.
3. Allow local inbound TCP 3001 through the computer firewall. Keep PostgreSQL bound to loopback.
4. `cd mobile && npm start`; scan the QR with an Expo Go version compatible with SDK 54. If your current Expo Go does not support SDK 54, use the matching Android client from https://expo.dev/go or a development build. Restart Expo after changing `.env`.
5. Sign in as `guard@demo.invalid`, choose the site, enter title/description/location and select a JPEG/PNG/WebP photo under 5 MB. Submit, then sign in to the web as Admin or Supervisor.
6. Admin changes the status to Under Review, In Progress or Resolved. Check the phone updates. Disable phone network, update on web, then reconnect and foreground the app: a fresh list recovers missed updates. Pull-to-refresh is also available.
7. Sign in as guard2 and verify the first guard's reports are absent. Supervisor only sees assigned sites.

HTTP is only for trusted local development. Use HTTPS API/WSS for hosted clients. Expo public environment values and Vite values are public configuration, never server secrets. This is source ready for Android testing, not a signed APK or Play Store release.

## API and access

Send `Authorization: Bearer <token>` except on login and health. JWTs expire after one hour. Mobile stores the token in SecureStore; web keeps it in memory (refresh requires login). Sign-out deletes the client token; there is no server-side token revocation yet.

| Method/path | Access |
|---|---|
| POST /auth/login | Rate-limited credentials; server determines role |
| GET /sites | Admin: all; others: assigned sites |
| GET /users | Admin, assignment choices |
| GET /incidents | Admin: all; Supervisor: assigned sites; Guard: own |
| POST /incidents | Authenticated; assigned site required except Admin; multipart `title`, `description`, `location`, `site_id`, `photo` |
| PATCH /incidents/:id | Admin only; `status` and/or nullable `assignee_id`; assignee must belong to report site |
| GET /incidents/:id/photo | Same visibility as incident; private, no-store |
| GET /incidents/:id/audit | Same visibility as incident |

Report creation/update and audit writes are transactional. Photos are decoded and re-encoded as JPEG, metadata is removed, maximum input is 5 MB / 25 megapixels. Files are not publicly served. Socket rooms follow server-assigned roles/sites; events contain no report payload and clients refetch authorized data. Both clients poll every 15 seconds and refresh after reconnect/foreground. Guard submissions are not queued offline: failures retain the form so the user can retry. A request that succeeds while the connection drops may be duplicated on retry; idempotency is a future enhancement.

## Verification

```sh
npm test
npm run test:browser
npm run build
cd web && npx tsc --noEmit
cd ../mobile && npm run typecheck
```

The integration test uses PGlite (embedded PostgreSQL engine), real HTTP, JWT auth, real image decoding and Socket.IO against the shared API. It checks mobile-shaped multipart submission → web read, web update → guard read, reconnect recovery, site/ownership restrictions, protected photos/audits, unauthorized modifications, invalid status/assignee/image and persisted audit events. The browser test starts isolated Vite/API processes and requires Chromium (`cd web && npx playwright install chromium`). Set `CHROMIUM_EXECUTABLE_PATH` if using an existing Chromium binary. It also verifies expired-session cleanup and delayed-response isolation after account switching. This does not replace testing on an actual Android device and a separately hosted PostgreSQL service. See `VERIFICATION.md` for execution results.

## AWS hosting preparation (no deployment performed)

1. Create a **new** Amplify Hosting app from this repository/feature branch when ready. Select monorepo root `web`; set `AMPLIFY_MONOREPO_APP_ROOT=web`. The root `amplify.yml` builds only the web app.
2. Set `VITE_API_URL=https://YOUR_API_HOST` before building. Configure a SPA 200 rewrite for client routes if introducing routing. Use the new Amplify URL first; leave existing project DNS unchanged.
3. Host the Express API separately on a Node service that supports persistent WebSockets (for example an isolated EC2/container service). Install with `npm ci`, run `npm start` in `backend/`. Set `DATABASE_URL`, strong `JWT_SECRET`, `PORT`, `WEB_ORIGINS` (exact web origins, comma-separated) and `UPLOAD_DIR`; inject secrets on the server. Put TLS in front and configure proxy trust/rate limiting for your actual trusted proxy. Run migration once per release before starting API traffic.
4. Provision PostgreSQL separately, for example RDS, with private network access and verified TLS as appropriate to your provider. Do not expose database credentials to either client. Configure backups and connection limits.
5. Photos currently use the API's private local `UPLOAD_DIR`. On one API instance, mount persistent storage there and back it up. Ephemeral hosting loses photos on restart. For S3, implement a private S3 storage adapter and authenticated retrieval/presigned access before deployment; S3 integration is **not implemented** here. Do not make evidence public. Multiple API replicas also need shared file storage and a Socket.IO adapter/message broker; this MVP is single-instance.
6. Set `EXPO_PUBLIC_API_URL` to the HTTPS API URL for Android development/release builds. Amplify hosts the web, not the Android app, Express server, PostgreSQL or private photos.

Use separate resources/names for this demo. AWS charges depend on provisioned resources and usage. No AWS resources, domain changes, or deployment actions are included in this change.

Before real use: security review, production identity/user lifecycle, revocation, retention policies, upload malware scanning where needed, backups/restore tests, monitoring, and device/release QA. Existing prototype data remains local and is not migrated automatically.

References: [Amplify monorepo configuration](https://docs.aws.amazon.com/amplify/latest/userguide/monorepo-configuration.html), [Expo image picker](https://docs.expo.dev/versions/v54.0.0/sdk/imagepicker/).

## Phase 1 role design (October 25, 2026)

- Security Personnel (Guards), `guard`: mobile, own reports and assigned records.
- Supervisor / Site In-Charge, `supervisor`: web and mobile, assigned sites and clients.
- Operations Management (SSD), `operations`: web, all operational sites and clients.
- System Administrator, `admin`: web, technical administration only. No incident/photo access.

The deployed frontend remains a sample-data demo without `VITE_API_URL`. Portal navigation starts with four role choices. Demo emails: `security@gmail.com`, `supervisor@demo.invalid`, `ar@gmail.com` (SSD), `bcc@gmail.com` (System Administrator). Use any non-empty demo password; this is simulated login, not authentication. Never enter real credentials.

System Administration → Roles & Permissions contains the supplied 52-feature permission design. A matrix entry is a permission specification, not confirmation that a production module or integration has been implemented. Existing screens and records are illustrative. Supervisor demo assignment is BGC Financial Tower. Confirm training/certification ownership, equipment maintenance and final incident approvals with BCC.

Apply backend migration `002_four_roles.sql` before using the new API. It preserves existing operational administrators by changing them to SSD (`operations`); provision technical administrators separately. Seed includes all four roles. Existing JWTs are resolved against the current database role. Supervisor incident updates are restricted to assigned sites; technical admins cannot list incidents or access their evidence. API and mobile changes require their own backend release and mobile build; a Vercel frontend release does not publish them.

## Separate Guard and Supervisor mobile applications

`mobile/` is **BCC Guard** (`com.bcc.demo.guard`). `mobile-supervisor/` is **BCC Supervisor** (`com.bcc.demo.supervisor`). They have separate Expo slugs, URL schemes, session keys and icons; both can be installed on one Android device. The four user roles remain unchanged.

Both apps call the same `EXPO_PUBLIC_API_URL` and shared PostgreSQL-backed API. Copy each folder's `.env.example` to its own `.env` and set the same API URL. Deploy the latest backend first: it validates the requested mobile role before issuing an app-bound token. Client checks also reject wrong-role and restored sessions. Supervisor permissions are still restricted to assigned sites by the API.

Run in separate terminals from the project root:

```bash
cd mobile
npm ci
npx expo start -c --port 8081
```

```bash
cd mobile-supervisor
npm ci
npx expo start -c --port 8082
```

Scan the corresponding QR code in Expo Go. These are source projects, not published APKs. For independent installable Android demos, each project includes `eas.json` with a `preview` APK profile. From each app folder, configure your own Expo project and run `eas build --platform android --profile preview`. Build signing and EAS configuration are separate; no build service or store release has been initiated.

Current functional scope is incident reporting, assigned sites, report tracking, and Supervisor status updates. Schedule, attendance and equipment modules from the broader TOR still require mobile implementation; separating the apps does not implement those features. The web application is unchanged. Physical-device testing is still required.
