# Pengembangan, pengujian dan rilis

## Menjalankan website

Frontend adalah file statis tanpa framework/bundler dan tanpa npm build. Browser memakai Chart.js, SheetJS, html5-qrcode dan Font Awesome dari CDN sesuai import HTML. Chart.js/Supabase JS beberapa referensinya tidak mengunci patch; perubahan dependency eksternal dapat memengaruhi hasil. Jangan mengubah versinya sebagai bagian pekerjaan dokumentasi.

Di workspace lengkap, preview aman menggunakan fixture sintetis:

```powershell
python scripts/preview-server.py
```

Server localhost port 8871. `/preview/stable` membuka dashboard stabil sintetis, `/preview/stable/login` membuka login stabil. `/preview` dan `/preview/login` adalah kandidat root. Route preview menyisipkan preview-fixtures.js dan mengintersep request Supabase. Membuka index.html langsung atau melalui server statis biasa tidak mendapat isolasi fixture dan dapat mengarah ke backend kantor.

Fixture mendukung `?motion=full` untuk audit animasi; parameter itu mengabaikan reduced motion hanya dalam preview eksplisit. Fixture juga mempunyai kontrol fail/empty/delay yang dapat dicari pada preview-fixtures.js. Jangan membawa fixture/interceptor/demo credentials ke deployment produksi.

## Tes workspace lengkap

Node tersedia untuk mjs; PostgreSQL lokal memakai PGlite 0.5.8 dan pgcrypto. `npm ci --ignore-scripts` memasang dependency development terkunci, bukan dependency runtime hosting. Periksa ketersediaan jaringan sebelum instalasi. Python dipakai untuk preview, foto, packaging dan audit warna; kebutuhan setiap script tercantum pada import/source script.

```powershell
npm test
```

npm test root menjalankan frontend, read-state, secure-sessions root dan atomic-inventory root. Itu bukan satu-satunya pemeriksaan stable. Untuk kontrak stable dan perbandingan historis:

```powershell
$env:CSM_CHECK_BACKEND='github/new/supabase'
node scripts/check-secure-sessions.mjs
Remove-Item Env:CSM_CHECK_BACKEND
node scripts/check-old-new-logic.mjs
node scripts/check-old-new-database.mjs
```

| Area perubahan | Script terkait |
|---|---|
| Struktur HTML/JS/aset bersama | check-frontend.mjs |
| Read state/draft/sesi | check-read-state.mjs |
| Agregasi dashboard | check-dashboard-analytics.mjs |
| Motion/period/story | check-ui-motion.mjs, check-chart-motion.mjs, check-period-motion.mjs, check-story-motion.mjs |
| Katalog foto | check-product-catalog.mjs |
| Guard delete/role/API | check-master-delete.mjs, check-admin-proof.mjs, check-guarded-api.mjs |
| Keamanan sesi dan Edge handler | check-secure-sessions.mjs; pilih backend secara explicit |
| Kandidat atomik | check-atomic-inventory.mjs |
| Old/New stable | check-old-new-logic.mjs, check-old-new-database.mjs |
| Warna | check-design-contrast.py |
| Paket publik/GitHub | check-public-release.py, check-github-tree.py; baca target/jaringan sebelum menjalankan |

Jangan menjalankan check-live-security.py atau script download/generate/package sebagai tes rutin tanpa membaca efek/network/outputnya. Nama check tidak menjamin lokal/read-only. scripts/database-test-runtime.mjs memakai dependency terpasang atau fallback runtime tmp yang sudah ada, bukan koneksi produksi.

Workflow root `.github/workflows/` memakai Node 24, npm ci --ignore-scripts dan npm test. Paket stable statis tidak otomatis memiliki workflow/runtime tersebut. Rilis root hijau tidak membuktikan live stable diuji dengan backend yang sama.

## Bukti yang sudah tercatat

Audit 7 Oktober: 149 skenario Old/New setara untuk kasus yang diuji; 28 skenario keamanan dan lima handler stable; migrasi stable pada schema fixture mempertahankan field bisnis fixture. Audit UI sebelumnya memeriksa 164 pasangan kontras serta matriks responsive, states, keyboard dan preview sintetis. Uji kandidat sebelumnya mencakup 40 skenario integritas.

Angka itu adalah hasil pada tanggal audit, bukan tes yang otomatis diulang saat membaca dokumen. Tidak ada snapshot backend/schema Old lengkap, bukti rekonsiliasi stok fisik, atau sertifikasi formal. PGlite satu koneksi tidak membuktikan semua kondisi dua koneksi produksi. Pemilihan/upload file native belum terverifikasi.

## Publish stable

Pemilik mengupload isi `github/new` sebagai root repo. index.html/assets/CNAME/.nojekyll berada langsung di root, bukan di subfolder new. docs dan supabase adalah source/dokumentasi, bukan data kantor. AGENTS.md tidak dieksekusi browser.

Jangan upload tmp, node_modules, Old, ZIP/backup/database dump, credential, artefak screenshot privat atau session. CNAME existing csmalsut.online dan path asset case-sensitive harus dipertahankan. .gitignore membantu Git, tetapi tidak membersihkan histori publik atau file yang sudah terupload.

Publish website tidak otomatis menjalankan SQL atau deploy Edge Functions. Dokumentasikan file mana yang berubah, hasil tes, dan apakah deployment backend benar-benar dilakukan. Status Supabase/GitHub live diperiksa terpisah.

## Rilis kandidat atomik

Ini langkah rilis yang belum boleh dianggap selesai hanya dari dokumen: verifikasi backup bisa dipulihkan, staging schema setara, migrasi 003, pengujian semua alur dan dua sesi, lalu deploy api-proxy/db-sync serta frontend kandidat sebagai satu rilis kompatibel. Jangan backfill saldo legacy ambigu. Backend atomik menolak client stable; aktivasi backend saja dapat membuat pengguna tidak bisa menyimpan.

Rollback harus mempertahankan perlindungan data dan receipt. Jangan mematikan guard atau menghidupkan writes nonatomik hanya untuk menghilangkan error. Status snapshot releases/atomic-inventory harus diperiksa sebelum dipakai.

## Memperbarui pegangan agent

Di workspace lengkap:

```powershell
node scripts/build-agent-reference.mjs
node scripts/build-agent-reference.mjs --check
```

Generator menulis indeks source/fungsi/hash root dan stable, serta menyalin empat handbook ke docs stable. Indeks menginventarisasi file source/config yang dipilih, dependency HTML, deklarasi fungsi tekstual, nama SQL dan handler inline. Bukan parser AST, dokumentasi setiap cabang, atau bukti ekuivalensi. Baca source untuk closure, anonymous callbacks, method, override dan generated HTML.

Setiap perubahan perilaku harus memperbarui aturan bisnis/API/manual juga, karena generator tidak dapat memahami maksud bisnis. --check mendeteksi dokumentasi hasil generator tertinggal; ia tidak menguji correctness aplikasi.
