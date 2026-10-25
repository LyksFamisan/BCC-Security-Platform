export type FenceSite={id:string;name:string;latitude?:number|null;longitude?:number|null;radius_m?:number|null}
export type FencePosition={latitude:number;longitude:number;accuracy:number}
export function siteFence(position:FencePosition|null,site?:FenceSite){
  if(site?.latitude==null||site.longitude==null||!site.radius_m)return {status:"Not configured",distance:null}
  if(!position)return {status:"GPS not checked",distance:null}
  const rad=(n:number)=>n*Math.PI/180,a=Math.sin(rad(position.latitude-site.latitude)/2)**2+Math.cos(rad(site.latitude))*Math.cos(rad(position.latitude))*Math.sin(rad(position.longitude-site.longitude)/2)**2
  const distance=6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)))
  const status=position.accuracy>Math.min(site.radius_m,100)?"Uncertain":distance+position.accuracy<=site.radius_m?"Inside":distance-position.accuracy>site.radius_m?"Outside":"Uncertain"
  return {status,distance:Math.round(distance)}
}
