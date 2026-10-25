import { createServer } from "node:http"
import { Server } from "socket.io"
import { createApp } from "./app.js"
import jwt from "jsonwebtoken"
export function createService(pool, secret) {
  if (!secret || secret.length < 32 || secret.startsWith("replace-"))
    throw Error("Set a random JWT_SECRET of at least 32 characters")
  let io
  const app = createApp(pool, secret, (row) => {
    io.to("operations")
      .to("user:" + row.reporter_id)
      .to("site:" + row.site_id)
      .emit("incidents:changed")
  })
  const server = createServer(app)
  io = new Server(server, {
    cors: {
      origin: (process.env.WEB_ORIGINS || "http://localhost:8443").split(","),
    },
  })
  io.use(async (socket, next) => {
    try {
      socket.data.user = await app.locals.identity(socket.handshake.auth.token)
      next()
    } catch {
      next(Error("Unauthorized"))
    }
  })
  io.on("connection", async (socket) => {
    const u = socket.data.user
    const expires = jwt.decode(socket.handshake.auth.token).exp * 1000
    const timer = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, expires - Date.now()),
    )
    socket.on("disconnect", () => clearTimeout(timer))
    socket.join("user:" + u.id)
    if (u.role === "operations") socket.join("operations")
    if (u.role === "supervisor") {
      try {
        const { rows } = await pool.query(
          "SELECT site_id FROM user_sites WHERE user_id=$1",
          [u.id],
        )
        for (const r of rows) socket.join("site:" + r.site_id)
      } catch {
        socket.disconnect(true)
      }
    }
    socket.emit("incidents:changed")
  })
  return { app, server, io }
}
