// Edge Function: admin-users
// Deploy: Supabase Dashboard -> Edge Functions -> Add new function -> name: admin-users -> paste file ini -> Deploy
// Fungsi: akses tabel users (list / ganti role / reset password) khusus administrator,
// tanpa mengekspos service key ke browser.
const SB_URL = Deno.env.get('SUPABASE_URL') ?? 'https://sufiawwyymeoiqjtjbzd.supabase.co';
const KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-session-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function sb(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(SB_URL + path, {
    method,
    headers: {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res;
}

// Server verifies a random, revocable session. A username is never a credential.
async function secureSession(token: string | null) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const res=await fetch(SB_URL+'/rest/v1/rpc/csm_session_user', {
    method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_token:token})
  });
  if(!res.ok)return null;
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const user = await secureSession(req.headers.get('x-session-token'));
    if(!user)return json({error:'Sesi tidak valid.',code:'SESSION_EXPIRED'},401);
    if (String(user.role).toLowerCase() !== 'administrator') return json({ error: 'Forbidden: admin only' }, 403);

    const body = await req.json();
    // Role changes and credential resets must not trust the legacy Base64 token.
    if (body.action === 'update_role') {
      const proof=await fetch(SB_URL+'/rest/v1/rpc/csm_verify_admin', {
        method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
        body:JSON.stringify({p_session_username:user.username,p_username:body.adminUsername || null,p_password:body.adminPassword || null})
      });
      if(!proof.ok)return json({error:'Verifikasi admin belum tersedia.'},503);
      const verified=await proof.json();
      if(!verified?.success)return json({error:verified.error || 'Verifikasi admin ditolak.'},verified.status || 403);
    }

    if (body.action === 'list') {
      const res = await sb('/rest/v1/users?select=id,username,role,nama_lengkap&order=id.asc');
      if (!res.ok) return json({ error: 'DB list failed: ' + res.status }, 500);
      return json(await res.json());
    }

    if (body.action === 'update_role') {
      const roles=['administrator','IT Junior Support','IT Support Officer','IT Support Section Head','IT Support Staff'];
      if(!roles.some(role=>role.toLowerCase()===String(body.role).toLowerCase()) || !Number.isSafeInteger(body.id)) return json({error:'Role atau akun tidak valid.'},400);
      const res = await sb('/rest/v1/users?id=eq.' + encodeURIComponent(body.id), 'PATCH', { role: body.role });
      if (!res.ok) return json({ error: 'DB update failed: ' + res.status }, 500);
      return json({ ok: true });
    }

    if (body.action === 'reset_password') {
      const res=await sb('/rest/v1/rpc/csm_reset_password','POST',{
        p_token:req.headers.get('x-session-token'),p_admin:body.adminUsername,p_password:body.adminPassword,p_id:body.id
      });
      if(!res.ok)return json({error:'Reset gagal.'},500);
      const out=await res.json();return json(out,out.status || 200);
    }

    return json({ error: 'Bad action' }, 400);
  } catch (e) {
    return json({ error: 'Operasi server gagal.' }, 500);
  }
});
