# Kontrak backend dan database

Baseline: source stable github/new, 7 Oktober 2026. Ini peta field/relasi yang digunakan aplikasi, bukan dump schema produksi lengkap. Nama, tipe, constraint dan trigger tambahan organisasi harus diperiksa di lingkungan yang sesuai sebelum migrasi.

## Tabel

| Tabel | Field utama yang digunakan | Kegunaan |
|---|---|---|
| master_barang | id, kode_barang, nama_barang, serial_number, fa_number, lokasi_barang, barcode, tersedia, stok_paten, masuk_peminjaman, keluar_peminjaman, masuk_baru, rusak, permanen, last_opname_date | Master aktif dan saldo/counter |
| data_entry | id, kode_barang, nama_barang, qty, kode_mutasi, tanggal, nomor_tiket, nama_peminjam, keterangan, catatan bila digunakan | Baris transaksi dan status tiket |
| log | id, timestamp, user, halaman, aksi, kode_barang, qty, kode_mutasi, detail, keterangan | Catatan operasi; actor username dipaksakan server |
| user_activity | id, username, nama_lengkap, login_time, logout_time, active_seconds, date_str | Estimasi aktivitas sesi |
| users | id, username, nama_lengkap, role, password, must_change_password, password_reset_required | Custom account; password hash bukan plaintext |

Relasi utama memakai kode_barang, bukan hanya nama barang atau index baris. Tiket dapat mempunyai banyak entry. Guard stable menolak entry/log yang mengacu master hilang/arsip. Log dapat berisi daftar kode sehingga pemeriksaannya tidak boleh disederhanakan ke satu equality tanpa membaca SQL.

Migrasi 001 menambah deleted_at, deleted_by, deleted_reason, delete_request_id pada master dan tabel master_delete_audit/master_delete_attempts. Migrasi 002 menambah field keamanan users dan tabel csm_sessions/csm_login_attempts. Tabel security/audit bukan data untuk diekspos lewat api-proxy umum.

Root kandidat menambah inventory_effect/loan_cycle pada entry, csm_inventory_receipts, index unik kode master serta constraint nonnegatif/validasi/FK tambahan pada migrasi 003. Sebagian constraint NOT VALID tidak membuktikan semua row legacy tervalidasi.

## Transport

Endpoint browser berada pada `/functions/v1/<nama>` project Supabase existing. Request aplikasi berupa JSON dan memakai `x-session-token` untuk operasi bersesi. Session adalah 64 hex acak, diverifikasi lewat csm_session_user; username/Base64 bukan credential. Jangan menyalin service-role key ke client.

| Edge Function | Action/payload penting | Penjaga |
|---|---|---|
| login | username/password; action logout + token | csm_login/csm_logout, rate limit, expiry/revocation |
| change-password | Kredensial lama/baru sesuai handler | csm_change_password, kebijakan password dan pencabutan sesi |
| api-proxy | get/insert/update/delete; table, params, data; delete_master_guarded | Sesi, allowlist, role, ownership, RPC arsip |
| admin-users | list; update_role(id, role, adminUsername/adminPassword); reset_password(id, proof) | Administrator dan proof ulang pada operasi sensitif |
| db-sync | dump(table, limit, offset); insert(table, rows, proof); clear ditolak | Administrator; insert proof; batas dump per halaman 1000 |

Untuk nama field exact gunakan source handler dan daftar simbol. Jangan mengarang kontrak berdasarkan tabel ringkasan ini.

## api-proxy stable

Allowlist tabel: master_barang, data_entry, log, user_activity. Users melalui admin-users. get mendukung select kolom/wildcard, filters equality, order, range dan limit sesuai handler. `select=*,id` sah; proyeksi relasional/injection ditolak.

Query ber-order dapat auto-pagination per 1000 sampai maksimum 20.000. Tanpa order deterministic, handler tidak mengambil halaman otomatis. Range explicit dihormati. Query jumlah besar harus diperiksa urutan/limitnya; jangan menjanjikan riwayat tak terbatas.

Master normal disaring deleted_at NULL. Lookup select kode_barang saja menyertakan arsip untuk reservasi kode. Jangan mengubahnya menjadi hanya master aktif karena kode arsip dapat digunakan ulang tanpa sengaja.

Writes inventaris memerlukan administrator; kontrol frontend bukan otorisasi akhir. Log hanya get/insert, actor dipaksakan server. Staff hanya membaca/membuat/memperbarui aktivitas miliknya dengan batas field; admin memiliki cakupan sesuai handler. Delete umum master/entry/log ditolak; arsip harus melalui action khusus.

## Autentikasi

Migrasi 002 memakai SHA-256 prehash dan bcrypt, token hash, expiry/revocation, guard akun serta rate limit. Password non-default legacy pada fixture tetap bisa digunakan setelah migrasi. Default legacy diblokir sampai reset admin. Reset menghasilkan password sementara acak, wajib diganti; password baru minimal 12 karakter. Perubahan password/role membatalkan sesi terkait.

Jangan mencatat credential pada log, artefak, URL atau dokumentasi. Reset harus disampaikan privat oleh admin. Jangan menganggap RLS cukup jika route service_role tidak memeriksa role; kedua lapisan harus dijaga. Ini custom auth, bukan Supabase Auth standar.

Secret server yang digunakan: SUPABASE_URL dan SERVICE_ROLE_KEY. Beberapa handler menerima alias SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY, tetapi api-proxy createClient masih membaca SERVICE_ROLE_KEY langsung. Konfigurasi paling konsisten adalah SERVICE_ROLE_KEY; jangan menganggap alias bekerja di seluruh route.

CORS saat ini wildcard pada handler. Itu tidak mengizinkan akses tanpa sesi dan bukan pengganti otorisasi. Dokumentasi ini tidak menyatakan konfigurasi tersebut telah mendapat penetration test.

## Arsip master guarded

delete_master_guarded membawa id, expected snapshot, UUID requestId, reason, name, code, username/password. RPC csm_delete_master memverifikasi ulang sesi/admin, nama/kode exact (trim luar), alasan 12-600 karakter, keadaan terbaru serta ketergantungan. Username proof harus sesuai sesi. Lima password salah dalam lima menit membatasi percobaan sesuai helper.

Master yang memiliki entry semua mutasi, log/pergerakan/counter, atau opname Sudah ditolak. Master tidak digunakan dapat diarsipkan. Audit/snapshot/log/arsip ada dalam satu transaksi dengan lock. Request sukses identik idempoten; UUID berbeda konteks ditolak. Delete fisik/ubah arsip/pakai ulang kode arsip ditolak. Foto bersama dipertahankan.

Arsip aman ini tidak membuat entry/return stable otomatis atomik. Keduanya memakai jalur berbeda.

## Impor dan kandidat atomik

db-sync stable menolak clear, tetapi insert terverifikasi masih berupa insert tabel dan tidak menerapkan semua efek stok sebagai satu operasi inventaris. Jangan gunakan dump/insert terpisah sebagai restore kantor tanpa prosedur rekonsiliasi.

Root kandidat api-proxy menambah inventory_commit/status ke RPC csm_inventory_commit/status, serta menolak jalur tulis inventaris lama dengan ATOMIC_WRITE_REQUIRED. Kandidat db-sync juga memblokir insert inventaris. Receipt/snapshot/expected harus dipertahankan saat retry. Jangan mengubah UUID pada retry yang hasilnya belum diketahui.

## Migrasi bukan schema bootstrap

001 dan 002 mengharapkan lima tabel bisnis existing. Tidak tersedia baseline schema produksi lengkap dalam Old. SQL pengujian merekonstruksi tabel minimal, sehingga bukan file bootstrap resmi kantor. Deployment lengkap memerlukan validasi schema nyata, backup/restore, secret, setting gateway custom-auth serta rilis frontend/backend yang kompatibel.
