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
| Browser UI walkthrough (`npm run test:browser`) | PASS — headless Chromium 153, real Vite + API + database flow |
| Expired-session cleanup and delayed Admin response after Supervisor login | PASS — no previous-account reports/audit/photo state restored |
| Physical Android, signed APK, hosted PostgreSQL/AWS | NOT RUN / NOT DEPLOYED |

The integration test uses PGlite, an embedded PostgreSQL engine, and real HTTP, Socket.IO and image decoding. Mobile requests are simulated at the HTTP boundary, not taps in an Android emulator/device. Android export confirms bundling, not a device execution or signed APK.

The browser walkthrough at `backend/test/browser.mjs` starts an isolated API/database and Vite server (port 9843). Run from the repository root:

```sh
cd web
npx playwright install chromium
cd ..
npm run test:browser
```

If Chromium is installed elsewhere, use `CHROMIUM_EXECUTABLE_PATH=/path/to/chromium npm run test:browser`. In the implementation environment, the Playwright CDN download failed, so a temporary Chromium 153 binary was obtained from the npm-distributed `@sparticuz/chromium` package and used through this override. It is not an application dependency or committed artifact.

Verified with temporary fictional users and PostgreSQL-engine data: browser login → Guard HTTP submission → realtime browser render → browser status update → Guard read; audit/photo UI; 390px responsive viewport; sign-out; delayed Admin audit response arriving after Supervisor login; server-session expiry and re-login; preserved prototype switching. No browser JavaScript errors were observed. The screenshot was visually inspected.

Session fixes clear report/user/audit/photo state immediately on expiry/sign-out and ignore stale responses from another session. Mobile sign-out additionally clears the unfinished report and evidence photo, and stale 401/submit responses cannot affect a new account. Mobile changes passed TypeScript and Android bundling; actual Android execution remains outstanding.

The retained prototype produces a large-chunk warning; it is lazy-loaded separately from the connected application. The original Figma Vite config also warns about future native-config-loader compatibility; the current build passes. No cloud resources were created. Main was not changed. Automatic Vercel deployment is disabled for the review branch in `vercel.json`.
