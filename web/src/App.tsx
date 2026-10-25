import ConnectedApp from "./ConnectedApp"
import {ThemeProvider,ThemeToggle} from './ThemeProvider'
import './theme.css'
export { moduleMeta, roleModules } from "./prototypeMeta"
export type { Module } from "./prototypeMeta"
export default function App() { return <ThemeProvider><div className="theme-control"><ThemeToggle/></div><ConnectedApp /></ThemeProvider> }
