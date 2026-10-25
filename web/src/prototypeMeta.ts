import type { UserRole } from "./components/LoginPortal"
export type Module = "dashboard" | "manpower" | "equipment" | "incidents" | "tactical" | "guard" | "admin"

export const moduleMeta: Record<Module, { section: string; title: string }> = {
  dashboard: { section: "OVERVIEW", title: "Operational Command Hub" },
  manpower: { section: "MANPOWER", title: "Deployment Management" },
  equipment: { section: "EQUIPMENT", title: "Asset Accountability" },
  incidents: { section: "INCIDENTS", title: "Incident Resolution Center" },
  tactical: { section: "OPERATIONS", title: "Tactical Command Console" },
  guard: { section: "DUTY", title: "Guard Dashboard" },
  admin: { section: "ADMIN", title: "System Administration" },
}

// Modules each role is allowed to access
export const roleModules: Record<UserRole, Module[]> = {
  guard: ["guard"],
  operations: ["dashboard", "manpower", "equipment", "incidents", "tactical"],
  admin: [
    "dashboard",
    "manpower",
    "equipment",
    "incidents",
    "tactical",
    "admin",
  ],
}
