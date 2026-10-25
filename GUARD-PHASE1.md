# Guard Phase 1 working flow

The native Expo app is in `mobile/` (Guard); `mobile-supervisor/` remains the separate Supervisor app. Both use the same hosted API and database as the web workspace. Preserve the existing navy/white/orange branding and BCC/CAT logos.

## Implemented Guard access

- Secure server login/logout, saved token in SecureStore, profile name/account UUID and assigned sites.
- Assigned duty roster, post, dates and optional duty instructions. Time In opens 30 minutes before duty until shift end. No assigned shift means no attendance authorization.
- Online Time In / Time Out with front camera, fresh precise foreground GPS, site-boundary checks, server timestamps, stamped photos and alternating attendance cycles. Lost-response retries use the capture UUID to avoid duplicate punches.
- Assigned site map opens the native/browser maps handler. Current GPS, accuracy and Inside/Outside/Uncertain site-boundary status are shown in the app. GPS sharing is explicit foreground check-in; continuous/background tracking is not enabled.
- Incident photo, assigned site, location, severity, description, local capture timestamp; own incident list, status and supervisor findings.
- Equipment issue list, receipt acknowledgment and assigned-equipment fault reports; training, assessments, licences and expiry records.
- In-app notifications for assignments/changes, upcoming shifts, incident status versions, equipment acknowledgment, expiry, escalations and offline attendance reviews. Updates poll while the app is open. OS push notifications are not included.

## Offline capture and synchronization

After an online login, saved sites/roster/records remain readable during network failures. New logins require internet. The application caches successful scoped GET responses inside its private document directory, under the signed-in account ID. Captures and copies of their photos persist across restarts in the same per-account directory. Signing out removes the token and hides account data; unsent records remain scoped to their owner for a later login. Clearing app data/uninstalling removes unsynced captures.

Incident submission first saves a complete capture locally and attempts sync. Use **Sync now** to retry; polling and returning to the foreground also retry. Upload errors stay visible with the saved capture; HTTP failures are not presented as successful submissions. Stable UUIDs make retries idempotent at the API/database boundary. Photos are deleted locally only after the server acknowledges the capture. Partial forms are not auto-saved.

Attendance offers **Save offline Time in/out · selfie + GPS**. It still requires the cached assigned shift, fresh GPS, camera and geofence checks. The online capture also falls back to this queue on a transport failure. If the original online request already committed, sync recognizes its UUID and returns the existing verified punch.

Otherwise, the server retains offline attendance as **Pending review**, including device time, server receipt time, photo, GPS accuracy and a server-recomputed boundary result. Device time/GPS are not treated as trustworthy proof of attendance. It never silently becomes a verified punch or billable hours. Supervisor/SSD can open **Offline attendance review**, inspect evidence and approve/reject with required notes. The decision is scoped, version checked and audited; the Guard sees its status. Review approval means the evidence was reviewed; payroll reconciliation remains a separate controlled process.

Captures older than 30 days, future device times, revoked accounts, removed site assignments, invalid shifts and malformed/oversized photos are rejected and retained locally with an error. Offline Time In/Out alternates using saved and synced review captures; verified attendance remains its own state.

## Setup and validation

Actual sites must have their real latitude/longitude and geofence radius configured by the administrator, and a valid guard shift. DEMO site coordinates must not be used as the actual deployment pin. Internet is required for live sync; mobile data without a usable data plan does not provide connectivity.

Get the latest GitHub source, then in `mobile/` run `npm ci` and `npx expo start -c`. Open the new QR code in Expo Go compatible with SDK 54. An existing installed binary requires rebuilding to include new dependencies. This repository update is not an app-store release or OTA update to old binaries.

Verification: backend integration tests include scoped/idempotent offline incident and attendance sync, photo access, review conflicts, real attendance retry after lost response, invalid timestamps and reviewed-vs-verified separation. Mobile tests cover durable queue/restart/account isolation/concurrent writes and GPS permission/freshness/mock/accuracy checks. Browser checks exercise the actual review notes and approval controls, roster, camera attendance and existing role workflows. TypeScript checks and Android Metro export verify compilation. Physical Android/iOS airplane-mode/camera/location testing remains required before client handover.
