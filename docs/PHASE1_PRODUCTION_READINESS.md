# BCC Phase 1 — Production Readiness Checklist

This branch is isolated from main. No production deployment is authorized by this document.

## Verified from repository configuration
- Guard Expo app: `mobile/`, Expo SDK 54.
- Supervisor Expo app: `mobile-supervisor/`, Expo SDK 54.
- Backend: Express, PostgreSQL, JWT, Socket.IO and file uploads.
- Root setup installs web, backend and both mobile projects.

## Work remaining (not yet verified complete)
- [ ] Upgrade Guard and Supervisor to the Expo SDK compatible with the target Expo Go version. Upgrade each SDK step as supported by Expo; run `npx expo install --fix`, `npx expo-doctor` and Android bundling for both apps.
- [ ] Verify the full TOR against the 52-feature coverage checklist; distinguish prototype/local-only features from persisted API features.
- [ ] Provision hosted PostgreSQL and run migrations securely.
- [ ] Provision hosted API with HTTPS, correct CORS origins, strong secrets and health checks.
- [ ] Configure durable private object storage for evidence photos and backup/restore procedures.
- [ ] Configure both mobile apps with the same hosted HTTPS API endpoint and verify role restrictions.
- [ ] Validate roster, attendance, geofence, incident approval, reporting, and synchronization with real Android devices.
- [ ] Verify offline behavior, queued writes and reconciliation; do not claim offline support until implemented and tested.
- [ ] Complete security testing, audit logging, rate limiting and session revocation checks.
- [ ] Obtain stakeholder acceptance before merging into main and deploying.

## Safe local validation
```sh
npm run setup
npm test
npm run build
npm --prefix mobile run typecheck
npm --prefix mobile-supervisor run typecheck
```

See `README.md` for database setup and device testing. Never commit .env files or real client records.
