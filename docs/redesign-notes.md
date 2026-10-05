# CSM Online — Gudang CSM

Redesign lokal, 5 Oktober 2026.

## Yang berubah

- Login memakai iMac 24 inci 2021 dengan wallpaper poster pengguna, Magic Keyboard dan Magic Mouse melayang terpisah di dekatnya, serta Logitech C930e dan Poly Sync 20. Animasi langsung berjalan tanpa play/pause; gerakan lebih kecil dipakai saat reduced motion. Foto tanpa kartu, nama atau kategori; layout mobile tetap menampilkan produk. Identitas frontend, sidebar dan favicon memakai CSM Online / Gudang CSM. Label lokasi ditampilkan tanpa branding lama, dengan nilai lokasi backend tetap dipakai untuk filter dan penyimpanan. [Aset dan prompt iMac](login-imac-2021.md).
- Sistem visual baru: sidebar ikon yang stabil, typography DM Sans/Manrope, aksen cyan/coral/lime, panel rounded, spacing dan grid responsif. Light menjadi default; Dark/Light bisa diganti di login dan workspace, tersimpan di browser serta memperbarui warna chart. Warna ungu dihapus dari UI dan gambar kategori SVG. [Detail tema dan cutout](theme-and-login.md).
- Dashboard: sembilan chart (mutasi harian, komposisi mutasi, tren 12 bulan, kondisi stok per lokasi, kesehatan stok, usia tiket aktif, progress opname, komposisi kategori dan opname per lokasi), heatmap kalender tanggal dalam satu bulan dengan kolom Senin–Minggu, ranking barang dengan foto, serta tabel transaksi terbaru. Warna tanggal berdasarkan total unit transaksi hari itu; tooltip memuat tanggal lengkap dan jumlah unit. Filter bulan memperbarui agregasi transaksi; stok dan opname ditandai sebagai kondisi terkini.
- Foto produk: 906 kode barang dipetakan ke 184 foto bersama melalui 303 alias nama. WebP berada di folder asset lokal; model yang sama memakai satu file. Foto tambahan memakai latar putih atau transparan, dan foto yang sudah ada dipertahankan.
- Inventaris dan stok: thumbnail untuk semua barang, pencarian nama/kode/SN/FA/lokasi, filter lokasi/kategori/kondisi, tabel/grid, pagination, panel detail serta QR.
- Input transaksi: pilihan jenis yang jelas, langkah input, thumbnail pilihan, peringatan stok dan ringkasan unit.
- Tiket: detail bergambar, usia pinjaman, catatan dan tombol pengembalian. Drag/drop tetap tersedia.
- Opname: kartu lokasi/progress, thumbnail barang, pencarian dan filter pemeriksaan.
- Login, aktivitas tim dan pengaturan akun memakai sistem visual yang sama. Animasi transisi/chart/hover menghormati reduced motion.
- Perbaikan frontend terkait: filter periode riwayat dipertahankan; pagination callback bekerja tanpa inline closure serialization; query master mempunyai order untuk auto-pagination; minimum password sesuai endpoint (8); UI admin berdasarkan role endpoint; validasi password lama dilakukan endpoint; tanggal transaksi ISO terbaca saat edit.

## Preview lokal

Dari folder project:

```powershell
python scripts/preview-server.py
```

- Dashboard: http://127.0.0.1:8871/preview
- Login: http://127.0.0.1:8871/preview/login
- View-only: http://127.0.0.1:8871/preview?role=viewer
- Uji bulan terkini tanpa transaksi: http://127.0.0.1:8871/preview?empty-current=1

Preview menggunakan **data contoh sintetis**. Semua request Supabase dicegat oleh fixture sebelum aplikasi berjalan. Aksi simpan, pengembalian dan opname hanya mengubah data di memori browser; reload mengembalikan fixture. `index.html` produksi tidak memuat fixture. Server hanya bind loopback.

Halaman produksi tetap memakai Edge Functions yang sudah ada. Belum ada deployment atau perubahan database/Edge Functions dalam pekerjaan redesign ini.

## Verifikasi

```powershell
node scripts/check-frontend.mjs
node scripts/check-product-catalog.mjs
node scripts/check-dashboard-analytics.mjs
```

Check otomatis: sintaks semua script, ID DOM unik, pemisahan preview/produksi, kategori barang, status stok, batas tanggal periode, callback pagination, struktur tiga stylesheet; resolusi seluruh 906 kode foto, alias kode baru dan konflik kode; agregasi chart, tanggal tidak valid/masa depan, tiket unik, usia pinjaman, unit per lokasi, opname, heatmap kalender (posisi hari, agregasi per tanggal, bulan kosong, Februari kabisat), ranking dan data kosong.

Verifikasi browser dengan fixture: dashboard dan seluruh sembilan canvas chart; perpindahan bulan; pemilihan otomatis bulan terakhir aktif saat bulan terkini kosong; periode kosong yang dipilih pengguna tetap kosong dan bisa kembali ke periode aktif; drilldown riwayat; filter kategori/grid; pemuatan foto dan sumber foto di detail; pencarian SN dan global; panel detail dan riwayat; simpan transaksi pinjaman, tiket aktif dan pengembalian; tanggal ISO serta status terkunci/aktif saat edit tiket; pilih lokasi dan simpan opname termasuk progress kartu yang langsung diperbarui; aktivitas tim; pengaturan akun; mode pengguna biasa tanpa aksi mutasi; layout mobile 390px dan desktop 1280px. Tidak ditemukan error JavaScript pada alur tersebut. Validasi dengan akun inventaris produksi dan perangkat kamera tetap memerlukan sesi pengujian operasional terpisah.

## Batas data

- Foto pencarian adalah referensi model/jenis produk, bukan foto unit fisik kampus. Gambar kategori menjadi cadangan saat model baru belum mempunyai foto atau file gagal dimuat. Nama “keystone lock” masih perlu dikonfirmasi, sementara memakai referensi kunci pengaman laptop. [Pengaturan foto dan atribusi](image-credits.md).
- Tren 12 bulan menggunakan baris transaksi tersimpan, bukan rekonstruksi saldo stok historis. Jika bulan terkini belum memiliki transaksi, pembukaan pertama memilih bulan terakhir aktif; pengguna tetap dapat memilih bulan kosong secara eksplisit.
- Status pengembalian mengganti status baris transaksi lama; grafik menjelaskan bahwa tanggal pengembalian tidak dicatat terpisah.
- Opname adalah status tersimpan, bukan histori sesi audit; pinjaman 30+ hari berarti usia pinjaman, bukan tenggat resmi.
- Metrik aktivitas adalah estimasi durasi sesi. Daftar pengguna tidak mengklaim status online pengguna lain.
- Kategori visual diinfer dari nama/kode, tidak mengubah schema.
- API auto-pagination mempunyai batas 20.000 baris. Temuan autentikasi backend dicatat pada [discovery](redesign-discovery.md); redesign tidak memperbaiki backend tersebut.
