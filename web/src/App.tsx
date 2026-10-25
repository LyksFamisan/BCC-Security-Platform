import { lazy, Suspense, useState } from "react"
import ConnectedApp from "./ConnectedApp"
export { moduleMeta, roleModules } from "./prototypeMeta"
export type { Module } from "./prototypeMeta"
const Prototype = lazy(() => import("./PrototypeApp"))
export default function App() {
  const [prototype, setPrototype] = useState(false)
  return (
    <>
      <div
        style={{
          padding: 8,
          background: "#102439",
          color: "white",
          textAlign: "center",
        }}
      >
        <button onClick={() => setPrototype((v) => !v)}>
          {prototype
            ? "Open connected incident platform"
            : "View preserved prototype (sample data only)"}
        </button>
        {prototype && (
          <strong>
            {" "}
            Prototype only — simulated login and local data; no shared API.
          </strong>
        )}
      </div>
      {prototype ? (
        <Suspense fallback={<p>Loading prototype…</p>}>
          <Prototype />
        </Suspense>
      ) : (
        <ConnectedApp />
      )}
    </>
  )
}
