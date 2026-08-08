# architecture.md — Peta Makro Repo Kit lintasAI

> Versi 1 · 2026-06-24 · Untuk maintainer + AI yang kerja DI repo kit ini (dogfood).
>
> Ini **jalur READ-MINIMAL** (§7.3): baca berkas INI dulu + [architecture_auto.md](architecture_auto.md)
> (registry semua docs), BARU cherry-pick berkas relevan task. JANGAN menjelajah seluruh repo tiap sesi.
>
> Angka yang gampang basi (jumlah tes/berkas/versi) **SENGAJA tak ditulis di sini** (de-fragilize §6.3) —
> lihat sumbernya: versi → `package.json`; jumlah tes → jalankan `npm run preflight`; daftar fakta yang
> dijaga → `docs/PETA_SUMBER_KEBENARAN.md`.

## Apa ini
Repo kit lintasAI = paket npm (`lintasai`) berisi **aturan kerja AI + alat** (installer/updater/robot
pemeriksa) yang dipasang ke project lain (Pola B: `<project>/.claude-kit/`). Repo ini juga **"dogfood"**
aturannya sendiri: `CLAUDE.md` meng-`@import` `CLAUDE_universal_v1.md` tiap sesi.

## Stack & jalur utama
- **Runtime: Node.js DIUTAMAKAN** (lihat `docs/decisions/ADR-003` + `ADR-004` + `ADR-005`). PowerShell =
  **cadangan** (pola Strangler Fig — belum dipensiun). Tiap alat inti punya **2 implementasi berdampingan**:
  `*.mjs` (Node, utama) + `*.ps1` (PowerShell, cadangan). Dispatcher memilih jalur Node lebih dulu.
  **Sejak 2026-06-25 (ADR-005): jalur eksekusi tim 100% Node** — 3 jembatan terakhir (MOTW, penjaga
  junction, penulis versi `bump`) sudah diport; PowerShell tinggal dipakai bila jalur Node gagal.
- **Entry-point resmi:** `bin/lintasai.js` — dispatcher `npm create lintasai` / `npx lintasai <cmd>`.
  Memetakan perintah → port Node (`COMMANDS_NODE`). `COMMANDS` (jalur PowerShell) kini KOSONG; PowerShell
  tinggal jadi cadangan darurat (`PS_FALLBACK`) saat versi Node gagal di-spawn.

## Struktur folder (lokasi modul inti)
- `bin/lintasai.js` — **dispatcher npx** (pintu masuk semua perintah; suntik `--project-root`).
- `kit.mjs` / `kit.ps1` — **router perintah kit** (doctor/scan/status/diff/version/bump/help).
- `setup-pola-b.mjs` / `.ps1` — **installer Pola B** (salin kit → `.claude-kit/` + deploy berkas tim + kartu identitas).
- `update-kit.mjs` / `.ps1` — **updater** (re-clone + backup + setup, rollback-safe).
- `uninstall.mjs` / `.ps1` — **uninstaller** via manifest sha256.
- `team-setup.mjs` / `.ps1`, `install-windows.mjs` / `.ps1` — setup tim + installer global (Pola A).
- `lib/` — **helper engine** (Node `*.mjs` utama + `*.ps1` cadangan). Inti:
  - `consistency-check.*` — **robot kecocokan SSOT** (versi + fakta jumlah file-tim). MODE KIT + PROJECT.
  - `manifest.*` + `manifest-signing.*` — catatan-pasang + tanda tangan HMAC (integritas, tulis-atomik).
  - `version-detect.*` — pembaca versi (parse CHANGELOG/manifest).
  - `project-detect.*`, `project-manifest.*`, `stack-check.*` — deteksi stack + kartu identitas project.
  - `split-guard.mjs` — robot anti-bocor `.env` saat pecah-repo (Node-only).
  - `unicode-safety-check.*` — pemindai "huruf-tipuan" Unicode.
  - `parity-check.mjs` — banding Node vs PowerShell (`npx lintasai parity-check`) untuk deteksi kalau logika Node diam-diam beda di mesin client (detektor lapangan, ADR-005; Node-only, butuh PS hadir).
  - `rollback.*` — balikin berkas project dari backup.
  - `risk-gate.js` — Palang Rem aksi berisiko (hook `PreToolUse`, opt-in).
  - `kit-files.psd1` (+ `kit-files.mjs`) — **SUMBER daftar berkas kit** (dibaca runtime via import).
  - `popup-helpers.ps1` — popup WPF GUI Windows-asli (PS-permanen). Lain: json-merge, git-helpers, safety, fs-text, lang-*, dll.
- `tests/` — `*.test.mjs` (Node) + `*.Tests.ps1` (Pester) + `preflight.mjs` (gerbang pra-rilis).
- `templates/` — berkas yang **DI-DEPLOY ke project client** (skeleton docs + panduan tim).
- `docs/` — dokumentasi repo kit → lihat [architecture_auto.md](architecture_auto.md) untuk TOC.
- `.github/` — CI (`validate.yml` + `publish-npm.yml`) + CODEOWNERS.

## Berkas aturan (akar) — yang auto-load tiap sesi
- `CLAUDE.md` → `@import CLAUDE_universal_v1.md` — **aturan inti AI** (auto-load tiap sesi, di repo & client).
- `LINTASAI_WORKFLOWS_v1.md` — detail rujukan **on-demand** (TIDAK auto-load → hemat token).
- `KEUNGGULAN_LINTASAI.md`, `README.md`, `CHANGELOG.md`, `JALANKAN_KIT.md` — dokumen pendukung.

## Alur kerja (perintah utama)
- **Pasang:** `npm create lintasai` → `bin/lintasai.js` → `setup-pola-b.mjs` (salin kit ke `.claude-kit/`).
- **Update:** `npx lintasai update` → `update-kit.mjs`. **Copot:** `npx lintasai uninstall` → `uninstall.mjs`.
- **Gerbang pra-rilis (WAJIB lulus sebelum "selesai", §4.6):** `npm run preflight` (`tests/preflight.mjs`) —
  tes Node + Pester + robot kecocokan + pemindai Unicode + smoke + cek CHANGELOG.
- **Naikkan versi:** `node kit.mjs bump X.Y.Z` (penulis cap-versi sudah Node, migrasi PS→Node 2026-06-25 — `lib/consistency-check.mjs`). Cadangan PowerShell `kit.ps1 bump` tetap ada.

## SSOT — di mana fakta "tinggal" (JANGAN duplikasi tanpa penjaga)
- `docs/PETA_SUMBER_KEBENARAN.md` — di mana tiap fakta tinggal + jenisnya (1-sumber sejati / duplikat+pengecek / prosa).
- `docs/RESEP_PERUBAHAN.md` — berkas mana ikut bergerak per jenis perubahan + cara jalankan robot.
- Robot penjaga drift: `lib/consistency-check.*` (jalan otomatis di preflight + Pester).

## Konvensi penting
- **Paritas PS↔Node:** ubah fakta robot di KEDUA `consistency-check.ps1` + `.mjs` (dijaga
  `tests/consistency-parity.Tests.ps1`); daftar berkas-tim di KEDUA `setup-pola-b.*` (dijaga
  `tests/teamfiles-parity.test.mjs`).
- **Read-before-Edit** (§7.3a) + **gerbang preflight** (§4.6) sebelum menyatakan "selesai".
- Keputusan teknis non-sepele → ADR di `docs/decisions/`.
