import { lazy, Suspense, useState } from "react"
import ConnectedApp from "./ConnectedApp"
export { moduleMeta, roleModules } from "./prototypeMeta"
export type { Module } from "./prototypeMeta"
const Prototype = lazy(() => import("./PrototypeApp"))
const connectedAvailable = Boolean(import.meta.env.VITE_API_URL) || import.meta.env.DEV
export default function App() {
  const [prototype, setPrototype] = useState(!connectedAvailable)
  return (
    <>
      <div style={{ padding: 8, background: "#102439", color: "white", textAlign: "center" }}>
        {connectedAvailable && (
          <button onClick={() => setPrototype((v) => !v)}>
            {prototype ? "Open connected incident platform" : "View preserved prototype (sample data only)"}
          </button>
        )}
        {prototype && (
          <strong> Demo — sample data and simulated login only. {connectedAvailable ? "No shared API in this mode." : "Live Guard-to-Web sync is pending backend setup."}</strong>
        )}
      </div>
      {prototype ? (
        <Suspense fallback={<p>Loading prototype…</p>}><Prototype /></Suspense>
      ) : <ConnectedApp />}
    </>
  )
}
