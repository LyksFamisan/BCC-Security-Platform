import {createContext,useContext,useEffect,useState,type ReactNode} from 'react'
type Mode='light'|'dark'
const ThemeContext=createContext<{mode:Mode;toggle:()=>void}>({mode:'light',toggle:()=>{}})
export function ThemeProvider({children}:{children:ReactNode}){
 const [mode,setMode]=useState<Mode>(()=>{try{const saved=localStorage.getItem('bcc-theme');if(saved==='dark'||saved==='light')return saved}catch{}return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'})
 useEffect(()=>{document.documentElement.dataset.bccTheme=mode;document.documentElement.style.colorScheme=mode;try{localStorage.setItem('bcc-theme',mode)}catch{}},[mode])
 return <ThemeContext.Provider value={{mode,toggle:()=>setMode(v=>v==='dark'?'light':'dark')}}>{children}</ThemeContext.Provider>
}
export function ThemeToggle(){const {mode,toggle}=useContext(ThemeContext);return <button type="button" className="theme-toggle" role="switch" aria-label="Dark mode" aria-checked={mode==='dark'} onClick={toggle}><span aria-hidden="true">{mode==='dark'?'☾':'☀'}</span><span>{mode==='dark'?'Dark':'Light'}</span><span className="theme-track" aria-hidden="true"><span/></span></button>}
