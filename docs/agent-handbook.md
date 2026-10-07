# Pegangan project CSM Online

Ditulis 7 Oktober 2026 berdasarkan source lokal dan audit yang tercatat. Dokumen ini membedakan perilaku saat ini, bug terbuka, dan kandidat perbaikan. Dokumentasi bukan bukti bahwa source lokal telah dipasang ke produksi.

## Urutan membaca

1. Dokumen ini untuk memilih paket dan memahami modul.
2. [business-rules.md](business-rules.md) untuk hitungan dan lifecycle tiket.
3. [backend-contract.md](backend-contract.md) untuk tabel/API/otorisasi.
4. [development-and-release.md](development-and-release.md) untuk preview, tes, dan rilis.
5. [code-reference.md](code-reference.md) untuk lokasi fungsi dan inventaris source, beserta `code-reference.json` untuk pencarian terstruktur.

## Paket yang berbeda

| Paket dalam workspace lengkap | Status | Catatan |
|---|---|---|
| github/new | Stabil untuk upload pemilik | Migrasi 001/002; entry/stok/log terpisah |
| Root index.html/assets/supabase | Kandidat atomik | Migrasi 003; inventory_commit/status; perlu rilis bersama |
| github/Old | Baseline HTML/aset lama | Backend/schema historis lengkap tidak tersedia; token lama tidak kompatibel |
| releases/atomic-inventory | Snapshot kandidat sebelumnya | Tidak otomatis mengikuti edit root |
| github/new.zip | ZIP lama pada audit terakhir | Bukan salinan folder terbaru pada 7 Oktober 2026 |

Jika membaca dokumen dari repo hasil upload `github/new`, jalur relatif index.html/assets/supabase menunjuk paket stabil tersebut. Root workspace lengkap berbeda dari root repo upload. Perbedaan ini harus dinyatakan sebelum perubahan.

## Arsitektur

Browser memuat HTML/CSS dan script biasa tanpa bundler. Fungsi inline dan global dari assets saling memanggil; urutan script penting. Browser mengirim POST ke Edge Functions memakai sesi custom `x-session-token`. Edge Function memverifikasi sesi dan memakai secret server untuk membaca/menulis PostgreSQL. Foto produk dilayani hosting statis melalui katalog JSON, bukan blob database.

`index.html` menyimpan markup menu, state utama, autentikasi, transport sbGet/sbInsert/sbUpdate, cache, entry/edit, master, opname, history, return/undo, akun, dan aktivitas. Modul workspace mengubah penyajian serta sebagian kalkulasi dashboard; tidak semua fungsi lama inline merupakan pemilik render terakhir. Periksa pemanggilan dan reassignment sebelum mengedit fungsi dengan nama sama.

## Menu dan pemilik logika

| Menu/fungsi | Sumber utama | Baca/tulis |
|---|---|---|
| Login/logout/ganti password | index.html; login/change-password; migrasi 002 | Sesi/account, bersihkan state saat logout |
| Dashboard/periode | workspace.js, dashboard-analytics.js, chart-data.js | Turunan master/entry; chart tidak menulis saldo |
| Data Entry/edit tiket | submitEntry dan helper stok di index.html | data_entry/master/log pada stable |
| Master Barang | index.html, workspace.js, master-delete.js/policy | Tambah/edit master; arsip guarded via RPC |
| Stock Gudang | index.html/workspace.js | Baca kondisi master dan filter |
| Stock Opname | index.html/workspace.js | last_opname_date; tidak mengubah stok |
| Riwayat Transaksi | index.html; chart-data.js | Baca/filter data_entry; kalender memasang filter tanggal |
| Active/Returned Ticket | returnTicket/undoReturnTicket/grouping di index.html | Status baris dan stok/counter |
| Time Management | index.html | user_activity dan estimasi durasi aktif |
| Account Settings | index.html, admin-users | List aman, role/reset dengan proof admin |
| QR/barcode/export spreadsheet | index.html/workspace.js dan library CDN | Cari/scan/export; periksa handler sebelum menyimpulkan efek tulis |

## Modul assets

| File | Tanggung jawab |
|---|---|
| workspace.js | Render list/grid/detail, katalog foto, kategori visual, filter/pagination, overlay, dashboard |
| dashboard-analytics.js | Agregasi periode, heatmap tanggal, seri 12 bulan, lokasi, usia pinjaman, kondisi, ranking |
| chart-data.js | Tabel angka dari input chart, kalender keyboard, filter tanggal history |
| ui-state.js | Loading/unknown/stale/error/retry, epoch respons, draft Entry dan konfirmasi discard, pembersihan sesi |
| theme.js/theme.css | Light/Dark, persistensi preferensi, warna chart |
| motion.js/motion.css | Motion dasar serta lifecycle feedback |
| chart-motion.js | Animasi pembaruan chart dan reuse instance |
| period-motion.js | Transisi pergantian bulan dan pembaruan dashboard |
| story-motion.js/motion-design.css | Motion interaksi/state/scroll sesuai implementasi; reduced motion |
| master-delete.js | Modal alasan/nama/kode/proof admin, request ID, invalidasi setelah arsip |
| master-delete-policy.js | Pemeriksaan/penjelasan frontend; keputusan akhir tetap RPC database |
| inventory-commit.js | Hanya kandidat atomik: request UUID, retry/status, snapshot expected |
| workspace.css/login.css/character.css | Layout, login iMac, token/aksen/kontras dan overrides visual |
| product-photos.json; products/ | Pemetaan nama/kode/model ke foto statis bersama dan fallback |
| csm-mark.svg | Identitas CSM Online |

CSS bertingkat: jangan mengedit stylesheet lebih awal tanpa memeriksa override terakhir. Daftar import aktual dan lokasi fungsi tersedia dalam code-reference.

## State browser

Sesi utama disimpan dalam memori pada sessionToken/appState. Cache query dipisahkan menurut token; respons sesi lama tidak boleh merender sesi baru. Draft Entry bertahan saat pindah menu dalam sesi, bukan jaminan tersimpan setelah browser ditutup. Beforeunload/discard guard mencegah kehilangan input tanpa konfirmasi; tidak menyimpan draft kantor ke disk.

LocalStorage menyimpan preferensi tema/sidebar dan username yang diingat, bukan password. Kandidat atomik memakai sessionStorage untuk pending request agar retry dapat memeriksa hasil sebelum mengulang; itu bukan mekanisme stable.

Foto yang dipilih dari panel detail hanya pratinjau sesi menggunakan object URL, maksimal 5 MB PNG/JPEG/WebP. Bukan upload permanen ke GitHub/Supabase. Pengujian pembukaan picker berhasil; pemilihan/upload native belum diverifikasi dalam audit UI terakhir.

## Foto dan kategori

Foto dibagikan menurut pemetaan `byName`, `byCode` jika tersedia, serta assets katalog. Nama dinormalisasi untuk pencarian. Kind model/reference/category/preview tidak sama dengan foto unit aset tertentu. Kategori visual berasal dari helper nama/kode; jangan menganggap kategori itu kolom authoritative database.

Sumber dan atribusi tercatat pada [image-credits.md](image-credits.md), [photo-import-notes.md](photo-import-notes.md), dan katalog. Foto baru diutamakan transparent/putih menurut brief pemilik. Jangan mengganti foto yang sudah dipilih tanpa kebutuhan. Foto bersama tidak dihapus saat satu master diarsipkan.

## Arah frontend yang disetujui

Identitas CSM Online/Gudang CSM, Light/Dark, tanpa palet ungu. Brief menghendaki warna berkarakter, dashboard berisi chart dari data nyata, motion terarah, tanpa ornamen garis/dashed/top-border generik. Login memakai iMac 24 inci 2021 dengan wallpaper kampus, keyboard/mouse terpisah dan mengambang. Video/portal kamera masuk wallpaper telah dibatalkan. Jangan menghidupkannya dari file storyboard lama.

Revisi anti-slop 7 Oktober mencakup states, draft, data alternatif chart, kalender keyboard, warna/focus/mobile. Arah detail ada pada design.md di paket stabil atau DESIGN.md di workspace lengkap. Tidak ada audit WCAG menyeluruh atau sertifikasi keamanan yang boleh disimpulkan dari revisi tersebut.

## Sumber pengetahuan dan kesegaran

Dokumen tematik lama menjelaskan alasan/history perubahan, bukan seluruh status live terbaru. security-release.md dan master-delete.md memuat pemeriksaan pada tanggal sebelumnya. Audit Old/New 7 Oktober memakai simulasi lokal dan tidak memeriksa live production.

Jika fakta dokumen bertentangan dengan source, catat perbedaan, baca handler/migrasi/fungsi terkait, lalu perbarui dokumentasi setelah perubahan yang sah. Jangan mengubah data kantor agar sesuai narasi dokumentasi. Indeks hash mendeteksi source berubah, tetapi tidak membuktikan keamanan atau kesetaraan semantik.
