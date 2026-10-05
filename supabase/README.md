# Backend CSM Online

Patch untuk skema inventaris existing, bukan export data. Tidak berisi data akun, database dump, service-role key, atau token sesi.

Jalankan migrasi `202610060001_guarded_master_delete.sql`, lalu `202610060002_secure_sessions.sql`. Deploy seluruh lima fungsi: login, change-password, api-proxy, admin-users, db-sync. Fungsi memverifikasi sesi acak pada server. Gateway Verify JWT tetap sesuai konfigurasi custom-auth existing; jangan menggantinya tanpa migrasi ke Supabase Auth.

Secret hanya pada environment server: SUPABASE_URL dan SERVICE_ROLE_KEY (atau SUPABASE_SERVICE_ROLE_KEY untuk fungsi yang mendukung alias). Jangan masukkan nilai secret ke source publik.

Frontend dan backend harus diperbarui bersama. Semua token Base64 lama ditolak. Password non-default existing tetap valid; akun dengan password default lama wajib mendapat reset acak dari admin. Reset/perubahan role/password membatalkan sesi terkait.

Lihat ../docs/security-release.md untuk dampak, verifikasi dan batas audit.
