# Guard attendance and GPS

Guard app: sign in → Attendance → Attendance tab → choose the assigned shift → Time In / Time Out. Check GPS can verify foreground location first; attendance always captures a fresh location again. Time Out remains disabled until a Time In is recorded. Attendance confirmation displays the server timestamp.

Required setup: Admin assigns the guard to a site and configures the actual site coordinates/radius; Supervisor or SSD creates a shift for the guard. Time In is permitted 30 minutes before shift start until shift end. Both attendance events must pass the existing server geofence and GPS accuracy checks. No fake assigned-site coordinates are submitted. Online access is required to save and sync records.

Phone: enable Location/GPS and precise foreground location permission. The app waits up to 30 seconds for a fresh fix (at most 15 seconds old) accurate within 100 metres; the server may require tighter accuracy for a small geofence. Mock GPS is refused on Android. Watchers stop after a fix, failure or timeout. Denied permission, disabled service and poor GPS have actionable messages. A GPS check alone does not record attendance.

Update your local checkout from GitHub, then run `npm ci` and `npx expo start --clear` inside `mobile` (Guard) or `mobile-supervisor` (Supervisor). Scan the newly generated QR code using a compatible Expo Go installation. An installed standalone app requires a new native build to receive code changes.

Verified: five simulated native-location adapter tests (`node --test mobile/test/gps.test.cjs`), TypeScript checks, Android JS exports and backend attendance/geofence tests. Physical phone GPS and actual client site boundaries still require device acceptance testing.
