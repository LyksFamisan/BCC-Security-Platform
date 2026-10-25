import { useEffect, useMemo, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "./geofence-map.css"

type Site = { id: string; name: string; latitude?: number | null; longitude?: number | null; radius_m?: number | null }
type Point = { id: string; site_id: string; subject_id?: string; subject_name?: string; site_name?: string; data: Record<string, unknown> }
const coordinates = (lat: unknown, lng: unknown): lat is number => typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90 && typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180
const colors: Record<string, string> = { Inside: "#188565", Outside: "#d44435", Uncertain: "#c17b12", "Not configured": "#6f7890" }
function popup(lines: string[]) {
  const el = document.createElement("div")
  for (const line of lines) { const p=document.createElement("div"); p.textContent=line; el.append(p) }
  return el
}
export default function GeofenceMap({ sites, points = [], onPick }: { sites: Site[]; points?: Point[]; onPick?: (latitude: number, longitude: number) => void }) {
  const element = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), layers = useRef<L.FeatureGroup | null>(null)
  const pick = useRef(onPick), fitted = useRef("")
  pick.current = onPick
  const [site, setSite] = useState(""), [tileError, setTileError] = useState(false)
  const latest = useMemo(() => {
    const result = new Map<string, Point>()
    for (const point of points) {
      if (site && point.site_id !== site) continue
      if (!coordinates(point.data.latitude, point.data.longitude)) continue
      const key = `${point.subject_id}:${point.site_id}`
      if (!result.has(key) || +new Date(String(point.data.recorded_at)) > +new Date(String(result.get(key)!.data.recorded_at))) result.set(key, point)
    }
    return [...result.values()]
  }, [points, site])
  useEffect(() => {
    if (!element.current) return
    const instance = L.map(element.current, { scrollWheelZoom: false }).setView([12.88,121.77],5)
    map.current=instance
    L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom:19,
    }).on("tileerror",()=>setTileError(true)).addTo(instance)
    layers.current=L.featureGroup().addTo(instance)
    instance.on("click",(event:L.LeafletMouseEvent)=>pick.current?.(Number(event.latlng.lat.toFixed(6)),Number(event.latlng.lng.toFixed(6))))
    const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(element.current)
    return ()=>{observer.disconnect();instance.remove();map.current=null;layers.current=null}
  }, [])
  useEffect(() => {
    const group=layers.current, instance=map.current
    if (!group || !instance) return
    group.clearLayers()
    for (const s of sites) {
      if ((site && s.id!==site) || !coordinates(s.latitude,s.longitude)) continue
      const center:L.LatLngExpression=[s.latitude!,s.longitude!]
      if (s.radius_m && s.radius_m>0) L.circle(center,{radius:s.radius_m,color:"#7656cf",weight:2,fillOpacity:.12}).bindPopup(popup([s.name,`Site boundary · ${s.radius_m} m radius`])).addTo(group)
      L.circleMarker(center,{radius:5,color:"#fff",weight:2,fillColor:"#365de0",fillOpacity:1}).bindPopup(popup([s.name,"Site centre"])).addTo(group)
    }
    for (const p of latest) {
      const status=String(p.data.geofence_status || "Not configured"), color=colors[status] || colors["Not configured"]
      const age=Date.now()- +new Date(String(p.data.recorded_at)), stale=!Number.isFinite(age)||age>15*60000
      const time=new Date(String(p.data.recorded_at)); const timestamp=Number.isNaN(+time)?"Unknown time":time.toLocaleString()
      L.circleMarker([Number(p.data.latitude),Number(p.data.longitude)],{radius:9,color:stale?"#667085":"#fff",weight:3,fillColor:color,fillOpacity:stale?.45:1})
        .bindPopup(popup([p.subject_name || "Guard",p.site_name || "",`${status}${stale?" · Stale location":""}`,`Last shared: ${timestamp}`,`GPS accuracy: ±${p.data.accuracy} m`])).addTo(group)
    }
    if (group.getLayers().length && fitted.current !== site+":ready") { instance.fitBounds(group.getBounds().pad(.2),{maxZoom:16}); fitted.current=site+":ready" }
  }, [sites,latest,site])
  return <section className="ops-panel geofence-map-panel" aria-label="Geofence map">
    <div className="geofence-map-toolbar"><h3>Site & guard map</h3><label>Site<select aria-label="Map site" value={site} onChange={e=>{fitted.current="";setSite(e.target.value)}}><option value="">All accessible sites</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button type="button" onClick={()=>{const bounds=layers.current?.getBounds();if(bounds?.isValid())map.current?.fitBounds(bounds.pad(.2),{maxZoom:16})}}>Fit all markers</button></div>
    <div ref={element} className="geofence-map" aria-label="Interactive site boundary and guard location map" />
    <div className="geofence-map-legend"><span>Site boundary</span><span>Inside</span><span>Outside</span><span>Uncertain</span><span>Faded: older than 15 minutes</span></div>
    {onPick && <p className="map-caption">Click the map to set the site centre, then save the site.</p>}
    {!latest.length && !onPick && <p className="map-caption">No shared guard locations yet. Configured site boundaries appear on the map.</p>}
    {tileError && <p role="status" className="map-caption">Map tiles could not load. Check your internet connection; site and guard markers remain available.</p>}
  </section>
}
