# Impor foto produk

- 906 kode barang dipetakan ke 184 kelompok foto dan 303 alias nama.
- Foto disimpan lokal sebagai WebP maksimal 640 px di `assets/products/catalog/`. Foto model yang sama dipakai bersama; browser tidak mengunduh foto dari situs sumber saat menampilkan inventaris.
- Foto yang sudah ada sebelum impor lanjutan dipertahankan. Foto tambahan dipilih dari Google Images dan hasil pencarian gambar produk publik, dengan sumber per kelompok di `image-credits.md`.
- Foto baru dipilih dengan latar putih; foto obeng memakai latar transparan. Foto referensi dibedakan dari foto unit fisik dan pratinjau unggahan pengguna.
- Catalog diuji terhadap seluruh 906 kode, alias untuk kode baru, konflik kode yang digunakan ulang, file lokal dan override foto pengguna.

## Cutout obeng

File final: `assets/products/catalog/screwdriver-cutout.webp`. Dibuat dengan tool imagegen bawaan, lalu diperkecil dan dikompres tanpa mengubah isinya. Sumber edit: `screwdriver-white.webp`; sumber foto publik dicantumkan di katalog.

Prompt: “Create a faithful transparent-background product cutout of ONLY the UNEED electric screwdriver. Preserve its diagonal orientation, silhouette, proportions, charcoal gray material, lettering and visible controls. Remove the hand, backdrop, promotional banners, text, icons and accessories. Do not redesign the tool or add features. Actual transparent alpha background.”
