# CSM Online — Gudang CSM

Website statis dengan foto produk lokal, dashboard inventaris, Light/Dark dan motion. Upload **isi folder ini** sebagai root repository: index.html, assets, CNAME dan .nojekyll berada langsung di root.

## Keamanan dan dampak pembaruan

Backend Supabase sudah diperbarui bersama migrasi keamanan dan lima Edge Function. Gunakan frontend ini; frontend/token Base64 lama ditolak. Password non-default existing tetap valid, semua sesi lama perlu login ulang. Akun yang masih menggunakan default lama tidak dapat login sampai admin melakukan reset acak dari Account Settings.

Reset membuat password sementara acak yang disampaikan secara privat oleh admin dan wajib diganti pemilik akun. Password baru minimal 12 karakter. Perubahan password atau role membatalkan sesi terkait. Password dan service key tidak berada di repository. URL project/domain serta metadata nama/kode model dalam katalog foto memang publik.

## Isi

- index.html dan assets: source website dan foto bersama.
- docs: dokumentasi desain, sumber foto, guard delete dan dampak keamanan.
- supabase: source migrasi/backend untuk review atau pemasangan pada skema existing; bukan dump database. Secret berada di environment Supabase.
- CNAME: csmalsut.online.
- .nojekyll dan .gitignore: konfigurasi website/repository.

Tidak perlu npm install atau build. Semua kapitalisasi/subfolder dipertahankan. Jangan upload Old, tmp, .env, backup database, screenshot pengujian, atau credentials ke repository publik. Folder ini tidak memuat file-file tersebut.

Panduan keamanan: docs/security-release.md. Urutan backend jika memasang ulang: supabase/README.md. Semua tabel inventaris existing dan riwayat tetap dipertahankan. Delete memakai arsip dan verifikasi admin; clear massal tetap diblokir.

Pemeriksaan keamanan ini bukan sertifikasi penetration test; layanan organisasi, histori Git lama, dan backup lama berada di luar audit paket ini.
