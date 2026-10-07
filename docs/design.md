# CSM Online / Gudang CSM

Dokumen arah desain, disarikan dari permintaan pengguna pada percakapan ini. Anti-slop 3.2.20 dipakai sebagai filter dan pemeriksaan; keputusan produk berasal dari brief pengguna.

## Identitas dan pemakai

Aplikasi inventaris internal untuk tim kantor. Pemakai mencatat mutasi, mencari barang berdasarkan nama/kode, memeriksa stok dan lokasi, menindaklanjuti pinjaman, melakukan opname dan mengatur akses. Kejelasan data lebih penting daripada kesan ramai.

Pengguna meminta tampilan berkarakter, foto barang, dashboard penuh chart dengan sumber data transaksi, sidebar ringkas, Light/Dark, dan motion yang terasa disengaja. Pengguna menolak ungu, warna pastel sebagai identitas, garis ornamental, logo/kalimat BINUS Alsut pada UI, serta portal/video masuk ke wallpaper. Login mempertahankan iMac 24 inci 2021, keyboard/mouse terpisah dan wallpaper yang diberikan pengguna. Nama produk: CSM Online dan Gudang CSM.

## Design Read

ENERGY 2 / RHYTHM 2 / MOTION 2. Dials ini mengikuti interpretasi brief yang sudah dicantumkan pada audit pertama dan disetujui bersama seluruh 14 revisi.

- ENERGY 2: petrol sebagai warna tindakan, cyan untuk inventaris, copper untuk ketersediaan; warna lain hanya membedakan kondisi/data.
- RHYTHM 2: dashboard dimulai dari tindak lanjut, dilanjutkan angka ringkas dan chart sesuai pertanyaannya. Form menggunakan alur detail/barang/ringkasan; daftar menggunakan tabel atau grid foto sesuai pilihan pemakai.
- MOTION 2: perpindahan, feedback, disclosure dan perubahan periode bergerak singkat. Angka final tetap tersedia langsung. Motion punya pembatalan saat navigasi, logout atau perubahan preferensi perangkat.

## Alasan visual

| Keputusan | Alasan |
|---|---|
| Petrol/cyan dengan copper | Mengikuti arah warna pengguna; membedakan jenis inventaris dari jumlah siap digunakan. |
| Gradient pada dua metrik utama dan tombol utama | Menentukan titik perhatian sesuai brief warna berkarakter; panel data tetap tenang. |
| Chart memakai warna semantik terpusat | Seri yang sama tetap dikenali dalam tema dan halaman berbeda. Warna disertai label dan tabel angka. |
| Dark mode petrol gelap | Permintaan langsung pengguna; Light menjadi default sebelum preferensi disimpan. |
| Manrope untuk judul/angka, DM Sans untuk isi | Mempertahankan identitas yang ada dan keterbacaan data padat. Monospace dipakai untuk kode/identitas, bukan heading dekoratif. |
| Radius 8/12/18/24 px | Membedakan kontrol, metrik, panel dan dialog; tidak semua elemen menjadi capsule. |
| Panel tanpa shadow besar | Data menjadi permukaan kerja. Elevasi dipakai untuk dialog dan tindakan utama yang perlu dikenali. |
| Kalender lebih lebar daripada donut ringkas | Tanggal harus terbaca dan bisa disentuh, dengan target minimal 44 px. |
| Chart aktivitas/tren lebih lebar | Label tanggal dan beberapa seri membutuhkan ruang dibanding ringkasan komposisi. |
| Tabel di kontainer scroll | Mempertahankan kolom operasional tanpa membuat dokumen melebar pada mobile. |
| Badge kondisi | Menjelaskan status stok/mutasi yang benar-benar berasal dari data. |
| Ikon kotak, lokasi, pencarian, kalender, pengembalian | Menandai tugas inventaris dan kontrol; tidak memakai sparkle dekoratif. |
| iMac dan foto barang yang ada | Mengikuti aset/permintaan pengguna, tanpa ilustrasi generik baru. |
| Gerakan login melayang | Permintaan eksplisit pengguna; aset tetap terpisah dari form dan tidak menunda autentikasi. |
| Tindak lanjut stok/rusak/pinjaman pada awal dashboard | Menjawab tindakan berikutnya yang dibutuhkan staf, bukan sekadar mengisi ruang dengan chart. |

## Kepemilikan source

`assets/character.css` menjadi sumber token warna, radius, skala teks, focus dan elevasi. `workspace.css` mengatur struktur/layout, `theme.css` perilaku tema, `login.css` komposisi login. `theme.js` menyediakan palet chart dari token tersebut.

`ui-state.js` menjaga status baca dan draft selama satu sesi. Kegagalan baca pertama menampilkan jumlah belum diketahui. Kegagalan pembaruan mempertahankan snapshot dengan waktu pemeriksaan terakhir dan retry. Draft tidak disimpan ke localStorage. `chart-data.js` menyajikan tabel dari input chart yang sama serta pilihan tanggal kalender.

Root `index.html` tetap kandidat inventory atomik. `github/new/index.html` tetap kontrak tulis stabil. Aset presentasi dibagikan dan diperiksa identik, tetapi entry point tidak disalin keseluruhan. Revisi audit ini tidak menjalankan migrasi, deploy Edge Function, push GitHub atau mutasi database kantor.

## Bahasa dan klaim

Bahasa UI utama Indonesia. Nama menu operasional yang sudah dipakai tim, misalnya Master Barang dan Data Entry, tetap dikenali. Tombol menyebut tindakannya: simpan perubahan, kembalikan barang, buang draft, atau pilih foto pratinjau. Angka kosong tidak dipakai untuk menyamarkan API gagal. Foto referensi dibedakan dari foto aset asli. Tidak ada klaim baru bahwa kontrak tulis stabil sudah berubah menjadi transaksi atomik.
