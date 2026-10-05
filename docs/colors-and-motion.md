# Audit warna dan motion — 6 Oktober 2026

Palet menggunakan petrol, electric cyan, copper, emerald, amber, dan charcoal. Surface netral mendukung data padat; aksen berwarna memakai gradasi dan pencahayaan, bukan bidang datar atau pastel. Tidak ada aksen ungu pada palet UI/chart baru.

`assets/character.css` adalah lapisan terakhir setelah stylesheet motion. Card memakai gradasi dan bayangan terukur tanpa garis aksen di tepi atau highlight garis bagian atas; ikon dan status memiliki wadah/aksen yang tegas. Warna chart diperbarui pada workspace serta analytics; grid tidak menggantikan bentuk data. Heatmap mengikuti tanggal satu bulan, dengan intensitas berdasarkan total unit nyata.

## Kontras yang diperiksa

Teks kecil diperiksa pada bagian paling gelap/terang gradasi yang relevan, memakai perhitungan luminansi sRGB:

| Pasangan | Rasio minimum |
|---|---:|
| Teks brand login Light pada seluruh stop gradasi | minimal 4,95:1 |
| Caption metric cyan | 5,02:1 |
| Caption metric copper | 4,63:1 |
| Teks muted Light pada surface input | >4,5:1 |
| Teks muted Dark pada surface card | 6,64:1 |
| Angka heatmap Light level 1 / 2 | 4,99:1 / 4,88:1 |
| Badge amber | 5,09:1 |
| Tombol utama Light | 5,56:1 |
| Tombol delete | 4,66:1 |

Pemeriksaan ini meliputi pasangan di atas, bukan klaim audit WCAG menyeluruh. Browser diuji pada desktop 1280 × 900 serta mobile 390 × 844, tanpa overflow horizontal atau error JavaScript pada preview.

## Motion tetap terhubung dengan state nyata

Micro-interaction, transisi halaman dan login/logout, loading/progress, feedback, scroll reveal, spring fisik, particle, state transition, rolling text, dan morph chart tetap menggunakan state aktual. Pergantian bulan memakai request terbaru; respons lama tidak mengganti periode atau mengembalikan master yang sudah dihapus. Popup delete mengikuti motion overlay, feedback error dan toast; submit ganda dibatasi, password dikosongkan setelah dikirim.

Indikator scroll berupa garis tersegmentasi disembunyikan; scroll reveal dan perubahan state tetap berjalan.

Mode reduced motion tetap dihormati. `scripts/preview-server.py` menyediakan `/preview?motion=full` dengan fixture terisolasi untuk pemeriksaan efek penuh, serta `/preview/login?motion=full` untuk login. Fixture dan script preview tidak ikut paket website GitHub.
