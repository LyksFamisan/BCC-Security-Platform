# Guard Phase 1 — online-only operation

The native Expo Guard app (`mobile/`) and browser Guard portal (`/guard`) use the same hosted API/database as Operations. The Guard interfaces retain navy/white/orange branding and BCC/CAT logos.

## Attendance

Each Time In and Time Out requires a fresh camera photo and accurate foreground GPS. The native app launches the front camera; the browser portal opens a live camera preview with capture/retake. A new photo is required for the next event. Photos are stamped by the server with the receipt time, coordinates, site/post and geofence result. Guards need an assigned shift and configured actual site boundary. Time In opens 30 minutes before the shift until its end. Time Out follows the active Time In; the next permitted Time In becomes available after checkout.

Attendance goes directly to `/attendance`. Success is shown only after a successful server response. Operations/Supervisor can see attendance, duty status, coordinates, boundary result and protected evidence photos through existing role/site scopes. Polling refreshes open workspaces. Capture UUIDs support idempotent server retries.

Internet, camera permission and precise location are required. Network failures show an error; no offline queue, device record cache or automatic offline upload is used. If a response was lost, refresh history before retrying because the server may already have received it. The old `/mobile/offline` upload endpoint returns HTTP 410. Previously saved historical review records remain available to authorized Operations/Supervisor; they were not deleted or converted into verified punches.

## Other Guard modules

- Profile/account ID, assigned sites, duty schedule, post and duty instructions.
- Online incident submission with assigned site, location, description, photo and severity; own status/feedback tracking.
- Assigned equipment, receipt acknowledgment and equipment fault reporting.
- Training, licences/certifications, expiry and assessments.
- In-app assignment/reminder, incident, accountability and compliance notifications.
- Explicit foreground GPS sharing and site map/geofencing. Continuous background tracking and OS push notifications are not implemented.

The browser portal exposes equipment, training/licenses and notifications under **My Records**. It requires no Expo installation. The native app remains a separate Expo application; pull the latest source and restart Metro (or rebuild an installed binary) to obtain interface changes.

## Validation

Hosted-storage backend tests verify camera/GPS attendance, photo access, role/site scope, repeated attendance cycles, idempotent attendance and live Operations visibility. Browser acceptance covers camera capture/retake for both events, GPS/geofence validation, Operations attendance reads, equipment acknowledgment/faults, certificates, notifications, profile, online incident severity and network-failure behavior without offline controls. TypeScript checks and Android export check compilation. Real Android/iOS camera and location permission testing is still required before client handover. Actual site pins must be configured; DEMO geofences must not replace real deployment coordinates.
