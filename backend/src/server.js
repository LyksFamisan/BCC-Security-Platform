import { pool } from "./db.js"
import { createService } from "./service.js"
const { server, io } = createService(pool, process.env.JWT_SECRET)
server.listen(Number(process.env.PORT || 3001), "0.0.0.0", () =>
  console.log("BCC API listening"),
)
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    io.close()
    server.close(async () => {
      await pool.end()
      process.exit(0)
    })
  })
