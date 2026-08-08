# Panduan Pasang Aman — Di Mana Menyimpan lintasAI?

> v1 · 2026-06-27 · Bahasa non-programmer · 1 halaman siap-baca/siap-kirim ke staff
>
> Tujuan berkas ini: supaya kit lintasAI **disimpan di tempat yang benar** sejak awal —
> tidak salah taruh (yang bikin aturannya tidak terbaca) dan tidak menimpa berkas project yang sudah ada.

---

## 1. Jawaban singkat: simpan DI DALAM project

lintasAI harus berada **di dalam folder project** sebagai sub-folder bernama `.claude-kit/`, lalu **ikut disimpan ke git** (di-`commit`) bersama project.

```
proyek-kamu/            ← folder project kamu
├── .claude-kit/        ← di SINI kit lintasAI tinggal ✅
├── CLAUDE.md           ← "tombol" yang bikin aturan otomatis terbaca
├── AGENTS.md           ← catatan khusus project kamu
├── src/ ... dst        ← kode project kamu
```

> Istilah: **commit** = menyimpan perubahan ke catatan project · **clone** = staff lain mengunduh salinan project · **repo** = satu "gudang kode" project.

🏢 Analogi: kit lintasAI itu seperti **buku aturan tim** — dia harus diletakkan **di dalam toko** yang dia atur, bukan di gudang lain yang terpisah.

---

## 2. ⚠️ Kesalahan paling umum: menaruh di folder TERPISAH

Jangan menaruh kit di folder yang **berdiri sendiri di luar project** (misalnya di `D:\folder-lain\lintasai` yang tidak ada hubungannya dengan project).

**Kenapa berbahaya:** berkas `CLAUDE.md` yang bikin aturan **otomatis terbaca** isinya cuma "tombol penunjuk" beralamat-relatif ke folder sebelahnya (`./.claude-kit/`). Kalau kit-nya ada di tempat lain, tombol itu menunjuk ruang kosong → **aturan tidak pernah ikut terbaca** saat kamu kerja di project.

Akibatnya: kit "hidup" di foldernya sendiri, tapi **mati-suri** untuk pekerjaan project — kamu mengira AI sudah patuh aturan tim, padahal AI tidak membacanya sama sekali. 😴

---

## 3. Cara pasang yang AMAN (ke project yang sudah ada)

1. **Simpan dulu** kondisi project (commit, atau salin folder) — jaring pengaman ekstra.
2. Buka Claude Code / terminal **DI DALAM folder project** (mis. di dalam `toko-online`), lalu jalankan:
   ```
   npm create lintasai
   ```
   Penting: jalankan **dari dalam folder project** — supaya kit otomatis mendarat di `toko-online/.claude-kit/` + "tombol" `CLAUDE.md` terpasang di tempat yang benar.
3. **Jangan pakai `--force`** di pemasangan pertama (biar pemasang bertanya / memakai pilihan paling aman).
4. **Commit** `.claude-kit/` + `CLAUDE.md` + `AGENTS.md` supaya semua staff dapat versi yang sama persis saat clone.

> Jangan cuma meng-copy folder kit secara manual tanpa menjalankan pemasang — kalau begitu, "tombol" `CLAUDE.md` tidak terbuat dan aturan tetap tidak terbaca.

---

## 4. Kalau project sudah punya `CLAUDE.md` / `AGENTS.md` sendiri

Pemasang **tidak akan menghapus berkas lamamu diam-diam** — selalu membuat **fotokopi cadangan** ber-stempel-waktu (berkas `*.backup-<tanggal>`) sebelum mengganti. Jadi semua bisa dibalik.

Tapi ada **1 hal yang harus kamu lakukan manual**: kalau project punya `CLAUDE.md` berisi **aturan kustom sendiri**, pemasang akan mencadangkannya lalu menggantinya dengan "tombol pemuat". Aturan kustom lama itu **tidak otomatis ikut tergabung**.
→ **Pindahkan isi aturan kustom lama itu ke `AGENTS.md`** (berkas yang juga ikut ditempel oleh pemuat), supaya tetap aktif.

---

## 5. Cek "beneran aktif" (langkah verifikasi)

Setelah pasang, buka **sesi Claude Code baru** di folder project, lalu tanya:

> *"kamu baca aturan dari berkas apa? sebutkan."*

Kalau jawabannya menyebut `.claude-kit/CLAUDE_universal_v1.md` → **berhasil, aturan benar-benar aktif.** ✅
Kalau tidak → kemungkinan kamu menjalankan Claude Code dari folder yang salah (bukan akar project), atau kit ditaruh di folder terpisah (lihat Bagian 2).

---

## 6. Untuk project SKALA BESAR: mulai 1 repo dulu

Untuk website/app besar, godaannya langsung pecah jadi banyak repo. Saran: **mulai dari 1 repo dulu** (dengan `.claude-kit/` di dalamnya), **pecah bertahap nanti** hanya saat benar-benar perlu.

Alasannya:
- Jalur **1 repo = stabil & teruji**; jalur **banyak-repo = masih BETA** (sedang diuji).
- Belum ada perintah update sekali-jalan untuk semua repo — kalau langsung 10 repo, tiap update harus diulang per-repo (melelahkan + rawan versi nyasar).
- Saat memang pecah: tiap repo hasil pecahan dapat `.claude-kit/`-nya sendiri (pola yang sama, konsisten).

🏢 Analogi: seperti buka cabang toko — matangkan 1 toko dulu, baru mekar saat permintaan nyata. Tiap cabang baru tetap bawa "buku aturan tim"-nya sendiri.

---

## 7. Apakah pemasangan aman? Ya.

- **Tidak ada** berkas project yang dihapus/ditimpa **tanpa cadangan** lebih dulu.
- Daftar izin & pengaturan AI di-**gabung** (bukan ditimpa); kalau berkasnya rusak, pemasang **menolak menulis** demi keselamatan.
- Kalau stack bukan Node.js → pemasang **berhenti sebelum menyalin apa pun** (tidak meninggalkan sampah).
- Salah pasang? Bisa dibalik: ada cadangan ber-stempel-waktu + perintah copot yang aman (`npx lintasai uninstall`).

> Ringkas: **simpan di dalam project, jalankan dari dalam project, commit hasilnya, lalu cek "beneran aktif".** Itu saja kunci aman + berfungsi.
