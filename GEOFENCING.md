# Site geofencing

Administrator: open Sites & geofences, configure the site centre (latitude/longitude) and radius in metres, then Save site. Use the client's actual approved boundary. Radius supports 20–10,000 metres.

Guard: attendance requires the assigned site geofence and acceptable GPS accuracy. A foreground Share GPS check-in also stores the server-calculated boundary result and shows it after submission.

Supervisor / SSD: open Location & geofencing to review timestamped samples, distance from the site centre, radius and Inside / Outside / Uncertain / Not configured status. Supervisors see assigned sites only; SSD sees all operational sites.

Notifications include an outside-boundary alert only for the latest sample per guard/site, sampled within 15 minutes during an active non-cancelled shift without a recorded checkout. A newer Inside or Uncertain sample removes the prior alert from the current notification list. Alerts use the existing in-app notifications; no OS push is configured.

GPS status accounts for accuracy: Inside requires the whole accuracy range inside the radius; Outside requires it wholly outside. Low accuracy or an overlapping range is Uncertain. Existing historical GPS samples remain as recorded and do not receive an invented status.

This is foreground GPS check-in geofencing, not continuous background tracking or a live map. Internet is required to submit samples and update the web app. No real client site coordinates or production records were changed during implementation.
