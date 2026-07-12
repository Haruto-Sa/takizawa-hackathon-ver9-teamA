import { handler, json } from '../_shared/http.ts'
import { admin, requireUser } from '../_shared/auth.ts'
import { demoTree } from '../_shared/demo.ts'
import { skillTreeSchema } from '../_shared/tree-schema.ts'
import { runGeneration } from '../_shared/generate.ts'
import * as treePrompt from '../_shared/prompts/generate-tree.ts'
Deno.serve(handler(async req=>{try{const user=await requireUser(req);const body=await req.json();if(typeof body.goal!=='string'||!Array.isArray(body.tags))return json({error:'invalid_input'},400);const db=admin();let fallback=false,raw:unknown;try{raw=await runGeneration({db,userId:user.id,functionName:'generate-tree',prompt:treePrompt,input:{goal:body.goal,tags:body.tags,details:body.details??[],interests:String(body.interests??'')}})}catch{fallback=true;raw=demoTree(body.goal,String(body.interests??''))}const tree=skillTreeSchema.parse(raw);const{data,error}=await db.from('trees').insert({user_id:user.id,tree_data:tree}).select('id').single();if(error)throw error;await db.from('profiles').upsert({id:user.id,goal:body.goal,interests:body.interests});return json({id:data.id,tree,fallback})}catch(e){return json({error:e instanceof Error?e.message:'failed'},e instanceof Error&&e.message==='unauthorized'?401:500)}}))
