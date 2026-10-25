import * as Location from "expo-location"
import { Platform } from "react-native"

export type GpsPosition = { latitude: number; longitude: number; accuracy: number }

// Use a fresh foreground fix; never fall back to a cached or assigned-site location.
export async function getDutyPosition(): Promise<GpsPosition> {
  if (!await Location.hasServicesEnabledAsync()) throw Error("Location is off. Turn on your phone's Location/GPS, then try again.")
  const permission = await Location.requestForegroundPermissionsAsync()
  if (!permission.granted) throw Error(permission.canAskAgain ? "Allow precise location access to use attendance and GPS." : "Location access is blocked. Open phone Settings → Apps → this app → Permissions, allow precise location, then retry.")
  return new Promise((resolve, reject) => {
    let subscription: Location.LocationSubscription | undefined
    let finished = false, lastAccuracy: number | null = null
    const finish = (error?: Error, position?: GpsPosition) => {
      if (finished) return
      finished=true
      clearTimeout(timer)
      subscription?.remove()
      if(error) reject(error); else resolve(position!)
    }
    const timer=setTimeout(()=>finish(Error(lastAccuracy === null ? "Could not get GPS within 30 seconds. Move outdoors, enable precise location and try again." : `GPS accuracy is ±${Math.round(lastAccuracy)} m. Move outdoors and retry for a more accurate position.`)),30000)
    void Location.watchPositionAsync({accuracy:Location.Accuracy.High, timeInterval:1000, distanceInterval:0}, location => {
      if(Platform.OS === "android" && location.mocked) return finish(Error("Mock location detected. Turn off mock location before checking in."))
      if(!Number.isFinite(location.timestamp) || Date.now()-location.timestamp>15000) return
      const {latitude,longitude,accuracy}=location.coords
      if(!Number.isFinite(latitude)||latitude < -90||latitude > 90||!Number.isFinite(longitude)||longitude < -180||longitude > 180||accuracy===null||!Number.isFinite(accuracy)||accuracy<0) return
      lastAccuracy=accuracy
      if(accuracy>100) return
      finish(undefined,{latitude,longitude,accuracy})
    }).then(value=>{subscription=value;if(finished)value.remove()}).catch(error=>finish(Error(error instanceof Error ? error.message : "GPS unavailable. Check location permissions and retry.")))
  })
}

export function geofenceStatus(position:GpsPosition,site:{latitude?:number|null;longitude?:number|null;radius_m?:number|null}) {
  if(site.latitude==null || site.longitude==null || !site.radius_m) return {status:"Not configured",distance:null,radius:site.radius_m ?? null}
  const rad=(v:number)=>v*Math.PI/180
  const dlat=rad(position.latitude-site.latitude),dlng=rad(position.longitude-site.longitude)
  const a=Math.sin(dlat/2)**2+Math.cos(rad(site.latitude))*Math.cos(rad(position.latitude))*Math.sin(dlng/2)**2
  const distance=6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)))
  const status=position.accuracy>Math.min(site.radius_m,100)?"Uncertain":distance+position.accuracy<=site.radius_m?"Inside":distance-position.accuracy>site.radius_m?"Outside":"Uncertain"
  return {status,distance:Math.round(distance),radius:site.radius_m}
}
export function nextAttendanceEvent(rows:{data:Record<string,any>}[],shiftId:string):"in"|"out" {
  const events=rows.filter(row=>row.data.shift_id===shiftId), cycle=events.reduce((n,row)=>Math.max(n,Number(row.data.cycle || 1)),0)
  const current=events.filter(row=>Number(row.data.cycle || 1)===cycle)
  return current.some(row=>row.data.event === "in") && !current.some(row=>row.data.event === "out") ? "out" : "in"
}
