# Aturan bisnis dan matematika inventaris

Baseline dokumen: paket stabil `github/new`, 7 Oktober 2026. Kandidat atomik dibedakan di akhir. Semua contoh memakai data sintetis.

## Istilah yang tidak boleh tertukar

| Field | Arti pada kode sekarang |
|---|---|
| kode_barang | Identitas hubungan master/transaksi; bukan sekadar nama tampilan |
| qty | Jumlah unit pada satu baris transaksi |
| tersedia | Saldo unit yang tersedia sekarang |
| stok_paten | Nilai master yang diinput; tidak otomatis berubah oleh mutasi 5 |
| masuk_peminjaman | Counter kejadian masuk per baris (+1), bukan total unit |
| keluar_peminjaman | Counter kejadian keluar per baris (+1), bukan total unit |
| masuk_baru | Total unit masuk baru yang diubah helper mutasi |
| rusak/permanen | Counter unit terkait kondisi/pergerakan tersebut |
| nomor_tiket | Mengelompokkan beberapa baris; satu tiket tidak sama dengan satu barang |
| last_opname_date | Teks status pemeriksaan; penyimpanan biasanya `Sudah - d/m/yyyy` |

stok_paten dipakai UI untuk indikator stok rendah dan ada label Stok minimum pada detail. Hal itu tidak membuktikan pemilik menetapkannya sebagai reorder point. Jangan diam-diam mengubah arti field menjadi ambang restock.

## Mutasi tambah transaksi

| Kode | Jenis | Delta tersedia | Delta counter |
|---:|---|---:|---|
| 1 | Masuk peminjaman/pengembalian | +qty | masuk_peminjaman +1 |
| 2 | Keluar peminjaman | -qty | keluar_peminjaman +1 |
| 3 | Rusak | -qty | rusak +qty |
| 4 | Keluar permanen | -qty | permanen +qty |
| 5 | Masuk baru | +qty | masuk_baru +qty |

Helper stable mengubah saldo tersedia negatif menjadi 0. Ini perilaku lama dan berisiko menyembunyikan overdraw, bukan mekanisme validasi total yang benar.

Pada stable, submit memvalidasi form, menulis data_entry, menyesuaikan master dan mencatat log melalui request terpisah. Gagal pada langkah tengah tidak otomatis membatalkan langkah sebelumnya. Jangan menjanjikan semua langkah selalu berhasil bersama.

## Edit qty peminjaman

Contoh tiket 123123 memiliki HDMI 30m qty 3, tersedia 7. Edit qty menjadi 2 untuk kode barang dan mutasi 2 yang sama:

- Baris data_entry yang diedit menjadi qty 2; nomor tiket tetap bila form tidak menggantinya.
- Tersedia bertambah 1 menjadi 8, karena selisih pinjaman -1.
- masuk_peminjaman/keluar_peminjaman tetap karena kejadian/baris tetap sama.
- Baris barang lainnya tidak berubah jika tidak diedit.
- Log edit dicoba disimpan. Kegagalan log dapat tertelan oleh writeLog.

Ubah 2 menjadi 3 berarti tersedia berkurang 1. Pergantian kode barang atau jenis mutasi melibatkan pembalikan efek lama dan efek baru; khusus rusak/permanen masih memiliki bug tanda di stable.

Tambah barang pada form edit membuat baris baru beserta efeknya. Menghapus baris dari form edit belum menghapus original row database: lihat risiko nomor 5. Jangan menyamakan mengurangi qty dengan menghapus seluruh baris.

## Return melalui Active Ticket

returnTicket membaca semua baris nomor tiket dengan kode_mutasi 2. Untuk setiap baris:

1. tersedia bertambah qty melalui reverse kode 2; keluar_peminjaman dipertahankan.
2. masuk_peminjaman bertambah 1.
3. Baris data_entry yang sama berubah kode_mutasi 2 menjadi 1.
4. Log dicoba ditambahkan setelah baris-baris diproses.

Return menganggap seluruh qty pada tiket telah kembali. Tidak ada input kuantitas kembali sebagian pada alur tersebut. Contoh peminjaman 3 unit memberi keluar +1; return 3 unit memberi masuk +1, sehingga selesai satu siklus tampil 1-1. Tujuh kejadian yang sudah kembali dapat tampil 7-7 walaupun unit setiap kejadian berbeda.

Return mengubah status baris lama, bukan membuat pasangan row keluar+masuk baru. Karena itu data_entry bukan ledger pergerakan immutable lengkap. Tanggal pada row yang berubah tidak boleh dianggap otomatis tanggal return. Jangan menghitung ulang saldo atau sejarah harian tanpa bukti tambahan.

Undo mengubah baris kembali ke kode 2 dan mengurangi tersedia sesuai qty. Pada stable counter masuk tidak dikurangi; ulang return/undo/return dapat menaikkannya. Counter identik masuk/keluar tidak membuktikan stok fisik lengkap atau data bebas kegagalan parsial.

## Opname, master, catatan dan waktu

Opname hanya mengubah last_opname_date, batch 20. Tidak mengoreksi saldo fisik. Menandai Sudah bukan bukti qty fisik sudah direkonsiliasi.

Master add/edit menyimpan metadata serta angka form. Tidak ada penghitungan ulang otomatis semua history ketika master diedit. Guard arsip berbeda dari edit master biasa; baca backend-contract sebelum mengubahnya.

Catatan Active Ticket memperbarui catatan terkait tiket; tidak mengubah qty/stok. Time Management memakai user_activity, idle 60 detik dan simpan interval 30 detik. Durasi aktif adalah estimasi interaksi browser, bukan absensi resmi.

## Dashboard

| Metrik | Sumber dan batas |
|---|---|
| Tiket periode | Tiket unik dari entry bertanggal pada periode; tiket kosong memakai fallback per row |
| Tiket aktif | Semua entry kode 2 sekarang; bukan snapshot pinjaman pada akhir bulan lampau |
| Tersedia/kondisi/lokasi | Master aktif sekarang |
| Mutasi/seri bulanan | Jumlah qty entry menurut kode dan tanggal; return mengubah kode lama, jadi bukan ledger immutable |
| Heatmap tanggal | Total qty seluruh mutasi per hari dalam bulan, bukan jumlah tiket/orang |
| Opname | Prefix Sudah pada last_opname_date, bukan semua teks tanggal nonkosong |
| Usia pinjaman | Kini dikurangi tanggal paling awal tiket; kelompok tanpa tanggal terpisah |
| Top barang | Akumulasi qty seluruh mutasi periode; fallback seluruh riwayat jika periode kosong, label scope tersedia |
| Stok rendah | tersedia dibanding stok_paten, indikator turunan dengan batas arti di atas |

Helper numberValue menggunakan Number dan clamp negatif ke 0 untuk penyajian. Jangan memakai angka tersanitasi chart sebagai bukti tidak ada saldo invalid di database. invalidDates pada analytics juga mencakup entry yang tidak masuk himpunan dated (termasuk tanggal masa depan), jadi nama itu bukan diagnosis format semata.

Old menghitung beberapa metrik berbeda: jumlah row bukan tiket, opname semua teks nonkosong, usia dengan cutoff periode, parsing tanggal lama. Angka ringkasan berbeda tidak selalu berarti stok database berubah. Riwayat mempunyai warning threshold 20.000; itu bukan perintah memotong array client.

## Lima risiko stable yang telah direproduksi

| ID | Kasus | Hasil stable/Old |
|---|---|---|
| B1 | tersedia 5, dua baris kode sama qty 3+3 | Validasi per baris lolos; total 6 tersimpan, tersedia clamp 0 |
| B2 | Gagal update master atau log setelah insert entry | Berhasil sebagian; tidak rollback menyeluruh |
| B3 | Counter rusak 7, edit row rusak qty 3 menjadi 4 | Counter menjadi 6; seharusnya 8. Permanen mempunyai pola tanda yang sama |
| B4 | Return lalu undo | Saldo balik, counter masuk tidak balik |
| B5 | Row original dihapus dari form edit | Row original masih tersimpan dan efeknya belum dibalik |

Perbandingan 149 skenario Old/New membuktikan perilaku yang diuji sama, termasuk bug. Ini tidak membuktikan data kantor telah rusak dan bukan persetujuan memperbaiki/backfill produksi.

## Kandidat atomik, belum menjadi stable

Root workspace menggunakan inventory_commit dan migrasi 003: efek inventory_effect/loan_cycle, receipt UUID, expected snapshot, agregasi delta batch dan validasi nonnegatif; perubahan entry/master/log dilakukan dalam satu transaksi. Ops: entry_save, ticket_return, ticket_undo, master_save, opname, ticket_note. Riwayat return lama tanpa provenance tidak ditebak; undo tertentu ditolak untuk pemeriksaan manual.

Tes lokal kandidat tercatat dalam integrity-audit-20261006.md di workspace lengkap. Paket stable tidak memiliki migrasi 003 atau helper inventory-commit.js. Jangan mengklaim B1-B5 sudah hilang dari stable atau mengaktifkan kandidat hanya dengan mengganti satu file.
