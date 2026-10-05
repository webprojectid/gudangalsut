const SB_URL=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')!;
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, x-session-token','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const json=(out:unknown,status=200)=>new Response(JSON.stringify(out),{status,headers:{...CORS,'Content-Type':'application/json'}});
async function rpc(name:string,body:unknown){
 const res=await fetch(SB_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!res.ok)return json({error:'Layanan autentikasi belum tersedia.'},503);
 const out=await res.json();return json(out,out?.status || 200);
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try {const body=await req.json();
 if(typeof body.oldPassword!=='string'||typeof body.newPassword!=='string')return json({error:'Input tidak valid.'},400);
 return await rpc('csm_change_password',{p_token:req.headers.get('x-session-token'),p_old:body.oldPassword,p_new:body.newPassword});
 }catch{return json({error:'Permintaan gagal.'},400);}
});
