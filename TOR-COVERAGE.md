# TOR coverage and release limits

Baseline: the user-supplied Phase 1 features/access matrix. This is not BCC acceptance sign-off or verification of a separate unseen TOR document. **Locally implemented does not mean live or production-accepted.**

Hosted API, PostgreSQL and encrypted persistent evidence storage are now configured. The live site opens the authenticated application. Initial real administrator activation, site/account setup, policy confirmation and physical-device acceptance are still required.

| Role | Scope |
|---|---|
| Guard | Own records; native mobile |
| Supervisor | Assigned sites only; web/mobile |
| SSD | All operational records; web |
| System Administrator | Technical configuration and audit metadata; no incident/evidence access |

## A. Manpower Monitoring

| # | Feature | Implementation / limitation |
|---|---|---|
| 1 | Duty Roster & Shift Management (AO) | Roster CRUD; overlap and post-attendance edit protection. |
| 2 | Guard Deployment Tracking | Deployment is represented by Guard/site/post shifts. |
| 3 | Real-Time Personnel Monitoring (DDO) | Assigned shift/attendance snapshots; no continuous GPS stream. |
| 4 | Attendance & Timekeeping Integration | Native geofenced attendance + authenticated import adapter; external vendor setup pending. |
| 5 | Mobile Workforce Monitoring | Current/recorded shifts, attendance and explicit GPS points. |
| 6 | GPS / Geolocation Monitoring | Foreground user-triggered GPS only; background/continuous tracking not implemented. |
| 7 | Manpower Utilization Reports | Scheduled/recorded hours, coverage metrics and scoped roster/attendance CSV. |
| 8 | Absenteeism Alerts | Current-shift missing check-in alerts. |
| 9 | Understaffing & Shortage Alerts | Configured staffing target versus current scheduled coverage. |
| 10 | Training Records Management | SSD writes; Supervisor views; Guard own records. |
| 11 | Certification & License Tracking | Expiry records and expiring-license alerts. |
| 12 | Competency Assessment | Supervisor/SSD assessments; Guard own scores. |

## B. Equipment Monitoring

| # | Feature | Implementation / limitation |
|---|---|---|
| 13 | Equipment Inventory (Firearms, Radio, etc.) | SSD inventory and lifecycle state; Guard sees issued assets. |
| 14 | Equipment Assignment | Assigned-site issue/return with single-current-recipient constraint. |
| 15 | Equipment Accountability | Guard acknowledgment; immutable acknowledgment on management edits. |
| 16 | Preventive Maintenance Scheduling | SSD schedules/completes; Supervisor view-only. |
| 17 | Asset Lifecycle Management | Available/In Service/Maintenance/Retired, with audit history. |
| 18 | Fault & Defect Reporting | Guard faults restricted to own issued equipment. |
| 19 | Equipment Utilization Reporting | Scoped equipment/assignment CSV and issued-asset counts. |
| 20 | Overdue Maintenance Alerts | Computed from incomplete maintenance due dates. |
| 21 | Equipment Issue Notifications | Unacknowledged issue/open-fault in-app notifications. |

## C. Incident Management

| # | Feature | Implementation / limitation |
|---|---|---|
| 22 | Incident Reporting & Documentation | Existing validated photo/report submission and record visibility. |
| 23 | Digital Incident Workflow | Review/status, approval policy and action-completion checks. |
| 24 | Incident Approval Process | Supervisor/SSD approval/return. Final approval ownership must be confirmed by BCC. |
| 25 | Incident Classification | Supervisor/SSD classification; hidden from Guard API response. |
| 26 | Severity Assignment | Severity updates recalculate the configured resolution deadline. |
| 27 | Case Management | Scoped incident records, assignment, actions and audit. |
| 28 | Investigation Tracking | Scoped investigation notes; Guard own incident investigation only. |
| 29 | Root Cause Documentation | Supervisor/SSD root cause; hidden from Guard API response. |
| 30 | Corrective Action Tracking | Site/incident-linked corrective actions, owner, due date and status. |
| 31 | Preventive Action Tracking | Site/incident-linked preventive actions, owner, due date and status. |
| 32 | Incident Analytics | Scoped incident/open/resolved/SLA counts. |
| 33 | Incident Trend Reporting | Incident creation-date trend derived from actual records. |

## D. Operations Monitoring Dashboard

| # | Feature | Implementation / limitation |
|---|---|---|
| 34 | Real-Time Operations Dashboard | Database-derived metrics with refresh/poll recovery. |
| 35 | Executive & Management Reporting | Scoped utilization/SLA/incident metrics and CSV. |
| 36 | KPI Monitoring | Scheduled/recorded hours, coverage, open/resolved cases and SLA totals. |
| 37 | Service Level / SLA Monitoring | Severity deadlines/SLA metrics. Policy defaults require BCC confirmation. |
| 38 | Site-Level Visibility | Own / assigned / all enforced in API queries. |
| 39 | Client-Level Visibility | Client labels on authorized site records; no separate Client role. |
| 40 | Automated Notifications | In-app computed alerts/read state; no OS push/email/SMS. |
| 41 | Escalation Management | Site-scoped escalation owner, reason, due date and status; overdue alerts. |
| 42 | Configurable Dashboards | Saved widget preferences, no scope expansion. |
| 43 | Configurable Reports | Saved report type plus site/creation-date filters and CSV. |

## E. System Administration & Security

| # | Feature | Implementation / limitation |
|---|---|---|
| 44 | User Account Management | Create/edit/disable accounts, roles and site assignments; session revision invalidation. |
| 45 | Role-Based Access Control | Four fixed backend roles; no arbitrary permission-editor override. |
| 46 | Authentication & Login Controls | Hashed passwords, login rate limits, SecureStore and JWT revocation. |
| 47 | API Integration Configuration | Admin enables timekeeping import/source label; vendor-specific adapter credentials/mapping pending. |
| 48 | Audit Trail Viewing | SSD operational details; Admin audit metadata without operational payload. |
| 49 | Encryption Configuration | Optional evidence AES-256-GCM and HTTPS enforcement. Database encryption requires hosting-provider setup. |
| 50 | Backup & Recovery Management | Encrypted bounded on-demand snapshots and empty-target restore tested. Scheduled/offsite/large-scale backups pending. |
| 51 | System Health Monitoring | Actual database connectivity, runtime and configuration status; no provider monitoring integration. |
| 52 | Security Updates | Image-processing dependency updated; production dependency audit clean at check time. Updates remain a reviewed operator release, not an in-app auto-updater. |

## Outstanding acceptance work

- Confirm BCC ownership of training, maintenance and final approvals, plus critical/high/standard SLA values. Defaults are configurable examples.
- Hosted connectivity is active through Vercel `/api` and Neon Free PostgreSQL. Verify workload limits before wider rollout; larger evidence/backup volumes need a dedicated storage strategy.
- Connect the actual timekeeping/biometric vendor; the authenticated import contract is tested but no unnamed vendor integration is claimed.
- Test both native apps on actual phones: permissions, camera, accurate GPS, poor network, reconnect, app install and accessibility.
- Agree whether continuous background location and OS push are required. They are not implemented in this branch.
- Configure production TLS/database encryption, offsite/scheduled backups, retention and restore drills. Source-level encrypted snapshots are not a provider disaster-recovery service.
- Production security/load testing, external operational acceptance and signed APK release remain open.
