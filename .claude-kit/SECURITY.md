# Kebijakan Keamanan — lintasAI

> Versi 2 · 2026-06-20

Dokumen ini menjelaskan **paket resmi lintasAI** (supaya kamu tak tertipu paket tiruan)
dan **cara melaporkan masalah keamanan** secara aman.

🏢 Untuk staff non-programmer: anggap ini seperti tanda **"Official Store"** di
Tokopedia/Shopee — daftar resmi supaya kamu tidak salah pasang dari "toko KW" yang namanya mirip.

---

## ✅ Paket & sumber RESMI (waspada tiruan / typosquat)

Hanya sumber di bawah ini yang resmi. **Apa pun di luar daftar ini BUKAN lintasAI** —
bisa jadi paket tiruan yang menyusupkan kode berbahaya.

| Jenis | Nama resmi | Cara pasang resmi |
|---|---|---|
| Paket utama (npm) | **`lintasai`** | `npx lintasai init` atau `npm install -g lintasai` |
| Pemasang cepat (npm) | **`create-lintasai`** | `npm create lintasai` |
| Kode sumber (GitHub) | **`github.com/ojokesusu/lintasAI`** | — |

⚠️ Waspadai nama yang **mirip tapi beda** (mis. `lintas-ai`, `lintasaii`, `lintas_ai`,
`lintasai-kit`, atau akun GitHub peniru). Nama "lintasai" pendek & umum, jadi tiruan
gampang dibuat. **Kalau ragu, jangan pasang** — tanya dulu ke tim/owner.

🔎 **Cara cek keaslian paket npm:** jalankan `npm view lintasai` lalu pastikan field
`repository` menunjuk ke `github.com/ojokesusu/lintasAI`. Kalau menunjuk ke tempat lain → itu tiruan.

---

## 📣 Melaporkan kerentanan (vulnerability)

**JANGAN** laporkan lewat Issue/diskusi publik — itu membocorkan celah ke penyerang
sebelum sempat diperbaiki. Laporkan **secara PRIVAT**:

1. **GitHub Security Advisory** (disarankan): di repo resmi, buka tab **Security →
   "Report a vulnerability"**. *(Owner: aktifkan "Private vulnerability reporting" di
   Settings repo bila belum.)*
2. Atau hubungi maintainer secara privat (kontak keamanan via profil owner `ojokesusu`).

Sertakan: langkah reproduksi, dampak, dan versi kit terpasang (lihat
`.claude-kit/.install-manifest.json` → `metadata.kit_version`).

**Target respon (best-effort — maintainer tunggal):** konfirmasi diterima ≤ 3 hari kerja ·
penilaian awal ≤ 7 hari · perbaikan menyesuaikan tingkat keseriusan.

**Pengungkapan terkoordinasi (coordinated disclosure):** laporan dijaga **PRIVAT sampai
perbaikan terbit** — kami tidak mengumumkan celah ke publik sebelum ada tambalannya, supaya
penyerang tak diberi peta sebelum lubangnya ditutup. 🏢 Mirip pabrik yang memperbaiki cacat
produk diam-diam dulu sebelum mengumumkan recall — bukan menyiarkan "produk X bisa meledak"
sebelum solusinya siap. Kalau sebuah laporan kami **tolak**, kami jelaskan alasannya (tak bisa
direproduksi / di luar cakupan / sudah diperbaiki / butuh bukti serangan lebih kuat) — bukan
didiamkan.

---

## 🛡️ Versi yang didukung

Kit ini dirawat tim kecil, jadi kebijakannya **lugas + jujur: hanya baris versi TERBARU yang
menerima perbaikan keamanan.** Tidak ada penambalan-mundur (backport) ke versi lama — kami tak
punya kapasitas untuk itu, dan menjanjikannya = bohong. Kalau ada perbaikan keamanan, jalannya =
**naik ke versi terbaru**, bukan menambal versi lama.

| Versi | Status |
|---|---|
| Baris versi **terbaru** (lihat `CHANGELOG.md` paling atas) | ✅ Didukung penuh |
| Di bawah versi terbaru | ⚠️ Tidak ditambal — mohon update dulu sebelum melapor |

Perbaikan keamanan ditandai **`[SECURITY]`** di `CHANGELOG.md` — artinya **"pasang segera"**
(mirip surat recall mobil: komponen kecil, tapi wajib cepat). 🏢 Untuk staff awam: anggap seperti
aplikasi HP yang hanya menambal versi terbaru — kalau ada perbaikan keamanan, kamu **update**,
bukan minta tambalan untuk versi lama.

---

## 📦 Cakupan

**Termasuk:** kode kit — orkestrator akar (`*.mjs` & `*.ps1`), `lib/`, `bin/` — paket npm
`lintasai` / `create-lintasai`, serta robot & workflow CI bawaan kit. (Sejak migrasi PS→Node,
perintah utama dijalankan berkas `.mjs` di akar; `.ps1` = jalur cadangan.)

**Di luar cakupan:** kode/aplikasi yang **kamu** bangun memakai lintasAI (itu tanggung
jawab project-mu sendiri); kerentanan di dependency pihak-ketiga (laporkan ke pihak terkait);
penyalahgunaan dengan kredensial yang sudah bocor dari sisi pengguna.

---

## 🔒 Praktik keamanan kit (ringkas, untuk yang ingin tahu)

- **Rilis terverifikasi:** sebelum terbit ke npm, versi tag wajib cocok dengan `package.json`
  (`.github/workflows/publish-npm.yml`) + seluruh tes lulus.
- **Integritas pemasangan:** manifest ber-tanda-tangan **HMAC** (mendeteksi berkas yang
  diubah/rusak — diverifikasi saat `doctor`) + update **atomik dengan auto-balik** (gagal di
  tengah → kembali ke versi lama yang utuh).
- **Aturan AI bawaan:** anti prompt-injection (aturan §8.1), anti-halusinasi / wajib-kutip-sumber
  (§8.2), penjaga bocor-rahasia (`secret-guard.yml` di CI + pemindai pre-commit opsional).
- **Rujukan standar profesional:** prinsip **OWASP** (validasi & anti-injeksi di pintu masuk data).
- **Integritas rilis (status jujur):** rilis ke npm memakai **OIDC Trusted Publishing** (terbit dari
  GitHub Actions **tanpa token** yang bisa dicuri) + **gerbang tes wajib** sebelum terbit
  (`publish-npm.yml`) + **HTTPS+TLS + proteksi-branch GitHub**. **npm provenance** (bukti-pabrik
  Sigstore) **belum aktif** karena hanya didukung untuk repo **PUBLIK**, sedangkan repo ini
  **private** (`publishConfig.provenance: false`) — bisa dinyalakan kalau repo dijadikan publik.
  Penandatanganan tag **GPG** masih **RENCANA** (lihat `docs/SIGNED_RELEASE.md`). Belum mengklaim **SLSA**.

---

## 🔑 Kelangsungan & ketergantungan (jujur soal "bus factor")

**Bus factor** = berapa orang yang tahu cara merawat ini. Kit ini dirawat **tim sangat kecil**
(praktis perawat tunggal). Itu kekuatan (cepat, fokus) sekaligus risiko: kalau perawat tak aktif,
tak ada komunitas besar yang langsung menambal. Yang kami siapkan untuk menjaga kelangsungan, dan
yang **kamu** sebaiknya lakukan:

- **Dari sisi kit:** lisensi **MIT** (siapa pun bebas mem-fork / melanjutkan), tiap rilis ber-**tag
  versi + manifest ber-tanda-tangan + catatan perubahan jelas** — supaya perawat pengganti (atau
  kamu sendiri) bisa melanjutkan tanpa menebak-nebak.
- **Dari sisi kamu (pengguna):** **simpan salinan lokal** versi kit yang kamu pakai, dan jangan
  menggantungkan operasi kritikal 100% pada update upstream. Kit sudah ter-pasang di project-mu
  (`.claude-kit/`), jadi tetap jalan walau upstream berhenti.

🏢 Analogi: seperti **resep warung yang ditulis lengkap + boleh dicontek siapa saja** (MIT) — kalau
kokinya berhenti, resepnya tetap ada dan warung bisa dilanjutkan orang lain; plus kamu sendiri pegang
fotokopi resepnya, jadi tak akan kehilangan.

---

> Dokumen ini sengaja dibuat ringkas + bahasa awam, tapi mengikuti praktik keamanan
> open-source profesional. Disiplin tata-kelola di sini (pengungkapan terkoordinasi, kebijakan
> versi-didukung, kelangsungan) terinspirasi praktik OSS profesional termasuk **ECC v2.0.0 (MIT)** —
> diadaptasi jujur ke realitas kit perawat-kecil, bukan disalin. Pembaruan akan menaikkan nomor versi di header.
