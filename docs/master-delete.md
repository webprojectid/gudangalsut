# Delete Master Barang — aturan dan bukti pengujian

Delete mengeluarkan master dari inventaris aktif melalui pengarsipan. Baris asli, ID, kode, jumlah stok awal, alasan, actor, dan snapshot tetap tersedia bagi administrator database. Kode tidak dapat digunakan kembali. Foto bersama tidak ikut dihapus karena dapat dipakai kode lain.

## Tiga rem

1. Alasan manual, 12–600 karakter.
2. Nama dan kode manual harus sama persis dengan data terbaru (spasi luar diabaikan).
3. Username harus cocok dengan sesi; password dan role Administrator dicek lagi di database. Password awal/reset wajib diganti sebelum delete. Lima password salah dalam lima menit membatasi percobaan selama lima menit.

## Keputusan simulasi

| Kondisi | Hasil |
|---|---|
| Master duplikat yang belum dipakai, seluruh konfirmasi benar | Diarsipkan; stok awal hilang dari total aktif, tersimpan pada snapshot |
| Alasan kosong/pendek/panjang, nama atau kode salah | Ditolak |
| Username berbeda, password salah, role staff | Ditolak |
| Password awal belum diganti | Ditolak |
| Riwayat data entry kode mutasi 1, 2, 3, 4, atau 5, termasuk pinjaman sudah kembali | Ditolak |
| Log operasional, termasuk metadata log tidak lengkap | Ditolak |
| Counter masuk/kembali/pinjaman/rusak/permanen bukan nol | Ditolak |
| Opname berstatus Sudah | Ditolak |
| Data barang berubah setelah modal dibuka | Ditolak; buka ulang modal |
| Barang tidak ditemukan atau telah diarsipkan | Ditolak |
| Request sukses yang sama diulang | Sukses idempoten; satu arsip dan satu log |
| Request ID digunakan untuk barang lain | Ditolak |
| Penyimpanan log gagal | Semua pengarsipan dan audit dibatalkan |
| Delete fisik, perubahan arsip, penggunaan kode arsip ulang | Ditolak oleh database |
| Transaksi/log baru atau perubahan stok pada master arsip | Ditolak oleh database |
| Koneksi putus saat submit | Tidak menampilkan sukses; ulangi ID permintaan yang sama |

## Sinkronisasi

`api-proxy` meneruskan `delete_master_guarded` ke RPC `csm_delete_master`. Pemeriksaan, snapshot audit, log, dan penandaan arsip dilakukan dalam satu transaksi PostgreSQL. Master dikunci `FOR UPDATE`; transaksi dan log mengambil `FOR KEY SHARE` pada master yang sama. Bila transaksi/log masuk lebih dahulu, delete menunggu lalu menolak riwayat tersebut. Bila arsip lebih dahulu, transaksi/log berikutnya menunggu lalu menolak master arsip.

Semua query master normal pada proxy hanya mengembalikan master aktif. Query kode saja memasukkan arsip untuk pemeriksaan kode yang sudah dipakai. Cache master/log, kamus transaksi, pemilih barang, stok dan fingerprint dashboard diperbarui setelah sukses. Penyaring lokal mencegah respons lama menghidupkan kembali barang yang sudah dihapus dalam sesi yang sama.

API juga menolak delete umum pada master, transaksi, dan log. Database tidak menghapus transaksi atau melakukan cascade. Master dengan riwayat selalu ditolak, sehingga data historis dan chart transaksi tetap utuh. Tidak ada pemanggilan `writeLog` terpisah dari frontend untuk delete.

## Validasi 6 Oktober 2026

- 35 skenario memakai PostgreSQL WASM/PGlite dan SQL migrasi yang sama, bukan mock aturan database. Termasuk rollback paksa saat log gagal dan izin RPC anon ditolak.
- PGlite memakai satu koneksi: interleaving paralel antar koneksi produksi belum diuji; mekanisme lock PostgreSQL diperiksa dan jalur sebelum/sesudah arsip diuji.
- Preview browser: password salah ditolak, kemudian master duplikat sintetis dihapus; jumlah master turun 73 → 72 dan unit tersedia 1.144 → 1.141.
- Supabase produksi: migrasi berhasil, api-proxy dideploy, query master mendapat HTTP 200, dan delete dengan akun sintetis yang tidak ada mendapat HTTP 401. Tidak ada master produksi dihapus untuk simulasi.
- Integrasi handler `admin-users` dengan helper PostgreSQL: sesi username palsu tanpa password tidak bisa reset/promosi; password salah ditolak; admin terverifikasi tetap dapat memperbarui akun sintetis.
- Tujuh skenario integrasi api-proxy dengan PostgreSQL: payload, password, penolakan delete umum, arsip atomik, query aktif, reservasi kode dan retry.
- Tujuh kelompok regresi frontend, agregasi dashboard, foto, motion, lifecycle dan pergantian bulan lolos.

## Instalasi backend

Migrasi dan api-proxy telah diterapkan pada project yang digunakan saat pengerjaan. Untuk memasang revisi pada project lain dengan skema inventaris yang sama: jalankan `supabase/migrations/202610060001_guarded_master_delete.sql`, kemudian deploy `supabase/functions/api-proxy/index.ts`, `supabase/functions/admin-users/index.ts`, dan `supabase/functions/db-sync/index.ts`. Pertahankan secret `SUPABASE_URL` dan `SERVICE_ROLE_KEY` pada server; jangan masukkan nilai secret ke GitHub.

`db-sync` menolak `clear` sebelum mengubah tabel apa pun dan meminta username/password admin pada `insert`. Dump backup tetap menyertakan arsip. Guard juga menolak proses lama yang mencoba menghapus fisik seluruh master, termasuk resync destruktif. Sinkronisasi impor harus mempertahankan arsip dan menggunakan kode unik; jangan mencoba mematikan guard untuk menjalankan reset massal.

Fitur delete memverifikasi ulang kredensial sungguhan. Reset password dan perubahan role pada `admin-users` kini juga memerlukan username/password admin, sehingga token username saja tidak bisa menjadi jalan pintas. Pengamanan lanjutan pada migrasi 002 mengganti session Base64 dengan token acak yang diverifikasi server dan password dengan hash bcrypt. Akun default lama diblokir sampai reset admin. Ini custom auth, bukan migrasi ke Supabase Auth. Kredensial tidak dicatat pada audit maupun log delete.

Referensi: [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html), [Supabase database functions](https://supabase.com/docs/guides/database/functions).
