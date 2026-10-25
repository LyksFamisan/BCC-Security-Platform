import pg from "pg"
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max:3, idleTimeoutMillis:10000, connectionTimeoutMillis:10000 })
