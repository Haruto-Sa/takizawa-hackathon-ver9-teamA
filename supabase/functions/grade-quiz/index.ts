import { handler, json } from '../_shared/http.ts'
import { admin, requireUser } from '../_shared/auth.ts'
Deno.serve(handler(async req=>{try{const user=await requireUser(req);const{quiz_id,answers}=await req.json();if(typeof quiz_id!=='string'||!Array.isArray(answers)||!answers.every(Number.isInteger))return json({error:'invalid_input'},400);const{data,error}=await admin().rpc('grade_quiz_transaction',{p_quiz_id:quiz_id,p_user_id:user.id,p_answers:answers});if(error)return json({error:error.message},409);return json(data)}catch{return json({error:'unauthorized'},401)}}))
