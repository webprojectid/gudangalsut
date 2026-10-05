# CSM ALSUT — konteks redesign

Inspeksi: 5 Oktober 2026. Sumber: frontend lokal, screenshot pengguna, serta Table Editor dan source Edge Functions project Supabase `sufiawwyymeoiqjtjbzd` melalui sesi browser pengguna. Inspeksi baca saja; tidak menjalankan SQL, test function, deployment, atau perubahan data produksi.

## Frontend

- Aplikasi vanilla HTML/CSS/JavaScript dalam `index.html` (5.530 baris).
- Halaman: login dan wajib ganti password, dashboard, data entry, master barang, stock gudang, stock opname, transaksi, active/returned ticket, time management, account settings.
- Library CDN: Chart.js, SheetJS, html5-qrcode, Font Awesome.
- Tema dipaksa light; aksen aplikasi hijau dan login ungu.
- Shell desktop: rail 78px, sidebar 264px; hover mengubah kolom konten. Mobile menggunakan drawer pada breakpoint 768px.
- Dashboard: grid 12 kolom, metrik, alert, empat chart, heatmap, daftar pinjaman, log, event, dan progress opname.
- Banyak inline style, override, dan beberapa deklarasi CSS tidak valid. Ada fungsi `previewMasterKode` duplikat.
- Cache daftar menggunakan stale-while-revalidate; alur stok membaca langsung sebelum menulis.

## Data yang terverifikasi

Jumlah record saat inspeksi: `master_barang` 906, `data_entry` 4.206, `log` 209, `user_activity` 160. Jumlah akun tidak dihitung dari tabel; screenshot pengguna menunjukkan 10 akun. Sampel yang dibaca terbatas pada tampilan awal tabel; bukan audit seluruh record.

### master_barang

`id` bigint identity PK; `kode_barang` text unik; `nama_barang`, `serial_number`, `fa_number`, `lokasi_barang` text; `masuk_peminjaman`, `masuk_baru`, `keluar_peminjaman`, `rusak`, `permanen`, `tersedia`, `stok_paten` integer; `last_opname_date` text; `barcode` nullable text. Index lokasi.

- Tidak ada kolom kategori khusus pada definisi yang dibaca.
- Frontend menginfer kategori dari nama barang.
- Status opname disimpan sebagai teks, misalnya `Sudah - tanggal`, bukan riwayat audit per sesi.
- Kolom masuk/keluar peminjaman diperlakukan sebagai counter transaksi di frontend, sedangkan tersedia/rusak/permanen menggunakan unit. Jangan menyamakan satuannya.

### data_entry

`id` bigint identity PK; `tanggal`, `nomor_tiket`, `nama_peminjam`, `kode_barang`, `nama_barang`, `keterangan` text; `qty`, `kode_mutasi` integer; `catatan` nullable text. Index nomor tiket dan kode barang.

- Satu nomor tiket bisa memiliki banyak baris barang.
- Mutasi: 1 pengembalian, 2 peminjaman, 3 rusak, 4 keluar permanen, 5 stok baru.
- Frontend pengembalian mengubah `kode_mutasi` 2 menjadi 1 pada baris yang sama. Undo mengembalikan ke 2.
- Tidak ada kolom tanggal pengembalian atau tenggat pada schema ini. Usia pinjaman bisa dihitung; keterlambatan resmi membutuhkan aturan/tenggat.
- Jangan menyebut grafik tanggal transaksi sebagai riwayat kejadian pengembalian yang lengkap: status lama dapat berubah dan tanggal pengembalian tidak direkam terpisah di tabel transaksi.

### log

`id` bigint identity PK; `timestamp`, `user`, `halaman`, `aksi`, `kode_barang`, `qty`, `kode_mutasi`, `detail`, `keterangan` text.

- Sampel timestamp memakai `DD/MM/YYYY HH:mm:ss`.
- Bisa menjadi timeline audit; log yang tersedia belum terbukti mencakup seluruh sejarah transaksi.

### user_activity

`id` bigint identity PK; `username` text; `nama_lengkap` text nullable; `login_time`, `logout_time` timestamptz nullable; `active_seconds` integer nullable; `date_str` text nullable.

- Durasi aktivitas adalah estimasi mekanisme idle frontend, bukan ukuran produktivitas atau bukti presence real-time.

### users

`id` bigint identity PK; `username` text unik; `password` text; `role`, `nama_lengkap` text nullable. Hanya schema diperiksa; isi password akun tidak dibaca/disimpan.

Tidak terlihat foreign key atau trigger pada definisi lima tabel yang dibaca. Ini tidak menggantikan audit seluruh schema, policies, functions database, atau konfigurasi proyek.

## Edge Functions yang dibaca

- `api-proxy`: allowlist empat tabel operasional; get/insert/update/delete. Filter equality, select, order, limit dan range eksplisit. Auto-pagination per 1.000 baris jika ada order dan limit tidak ada atau >1.000, dibatasi 20.000 total. Query tanpa order tidak otomatis mengambil seluruh tabel.
- `login`: lookup tabel users, validasi password, mengembalikan data user tanpa password dan flag wajib ganti password.
- `change-password`: validasi password lama dan panjang password baru minimal **8**, sementara UI masih menyebut/mengecek **6**.
- `admin-users`: list akun tanpa password, ubah role, reset password; memeriksa role administrator dari lookup user.
- `db-sync`: dump berhalaman serta clear/insert batch master_barang/data_entry untuk administrator. Fungsi ini bukan bagian alur frontend lokal yang dibaca dan tidak dipanggil saat inspeksi.

## Ketidaksinkronan yang perlu diperhatikan

- Catatan frontend tentang batas server 1.000 transaksi sudah tertinggal dari source `api-proxy` yang memiliki auto-pagination. Range tersedia di backend tetapi parser parameter frontend belum meneruskannya.
- UI menentukan admin dari username tertentu; backend admin-users/db-sync menentukan admin dari role.
- Frontend ganti password membandingkan password lama dengan field password yang dihapus saat completeLogin; validasi seharusnya dilakukan oleh endpoint.
- Autentikasi operasional memakai username ber-Base64, bukan token sesi bertanda tangan. `api-proxy` yang dibaca hanya mendekode token tanpa lookup user/role. Login membandingkan password secara langsung. Ini temuan source, belum diuji eksploitasi, dan perlu pekerjaan backend tersendiri sebelum akses operasional diperluas.

## Arah desain yang didukung data sekarang

1. Overview operasional: kondisi inventaris sekarang, prioritas stok rendah/rusak, usia pinjaman, dan progress opname tiap lokasi.
2. Inventaris: tabel dengan pencarian/filter lokasi/status, angka dengan satuan jelas, dan panel detail aset (SN/FA/stock/catatan terkait).
3. Peminjaman: ringkasan per tiket dengan detail barang, usia, catatan dan aksi pengembalian yang terlihat jelas; drag-and-drop sebagai tambahan, bukan satu-satunya cara.
4. Opname: pilih lokasi lewat kartu ringkasan, tampilkan progress dan scan workflow yang nyaman di mobile.
5. Input transaksi: pilihan jenis mutasi dengan bahasa yang jelas, daftar barang, warning stock inline, ringkasan sebelum simpan.
6. Empty state: ketika periode belum memiliki transaksi, tampilkan penjelasan dan jalan menuju periode yang berisi data; jangan isi area utama dengan chart kosong.
7. Visual: typography lebih terbaca, grid konsisten, sidebar stabil, hierarki panel berdasarkan kepentingan, warna status konsisten, animasi pendek untuk feedback dan navigasi dengan reduced-motion.

Ide yang memerlukan data/backend tambahan: nilai uang aset, foto aset, kategori terstruktur, tenggat pinjaman, tanggal pengembalian, riwayat audit opname, histori lokasi/kondisi, forecasting dan tingkat utilisasi yang presisi. Jangan menampilkan angka rekaan atau menganggap kolom tersebut sudah tersedia.

Catatan di atas merekam kondisi sebelum implementasi. Frontend lokal kini sudah dibangun ulang; lihat redesign-notes.md untuk perubahan dan hasil verifikasi. Backend tidak diubah.

