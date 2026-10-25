# DEMO fixtures

User-requested illustrative data was added to the shared hosted database. All fixture sites, incidents and named records use [DEMO] labels. Attendance and GPS also carry data.demo=true. These are simulated records, not actual employee work, GPS observations, licences, incidents or billable hours. Exclude [DEMO] sites from actual billing and client reports.

Coverage: two fictional training sites with geofences, guard/site assignments, past and future shifts, closed attendance cycles, text-only sample photos, inside/outside GPS samples, training, expiring certifications, assessments, equipment, issue/return assignments, maintenance, defects, incidents in all four states, corrective/preventive actions, escalations and audit history. Dashboards, alerts and reports derive from these records. Guard and supervisor access follows existing site scopes.

No account passwords, existing records, real site coordinates, production health status, backup files or integrations were changed. Future DEMO shifts still require the real camera/GPS/geofence checks when used. Real billing must use actual sites and verified records.

`backend/scripts/demo-fixtures.js` exports buildDemoFixtures(existingUsers, date). It returns additive SQL without executing it. IDs are deterministic; inserts preserve existing rows. Review the target database and active users before execution. Do not expose generated SQL containing user IDs publicly. Run `node --test backend/test/demo-fixtures.test.js` for isolated schema, coverage, preservation and idempotence checks.
