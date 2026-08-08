# ANALOGI_LIBRARY — Kamus jargon teknis → bahan analogi (opsional) untuk non-programmer

> Versi 3 · 2026-06-25 · **STATUS: AKTIF (berisi 32 entri)** — auto-deploy via `setup-pola-b.ps1` ke `docs/ANALOGI_LIBRARY.md`.

## Tujuan

Saat AI menyebut istilah teknis, dia menjelaskannya dengan **bahasa awam** (1 kalimat yang mudah dipahami) supaya staf non-programmer paham tanpa harus jago coding. **Kalau mau menyertakan analogi** (opsional — tidak wajib 3-lapis), berikut bahannya:

1. **🏢 Sehari-hari** — analogi kantor/rumah/dapur, tanpa perlu tahu tools apa pun.
2. **📱 Tools digital populer** — analogi pakai aplikasi familiar (Tokopedia, Gojek, WhatsApp, BCA mobile, Excel, Google Drive, Notion, iPhone, dll.).
3. **🎯 Contoh konkret** — kapan situasi ini muncul di proyek.

> Library ini = **sumber analogi OPSIONAL** (dipakai kalau mau menyertakan 1 analogi; analogi tidak wajib 3-lapis). Untuk istilah baru di luar tabel, AI cukup jelaskan dengan bahasa awam lalu boleh suggest tambah ke sini via LAZY-GENERATE. Lihat aturan di `CLAUDE_universal_v1.md` §2.1 (poin 1+5).

---

## Tabel analogi (32 jargon paling sering muncul)

| Jargon | 🏢 Sehari-hari | 📱 Tools digital | 🎯 Contoh di proyek |
|---|---|---|---|
| **Branch** | Fotokopi dokumen yang kamu rename "draft" sebelum coret-coret, biar yang asli aman | Duplicate template di Canva sebelum diedit | Bikin `fix/tombol-export` sebelum ubah halaman admin |
| **Commit** | Simpan + tulis 1 kalimat "apa yang berubah" | Ctrl+S di Word + isi nama versi di Google Docs version history | "fix: validasi email di form daftar" |
| **Push** | Kirim hasil kerjamu ke loker bersama kantor | Upload file ke shared folder Google Drive | Naikkan commit lokal ke GitHub tim |
| **Pull** | Ambil versi terbaru dari loker bersama | Download file terbaru dari shared Drive | Tarik perubahan teman sebelum mulai kerja |
| **PR (Pull Request)** | Lapor atasan: "draft saya siap, mohon review" | Minta approval di Google Docs lewat komentar @mention | Minta owner review sebelum digabung ke `main` |
| **Merge** | Gabungkan dua draft jadi satu dokumen final | Gabung dua playlist Spotify jadi satu | Satukan branch fitur ke `main` |
| **Merge conflict** | Dua orang edit paragraf sama, harus pilih versi mana | Dua orang edit sel Excel sama bareng, muncul peringatan | Kamu & teman ubah baris yang sama di file yang sama |
| **Main / Production** | Etalase toko yang dilihat pelanggan asli | Akun Tokopedia kamu yang sudah live | URL utama yang user beneran pakai |
| **Staging** | Showroom prototipe, tim boleh lihat, publik belum | Draft postingan Instagram sebelum di-publish | Preview URL untuk dicek sebelum naik ke production |
| **Deploy** | Pindahkan barang dari gudang ke etalase | Klik "Publish" di Notion/WordPress | Naikkan kode baru ke server yang user pakai |
| **Rollback** | Tarik kembali barang cacat dari etalase, balik ke versi lama | Pakai "version history" Google Drive untuk balik ke versi kemarin | Balikkan ke kit versi sebelumnya kalau update bermasalah |
| **Hotfix** | Tambal cepat ban bocor di pinggir jalan | Update darurat WhatsApp untuk tutup bug | Perbaikan kilat untuk bug parah di production |
| **Regression** | Benerin satu hal, malah ada hal lain yang rusak | Update aplikasi malah bikin fitur lama error | Fitur A dibetulkan, fitur B jadi rusak |
| **Refactor** | Rapikan susunan lemari, isinya tetap sama | Rapikan folder Google Drive tanpa hapus file | Pecah file 500 baris jadi beberapa file kecil |
| **Env var (environment variable)** | PIN/kunci brankas yang disimpan terpisah, bukan ditempel di pintu | PIN BCA mobile — rahasia, jangan ditulis di kode | Password database disimpan di `.env.local`, bukan di kode |
| **API** | Pelayan restoran: kamu pesan, dia ambilkan ke dapur | Tombol "Login pakai Google" yang manggil layanan Google | Halaman ambil data pelanggan dari server |
| **Endpoint** | Satu loket spesifik di kantor pos | Satu menu spesifik di app Gojek (GoFood, GoRide) | `/api/users` untuk ambil daftar user |
| **Database** | Lemari arsip raksasa yang tertata rapi | Spreadsheet Excel raksasa dengan banyak sheet | Tempat simpan data pelanggan, order, produk |
| **Schema** | Template formulir kosong: kolom apa saja yang harus diisi | Template database di Notion (struktur dulu, isi belakangan) | Tabel `users` punya kolom nama, email, role |
| **Migration** | Renovasi rak arsip: pindahkan isi dari format lama ke baru | Migrasi chat WhatsApp dari Android ke iPhone | Tambah kolom `last_login` ke tabel users |
| **RLS (Row Level Security)** | Aturan "siapa boleh buka laci mana" di lemari arsip | Privasi WhatsApp: kamu cuma lihat chat-mu sendiri | User cuma bisa lihat data miliknya, bukan punya orang lain |
| **Index (DB)** | Daftar isi buku tebal biar cepat cari halaman | Fitur "search" di Gmail yang langsung ketemu | Bikin pencarian email user jadi cepat |
| **Query** | Permintaan ke petugas arsip: "ambilkan berkas X" | Ketik kata kunci di kolom search Tokopedia | "Ambil semua order bulan ini" |
| **N+1 query** | Bolak-balik ke ATM 100 kali padahal bisa sekali tarik banyak | Buka 100 chat WA satu-satu padahal ada fitur broadcast | Ambil 100 user lalu query DB 100x — lambat |
| **Race condition** | Dua orang isi formulir terakhir bersamaan, hasilnya kacau | Dua orang edit Google Docs barengan tanpa save dulu | 2 user klik "Submit" bareng, stok jadi minus |
| **IDOR** | Ganti nomor loker di tiket biar buka loker orang lain | Ganti angka di URL Tokopedia buka order orang lain | Ubah `?id=5` jadi `?id=6` untuk intip data orang |
| **XSS** | Selipkan instruksi jahat di formulir yang nanti dijalankan | Komentar berisi script jahat yang jalan saat dibuka | Input komentar berisi `<script>` yang tak disaring |
| **SQL Injection** | Titip pesan jahat ke petugas arsip biar dia buka semua laci | Ketik perintah jahat di kolom search yang tak disaring | Input form yang merusak/buka seluruh database |
| **Token / JWT** | Tiket masuk konser: nunjukin tiket = boleh masuk | Sesi login WhatsApp Web (scan QR sekali, tetap masuk) | Bukti "user ini sudah login" yang dikirim tiap request |
| **Rate limit** | Satpam batasi 10 tamu per menit biar tidak rusuh | BCA mobile batasi 3x salah PIN lalu blokir | Batasi 5x percobaan login per menit |
| **Cache** | Taruh barang sering dipakai di laci meja, bukan di gudang | "Tonton lagi nanti" YouTube biar tak loading ulang | Simpan hasil yang sering diakses biar cepat |
| **Feature flag** | Saklar lampu per-ruangan: nyalakan fitur bertahap | Fitur baru Instagram yang muncul ke sebagian user dulu | Nyalakan fitur baru ke 10% user dulu (POST-LAUNCH) |

---

## Catatan

- Kalau muncul jargon yang **belum ada** di tabel ini, AI cukup jelaskan dengan bahasa awam (analogi singkat opsional) lalu boleh menawarkan menambahkannya ke sini (LAZY-GENERATE).
- Library ini melengkapi `docs/GLOSSARY_NON_PROGRAMMER.md` (kamus istilah lebih lengkap). Library analogi ini fokus ke **jargon yang butuh analogi cepat** saat AI bicara.
