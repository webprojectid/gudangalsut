# Pengamanan sebelum repository publik — 6 Oktober 2026

## Perubahan dan dampak

- Username Base64 diganti token acak 256 bit; server hanya menyimpan SHA-256 token. Token disimpan di memori browser, tidak di localStorage. Reload perlu login ulang.
- Sesi kedaluwarsa setelah 30 menit tanpa request atau maksimal 8 jam. Logout mencabut token di server. Perubahan password, reset atau role mencabut sesi akun terkait.
- Password lama diubah menjadi bcrypt cost 12 dengan prehash SHA-256 dan salt acak; password non-default yang dipakai pengguna tetap sama. Prehash menghindari pemotongan bcrypt pada 72 byte. Password baru minimal 12 karakter.
- Akun dengan password default lama tidak bisa login sampai admin melakukan reset. Password sementara dibuat acak di server, ditampilkan kepada admin satu kali dalam response, dan wajib diganti oleh pemilik akun. Tidak ada password bersama dalam source.
- Reset/perubahan role/delete tetap meminta konfirmasi kredensial admin. Backend mengecek peran; menyembunyikan tombol bukan mekanisme otorisasi.
- Inventaris hanya dapat ditambah/diedit admin. Staf bisa membaca inventaris dan menulis aktivitas milik sendiri. Staf tidak dapat mengambil aktivitas akun lain atau daftar akun. Log operasional hanya dapat ditambahkan dan identitas aktor ditetapkan server.
- Role anon/authenticated tidak mempunyai akses langsung ke lima tabel aplikasi, sesi, rate limit, dan helper RPC. RLS aktif; akses aplikasi melalui fungsi server/service_role.
- Login dibatasi per akun dan IP dalam database; verifikasi admin/password juga dibatasi. Ini mengurangi percobaan berulang, bukan perlindungan DDoS menyeluruh.
- Tidak menghapus data inventaris, transaksi, master arsip atau riwayat opname. Guard delete dan blok clear massal tetap berlaku.

## Pemasangan

Backend migrasi dan kelima Edge Function dipasang pada project saat pengerjaan. Upload isi github/new sebagai root website. Frontend lama berhenti cocok dengan backend baru; pengguna harus memakai frontend terbaru dan login ulang.

Jangan men-deploy source Old atau migration 001 sendirian setelah pengamanan. Secret server tetap di Supabase environment. Folder supabase adalah source skema/fungsi, tidak berisi nilai secret maupun dump produksi. Aset katalog berisi nama/kode model produk untuk lookup gambar, sehingga metadata katalog tersebut akan publik bersama website.

## Verifikasi

Pengujian PostgreSQL lokal memakai pgcrypto sungguhan: hashing/salt, password lama, token palsu/acak, expiry idle/absolut, logout, pencabutan sesi saat perubahan keamanan, batas percobaan akun yang tidak ada, sesi terbatas, password baru, reset acak, blok akun default, panjang password, guard archive dan akses anon. Kelima handler Edge dijalankan terhadap PostgreSQL: token lama ditolak, staf baca inventaris tetapi tidak dapat mengubah master/list akun, response akun tidak memuat hash, clear diblokir, logout mencabut akses, dan change-password menolak token palsu.

Uji mutasi akun/reset/delete menggunakan data sintetis di database lokal. Tidak mengganti password pengguna produksi sebagai simulasi. Pengujian login sukses memakai akun produksi memerlukan pemilik akun masuk sendiri; password asli tidak diambil dari database.

Pemeriksaan produksi menunjukkan 10/10 password tersimpan dalam format hash, 7 akun default lama diblokir, 1 admin non-default tetap tersedia, tidak ada grant anon/authenticated pada tabel aplikasi, dan tidak ada grant publik untuk helper csm. Kelima endpoint aktif mengembalikan HTTP 401 untuk probe kredensial palsu. Login/logout pada preview berjalan tanpa error.

## Batas audit

Ini pengamanan pada aplikasi existing, bukan sertifikasi penetration test atau migrasi ke Supabase Auth/MFA. Tidak mengaudit histori commit repository GitHub lama, semua layanan organisasi Supabase, backup lama berisi plaintext, ataupun hak lisensi setiap foto produk. Kode frontend, URL project, domain dan katalog foto memang dapat dibaca publik. Repository private tidak menggantikan keamanan endpoint.

Referensi desain: [PostgreSQL pgcrypto](https://www.postgresql.org/docs/current/pgcrypto.html), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
