import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token",
};

const ALLOWED_TABLES = ["master_barang", "data_entry", "log", "user_activity"];

// ============================================================================
// AUTO-PAGINATION
// ----------------------------------------------------------------------------
// PostgREST memotong setiap response pada `db-max-rows` (default 1000). Batas
// ini tidak bisa dilewati lewat `.limit()`: meminta limit=10000 tetap kembali
// 1000 baris. Satu-satunya cara mengambil lebih adalah `.range()` per jendela,
// yang sudah diverifikasi menembus batas tersebut.
//
// Karena itu action "get" sekarang mengambil data per jendela PAGE_SIZE dan
// menggabungkannya, sehingga tabel besar (data_entry ±4200 baris) termuat
// lengkap. Perilaku lama dipertahankan untuk request yang tidak butuh paginasi.
//
// Pagination HANYA diaktifkan bila client mengirim `order`. Tanpa urutan yang
// deterministik, jendela yang berurutan bisa tumpang tindih atau melompati
// baris. Semua query besar di client memakai order=id.desc, jadi aman.
// ============================================================================
const PAGE_SIZE = 1000;      // batas per-request dari PostgREST
const MAX_ROWS_TOTAL = 20000; // pengaman agar response tidak tak terkendali

const SB_URL=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sessionUser = await secureSession(req.headers.get("x-session-token"));
  const username=sessionUser?.username;
  if (!username) {
    return new Response(JSON.stringify({ error: "Sesi tidak valid.", code:"SESSION_EXPIRED" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const body = await req.json();
    body.params ??= {};
    const { action, table, params, data } = body;

    if (!ALLOWED_TABLES.includes(table)) {
      return new Response(JSON.stringify({ error: "Table not allowed" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // Only this branch can archive a master. The RPC rechecks credentials,
    // role, current row and every dependency within one transaction.
    if (action === "delete_master_guarded") {
      if (table !== "master_barang" || !data || typeof data.expected !== "object" ||
          !data.expected || Array.isArray(data.expected) ||
          !Number.isSafeInteger(data.id) || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.requestId || "") ||
          [data.username,data.password,data.name,data.code,data.reason].some(v => typeof v !== "string")) {
        return new Response(JSON.stringify({error:"Data konfirmasi tidak lengkap.",code:"VALIDATION"}),
          {status:422,headers:{...corsHeaders,"Content-Type":"application/json"}});
      }
      const {data: outcome,error} = await supabase.rpc("csm_delete_master", {
        p_session_username:username,p_username:data.username,p_password:data.password,
        p_id:data.id,p_name:data.name,p_code:data.code,p_reason:data.reason,
        p_expected:data.expected,p_request_id:data.requestId
      });
      if(error) throw error;
      return new Response(JSON.stringify(outcome), {status:outcome?.success?200:(outcome?.status || 500),
        headers:{...corsHeaders,"Content-Type":"application/json"}});
    }
    if (action === "delete" && table !== "user_activity") {
      return new Response(JSON.stringify({error:"Master dan riwayat tidak boleh dihapus lewat delete umum. Gunakan delete master terverifikasi.",code:"GUARDED_DELETE_REQUIRED"}),
        {status:403,headers:{...corsHeaders,"Content-Type":"application/json"}});
    }
    if(table==='log' && !['get','insert'].includes(action))return new Response(JSON.stringify({error:'Log hanya boleh ditambahkan.'}),{status:403,headers:{...corsHeaders,'Content-Type':'application/json'}});
    const admin=String(sessionUser.role).toLowerCase()==='administrator';
    if(action!=='get' && table!=='user_activity' && !(table==='log' && action==='insert') && !admin)
      return new Response(JSON.stringify({error:'Akses edit hanya administrator.'}),{status:403,headers:{...corsHeaders,'Content-Type':'application/json'}});
    if(table==='user_activity' && !admin) {
      if(action==='get') { body.params ??= {}; body.params.filters ??= {}; body.params.filters.username=username; }
      else if(action==='insert') {
        if(!Array.isArray(data))throw new Error('Invalid rows');
        for(const row of data){ row.username=username;row.nama_lengkap=sessionUser.nama_lengkap; }
      } else if(action==='update') {
        if(data?.matchCol!=='id' || !Number.isSafeInteger(Number(data.matchVal)))throw new Error('Invalid activity id');
        const owner=await supabase.from('user_activity').select('username').eq('id',data.matchVal).single();
        if(owner.error || owner.data?.username!==username)return new Response(JSON.stringify({error:'Akses ditolak.'}),{status:403,headers:{...corsHeaders,'Content-Type':'application/json'}});
        const allowed=['logout_time','active_seconds'];
        if(Object.keys(data.updateData || {}).some(key=>!allowed.includes(key)))throw new Error('Invalid activity update');
      } else return new Response(JSON.stringify({error:'Akses ditolak.'}),{status:403,headers:{...corsHeaders,'Content-Type':'application/json'}});
    }
    if(table==='log' && action==='insert')for(const row of data){row.user=username;}
    // Reject relational selects: public clients may only request this table's columns.
    if(params?.select && !/^(\*|[a-z_]+(?:,[a-z_]+)*)$/.test(params.select))throw new Error('Invalid select');
    let result;

    if (action === "get") {
      const selectCols = params?.select || "*";
      const filterEntries = params?.filters ? Object.entries(params.filters) : [];
      const order = params?.order;

      // Terapkan select + filter + order. Dipakai ulang oleh setiap jendela.
      const buildQuery = () => {
        let q = supabase.from(table).select(selectCols);
        // Code-only lookup includes archives so codes can never be reused.
        if (table === "master_barang" && selectCols !== "kode_barang") q = q.is("deleted_at",null);
        for (const [col, val] of filterEntries) {
          q = q.eq(col, val as string);
        }
        if (order) q = q.order(order.col, { ascending: order.asc });
        return q;
      };

      if (params?.range) {
        // Client mengirim jendela eksplisit -> hormati, satu request saja.
        const from = Number(params.range.from) || 0;
        const to = Number(params.range.to) || PAGE_SIZE - 1;
        const { data: rows, error } = await buildQuery().range(from, to);
        if (error) throw error;
        result = rows;

      } else {
        const requestedLimit =
          typeof params?.limit === "number" ? params.limit : null;

        // Paginasi hanya perlu bila client ingin lebih dari satu jendela,
        // dan hanya aman bila ada urutan deterministik.
        const wantsMoreThanOnePage =
          requestedLimit === null || requestedLimit > PAGE_SIZE;
        const shouldPaginate = wantsMoreThanOnePage && !!order;

        if (!shouldPaginate) {
          // ---- JALUR LAMA (tidak berubah sama sekali) ----
          let query = buildQuery();
          if (requestedLimit) query = query.limit(requestedLimit);
          const { data: rows, error } = await query;
          if (error) throw error;
          result = rows;

        } else {
          // ---- AUTO-PAGINATION ----
          const maxRows =
            requestedLimit === null
              ? MAX_ROWS_TOTAL
              : Math.min(requestedLimit, MAX_ROWS_TOTAL);

          const all: unknown[] = [];
          let from = 0;

          while (all.length < maxRows) {
            const to = Math.min(from + PAGE_SIZE - 1, maxRows - 1);
            const { data: rows, error } = await buildQuery().range(from, to);
            if (error) throw error;
            if (!rows || rows.length === 0) break;

            all.push(...rows);

            // Jendela terakhir: baris yang kembali lebih sedikit dari yang diminta.
            const windowSize = to - from + 1;
            if (rows.length < windowSize) break;

            from = to + 1;
          }

          result = all;
        }
      }

    } else if (action === "insert") {
      const { data: rows, error } = await supabase.from(table).insert(data).select();
      if (error) throw error;
      result = rows;

    } else if (action === "update") {
      const { matchCol, matchVal, updateData } = data;
      const { data: rows, error } = await supabase.from(table).update(updateData).eq(matchCol, matchVal).select();
      if (error) throw error;
      result = rows;

    } else if (action === "delete") {
      const { matchCol, matchVal } = data;
      const { error } = await supabase.from(table).delete().eq(matchCol, matchVal);
      if (error) throw error;
      result = { success: true };

    } else {
      return new Response(JSON.stringify({ error: "Action not allowed" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("api-proxy operation failed", (err as {code?:string})?.code || "unknown");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
