type CaptureRecord = {id:string;[key:string]:unknown}
export async function sendAttendance<T extends CaptureRecord>({send,findSaved,onRetry,wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))}:{send:()=>Promise<T>;findSaved:()=>Promise<T|undefined>;onRetry:(attempt:number)=>void;wait?:(ms:number)=>Promise<void>}):Promise<T> {
  for(let attempt=1;attempt<=3;attempt++) {
    try {return await send()} catch(error) {
      if(!(error as {network?:boolean}).network && !(error as {retryable?:boolean}).retryable)throw error
      try {const saved=await findSaved();if(saved)return saved}catch{}
      if(attempt===3)throw Error('Attendance could not be confirmed. Check your internet, then refresh attendance before trying again.')
      onRetry(attempt+1);await wait(attempt*1500)
    }
  }
  throw Error('Attendance could not be confirmed')
}
