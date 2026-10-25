# Verification — connected incident MVP

Executed in the implementation workspace on 2026-10-25.

| Check | Result |
|---|---|
| Express HTTP + PostgreSQL-engine integration test (`npm test`) | PASS |
| Guard multipart report → Admin/Supervisor list | PASS |
| Admin status/assignment → Guard list | PASS |
| Socket.IO event and reconnect/refetch recovery | PASS |
| No-token access, wrong password, other-Guard list/photo/audit, Guard/Supervisor write denial | PASS |
| Status/assignee validation and corrupt-image rejection | PASS |
| Submission/update audit persistence | PASS |
| Vite production build (`npm run build`) | PASS |
| Web TypeScript (`cd web && npx tsc --noEmit`) | PASS |
| Mobile TypeScript (`cd mobile && npm run typecheck`) | PASS |
| Expo SDK dependency compatibility (`cd mobile && npx expo install --check`) | PASS — dependencies up to date |
| Android bundle export (`cd mobile && npx expo export --platform android --output-dir /tmp/bcc-android-export`) | PASS — 606 modules bundled |
| Dev server startup | PASS with loopback host override in this restricted container |
| Browser UI walkthrough | NOT RUN — Chromium download returned truncated ZIP files; no browser runtime available |
| Physical Android, signed APK, hosted PostgreSQL/AWS | NOT RUN / NOT DEPLOYED |

The integration test uses PGlite, an embedded PostgreSQL engine, and real HTTP, Socket.IO and image decoding. Mobile requests are simulated at the HTTP boundary, not taps in an Android emulator/device. Android export confirms bundling, not a device execution or signed APK.

A browser walkthrough script is included at `backend/test/browser.mjs`. To run on a machine with a working Chromium installation, start Vite at `http://127.0.0.1:8443`, leave API port 3001 free, then run:

```sh
cd web
npx playwright install chromium
cd ..
node backend/test/browser.mjs
```

It uses temporary fictional users and a temporary database/upload directory, and checks login → report from Guard HTTP flow → realtime browser render → web status update → Guard read, plus audit/photo UI, mobile viewport width, sign-out and prototype switching. It is not counted as a passed check here.

The retained prototype produces a large-chunk warning; it is lazy-loaded separately from the connected application. The original Figma Vite config also warns about future native-config-loader compatibility; the current build passes. No cloud resources were created. Main was not changed. Automatic Vercel deployment is disabled for the review branch in `vercel.json`.
