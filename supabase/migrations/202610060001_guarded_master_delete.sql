BEGIN;
ALTER TABLE public.master_barang
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by text,
  ADD COLUMN IF NOT EXISTS deleted_reason text,
  ADD COLUMN IF NOT EXISTS delete_request_id uuid;

CREATE TABLE IF NOT EXISTS public.master_delete_audit (
  request_id uuid PRIMARY KEY, master_id bigint NOT NULL,
  kode_barang text NOT NULL, actor text NOT NULL, reason text NOT NULL,
  snapshot jsonb NOT NULL, deleted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.master_delete_attempts (
  username text PRIMARY KEY, failures integer NOT NULL DEFAULT 0,
  window_started timestamptz NOT NULL DEFAULT now(), blocked_until timestamptz
);
ALTER TABLE public.master_delete_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_delete_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.master_delete_audit, public.master_delete_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.master_delete_audit TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.master_delete_attempts TO service_role;

-- Key-share checks and the deletion RPC's FOR UPDATE use the same row lock.
CREATE OR REPLACE FUNCTION public.csm_entry_master_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE archived timestamptz;
BEGIN
  SELECT deleted_at INTO archived FROM public.master_barang
    WHERE kode_barang = NEW.kode_barang FOR KEY SHARE;
  IF NOT FOUND OR archived IS NOT NULL THEN
    RAISE EXCEPTION 'Barang tidak aktif. Muat ulang daftar barang.' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END; $$;
-- Operational logs take the same row lock, preventing a concurrent history
-- insert from slipping between the dependency check and archival.
CREATE OR REPLACE FUNCTION public.csm_log_master_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE archived timestamptz;
BEGIN
  IF NEW.kode_barang IS NULL OR NEW.kode_barang='' THEN RETURN NEW; END IF;
  SELECT deleted_at INTO archived FROM public.master_barang
    WHERE kode_barang=NEW.kode_barang FOR KEY SHARE;
  IF FOUND AND archived IS NOT NULL THEN
    RAISE EXCEPTION 'Log operasional untuk master yang diarsipkan ditolak.' USING ERRCODE='23503';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS csm_log_master_guard ON public.log;
CREATE TRIGGER csm_log_master_guard BEFORE INSERT OR UPDATE OF kode_barang ON public.log
FOR EACH ROW EXECUTE FUNCTION public.csm_log_master_guard();
REVOKE ALL ON FUNCTION public.csm_log_master_guard() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.csm_master_archive_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Penghapusan fisik master dilarang. Gunakan delete terverifikasi.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NOT NULL OR NEW.deleted_by IS NOT NULL OR NEW.deleted_reason IS NOT NULL OR NEW.delete_request_id IS NOT NULL THEN
      RAISE EXCEPTION 'Metadata arsip hanya boleh diisi oleh proses delete.' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF OLD.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Barang sudah diarsipkan. Perubahan stok atau identitas ditolak.' USING ERRCODE = '42501';
    END IF;
    IF ROW(OLD.deleted_at,OLD.deleted_by,OLD.deleted_reason,OLD.delete_request_id)
       IS DISTINCT FROM ROW(NEW.deleted_at,NEW.deleted_by,NEW.deleted_reason,NEW.delete_request_id)
       AND coalesce(current_setting('csm.archive_guard',true),'') <> txid_current()::text || ':' || OLD.id::text THEN
      RAISE EXCEPTION 'Delete memerlukan verifikasi ulang administrator.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS csm_entry_master_guard ON public.data_entry;
CREATE TRIGGER csm_entry_master_guard BEFORE INSERT OR UPDATE OF kode_barang ON public.data_entry
FOR EACH ROW EXECUTE FUNCTION public.csm_entry_master_guard();
DROP TRIGGER IF EXISTS csm_master_archive_guard ON public.master_barang;
CREATE TRIGGER csm_master_archive_guard BEFORE INSERT OR UPDATE OR DELETE ON public.master_barang
FOR EACH ROW EXECUTE FUNCTION public.csm_master_archive_guard();
REVOKE ALL ON FUNCTION public.csm_entry_master_guard(), public.csm_master_archive_guard() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.csm_verify_admin(p_session_username text,p_username text,p_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE account public.users%ROWTYPE; attempt public.master_delete_attempts%ROWTYPE;
BEGIN
  IF p_session_username IS DISTINCT FROM p_username OR p_username IS NULL OR length(p_username)>100
     OR p_password IS NULL OR length(p_password) NOT BETWEEN 1 AND 1024 THEN
    RETURN jsonb_build_object('error','Konfirmasi akun tidak sesuai sesi login.','code','INVALID_CREDENTIALS','status',401);
  END IF;
  SELECT * INTO account FROM public.users WHERE username = p_username FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Username atau password salah.','code','INVALID_CREDENTIALS','status',401); END IF;
  INSERT INTO public.master_delete_attempts(username) VALUES(p_username) ON CONFLICT DO NOTHING;
  SELECT * INTO attempt FROM public.master_delete_attempts WHERE username=p_username FOR UPDATE;
  IF attempt.blocked_until > now() THEN
    RETURN jsonb_build_object('error','Terlalu banyak percobaan. Tunggu 5 menit.','code','RATE_LIMITED','status',429);
  END IF;
  IF attempt.window_started < now()-interval '5 minutes' OR attempt.blocked_until IS NOT NULL THEN
    UPDATE public.master_delete_attempts SET failures=0,window_started=now(),blocked_until=null WHERE username=p_username;
    attempt.failures:=0;
  END IF;
  -- Matches the existing login backend's credential format. No password is logged.
  IF p_password IS DISTINCT FROM account.password THEN
    UPDATE public.master_delete_attempts SET failures=attempt.failures+1,
      blocked_until=CASE WHEN attempt.failures+1>=5 THEN now()+interval '5 minutes' ELSE null END WHERE username=p_username;
    RETURN jsonb_build_object('error','Username atau password salah.','code','INVALID_CREDENTIALS','status',401);
  END IF;
  IF md5(account.password)='8761cb3983f1d4afcd48f53c8854ebbe' THEN
    RETURN jsonb_build_object('error','Ganti password awal sebelum menggunakan delete.','code','PASSWORD_CHANGE_REQUIRED','status',403);
  END IF;
  UPDATE public.master_delete_attempts SET failures=0,blocked_until=null,window_started=now() WHERE username=p_username;
  IF lower(coalesce(account.role,'')) <> 'administrator' THEN
    RETURN jsonb_build_object('error','Hanya administrator yang dapat menghapus master.','code','FORBIDDEN','status',403);
  END IF;
  RETURN jsonb_build_object('success',true);
END; $$;
REVOKE ALL ON FUNCTION public.csm_verify_admin(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.csm_verify_admin(text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.csm_delete_master(
  p_session_username text, p_username text, p_password text, p_id bigint,
  p_name text, p_code text, p_reason text, p_expected jsonb, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item public.master_barang%ROWTYPE; auth_result jsonb; snapshot jsonb; event_id bigint;
  fields text[] := ARRAY['deleted_at','deleted_by','deleted_reason','delete_request_id'];
BEGIN
  auth_result:=public.csm_verify_admin(p_session_username,p_username,p_password);
  IF NOT coalesce((auth_result->>'success')::boolean,false) THEN RETURN auth_result; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 12 AND 600
     OR p_request_id IS NULL OR p_expected IS NULL OR p_id IS NULL THEN
    RETURN jsonb_build_object('error','Alasan harus 12–600 karakter dan data konfirmasi wajib lengkap.','code','VALIDATION','status',422);
  END IF;
  SELECT * INTO item FROM public.master_barang WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Barang tidak ditemukan.','code','NOT_FOUND','status',404); END IF;
  IF btrim(p_name) IS DISTINCT FROM item.nama_barang OR btrim(p_code) IS DISTINCT FROM item.kode_barang THEN
    RETURN jsonb_build_object('error','Nama dan kode yang diketik tidak cocok.','code','IDENTITY_MISMATCH','status',422);
  END IF;
  IF item.deleted_at IS NOT NULL THEN
    IF item.delete_request_id=p_request_id AND item.deleted_by=p_username THEN
      RETURN jsonb_build_object('success',true,'id',item.id,'kode_barang',item.kode_barang,'duplicate',true);
    END IF;
    RETURN jsonb_build_object('error','Barang sudah dihapus dari inventaris aktif.','code','ALREADY_DELETED','status',409);
  END IF;
  snapshot:=to_jsonb(item);
  IF (snapshot-fields) IS DISTINCT FROM (p_expected-fields) THEN
    RETURN jsonb_build_object('error','Data barang berubah sejak form dibuka. Buka ulang form delete.','code','STALE_MASTER','status',409);
  END IF;
  IF EXISTS(SELECT 1 FROM public.data_entry WHERE kode_barang=item.kode_barang) THEN
    RETURN jsonb_build_object('error','Barang memiliki riwayat transaksi atau peminjaman. Delete ditolak.','code','HAS_TRANSACTIONS','status',409);
  END IF;
  IF EXISTS(SELECT 1 FROM public.log WHERE kode_barang=item.kode_barang
    AND NOT coalesce((halaman='Master Barang' AND aksi IN ('Tambah Barang','Edit Barang')),false)) THEN
    RETURN jsonb_build_object('error','Barang memiliki riwayat operasional. Delete ditolak.','code','HAS_HISTORY','status',409);
  END IF;
  IF coalesce(item.masuk_peminjaman,0)<>0 OR coalesce(item.keluar_peminjaman,0)<>0
     OR coalesce(item.masuk_baru,0)<>0 OR coalesce(item.rusak,0)<>0 OR coalesce(item.permanen,0)<>0
     OR coalesce(item.last_opname_date,'') ~* '^sudah([[:space:]]|$)' THEN
    RETURN jsonb_build_object('error','Barang sudah digunakan, rusak, keluar, atau diperiksa lewat opname.','code','HAS_MOVEMENT','status',409);
  END IF;
  IF EXISTS(SELECT 1 FROM public.master_delete_audit WHERE request_id=p_request_id) THEN
    RETURN jsonb_build_object('error','ID permintaan sudah dipakai untuk barang lain.','code','REQUEST_CONFLICT','status',409);
  END IF;
  INSERT INTO public.master_delete_audit(request_id,master_id,kode_barang,actor,reason,snapshot)
    VALUES(p_request_id,item.id,item.kode_barang,p_username,btrim(p_reason),snapshot);
  INSERT INTO public.log(timestamp,"user",halaman,aksi,kode_barang,qty,kode_mutasi,detail,keterangan)
    VALUES(to_char(now() AT TIME ZONE 'Asia/Jakarta','DD/MM/YYYY HH24:MI:SS'),p_username,'Master Barang','Hapus Master Barang',item.kode_barang,
      coalesce(item.tersedia,0),0,item.nama_barang,btrim(p_reason)||' | Request: '||p_request_id::text) RETURNING id INTO event_id;
  PERFORM set_config('csm.archive_guard',txid_current()::text||':'||item.id::text,true);
  UPDATE public.master_barang SET deleted_at=now(),deleted_by=p_username,deleted_reason=btrim(p_reason),delete_request_id=p_request_id WHERE id=item.id;
  PERFORM set_config('csm.archive_guard','',true);
  RETURN jsonb_build_object('success',true,'id',item.id,'kode_barang',item.kode_barang,'audit_id',p_request_id,'log_id',event_id);
END; $$;
REVOKE ALL ON FUNCTION public.csm_delete_master(text,text,text,bigint,text,text,text,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.csm_delete_master(text,text,text,bigint,text,text,text,jsonb,uuid) TO service_role;
COMMIT;
