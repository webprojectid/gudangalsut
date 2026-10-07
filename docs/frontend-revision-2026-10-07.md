# Revisi frontend 7 Oktober 2026

Revisi berdasarkan 14 temuan audit anti-slop yang disetujui pengguna. Paket ini tetap memakai kontrak tulis backend stabil.

- API gagal menampilkan pesan menetap dan Coba lagi. Jumlah yang belum diketahui dibedakan dari daftar kosong; refresh gagal mempertahankan data terakhir yang berhasil dibaca.
- Draft Data Entry bertahan selama navigasi dalam sesi. Mengosongkan draft, transaksi baru, edit tiket lain atau logout mempunyai konfirmasi bila ada perubahan. Draft tidak disimpan permanen.
- Logout membersihkan state, draft, tabel, chart, cache dan pratinjau lokal; respons lama dibatalkan.
- Dashboard memprioritaskan stok habis, barang rusak dan pinjaman lama. Calendar membuka riwayat tanggal terpilih dengan reset filter; chart mempunyai tabel angka dari input yang sama.
- Kontras, ukuran target, keyboard, focus, grid mobile, hierarki card, copy dan token tema diperbaiki. Light/Dark dan iMac login dipertahankan; portal/video login dibatalkan.

Validasi dilakukan pada data contoh terisolasi: sembilan menu, lima lebar layar, kedua tema, ditambah login. Tes syntax, state, draft dan motion lulus; 164 pasangan warna yang diperiksa lulus checker skill. Operasi tulis database kantor, pemilihan file native sampai selesai, scanner fisik, zoom/screen reader penuh dan deployment publik tidak disertifikasi oleh pemeriksaan ini.

Upload isi folder ini ke root repository dengan struktur assets lengkap. Jangan mengganti index.html ini dengan kandidat inventory atomik di root workspace tanpa rilis backend yang sesuai. Revisi frontend ini tidak menjalankan migrasi, deploy atau push GitHub.
