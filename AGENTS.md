# Pegangan agent paket stabil CSM Online

Baca `docs/agent-handbook.md`, `docs/business-rules.md`, `docs/backend-contract.md`, `docs/development-and-release.md`, lalu cari file/fungsi di `docs/code-reference.md`.

Folder ini paket stabil untuk GitHub: HTML/CSS/JS statis dan backend custom-auth. Entry, stok, dan log masih ditulis melalui request terpisah. Lima bug integritas yang dijelaskan dalam business-rules belum diperbaiki pada paket ini. Jangan menganggap dokumentasi atau desain baru berarti backend atomik sudah aktif.

Di workspace lengkap, root project berisi kandidat atomik dengan migrasi 003. Kandidat tidak termasuk paket ini. Jangan mencampur frontend/backend dua versi; backend atomik menolak jalur tulis stable dengan ATOMIC_WRITE_REQUIRED. Jangan memakai Old sebagai rollback autentikasi.

Counter masuk_peminjaman/keluar_peminjaman menghitung kejadian per baris, bukan unit. Return mengganti kode 2 menjadi 1 pada baris yang sama. Jangan menghitung ulang sejarah atau saldo kantor dari asumsi tersebut. Simulasi menggunakan data sintetis; audit/dokumentasi bukan izin deploy atau mengubah database produksi.

Master delete memakai arsip terverifikasi, bukan delete fisik. Jangan menghapus riwayat/cascade, mematikan guard, atau memasukkan secret/dump kantor ke GitHub publik. Jangan menyimpan foto produk ke database tanpa perubahan kebutuhan yang disetujui; katalog foto berada pada assets.

Perbarui dokumentasi bersama perubahan source. Indeks fungsi bersifat tekstual dan menunjukkan lokasi, bukan bukti formal kesamaan perilaku. Script pengujian/pembangun indeks berada di workspace lengkap; paket statis ini tidak memuat runtime tes.

Untuk desain gunakan `docs/design.md`. Login portal/video telah dibatalkan; pertahankan login iMac asli. Skill antislop terpasang pada komputer asal di `C:/Users/csm11/.codex/skills/`; agent lain perlu mencari instalasinya sendiri, membaca core dan skill yang sesuai, lalu menyelesaikan mode menurut core. Jangan menganggap skill tersedia hanya karena path tersebut tercatat.
