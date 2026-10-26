# BCC Guard — Expo SDK 58

Requires Node.js 22.13+ (22.x) or 24.3+ (24.x), and Expo Go for SDK 58.

Download the latest repository ZIP, extract it into a new folder, and open that folder in VS Code. Stop the old Metro terminal with Control+C first. From the repository root:

```sh
cd mobile
npm ci
npx expo start --tunnel --clear
```

Scan the new QR in Expo Go. Keep the terminal running. This folder is the Guard app; mobile-supervisor is a separate app and has its own SDK version. Updating Vercel does not update a previously downloaded ZIP or a running Metro server.

Sign in with a Guard account, open Attendance, and tap Time In · Camera + GPS on a valid assigned shift. Allow camera and precise foreground location. Time Out captures a new selfie and GPS fix. Attendance requires an internet connection, accurate GPS, a selfie and an assigned shift. If the site has no configured geofence, attendance is accepted and labeled Not configured; configured boundaries remain enforced. Time In opens 30 minutes before duty through shift end.

Validation: npm run typecheck; npx expo-doctor; npx expo export --platform android. A bundle export does not replace physical-device camera/GPS testing.
