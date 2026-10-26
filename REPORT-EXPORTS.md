# Operational PDF and CSV reports

Supervisor and SSD users can export operational data from **Reports**. The report library covers incidents, duty schedules, Time In/Out, attendance hours for billing review, equipment inventory, equipment issues, maintenance, faults, corrective/preventive actions, escalations, training, licenses/certifications, guard assessments and shared GPS. The overview has its own PDF/CSV snapshot buttons.

Exports use the same role and site scopes as the workspace. Guards and technical administrators cannot export operational reports through this endpoint. Each successful export request records kind, format, record count and selected filters in the audit log. Responses are private/no-store. CSV cells are quoted, UTF-8 with BOM, and protected against spreadsheet formula interpretation.

Dates use the report's event date: attendance/GPS capture time, shift start, equipment acquisition, equipment issue, training completion, assessment date, license expiry, or action/maintenance target date. Incident and defect filters use their report creation date. From/To include full local browser days; exported timestamps explicitly use Asia/Manila. Invalid date ranges are rejected. The overview is a current snapshot across authorized sites, with all-date incident/equipment/hour totals clearly labeled; date/site filters apply to detailed reports.

PDF is a real downloadable A4 document generated on the server, with report title, filter context, generation time, authorized user, complete record fields, repeating headers and page numbers. Long narratives wrap and continue across pages. CSV uses readable named columns and resolves equipment, incident and duty references to names where available. Private evidence photos are not embedded in exports; evidence references remain traceable through authenticated record views.

Attendance billing exports pair guard + shift + cycle. They report recorded hours for review only; they do not calculate rates/payroll. DEMO records remain labeled and must not be included in actual billing.

Validation includes every report in both formats, scope/role denial, filter validation, empty reports, CSV formula protection, audit metadata, browser download buttons and multi-page PDF rendering. Vercel explicitly packages PDFKit font metrics with the API function.
