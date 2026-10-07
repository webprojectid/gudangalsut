# Perbaikan peminjaman dan riwayat kosong — 6 Oktober 2026

Validasi projection pada pengamanan API semula menerima `*` atau daftar kolom, tetapi tidak menerima gabungan valid `*,id` yang dipakai riwayat, pinjaman aktif, pengembalian, pencarian dan edit tiket. Request tersebut ditolak sebelum query database, sehingga halaman gagal memuat data.

Validasi diperbaiki menjadi daftar token yang masing-masing berupa wildcard atau nama kolom sederhana. Relasi, alias, fungsi dan karakter query injeksi tetap ditolak dengan INVALID_SELECT / HTTP 400. Autentikasi token, otorisasi admin, RLS dan guard archive tetap berlaku.

API-proxy sudah dideploy pada backend produksi. Tidak mengubah baris transaksi atau inventaris. Frontend yang sudah dipush tetap kompatibel; muat ulang dan login untuk mengambil data lagi.

Verifikasi source publik: semua 255 file paket yang sebelumnya dipush ada dan cocok dengan GitHub (format newline Git diperhitungkan), tanpa file hilang/ekstra. File utama website aktif juga cocok. Source api-proxy dan dokumen ini kemudian diperbarui dalam paket new untuk menyimpan perbaikan backend.

Database produksi masih memiliki 906 master aktif, 4206 baris transaksi, 4 baris kode mutasi 2 dan 3804 baris kode mutasi 1. Jumlah baris tidak sama dengan jumlah tiket karena satu tiket dapat berisi beberapa barang. Sampel tanggal tertinggi adalah 2026-09-17; periode Oktober belum memiliki transaksi ISO baru saat pengecekan.

Regression check-secure-sessions.mjs menjalankan handler sebenarnya terhadap PostgreSQL lokal dengan kasus select `*,id` untuk riwayat, active loans, returned loans dan lookup edit; semuanya berhasil. Projection relasi/injeksi tetap ditolak. Delapan bentuk select literal di frontend diperiksa dan semuanya diterima. Pengujian sesi/password/akses staf tetap lolos.
