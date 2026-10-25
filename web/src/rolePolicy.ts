export const roleDefinitions = {
  "guard": {
    "label": "Security Personnel (Guards)",
    "application": "Mobile Application",
    "color": "#8B5CF6",
    "access": [
      "Own schedule and attendance",
      "Assigned equipment",
      "Submit incidents and view own reports",
      "Own notifications"
    ]
  },
  "supervisor": {
    "label": "Supervisor / Site In-Charge",
    "application": "Web + Mobile Application",
    "color": "#1976b9",
    "access": [
      "Assigned sites and clients only",
      "Roster and deployment",
      "Equipment accountability",
      "Incident review, approvals and escalation"
    ]
  },
  "operations": {
    "label": "Operations Management (SSD)",
    "application": "Web Application",
    "color": "#F06522",
    "access": [
      "All sites and clients",
      "Manpower and equipment management",
      "Incident management and approvals",
      "Analytics, KPI, SLA and executive reporting"
    ]
  },
  "admin": {
    "label": "System Administrator",
    "application": "Web Application",
    "color": "#dc2626",
    "access": [
      "User accounts and RBAC",
      "Integrations and workflow configuration",
      "Audit logs and system health",
      "Security, backup and recovery configuration"
    ]
  }
} as const
