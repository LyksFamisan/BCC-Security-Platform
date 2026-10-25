# Attendance cycles and mobile geofencing

Time In → Time Out → Time In is supported within the assigned shift window. Every cycle requires a fresh photo and GPS position. The server derives cycle numbers under a guard-row lock; clients cannot choose a cycle or record consecutive duplicate actions. After a completed cycle, the next action returns to Time In. Once the shift window ends, a new scheduled shift is needed.

Legacy and imported `attendance` rows stay unchanged. New camera records use `attendance_punch` with a cycle number and an additive unique index from migration 005. Attendance APIs, photo access, reports, backups and dashboards include both types. Billing export pairs each cycle separately; it does not include the off-duty gap between cycles.

Mobile Guard attendance shows a single next-action button, current GPS accuracy, site radius and Inside / Outside / Uncertain / Not configured status. Android can open Location settings; iOS opens app settings. Precise foreground location permission and active phone Location/GPS are required. The app checks the boundary before opening the camera and obtains a fresh GPS fix after capture; the backend validates again before saving.

The photo footer contains server receipt time (Asia/Manila), GPS coordinates/accuracy, assigned site/post, boundary radius and distance. This is not continuous background tracking and does not verify a street address through reverse geocoding.

Mobile branding uses the web app's CAT/BCC logos, navy/orange palette, rounded cards and a subtle shared guard-team background. Dark/light controls remain available. Update the checkout and restart Expo with `npx expo start --clear` to load the mobile changes; standalone installed apps require a new build.

The existing Makati City site has no approved coordinates configured. An administrator must set its actual centre and radius; no fake boundary or attendance was created for this update.

Validation: repeated/legacy cycles, duplicate concurrency protection, billing pairing and hosted evidence storage in backend tests; seven native GPS/state tests; browser next-action and photo flow; TypeScript and Android JS exports. Real phone camera/GPS acceptance testing is still required.

## Live web setup and checks

Guard Portal `/guard` displays the selected site, radius, GPS accuracy and Inside/Outside/Uncertain/Not configured state, plus a zoomable site/current-device map. A device preview marker is labelled GPS checked, while shared records retain Last shared. Camera attendance still obtains a fresh GPS fix before validation.

Admin can configure a site using Sites & geofences → Configure → Use current device location (on-site) → Save site. This requests precise browser GPS and refuses poor accuracy. Only use this while physically at the approved site; otherwise choose the correct centre on the map. Coordinates are not written until Save site. The existing Makati City boundary remains unconfigured until actual coordinates are supplied.
