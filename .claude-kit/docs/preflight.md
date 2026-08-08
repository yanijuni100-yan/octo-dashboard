# preflight.md - Gerbang Pra-Rilis 1-perintah (`npm run preflight` / `npx lintasai preflight`)

> Versi 5 · 2026-06-28 · user-written (Tahap A skrip + Tahap D gerbang CI + Tahap E sebar ke klien; cetak-biru `docs/plans/BUKU_PELAJARAN_DAN_PREFLIGHT.md`).
> v4: tambah **lama-waktu per-pemeriksa + total** (transparansi — BUKAN paralelisasi tes berat, yang berisiko flaky) + **pesan error ramah non-programmer**.
> v5: tambah **opt-in gerbang CI di project KLIEN** (`npx lintasai enable-preflight-ci`) — backstop MESIN supaya robot mutu tak cuma jalan saat AI ingat (audit 2026-06-28, PENTING #2).

## Tujuan

Satu perintah yang menjalankan **semua pemeriksa mutu sekaligus** + menambah **cek kelengkapan rilis**, lalu memilah hasil jadi **GENTING / PENTING / RAPIKAN** dengan satu kode-keluar (exit-code). Ini "gerbang sebelum menyatakan selesai/rilis" (aturan `CLAUDE_universal_v1.md` §4.6 QA+QC).

Masalah yang dipecahkan: dulu pemeriksa dijalankan **manual satu-satu** → gampang "lupa cek sesuatu", dan **tidak ada** cek kelengkapan rilis (mis. versi naik tapi `CHANGELOG.md` belum punya entrinya). Sekarang: `npm run preflight`.

- **👨‍💻 Programmer:** orkestrator Node (`tests/preflight.mjs`) yang me-reuse robot yang sudah ada (`lib/consistency-check.mjs`, `lib/unicode-safety-check.mjs`, parser CHANGELOG `lib/version-detect.mjs`) + men-spawn tes Node, ESLint, Pester, smoke. Memilah temuan ke severity + exit-code.
- **🙂 Non-Programmer:** kayak **satu tombol "Cek Kesehatan" di BCA mobile** — sekali tekan, semua diperiksa (saldo + tagihan + keamanan) lalu kasih ringkasan, bukan kamu cek satu per satu. Di sini: sekali ketik `npm run preflight`, semua pemeriksa jalan + kasih lampu hijau/kuning/merah.

## Cara Pakai

**Di repo kit (maintainer):**

```bash
npm run preflight              # kerja harian: hanya GENTING (lampu merah) yang menghentikan
npm run preflight:strict       # saat MAU RILIS: PENTING (lampu kuning) ikut menghentikan
node tests/preflight.mjs --skip-ps   # lewati tes PowerShell (iterasi cepat sisi Node saja)
```

> 💡 **Tips kecepatan (tanpa mengorbankan keandalan):** saat ngoding cepat di sisi Node, pakai `--skip-ps`
> untuk melewati tes PowerShell (Pester) yang paling lama (~2,5 menit) → umpan balik kilat. **TAPI** jalankan
> gerbang **penuh** (tanpa `--skip-ps`) sebelum menyatakan "selesai"/rilis — `--skip-ps` itu untuk iterasi,
> **bukan** pengganti gerbang lengkap. Laporan juga kini menampilkan **lama-waktu tiap pemeriksa** + **total**,
> jadi kelihatan bagian mana yang lambat. Kit sengaja **TIDAK** memparalelkan tes berat: menjalankan tes Node
> + Pester bersamaan berisiko bikin tes "gagal acak" (flaky) di mesin lemah — gerbang yang **andal** lebih
> penting daripada sedikit lebih cepat (keputusan owner 2026-06-24).

**Di project KLIEN (yang memasang lintasAI, Tahap E):**

```bash
npx lintasai preflight              # gerbang sebelum menyatakan "selesai"
npx lintasai preflight --strict     # gerbang lebih ketat saat mau rilis
```

`npx lintasai preflight` otomatis memeriksa **project klien** (dispatcher menyuntik `--project-root <cwd>`), bukan folder kit. Preflight mendeteksi "mode project" (`package.json` `name` ≠ `lintasai`) dan menyesuaikan diri (lihat "Mode project (klien)" di bawah). AI di sesi klien juga menjalankan gerbang ini otomatis tiap ada perubahan nyata (aturan §4.6) — klien tak perlu mengingatnya.

Bendera (flag):
- `--strict` — PENTING ikut jadi pemblokir (dipakai saat mau rilis). Default: hanya GENTING.
- `--skip-ps` (alias `--node-only`) — paksa lewati pemeriksa PowerShell (Pester + smoke).
- `--repo-root <path>` — periksa folder lain (default: induk dari `tests/`).
- `--project-root <path>` — alias `--repo-root` (disuntik otomatis oleh dispatcher `npx lintasai preflight`). `--repo-root` menang kalau keduanya diberi.

## Input / Output

- **Input:** akar repo (otomatis). Membaca `package.json`, `CHANGELOG.md`, kode + dokumen repo, tag git.
- **Output:** laporan per-pemeriksa (+ **lama-waktu** tiap pemeriksa, mis. `(12.3 dtk)`) + ringkasan `GENTING N | PENTING N | RAPIKAN N` (+ **total waktu**) + baris HASIL.
- **Exit-code:** `0` = lulus (boleh dilanjut). `1` = ada pemblokir (GENTING; atau GENTING/PENTING saat `--strict`).

### Pemeriksa yang dijalankan

| Pemeriksa | Sumber | Kalau gagal |
|---|---|---|
| Tes Node | `tests/run-node-tests.mjs` | GENTING |
| ESLint | `node_modules/eslint` (di-`npm ci`) | GENTING (PENTING kalau eslint belum terpasang) |
| Robot kecocokan versi | `lib/consistency-check.mjs` (MODE KIT, atau MODE PROJECT via `docs/consistency-map.jsonc`) | GENTING (drift versi/fakta) |
| Pemindai huruf-tipuan (Unicode) | `lib/unicode-safety-check.mjs` | GENTING (potensi serangan tersembunyi) |
| Smoke cepat (PowerShell) | `tests/smoke-fast.ps1` | GENTING (PENTING kalau PowerShell tak ada) |
| Tes PowerShell (Pester) | `tests/Run-Tests.ps1` | GENTING (PENTING kalau Pester/PowerShell tak ada) |
| Entri CHANGELOG utk versi package.json | `CHANGELOG.md` | GENTING kalau hilang |
| Isi entri CHANGELOG teratas | `CHANGELOG.md` | PENTING kalau masih teks-contoh kerangka |
| Versi vs tag terakhir | `git tag` + `package.json` | PENTING kalau breaking tanpa naik BESAR / downgrade; selain itu INFO |
| Tes untuk perubahan kode | `git diff <tag>..HEAD` | RAPIKAN kalau kode berubah tanpa tes |

> Catatan: saat PowerShell tak terpasang, baris **Smoke** + **Pester** digabung jadi SATU peringatan PENTING ("Tes PowerShell (smoke + Pester) dilewati"), bukan dua baris terpisah. Untuk pemeriksa Node/Pester, kalau prosesnya **lulus (exit 0) tapi jumlah tes tak terbaca** (format output berubah) → dilaporkan PENTING (fail-closed), bukan diam-diam OK.

### Mode project (klien) — apa yang berbeda (Tahap E)

Saat dijalankan di project yang BUKAN repo kit (`package.json` `name` ≠ `lintasai`, atau tak ada `package.json`), preflight menyesuaikan diri supaya **tidak menampilkan alarm-palsu** untuk struktur yang memang khas-kit. Yang berbeda dari mode kit:

| Pemeriksa | Mode KIT | Mode PROJECT (klien) |
|---|---|---|
| Tes | `tests/run-node-tests.mjs` (suite kit) → GENTING kalau gagal | `npm test` **milik klien** (kontrak universal: jest/vitest/mocha/node:test) → GENTING kalau gagal; **RAPIKAN** kalau klien belum punya script `test` / masih teks-contoh npm (tak memblokir) |
| ESLint | GENTING kalau ada error; PENTING kalau eslint belum di-`npm ci` | sama, tapi **RAPIKAN** kalau eslint tak terpasang (opsional di klien — tak memblokir rilis) |
| Robot kecocokan | MODE KIT (`$KitFacts`) | baca `docs/consistency-map.jsonc` klien; **RAPIKAN** (saran lembut) kalau belum ada — tak memblokir rilis |
| CHANGELOG / versi | wajib → GENTING kalau hilang/drift | ketiadaan versi/CHANGELOG = **INFO** (banyak app klien tak pakai CHANGELOG formal); kalau KEDUANYA ada tapi entri drift = **PENTING** (tetap memblokir saat `--strict`/rilis) |
| Pemindai Unicode | sama | sama (otomatis lewati `node_modules`/`.git`/`.claude-kit`) |
| Smoke + Pester | jalan (PowerShell ada) | otomatis **dilewati** (berkas `tests/smoke-fast.ps1`/`Run-Tests.ps1` ada di `.claude-kit/`, bukan di akar project klien) |

Inti: di klien, hal yang "belum ada" (CHANGELOG, peta-konsistensi, eslint, tes) jadi **catatan/saran**, bukan penghenti — supaya gerbang tetap berguna sejak menit pertama tanpa membuat staff non-programmer panik melihat "lampu merah". Yang benar-benar salah (tes klien gagal, drift versi saat rilis, huruf-tipuan Unicode) **tetap** menghentikan.

## Di CI (gerbang otomatis, Tahap D)

Preflight kini jadi pemeriksa di GitHub Actions — bukan cuma perintah manual:

- **`.github/workflows/validate.yml` → job `preflight`** (tiap PR/push ke `main`). Menjalankan `npm run preflight -- --skip-ps`: membawa 3 cek yang **belum dijaga job CI lain** (robot kecocokan versi/fakta, pemindai huruf-tipuan Unicode, kelengkapan CHANGELOG). Tes PowerShell (Pester + smoke) **sengaja dilewati di sini** (`--skip-ps`) karena sudah punya job paralel sendiri → tidak dijalankan 2x. Mode non-strict: hanya **GENTING** yang memblokir.
- **`.github/workflows/publish-npm.yml` → langkah `preflight:strict`** (sebelum TERBIT ke npm). Menjalankan `npm run preflight:strict -- --skip-ps`: di titik ini cek kelengkapan rilis paling berharga, jadi **PENTING ikut memblokir** (mis. CHANGELOG masih teks-contoh / versi drift → terbit dibatalkan).
- **Dikunci tes anti-rot:** `tests/ci-preflight-wiring.test.mjs` membuat suite **merah** kalau job/langkah preflight diam-diam terhapus dari salah satu workflow atau dari `package.json scripts`.
- **Menjadikan "wajib" (required status check):** menambah job ke CI **belum** otomatis memblokir merge. Owner mencentangnya di **GitHub → Settings → Branches → aturan proteksi `main` → "Require status checks to pass" → pilih `preflight`** (lakukan setelah job terbukti hijau beberapa kali, supaya PR tidak terblokir mendadak).

### Opt-in: gerbang CI di project KLIEN (`enable-preflight-ci`)

Bagian "Di CI" di atas = CI **repo kit**. Untuk **project klien**, robot mutu default-nya **dipicu AI** (AI menjalankan `npx lintasai preflight` saat Gerbang §4.6). Itu bergantung AI ingat menjalankannya — kalau terlewat, cek mutu di sisi klien tak jalan (audit 2026-06-28, temuan PENTING #2). Untuk **backstop MESIN** di klien (opsional):

```bash
npx lintasai enable-preflight-ci      # pasang .github/workflows/preflight.yml (SIMULASI: tambah --dry-run)
```

- **Apa yang terjadi:** menyalin `templates/github/workflows/preflight.yml` ke `.github/workflows/` klien. Tiap **push/PR ke `main`**, GitHub menjalankan `npx lintasai preflight --skip-ps` → robot mutu (kecocokan versi, Unicode, tes klien, dll) jalan **otomatis**; gagal → PR ditandai merah.
- **Kenapa OPT-IN (bukan dipasang otomatis):** butuh GitHub Actions + alur PR. Memaksanya ke klien yang belum pakai GitHub = CI merah membingungkan. Owner yang putuskan (§1.1). Cermin pola `enable-risk-gate`.
- **WAJIB `windows-latest`:** CLI `lintasai` Windows-only (v1.x) — di Linux runner ia berhenti. Template sudah memakai `runs-on: windows-latest`.
- **Idempoten + aman:** sudah ada + isi sama → no-op; sudah ada tapi **kamu sunting sendiri** → TIDAK ditimpa tanpa `--force` (editanmu dijaga). **Matikan:** hapus berkas `.github/workflows/preflight.yml`.
- **Sumber + penjaga:** `lib/ensure-preflight-ci.mjs`; dikunci `tests/ensure-preflight-ci.test.mjs` + routing `tests/dispatcher-init-routing.test.mjs`.

## Dependensi

- **Node ≥ 18** (bagian Node selalu jalan).
- **PowerShell** (`pwsh` ATAU `powershell` 5.1) + **Pester 5+** — opsional. Kalau tak ada → bagian PowerShell **dilewati dengan peringatan jelas** (level PENTING), bukan diam-diam. Keputusan owner 2026-06-24: "Node dulu, PowerShell kalau ada".
- **git** — opsional. Tanpa git → cek "versi vs tag" + "kode vs tes" jadi INFO (dilewati, tak crash).
- Reuse: `lib/consistency-check.mjs`, `lib/unicode-safety-check.mjs`, `lib/version-detect.mjs`, `lib/fs-text.mjs`.

## Catatan

- **Severity (bahasa non-programmer, §2.1 #7):** GENTING = wajib perbaiki, menghentikan. PENTING = saran kuat (menghentikan saat `--strict`). RAPIKAN = enak dibereskan, tak pernah menghentikan. INFO = konteks.
- **Lama-waktu per-pemeriksa + total (#1, keputusan owner 2026-06-24):** laporan menampilkan durasi tiap bagian + total, supaya bagian lambat kelihatan. Kit **tidak** memparalelkan tes berat (Node + Pester bersamaan berisiko flaky di mesin lemah) — keandalan gerbang diutamakan; untuk iterasi cepat pakai `--skip-ps`. Diuji `tests/preflight.test.mjs` (fungsi `fmtDur`).
- **Pesan error ramah non-programmer (#2):** saat sebuah pemeriksa gagal *dijalankan* (bukan "tesnya gagal", tapi programnya tak bisa start), pesan pakai bahasa awam (mis. "perintahnya tak ditemukan - program seperti Node/git/PowerShell mungkin belum terpasang") + menyelipkan kode sistem aslinya dalam kurung (`ENOENT`) untuk diagnosa programmer. Diuji `tests/preflight.test.mjs` (fungsi `cmdErrMsg`).
- **Sudah dipasang di CI (Tahap D):** job `preflight` di `validate.yml` + gerbang `preflight:strict` di `publish-npm.yml` (lihat bagian "Di CI" di atas).
- **Sudah disambung ke dispatcher `lintasai` (Tahap E):** `npx lintasai preflight` (terdaftar di `bin/lintasai.js` `COMMANDS_NODE` + `shouldPassProjectRoot`). Klien dapat gerbang yang sama otomatis lewat pemasangan. Dikunci tes anti-rot di `tests/dispatcher-init-routing.test.mjs` (routing + suntik `--project-root` + `Mode: project`).
- **Disebar ke klien lewat pemasang (Tahap E):** `setup-pola-b.mjs`/`.ps1` menyalin `templates/consistency-map.example.jsonc` (peta-konsistensi format Node) + `templates/BUKU_PELAJARAN.example.md` (contoh Lapis 3) ke `docs/` project klien.
- **Anti-rekursi:** `tests/preflight.mjs` bukan `*.test.mjs` → tak ikut dijalankan `npm test`. Saat di-import oleh tes pengunci, `main()` tidak jalan (dijaga `isMain`). Tes pengunci hanya menguji fungsi murni, tak memanggil `runPreflight()`.
- **Tes pengunci (anti-rot):** `tests/preflight.test.mjs` — memastikan pemilah severity + cek kelengkapan rilis benar-benar menangkap masalah (uji skenario GAGAL, bukan cuma jalur hijau) + wiring `package.json` tak diam-diam hilang.
- **Bukan jaminan nol-bug** (cetak-biru §9): menutup drift fakta + kelengkapan rilis + bug yang sudah ada tesnya. TIDAK menutup otomatis: bug logika baru, celah tak-terpikir, masalah integrasi runtime di mesin lain.
- Source: `tests/preflight.mjs`, tes `tests/preflight.test.mjs`, cetak-biru `docs/plans/BUKU_PELAJARAN_DAN_PREFLIGHT.md`.
