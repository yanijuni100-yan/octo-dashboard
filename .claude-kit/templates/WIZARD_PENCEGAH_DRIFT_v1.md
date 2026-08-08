# WIZARD PENCEGAH-DRIFT — naskah AI mengisi peta-konsistensi dari fakta NYATA project

> Versi 1 · 2026-06-26 · pendamping `templates/consistency-map.example.jsonc` (kerangka) + `lib/consistency-check.mjs` (robot pemeriksa yang sudah ada) + `docs/RESEP_PERUBAHAN.md`

## Untuk siapa & kenapa

Ini **naskah untuk AI**. Tujuannya: saat owner minta *"aktifkan pencegah-drift"*, AI **memindai project mencari fakta-yang-ditulis-berulang** (mis. nomor versi yang muncul di banyak berkas), lalu **menuliskan sendiri** `docs/consistency-map.jsonc` berisi **nilai-saat-ini yang NYATA** — supaya robot pemeriksa bisa menangkap bug "angka diubah di satu berkas, lupa di berkas lain".

> 🏢 **Analogi (untuk owner):** kayak **petugas stok-opname** yang mendata "barang ini tercatat di 3 buku — pastikan ketiganya angkanya sama". Robot lalu mengecek otomatis tiap kali ada perubahan.

**Pemicu (frasa owner):** *"aktifkan pencegah-drift"* / *"isi peta-konsistensi"* / *"nyalakan pencegah salah-ketik-angka"* / *"lengkapi peta-konsistensi project"*.

## ⚠️ KENAPA bukan "auto-salin contoh" (penting — cegah alarm palsu)

JANGAN sekadar menyalin `consistency-map.example.jsonc` → `docs/consistency-map.jsonc` lalu jalankan robot. Alasannya (terbukti di `lib/consistency-check.mjs`):
- Kalau daftar `Checks` **kosong** → robot **melempar error** (berhenti).
- Kalau pola fakta contoh (mis. "versi vX.Y.Z di README") **tak ketemu** di project ini → robot lapor **MISSING/MISMATCH** = **alarm palsu** (owner panik padahal tak ada masalah nyata).

Maka isi peta dengan **fakta NYATA yang benar-benar ada + konsisten di project ini**, lalu verifikasi robotnya **BERSIH** sebelum bilang selesai.

## Aturan main untuk AI (WAJIB)

1. **Mode aman cuma-baca dulu** — pindai (Grep/Read) untuk menemukan kandidat fakta; jangan tulis `docs/consistency-map.jsonc` sampai owner setuju isinya.
2. **Hanya jaga fakta yang LAYAK** (CLAUDE_universal §6.3): (a) punya **sumber tunggal yang bisa dihitung** (mis. `package.json` field `version`); (b) **pola tulisannya TIDAK ambigu**. JANGAN jaga "X jargon"/"X prompt"/angka yang bermakna ganda → itu sumber alarm palsu.
3. **Hanya NILAI-SAAT-INI** — penanda sejarah ("fitur lahir di v1.2.0", entri changelog lama) menyimpan nilai lama → **JANGAN** dimasukkan (pakai `HeaderLines` untuk batasi cari ke baris-baris awal).
4. **Sajikan BERTAHAP (§4.7)** — tampilkan kandidat → popup klik owner pilih mana yang dijaga → tulis → verifikasi → rekap.
5. **AI mengisi, ROBOT yang menjaga** — setelah ditulis, AI **WAJIB menjalankan robot** untuk membuktikan peta valid + bersih. Robot (`consistency-check.mjs`) = penjaga otomatis yang sudah ada; kalau AI salah tulis, robot menangkapnya.

## Langkah (urut)

**Langkah 1 — Tentukan Sumber Kebenaran (`Source`).** Cari otomatis: ada `package.json` dengan `version`? → `{ "File": "package.json", "JsonField": "version" }`. Tidak ada? cari `VERSION.txt` / konstanta versi → `{ "File": "...", "Pattern": "(\\d+\\.\\d+\\.\\d+)" }`. Kalau project belum punya "nilai acuan" yang jelas → **belum perlu** pencegah-drift; sampaikan jujur + tunda (jangan paksa nyalakan).

**Langkah 2 — Pindai kandidat fakta-berulang (cuma-baca).** `Grep` tempat nilai acuan itu **ditulis ulang**: badge/baris versi di `README.md`, entri teratas `CHANGELOG.md`, konstanta versi di kode (`APP_VERSION`), dll. Kumpulkan yang **benar-benar ada + cocok** dengan Source sekarang. Buang yang ambigu / yang mungkin tak ada.

**Langkah 3 — Tawarkan ke owner (popup §14.1).** Tampilkan kandidat (mis. "versi muncul di README + CHANGELOG + src/version.ts"). Popup: `[1]` Jaga semua yang cocok (rekomendasi — paling lengkap, sudah diverifikasi cocok) / `[2]` Pilih satu-satu / `[stop]`.

**Langkah 4 — Tulis `docs/consistency-map.jsonc`.** Pakai `consistency-map.example.jsonc` sebagai kerangka. Isi `Source` + `Checks` (tiap entri: `File` yang ADA, `Label` ramah, `Pattern` regex 1-capture-group yang **cocok nilai-saat-ini**, `HeaderLines` bila perlu). Backslash regex di-escape (`\d` → `\\d`). Minimal 1 entri (robot menolak `Checks` kosong).

**Langkah 5 — VERIFIKASI dengan robot (WAJIB).** Jalankan:
```
node .claude-kit/lib/consistency-check.mjs --repo-root . --checks-file docs/consistency-map.jsonc
```
- **BERSIH** → bagus, peta valid. Lanjut.
- **MISMATCH/MISSING** → bisa 2 hal: (a) **drift NYATA ditemukan** (satu berkas memang ketinggalan — kabari owner, tawarkan perbaiki!), atau (b) **pola/file salah tulis** → perbaiki peta + ulang. Jangan biarkan peta yang bikin alarm palsu.

**Langkah 6 — ✅ SELESAI + rekap.** Status penjaga jadi NYALA. Sampaikan: berapa fakta dijaga, dari sumber apa, hasil verifikasi (bersih / drift ditemukan). Mulai sekarang robot ini ikut jalan di Gerbang Pra-Rilis (§4.6) + `npx lintasai preflight` → tiap perubahan, "angka lupa diganti" ketahuan otomatis.

## Input / Output

- **Input:** struktur project (berkas yang menulis ulang nilai acuan).
- **Output:** `docs/consistency-map.jsonc` berisi fakta NYATA + terverifikasi BERSIH oleh robot.

## Catatan

- Robot pemeriksa **sudah ada** (`lib/consistency-check.mjs`) + sudah bertes — naskah ini cuma **mengisi petanya dengan benar**. Tak ada robot baru.
- Menambah fakta baru nanti: minta AI *"tambah fakta ke peta-konsistensi"* → ulangi Langkah 2-5 untuk fakta itu.
- Untuk tahu berkas mana yang selalu ikut bergerak per jenis perubahan: `docs/RESEP_PERUBAHAN.md`.
