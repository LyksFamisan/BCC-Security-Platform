export const statuses = ["Submitted", "Under Review", "In Progress", "Resolved"]
export function scope(user, alias = "i", offset = 1) {
  if (user.role === "operations") return { sql: "TRUE", values: [] }
  if (user.role === "guard")
    return { sql: `${alias}.reporter_id=$${offset}`, values: [user.id] }
  if (user.role !== "supervisor") return { sql: "FALSE", values: [] }
  return {
    sql: `EXISTS(SELECT 1 FROM user_sites us WHERE us.site_id=${alias}.site_id AND us.user_id=$${offset})`,
    values: [user.id],
  }
}
