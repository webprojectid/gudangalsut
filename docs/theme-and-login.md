# Tema, cutout login, dan heatmap kalender

5 Oktober 2026. Implementasi lokal di D:/Project/gudangalsut-main.

## Dark / Light

Light menjadi default dengan aksen cyan, coral dan lime. Dark menggunakan permukaan charcoal dan aksen yang sama. Tombol tersedia di login serta top bar workspace, termasuk ponsel. Pilihan tersimpan pada localStorage `csm-online-theme`; script di head menerapkannya sebelum tampilan halaman. Sidebar, form, tabel, modal, badge, tooltip dan seluruh chart mengikuti tema. SVG kategori cadangan juga diperbarui tanpa warna ungu.

## Heatmap kalender

Pola aktivitas menampilkan semua tanggal dalam bulan yang dipilih, dengan tujuh kolom Senin–Minggu. Posisi tanggal mengikuti hari awal bulan, termasuk Februari kabisat. Tiap tanggal menjumlahkan qty seluruh data entry valid pada hari itu, hingga tanggal saat ini. Tidak ada pemotongan berdasarkan kategori. Intensitas warna dibagi menjadi empat tingkat relatif terhadap hari paling aktif pada bulan itu; hari tanpa transaksi memakai tingkat nol. Tooltip dan label aksesibilitas memuat hari, tanggal lengkap, dan unit transaksi. Pemilihan bulan memakai kontrol periode dashboard yang sudah ada.

## Cutout login

Login terbaru memakai iMac 24 inci 2021, keyboard dan mouse terpisah, webcam serta speakerphone. Animasi autoplay tanpa play/pause. [Revisi iMac, wallpaper asli pengguna, file dan prompt](login-imac-2021.md).

Berikut arsip tiga cutout awal melalui **built-in image_gen** (bukan CLI). File katalog asli tidak ditimpa. PNG dengan alpha diturunkan ukurannya menjadi WebP dengan alpha. Foto ditampilkan tanpa kartu putih, figcaption, nama atau kategori; nama produk tetap tersedia sebagai alt untuk aksesibilitas. HP ProBook di bawah tidak lagi dipakai pada login.

### HP ProBook 430 G7

- Input: D:/Project/gudangalsut-main/assets/products/catalog/hp-probook430g7.webp
- File final: D:/Project/gudangalsut-main/assets/products/login/hp-probook430g7.webp (640 × 640, RGBA dengan alpha transparan)
- Output PNG bawaan: C:/Users/csm11/.codex/generated_images/01a10b3e-33b0-7830-acc4-0f804360eb88/exec-3d639224-907f-407c-b602-3e1c68b864aa.png

Prompt final:

```text
Use case: background-extraction. Edit target: the attached real product photograph. Produce a faithful cutout of ONLY the HP ProBook laptop. Remove only the white backdrop, ground shadow and empty white margins. Preserve the silver laptop body, open screen angle, keyboard, trackpad, ports, HP logo, and exactly the displayed mountain/paraglider screen image. Do not redraw, redesign, recolor, relight or substitute the product. Do not add text, labels, category names, cards, a pedestal, a frame, props or any backdrop. Center the entire existing product silhouette with 8 percent transparent padding, no part cropped off. Output must have genuine transparent alpha, not an opaque white or checkerboard background. The photo will float over light cyan and dark charcoal website backgrounds.
```

### Logitech C930e

- Input: D:/Project/gudangalsut-main/assets/products/catalog/logitech-c930e.webp
- File final: D:/Project/gudangalsut-main/assets/products/login/logitech-c930e.webp (640 × 640, RGBA dengan alpha transparan)
- Output PNG bawaan: C:/Users/csm11/.codex/generated_images/01a10b3e-33b0-7830-acc4-0f804360eb88/exec-1337bfd6-ed09-49be-b549-392b2b5409bd.png

Prompt final:

```text
Use case: background-extraction. Edit target: the attached real product photograph. Produce a faithful cutout of ONLY the Logitech C930e webcam. Remove only the white backdrop, ground shadow and empty white margins. Preserve the horizontal black/silver webcam, round lens, visible Logitech marking, hinge, mounting clip, proportions, orientation, and all visible controls. Do not redraw, redesign, recolor, relight or substitute the product. Do not add text, labels, category names, cards, a pedestal, a frame, props or any backdrop. Center the entire existing product silhouette with 8 percent transparent padding, no part cropped off. Output must have genuine transparent alpha, not an opaque white or checkerboard background. The photo will float over light cyan and dark charcoal website backgrounds.
```

### Poly Sync 20

- Input: D:/Project/gudangalsut-main/assets/products/catalog/poly-sync20.webp
- File final: D:/Project/gudangalsut-main/assets/products/login/poly-sync20.webp (640 × 427, RGBA dengan alpha transparan)
- Output PNG bawaan: C:/Users/csm11/.codex/generated_images/01a10b3e-33b0-7830-acc4-0f804360eb88/exec-17b5ca58-929e-4328-83a0-315d2c29da95.png

Prompt final:

```text
Use case: background-extraction. Edit target: the attached real product photograph. Produce a faithful cutout of ONLY the Poly Sync 20 speakerphone. Remove only the white backdrop, ground shadow and empty white margins. Preserve the diagonal gray fabric speakerphone body, fabric weave, Poly logo, silver control strip, green indicator, buttons, and attached wrist strap. Do not redraw, redesign, recolor, relight or substitute the product. Do not add text, labels, category names, cards, a pedestal, a frame, props or any backdrop. Center the entire existing product silhouette with 8 percent transparent padding, no part cropped off. Output must have genuine transparent alpha, not an opaque white or checkerboard background. The photo will float over light cyan and dark charcoal website backgrounds.
```

## Verifikasi

- Semua tiga check Node lulus: frontend, katalog foto (906 kode), dan agregasi dashboard.
- Uji kalender: Oktober 2026 memiliki 31 tanggal mulai Kamis; September 2026 memiliki 30 tanggal mulai Selasa; Februari 2024 memiliki 29 tanggal mulai Kamis; Februari 2026 memiliki 28 tanggal mulai Minggu. Bulan kosong tetap memperlihatkan semua tanggal dengan intensitas nol.
- Browser: pergantian Dark/Light pada dashboard (sembilan canvas), form dan dua chart aktivitas tim; pilihan Dark tetap tersimpan setelah reload. Tidak ada error atau warning JavaScript pada alur ini.
- Verifikasi awal cutout ada di arsip ini; revisi terbaru memverifikasi lima produk bergerak otomatis tanpa tombol play/pause, dengan poster pengguna di layar iMac. Detail verifikasi ada pada catatan revisi iMac di atas.
- Desktop dan ponsel 390 px: login serta dashboard tidak melebar keluar layar; tombol tema tetap terlihat. Screenshot tersimpan di docs/login-light.png, login-dark.png, login-light-mobile.png, dashboard-light.png, dashboard-dark.png, dashboard-light-mobile.png, dashboard-dark-mobile.png.

Preview memakai data contoh sintetis. Halaman produksi menghitung dari data entry API yang ada. Pekerjaan ini tidak memublikasikan website atau mengubah database.

