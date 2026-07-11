export const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"}
export function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}})}
export function handler(fn:(req:Request)=>Promise<Response>){return async(req:Request)=>req.method==='OPTIONS'?new Response('ok',{headers:cors}):fn(req)}
