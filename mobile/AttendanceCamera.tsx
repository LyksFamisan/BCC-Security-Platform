import React, {useEffect, useRef, useState} from "react"
import {ActivityIndicator, Modal, Pressable, Text, View, Linking} from "react-native"
import {CameraView, useCameraPermissions} from "expo-camera"
import {SafeAreaView} from "react-native-safe-area-context"
import type {GpsPosition} from "./gps"
export type AttendanceCapture = {sessionId:string;event:string;site:string;post:string;coords:GpsPosition|null;gpsError?:string;geofenceStatus?:string}
export default function AttendanceCamera({capture,onDone,onCancel,onRetryGps}:{capture:AttendanceCapture|null;onDone:(uri:string)=>void;onCancel:()=>void;onRetryGps:()=>void}) {
  const camera=useRef<CameraView>(null)
  const captureInFlight=useRef(false)
  const activeSession=useRef(capture?.sessionId)
  activeSession.current=capture?.sessionId
  const [permission,requestPermission]=useCameraPermissions()
  const [ready,setReady]=useState(false),[taking,setTaking]=useState(false),[error,setError]=useState("")
  const [now,setNow]=useState(Date.now())
  useEffect(()=>{captureInFlight.current=false;setReady(false);setError("");setTaking(false);setNow(Date.now());if(!capture)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[capture?.sessionId])
  async function take() {
    if(!ready || captureInFlight.current || !capture?.coords)return
    const session=capture.sessionId
    captureInFlight.current=true
    setTaking(true);setError("")
    try {const image=await camera.current?.takePictureAsync({quality:0.7});if(!image?.uri)throw Error("No photo was captured. Keep the camera open and try again.");if(activeSession.current===session)onDone(image.uri)}
    catch(e){if(activeSession.current===session)setError((e as Error).message)}finally{captureInFlight.current=false;if(activeSession.current===session)setTaking(false)}
  }
  const cancel=()=>{if(!captureInFlight.current)onCancel()}
  const button=(label:string,onPress:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={{backgroundColor:disabled?"#536273":"#df681e",padding:16,borderRadius:14,alignItems:"center",minHeight:52}}><Text style={{color:"white",fontWeight:"800"}}>{label}</Text></Pressable>
  if(!capture) return null
  return <Modal visible={!!capture} animationType="slide" onRequestClose={cancel}><SafeAreaView style={{flex:1,backgroundColor:"#07172b"}}>
    <View style={{padding:16,gap:8}}><Text style={{color:"white",fontSize:24,fontWeight:"800"}}>{capture?.event==="out"?"Time Out":"Time In"} · Selfie</Text><Text style={{color:"#c8d8ec"}}>{capture?.site} · {capture?.post}</Text></View>
    {!permission ? <ActivityIndicator/> : !permission.granted ? <View style={{padding:20,gap:16}}><Text style={{color:"white"}}>Allow camera access to capture your attendance selfie.</Text>{button(permission.canAskAgain?"Allow camera":"Open camera settings",()=>{if(permission.canAskAgain)void requestPermission().catch(e=>setError(e.message));else void Linking.openSettings()})}{!permission.canAskAgain&&<Text style={{color:"#ffa765"}}>Enable Camera in phone Settings → Apps → Expo Go → Permissions.</Text>}</View> : <View style={{flex:1,marginHorizontal:16,borderRadius:20,overflow:"hidden",backgroundColor:"#142941"}}>
      <CameraView ref={camera} style={{flex:1}} facing="front" mode="picture" onCameraReady={()=>setReady(true)} onMountError={e=>setError(e.message)}/>
      <View pointerEvents="none" style={{position:"absolute",bottom:0,left:0,right:0,backgroundColor:"#07172be8",padding:14,gap:5}}>
        <Text style={{color:"#ffa765",fontWeight:"800"}}>{capture?.event==="out"?"TIME OUT":"TIME IN"} · {new Date(now).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}</Text>
        <Text style={{color:"white"}}>{capture?.site} · {capture?.post}</Text>
        <Text style={{color:"white"}}>GPS {capture.coords ? `${capture.coords.latitude.toFixed(6)}, ${capture.coords.longitude.toFixed(6)}` : "Getting precise location…"}</Text>
        <Text style={{color:"#c8d8ec"}}>{capture.coords ? `Accuracy ±${Math.round(capture.coords.accuracy)} m · ${capture.geofenceStatus==="Not configured" ? "Geofence not configured" : "Inside site geofence"}` : capture.gpsError || "Checking GPS and site boundary…"}</Text>
      </View>
    </View>}
    <View style={{padding:16,gap:10}}>{!!capture.gpsError&&<><Text accessibilityRole="alert" style={{color:"#ffb6a1"}}>{capture.gpsError}</Text>{button("Retry GPS & geofence",onRetryGps)}</>}{!!error&&<Text accessibilityRole="alert" style={{color:"#ffb6a1"}}>{error}</Text>}{permission?.granted&&button(taking?"Capturing…":"Capture & send attendance",()=>void take(),!ready||taking||!capture.coords)}{button("Cancel",cancel,taking)}<Text style={{color:"#b7c9df",fontSize:12,textAlign:"center"}}>Saved photo includes server timestamp, GPS and geofence status.</Text></View>
  </SafeAreaView></Modal>
}
