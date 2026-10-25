# Verification — TOR operational workflows

Execution date: October 25, 2026. Scope includes local source checks and the separate hosted smoke checks recorded below.

| Check | Result |
|---|---|
| Shared incident API / JWT / Socket.IO regression | Passed |
| TOR operational HTTP integration suite | Passed |
| Photo encryption, tamper rejection and legacy read | Passed |
| Encrypted database snapshot, isolated restore and overwrite rejection | Passed |
| Browser roster create/save and persisted record display | Passed |
| Browser Admin site/geofence form and role isolation | Passed |
| Browser Guard submission → live web → approval/status → Guard API | Passed |
| Browser audit/photo, logout, expired sessions, delayed-response isolation | Passed |
| Browser responsive incident view and mobile workspace clipping check | Passed |
| Web production build and TypeScript | Passed |
| Guard / Supervisor TypeScript | Passed |
| Guard / Supervisor Android JavaScript exports | Passed |
| Backend production dependency audit after sharp update | 0 reported vulnerabilities |
| Actual Android/iOS phone, GPS/camera and APK install | Not performed |
| BCC vendor/biometric integration | Adapter tested; vendor not connected |
| Hosted PostgreSQL/API | Deployed; database health 200 and unauthenticated reports 401 verified |
| Hosted private evidence storage | PostgreSQL adapter tests passed; real-account production upload acceptance follows administrator activation |
| Provider disaster recovery, scheduled/offsite backups and failover | Not acceptance-tested |
| Continuous/background GPS and OS push | Not implemented |

The API suites use isolated PGlite databases and fictional records. Tests do not certify a production PostgreSQL server or GPS/device integrity. All migrations are applied to each isolated database. The roster/site browser tests use the actual React forms rather than only API calls.

The default Playwright browser download failed (truncated archive). Browser verification then succeeded using a locally extracted Chromium executable from `@sparticuz/chromium`, installed only in temporary test tooling. It is not a project dependency.

Additional behavior tested: Guard cannot create shifts or access another Guard's attendance/equipment/training; Supervisor cannot modify inventory/maintenance or reach another site; Admin cannot read operational incidents/evidence; missing geofence, poor location accuracy, out-of-radius location, overlapping shifts, duplicate shift attendance, double issue, stale versions, unresolved actions and unapproved resolution are rejected. Attendance imports enforce source enablement and external-ID idempotency. Account disablement and logout invalidate tokens on subsequent authenticated requests.

Desktop and narrow-screen web screenshots were visually inspected. Native mobile screens have passed static/bundle checks only; production device acceptance is outstanding. No test claims that all TOR acceptance criteria or integrations have been signed off by BCC.

## Hosted activation verification

- Same-origin production `/api/health`: HTTP 200, PostgreSQL query successful.
- Unauthenticated `/api/incidents`: HTTP 401 with application session error, no operational payload.
- Durable PostgreSQL file-store adapter and one-time administrator activation: isolated tests passed.
- Production schema applied with no fictional seed accounts or records.
- Native projects target the hosted API by default; both Android JavaScript exports pass.
- Prior notes about absent hosting describe the earlier TOR implementation baseline. Production account-level end-to-end acceptance still requires the owner to activate the first administrator and configure real users/sites.

- Live login page rendered through a Node-fetch browser transport bridge after direct Chromium network access failed; no demo/guide banner remained.
