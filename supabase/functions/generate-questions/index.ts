import { handler, json } from '../_shared/http.ts'
import { admin, requireUser } from '../_shared/auth.ts'
import { runGeneration } from '../_shared/generate.ts'
import * as questionsPrompt from '../_shared/prompts/generate-questions.ts'
Deno.serve(handler(async req=>{try{const user=await requireUser(req);const{goal,tags}=await req.json();if(typeof goal!=='string'||!Array.isArray(tags))return json({error:'invalid_input'},400);try{const result=await runGeneration({db:admin(),userId:user.id,functionName:'generate-questions',prompt:questionsPrompt,input:{goal,tags}});return json(result)}catch{return json({questions:[tags.length?`${tags[0]}を使って、どんなものを作りましたか？`:`${goal}に興味を持ったきっかけは何ですか？`],fallback:true})}}catch{return json({error:'unauthorized'},401)}}))
