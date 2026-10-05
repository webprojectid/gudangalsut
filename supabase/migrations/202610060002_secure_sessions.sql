-- Apply after 001. Existing passwords remain valid; only their storage changes.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_reset_required boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.csm_sessions(
 token_hash text PRIMARY KEY, username text NOT NULL REFERENCES public.users(username),
 created_at timestamptz NOT NULL DEFAULT now(), last_seen timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '8 hours', restricted boolean NOT NULL DEFAULT false,
 revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS csm_sessions_user ON public.csm_sessions(username);
CREATE TABLE IF NOT EXISTS public.csm_login_attempts(
 key text PRIMARY KEY, count integer NOT NULL DEFAULT 0, started_at timestamptz NOT NULL DEFAULT now()
);
-- Bcrypt over a SHA-256 prehash avoids bcrypt's 72-byte truncation.
CREATE OR REPLACE FUNCTION public.csm_hash_password(p text) RETURNS text
 LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT 'csm$bfsha256$'||extensions.crypt(encode(extensions.digest(p,'sha256'),'hex'),extensions.gen_salt('bf',12)); $$;
CREATE OR REPLACE FUNCTION public.csm_password_matches(p text,h text) RETURNS boolean
 LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(h LIKE 'csm$bfsha256$%' AND substring(h FROM 14)=extensions.crypt(encode(extensions.digest(p,'sha256'),'hex'),substring(h FROM 14)),false); $$;
UPDATE public.users SET must_change_password=true,password_reset_required=true WHERE md5(password)='8761cb3983f1d4afcd48f53c8854ebbe';
UPDATE public.users SET password=public.csm_hash_password(password) WHERE password NOT LIKE 'csm$bfsha256$%';
CREATE OR REPLACE FUNCTION public.csm_user_security_guard() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF TG_OP='INSERT' OR NEW.password IS DISTINCT FROM OLD.password THEN
  IF NEW.password IS NULL OR length(NEW.password)=0 THEN RAISE EXCEPTION 'Password required'; END IF;
  IF NEW.password NOT LIKE 'csm$bfsha256$%' THEN NEW.password:=public.csm_hash_password(NEW.password); END IF;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.password IS DISTINCT FROM OLD.password OR NEW.role IS DISTINCT FROM OLD.role OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password OR NEW.password_reset_required IS DISTINCT FROM OLD.password_reset_required) THEN
  UPDATE public.csm_sessions SET revoked_at=now() WHERE username=OLD.username AND revoked_at IS NULL;
 END IF;
 RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS csm_user_security_guard ON public.users;
CREATE TRIGGER csm_user_security_guard BEFORE INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.csm_user_security_guard();
CREATE OR REPLACE FUNCTION public.csm_rate_allow(p_key text,p_limit integer) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE a public.csm_login_attempts%ROWTYPE; BEGIN
 INSERT INTO public.csm_login_attempts(key) VALUES(p_key) ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM public.csm_login_attempts WHERE key=p_key FOR UPDATE;
 IF a.started_at<now()-interval '5 minutes' THEN a.count:=0; UPDATE public.csm_login_attempts SET count=0,started_at=now() WHERE key=p_key; END IF;
 IF a.count>=p_limit THEN RETURN false; END IF;
 UPDATE public.csm_login_attempts SET count=count+1 WHERE key=p_key; RETURN true; END; $$;
CREATE OR REPLACE FUNCTION public.csm_session_user(p_token text,p_restricted boolean DEFAULT false) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE s public.csm_sessions%ROWTYPE; u public.users%ROWTYPE; BEGIN
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
 SELECT * INTO s FROM public.csm_sessions WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex') FOR UPDATE;
 IF NOT FOUND OR s.revoked_at IS NOT NULL OR s.expires_at<=now() OR s.last_seen<=now()-interval '30 minutes' THEN RETURN NULL; END IF;
 SELECT * INTO u FROM public.users WHERE username=s.username;
 IF NOT FOUND OR u.password_reset_required OR ((s.restricted OR u.must_change_password) AND NOT p_restricted) THEN RETURN NULL; END IF;
 UPDATE public.csm_sessions SET last_seen=now() WHERE token_hash=s.token_hash;
 RETURN jsonb_build_object('id',u.id,'username',u.username,'nama_lengkap',u.nama_lengkap,'role',u.role,'requirePasswordChange',u.must_change_password);
 END; $$;
CREATE OR REPLACE FUNCTION public.csm_login(p_username text,p_password text,p_ip text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u public.users%ROWTYPE; t text; BEGIN
 IF p_username IS NULL OR length(p_username) NOT BETWEEN 1 AND 100 OR p_password IS NULL OR length(p_password) NOT BETWEEN 1 AND 1024 THEN
  RETURN jsonb_build_object('error','Username atau password salah.','status',401); END IF;
 IF NOT public.csm_rate_allow('ip:'||encode(extensions.digest(coalesce(p_ip,'unknown'),'sha256'),'hex'),40)
 OR NOT public.csm_rate_allow('user:'||lower(p_username),10) THEN RETURN jsonb_build_object('error','Terlalu banyak percobaan. Tunggu 5 menit.','status',429); END IF;
 SELECT * INTO u FROM public.users WHERE username=p_username FOR SHARE;
 IF NOT FOUND OR u.password_reset_required OR NOT public.csm_password_matches(p_password,u.password) THEN
  RETURN jsonb_build_object('error','Username atau password salah.','status',401); END IF;
 t:=encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO public.csm_sessions(token_hash,username,restricted) VALUES(encode(extensions.digest(t,'sha256'),'hex'),u.username,u.must_change_password);
 RETURN jsonb_build_object('token',t,'requirePasswordChange',u.must_change_password,'user',jsonb_build_object('id',u.id,'username',u.username,'nama_lengkap',u.nama_lengkap,'role',u.role)); END; $$;
CREATE OR REPLACE FUNCTION public.csm_logout(p_token text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 UPDATE public.csm_sessions SET revoked_at=now() WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 RETURN jsonb_build_object('success',true); END; $$;
CREATE OR REPLACE FUNCTION public.csm_change_password(p_token text,p_old text,p_new text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u jsonb; stored text; BEGIN
 u:=public.csm_session_user(p_token,true);
 IF u IS NULL THEN RETURN jsonb_build_object('error','Sesi berakhir. Login kembali.','status',401); END IF;
 IF p_old IS NULL OR length(p_old)>1024 OR NOT public.csm_rate_allow('change:'||(u->>'username'),5) THEN RETURN jsonb_build_object('error','Verifikasi ditolak. Coba lagi nanti.','status',429); END IF;
 SELECT password INTO stored FROM public.users WHERE username=u->>'username' FOR UPDATE;
 IF NOT public.csm_password_matches(p_old,stored) THEN RETURN jsonb_build_object('error','Password lama salah.','status',401); END IF;
 IF p_new IS NULL OR length(p_new) NOT BETWEEN 12 AND 1024 OR p_new=p_old OR md5(p_new)='8761cb3983f1d4afcd48f53c8854ebbe' THEN RETURN jsonb_build_object('error','Gunakan password baru minimal 12 karakter.','status',400); END IF;
 UPDATE public.users SET password=public.csm_hash_password(p_new),must_change_password=false WHERE username=u->>'username';
 RETURN jsonb_build_object('success',true,'requireLogin',true); END; $$;
-- Keep the existing guarded-delete RPC, upgrade its proof verification.
CREATE OR REPLACE FUNCTION public.csm_verify_admin(p_session_username text,p_username text,p_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u public.users%ROWTYPE; BEGIN
 IF p_session_username IS DISTINCT FROM p_username OR p_username IS NULL OR p_password IS NULL OR length(p_password)>1024 THEN RETURN jsonb_build_object('error','Verifikasi admin ditolak.','status',401); END IF;
 IF NOT public.csm_rate_allow('admin:'||p_username,5) THEN RETURN jsonb_build_object('error','Tunggu 5 menit.','status',429); END IF;
 SELECT * INTO u FROM public.users WHERE username=p_username FOR SHARE;
 IF NOT FOUND OR u.password_reset_required OR NOT public.csm_password_matches(p_password,u.password) THEN RETURN jsonb_build_object('error','Verifikasi admin ditolak.','status',401); END IF;
 IF u.must_change_password OR u.password_reset_required OR lower(u.role)<>'administrator' THEN RETURN jsonb_build_object('error','Akses admin ditolak.','status',403); END IF;
 UPDATE public.csm_login_attempts SET count=0 WHERE key='admin:'||p_username;
 RETURN jsonb_build_object('success',true); END; $$;
CREATE OR REPLACE FUNCTION public.csm_reset_password(p_token text,p_admin text,p_password text,p_id bigint) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE u jsonb; proof jsonb; t text; BEGIN
 u:=public.csm_session_user(p_token); IF u IS NULL THEN RETURN jsonb_build_object('error','Sesi tidak valid.','status',401); END IF;
 proof:=public.csm_verify_admin(u->>'username',p_admin,p_password); IF NOT coalesce((proof->>'success')::boolean,false) THEN RETURN proof; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=p_id) THEN RETURN jsonb_build_object('error','Akun tidak ditemukan.','status',404); END IF;
 t:=encode(extensions.gen_random_bytes(18),'hex');
 UPDATE public.users SET password=public.csm_hash_password(t),must_change_password=true,password_reset_required=false WHERE id=p_id;
 RETURN jsonb_build_object('success',true,'temporaryPassword',t); END; $$;
-- Only these application's tables are changed. Edge functions use service_role.
REVOKE ALL ON public.users,public.master_barang,public.data_entry,public.log,public.user_activity,public.csm_sessions,public.csm_login_attempts FROM PUBLIC,anon,authenticated;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_barang ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csm_login_attempts ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.csm_sessions,public.csm_login_attempts TO service_role;
DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'csm_%' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.name);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.name);
 END LOOP; END; $$;
COMMIT;
