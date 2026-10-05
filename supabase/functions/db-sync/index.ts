// Edge Function: db-sync
// Deploy: Supabase Dashboard -> Edge Functions -> Add new function -> name: db-sync -> paste file ini -> Deploy
// JANGAN LUPA: matikan "Verify JWT" di settings function ini (auth dicek internal via x-session-token).
// Archive-aware backup and authenticated batch inserts. Destructive clear is disabled.
const SB_URL = Deno.env.get('SUPABASE_URL') ?? 'https://sufiawwyymeoiqjtjbzd.supabase.co';
const KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? '';
const ALLOWED = ['data_entry', 'master_barang'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-session-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function sb(path: string, method = 'GET', body?: unknown) {
  return fetch(SB_URL + path, {
    method,
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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
    if (!ALLOWED.includes(body.table)) return json({ error: 'Table not allowed' }, 400);

    if (body.action === 'dump') {
      const limit = Math.min(Number(body.limit) || 1000, 1000);
      const offset = Number(body.offset) || 0;
      const res = await fetch(SB_URL + '/rest/v1/' + body.table + '?select=*&order=id.asc&limit=' + limit + '&offset=' + offset, {
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY },
      });
      if (!res.ok) return json({ error: 'dump failed: ' + res.status }, 500);
      return json(await res.json());
    }

    if (body.action === 'clear') {
      return json({error:'Clear massal dinonaktifkan untuk menjaga riwayat dan arsip master. Gunakan impor tanpa menghapus data lama.',code:'DESTRUCTIVE_SYNC_BLOCKED'},409);
    }

    if (body.action === 'insert') {
      const proof=await fetch(SB_URL+'/rest/v1/rpc/csm_verify_admin', {
        method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
        body:JSON.stringify({p_session_username:user.username,p_username:body.adminUsername || null,p_password:body.adminPassword || null})
      });
      if(!proof.ok)return json({error:'Verifikasi admin belum tersedia.'},503);
      const verified=await proof.json();
      if(!verified?.success)return json({error:verified.error || 'Verifikasi admin ditolak.'},verified.status || 403);
      if (!Array.isArray(body.rows) || body.rows.length === 0) return json({ ok: true, inserted: 0 });
      const res = await sb('/rest/v1/' + body.table, 'POST', body.rows);
      if (!res.ok) return json({ error: 'insert failed: ' + res.status + ' ' + (await res.text()).slice(0, 200) }, 500);
      return json({ ok: true, inserted: body.rows.length });
    }

    return json({ error: 'Bad action' }, 400);
  } catch (e) {
    return json({ error: 'Operasi server gagal.' }, 500);
  }
});
