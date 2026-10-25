import {createApp} from './app.js'
export function createHostedHandler(pool,secret){
 if(!secret||secret.length<32)throw Error('Server authentication is not configured')
 const app=createApp(pool,secret)
 return (req,res)=>{req.url=req.url.replace(/^\/api(?=\/|\?|$)/,'')||'/';return app(req,res)}
}
