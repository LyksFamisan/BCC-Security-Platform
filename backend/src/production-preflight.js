// Preflight checks for hosting the BCC API. No secrets are printed.
import { pathToFileURL } from "node:url"

export function checkProductionEnvironment(env = process.env) {
  const errors = []
  const warnings = []
  const required = ["DATABASE_URL", "JWT_SECRET", "WEB_ORIGINS", "UPLOAD_DIR"]
  for (const key of required) if (!env[key]?.trim()) errors.push(`${key} is required`)
  if (env.JWT_SECRET && env.JWT_SECRET.length < 32) errors.push("JWT_SECRET must be at least 32 characters")
  if (env.JWT_SECRET && /replace|example|change.me|demo/i.test(env.JWT_SECRET)) errors.push("JWT_SECRET appears to be a placeholder")
  if (env.DATABASE_URL) {
    try {
      const url = new URL(env.DATABASE_URL)
      if (!["postgres:", "postgresql:"].includes(url.protocol)) errors.push("DATABASE_URL must use PostgreSQL")
      if (["localhost", "127.0.0.1"].includes(url.hostname)) errors.push("DATABASE_URL points to localhost, not a hosted database")
    } catch { errors.push("DATABASE_URL is not a valid URL") }
  }
  if (env.WEB_ORIGINS) for (const origin of env.WEB_ORIGINS.split(",")) {
    try {
      const u = new URL(origin.trim())
      if (u.protocol !== "https:") errors.push("All production WEB_ORIGINS must use HTTPS")
      if (u.pathname !== "/" || u.search || u.hash) errors.push("WEB_ORIGINS must contain origins, not URL paths")
    } catch { errors.push("Invalid WEB_ORIGINS entry") }
  }
  if (env.UPLOAD_DIR && !env.UPLOAD_DIR.startsWith("/")) warnings.push("UPLOAD_DIR is relative; use an explicitly mounted persistent volume")
  warnings.push("Verify UPLOAD_DIR is on durable storage and included in backups; container ephemeral storage is not sufficient")
  warnings.push("This check does not test database connectivity, migrations, storage persistence or device functionality")
  return { ok: errors.length === 0, errors, warnings }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = checkProductionEnvironment()
  for (const error of result.errors) console.error("ERROR:", error)
  for (const warning of result.warnings) console.warn("NOTE:", warning)
  if (result.ok) console.log("Production configuration preflight passed (configuration only)")
  process.exitCode = result.ok ? 0 : 1
}
