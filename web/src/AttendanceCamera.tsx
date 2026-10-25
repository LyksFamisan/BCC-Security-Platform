import {useEffect,useRef,useState} from "react"

export default function AttendanceCamera({title,onCapture,onClose}:{title:string;onCapture:(file:File)=>void;onClose:()=>void}) {
  const video=useRef<HTMLVideoElement>(null)
  const [facing,setFacing]=useState<"user"|"environment">("user")
  const [photo,setPhoto]=useState<{file:File;url:string}|null>(null)
  const [ready,setReady]=useState(false),[error,setError]=useState(""),[attempt,setAttempt]=useState(0),[capturing,setCapturing]=useState(false)
  const alive=useRef(true)
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
  useEffect(()=>()=>{if(photo)URL.revokeObjectURL(photo.url)},[photo])
  useEffect(()=>{
    if(photo) return
    let active=true,stream:MediaStream|undefined
    setReady(false);setError("")
    if(!navigator.mediaDevices?.getUserMedia){setError("Camera unavailable. Open this HTTPS page in Chrome or Safari and allow camera access.");return}
    void navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:960}}}).then(async value=>{
      stream=value
      if(!active){value.getTracks().forEach(track=>track.stop());return}
      if(video.current){video.current.srcObject=value;await video.current.play()}
    }).catch(reason=>{if(active)setError(reason?.name === "NotAllowedError" ? "Camera access denied. Allow Camera in browser/phone settings, then retry." : reason?.name === "NotFoundError" ? "No camera found on this device." : "Could not open camera. Close other apps using it and retry.")})
    return()=>{active=false;stream?.getTracks().forEach(track=>track.stop())}
  },[facing,!!photo,attempt])
  function capture(){
    if(!video.current?.videoWidth || !ready) return
    const source=video.current, scale=Math.min(1,1280/Math.max(source.videoWidth,source.videoHeight))
    const canvas=document.createElement("canvas");canvas.width=Math.round(source.videoWidth*scale);canvas.height=Math.round(source.videoHeight*scale)
    const context=canvas.getContext("2d");if(!context){setError("Could not capture image. Retry.");return}
    context.drawImage(source,0,0,canvas.width,canvas.height);setCapturing(true)
    canvas.toBlob(blob=>{
      if(!alive.current)return
      setCapturing(false)
      if(!blob || blob.size>3*1024*1024){setError("Photo could not be captured under 3 MB. Retry.");return}
      const file=new File([blob],"attendance-"+Date.now()+".jpg",{type:"image/jpeg"})
      setPhoto({file,url:URL.createObjectURL(file)})
    },"image/jpeg",.8)
  }
  return <div className="attendance-camera-backdrop" role="dialog" aria-modal="true" aria-label="Attendance camera" onKeyDown={event=>{if(event.key === "Escape")onClose();if(event.key === "Tab"){const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus()}}}}>
    <section className="attendance-camera-panel"><div className="guard-row"><h2>{title}</h2><button type="button" className="guard-secondary" autoFocus onClick={onClose}>Close camera</button></div>
      {photo ? <img className="attendance-camera-preview" src={photo.url} alt="Captured attendance photo preview" /> : <video ref={video} className={"attendance-camera-preview"+(facing === "user"?" mirror":"")} autoPlay muted playsInline onLoadedData={()=>setReady(true)} aria-label="Live camera preview" />}
      {error && <p className="guard-error" role="alert">{error}</p>}
      {!photo && !ready && !error && <p role="status">Opening camera…</p>}
      <div className="attendance-camera-actions">{photo ? <><button type="button" className="guard-secondary" onClick={()=>setPhoto(null)}>Retake photo</button><button type="button" className="guard-primary" onClick={()=>onCapture(photo.file)}>Use photo</button></> : <><button type="button" className="guard-secondary" disabled={capturing} onClick={()=>setFacing(value=>value === "user"?"environment":"user")}>Switch camera</button><button type="button" className="guard-primary" disabled={!ready||capturing||!!error} onClick={capture}>{capturing?"Capturing…":"Capture photo"}</button>{error && <button type="button" className="guard-secondary" onClick={()=>setAttempt(value=>value+1)}>Retry camera</button>}</>}</div>
    </section>
  </div>
}
