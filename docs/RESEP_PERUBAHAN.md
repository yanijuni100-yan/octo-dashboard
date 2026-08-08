# RESEP_PERUBAHAN.md — Berkas mana yang ikut bergerak per jenis perubahan

> Versi 1 · auto-deploy oleh lintasAI · Untuk project kamu (developer + AI)

## Untuk apa berkas ini

Masalah yang dipecahkan: fakta yang sama (nomor versi, nilai konfigurasi, nama env, daftar
fitur) sering ditulis di **banyak berkas**. Ganti satu, gampang lupa salinannya → bug
"file A lupa, file B lupa, file C sudah" yang baru ketahuan saat scan menyeluruh (lambat +
boros token).

Resep ini = **peta dampak** (berkas mana yang **selalu ikut bergerak** per jenis perubahan).
Manfaatnya: ⚡ cepat & hemat token (AI langsung tahu daftar berkasnya), 🛡️ anti lupa
(resep = daftar centang), 🤖 diverifikasi robot (di bawah).

🏢 Analogi: kayak **checklist pramugari sebelum lepas landas** — bukan mengingat tiap kali,
tapi baca daftar tetap. Resep ini daftar tetap itu untuk kode.

---

## 🤖 Robot pemeriksa kecocokan (jalankan SEBELUM bilang "selesai")

Satu perintah, hitungan detik, biaya token ~nol (skrip, bukan AI baca-baca berkas):

```powershell
pwsh .claude-kit/lib/consistency-check.ps1 -RepoRoot . -ChecksFile docs/consistency-map.psd1
```

- ✅ "BERSIH" = semua deklarasi nilai-saat-ini cocok dengan sumber kebenaran.
- ❌ "[TAK COCOK]/[HILANG]" = ada yang basi (robot sebut berkasnya) → perbaiki.

**Setup sekali (5 menit):** salin `.claude-kit/templates/consistency-map.example.psd1` →
`docs/consistency-map.psd1`, lalu isi fakta-berulang project kamu. Tidak paham? Minta AI:
*"isi peta-konsistensi untuk project ini"* — AI akan scan + melengkapi (lalu kamu cek).

> Belum bikin peta? Robot tetap jalan dengan acuan bawaan (versi `package.json`), tapi
> menjaga lebih banyak berkas kalau petanya diisi.

---

## Resep per jenis perubahan (sesuaikan dengan project kamu)

### 1. Naikkan versi / rilis
Semua tempat yang membawa nomor versi disetel ke versi baru: `package.json` (sumber),
`README.md` (badge/baris versi), `CHANGELOG.md` (entri baru di atas), berkas versi lain
(mis. `src/version.*`). ➡️ **Jalankan robot** untuk verifikasi.

### 2. Tambah / ubah FITUR
- berkas kode yang diubah
- `docs/<basename>.md` pendamping — AUTO-SYNC kalau perubahan substansial
- minimal 1 test happy-path
- `CHANGELOG.md` + naikkan versi
- dokumen ringkasan fitur/keunggulan (kalau ada)

### 3. Tambah / ubah ENV VAR atau NILAI KONFIGURASI
- `.env.example` (+ `.env` lokal) — tambah/ubah key
- kode yang membaca env itu + validasi di pintu masuk (boundary)
- dokumen setup yang menyebut env itu
- ➡️ kalau nilai ini dipakai di >1 berkas, **masukkan ke `docs/consistency-map.psd1`** biar robot menjaganya.

### 4. Ubah ANGKA/JUMLAH yang tersebar (mis. jumlah item, batas, harga)
- cari (Grep) angka itu di seluruh project → update **semua**, atau pusatkan di 1 berkas.

### 5. Hapus fitur / berkas
- cari (Grep) pemakaian NYATA (pemanggil) dulu — jangan andalkan dokumen saja
- hapus berkas + perbarui dokumen + test + `CHANGELOG.md`

---

## Alur singkat (tiap perubahan)
1. Cari jenis perubahan di resep → tahu berkas yang ikut bergerak.
2. Ubah semua berkas itu.
3. Jalankan robot → pastikan BERSIH.
4. Jalankan test project → semua lulus.
5. Baru nyatakan "selesai" (Gerbang Verifikasi Pra-Rilis — lihat aturan §4.6).
