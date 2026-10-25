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
