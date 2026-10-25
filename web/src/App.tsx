import ConnectedApp from "./ConnectedApp"
import GuardPortal from "./GuardPortal"
import {ThemeProvider,ThemeToggle} from './ThemeProvider'
import './theme.css'
export { moduleMeta, roleModules } from "./prototypeMeta"
export type { Module } from "./prototypeMeta"
export default function App() {
  if (window.location.pathname.replace(/\/$/, "") === "/guard") return <GuardPortal />
  return <ThemeProvider><div className="theme-control"><ThemeToggle/></div><ConnectedApp /></ThemeProvider>
}
