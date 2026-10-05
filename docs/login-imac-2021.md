# Login iMac 24 inci 2021

5 Oktober 2026. Revisi lokal atas permintaan pengguna.

## Perubahan

- HP ProBook pada login diganti iMac 24 inci M1 tahun 2021 warna mint. Keyboard dan mouse berupa file terpisah, figure terpisah, dan durasi/delay animasi terpisah, berada dekat iMac.
- Kelima produk (iMac, keyboard, mouse, webcam dan speakerphone) langsung melayang saat login dimuat. Tidak ada tombol play/pause, handler atau inisialisasi tombol lama. Gerakan yang lebih kecil dipakai pada reduced motion, tetap autoplay sesuai permintaan pengguna; chart dan transisi aplikasi lain tetap mengikuti reduced motion.
- Poster asli dari pengguna dipasang sebagai lapisan img di area layar: tidak digambar ulang oleh AI. Bezel, layar, chin dan stand ikut satu transformasi iMac. Branding UI tetap CSM Online / Gudang CSM; tulisan pada poster dipertahankan sesuai gambar yang diminta.
- Foto katalog inventaris tidak diubah. Aset login disimpan lokal untuk dibaca frontend, tanpa upload ke Supabase.

## Referensi dan hasil

Referensi bentuk produk: [Apple Newsroom, iMac 2021](https://www.apple.com/newsroom/2021/04/imac-features-all-new-design-in-vibrant-colors-m1-chip-and-45k-retina-display/). Sumber edit ketiga aset: [foto resmi iMac mint dengan aksesori](https://www.apple.com/newsroom/images/product/imac/standard/apple_new-imac-spring21_pf-green-accessories_04202021_big_carousel.jpg.large.jpg), disimpan sebagai D:/Project/gudangalsut-main/tmp/login-imac-references/apple-imac2021-accessories.jpg.

Ketiga cutout diproses lewat **built-in image_gen**, bukan CLI. PNG bawaan tetap tersimpan di direktori generated_images. Versi WebP dioptimalkan ukurannya dengan alpha dipertahankan; tidak ada penghapusan background melalui Python. Alpha setiap cutout mencakup 0 hingga 255.

### iMac 24 inci M1 (2021)

- File final: D:/Project/gudangalsut-main/assets/products/login/imac24-2021.webp (720 × 480)
- PNG hasil: C:/Users/csm11/.codex/generated_images/01a10b3e-33b0-7830-acc4-0f804360eb88/exec-1bb6723e-de28-4d9b-b2f0-8d03b4174502.png

Prompt final:

```text
Use case: background-extraction. Asset type: transparent real-product photograph for a website login hero. Edit target: the attached Apple 2021 product photograph. Isolate ONLY the mint-green Apple iMac 24-inch M1 (2021) monitor and its integrated stand. Preserve the original authentic 2021 design: narrow WHITE bezel, tiny centered webcam, pastel mint-green chin without an Apple logo on the front, flat aluminum chassis, and matching green stand. Preserve the perfectly straight-on camera view, horizontal edges, proportions and material lighting of the reference. Remove the keyboard, mouse, all floor shadows and every bit of the white background. Replace ONLY the display's wallpaper with a perfectly flat solid dark-gray (#222222) 16:9 rectangle so the website can place the user's exact wallpaper there later. Show the complete monitor and full stand, centered tightly with 5 percent transparent margin around the silhouette. Photorealistic clean product cutout with crisp real edges. Output genuine transparent alpha, no white backdrop or checkerboard pixels, no card, no labels, no extra accessories, no watermark, no surface underneath.
```

### Magic Keyboard

- File final: D:/Project/gudangalsut-main/assets/products/login/magic-keyboard2021.webp (640 × 213)
- PNG hasil: C:/Users/csm11/.codex/generated_images/01a10b3e-33b0-7830-acc4-0f804360eb88/exec-13148449-62af-4ceb-a303-64ddee8c6d1c.png

Prompt final:

```text
Use case: background-extraction. Asset type: transparent product cutout for a website login hero. Edit target: the attached Apple 2021 iMac product photograph. Isolate ONLY the compact Magic Keyboard in front of the iMac. Keep its white QWERTY keys, authentic 2021 key layout including Touch ID, light mint-green aluminum body, original shallow top/front camera angle, rounded corners and original keyboard proportions. Remove the monitor, stand, mouse, every ground shadow and the entire white backdrop. Render just the complete keyboard as a sharp faithful photographic cutout, centered and tightly framed with 5 percent transparent padding; no keys or corners cropped off. Genuine transparent alpha, not white or checkerboard pixels. No numeric keypad, no cables, no desk, no pedestal, no card, no added label or text, no extra objects.
```

### Magic Mouse

- File final: D:/Project/gudangalsut-main/assets/products/login/magic-mouse2021.webp (320 × 213)
- PNG hasil: C:/Users/csm11/.codex/generated_images/01a10b3e-33b0-7830-acc4-0f804360eb88/exec-09a1e232-8d00-468d-9dee-cfe569030d4a.png

Prompt final:

```text
Use case: background-extraction. Asset type: transparent product cutout for a website login hero. Edit target: the attached Apple 2021 iMac product photograph. Isolate ONLY the white and mint-green Magic Mouse at the lower right. Preserve the exact smooth single-piece glossy white top, subtle Apple mark, slim mint-green aluminum side, curved silhouette, and the same slightly top-down three-quarter angle and orientation as in the original product photograph. Remove the monitor, stand, keyboard, all ground shadows and the entire white background. Create a sharp faithful product photograph of the entire mouse, centered and tightly framed with 5 percent transparent padding; no part cropped off. Genuine transparent alpha, not opaque white or checkerboard pixels. No wheel, no separate button seams, no cable, no desk, no surface, no card, no added text, no other objects.
```

### Wallpaper

- Sumber pengguna: C:/Users/csm11/Downloads/BINUS Campus Poster in Graphic Grain.png
- File final: D:/Project/gudangalsut-main/assets/products/login/campus-wallpaper.webp (1280 × 720)
- Optimasi: resize proporsional dan kompresi WebP; seluruh isi gambar tetap dipakai. Tidak diproses lewat image_gen. Area layar di CSS menyesuaikan foto cutout iMac.

## Verifikasi

- check-frontend.mjs lulus: sintaks JS, ID DOM, isolasi preview/produksi, kategori/status/tanggal/pagination dan struktur CSS.
- Browser: keenam img login berhasil dimuat (lima produk dan wallpaper); kelima animasi berstatus running dengan iterasi infinite, tanpa interaksi play. Transformasi berubah pada pembacaan berikutnya. Tidak ada error/warning JavaScript pada pemuatan login.
- Dark dan Light menampilkan cutout transparan dan wallpaper yang tetap sejajar dengan layar.
- Desktop serta viewport 390 × 844: tidak ada overflow horizontal; form bisa discroll untuk menjangkau tombol Masuk pada ponsel.
- Screenshot: docs/login-imac-desktop.png, docs/login-imac-dark.png, docs/login-imac-mobile.png dan docs/login-imac-dark-mobile.png.

Preview: http://127.0.0.1:8871/preview/login. Belum ada deployment atau perubahan database.

