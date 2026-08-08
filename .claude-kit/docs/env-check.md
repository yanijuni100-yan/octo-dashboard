# env-check.md — Robot "Pemeriksa Lingkungan Setara" (`kit doctor --env`)

> Versi 1 · 2026-06-25 · auto-generated

## Tujuan

Menutup akar keluhan **"di komputer pengembang jalan, di komputer client TERASA BEDA"**.

Penyebab tersering perbedaan itu = **lingkungan eksekusi yang tidak setara** — beda versi Node.js,
beda versi PowerShell/OS, library (dependency) belum terpasang, atau versi library tidak terkunci.
Sebelumnya `kit doctor` cuma memeriksa **berkas kit + keasliannya** (sha256), jadi **buta** terhadap
kondisi runtime di mesin client. Robot ini memberi "lampu indikator dashboard" untuk itu.

🏢 Analogi: seperti **memeriksa oven sebelum menyalahkan resep** — kalau resep minta 180°C tapi oven
client cuma sampai 150°C, kuenya bantet bukan karena resepnya salah, tapi karena ovennya beda.

## Cara Pakai

```
npx lintasai doctor --env      # atau, dari dalam project: node .claude-kit/kit.mjs doctor --env
```

Tanpa `--env`, `kit doctor` berperilaku **persis seperti dulu** (byte-identik dengan cadangan
PowerShell `kit.ps1` — menjaga gerbang output-identik ADR-003). `--env` **menambah** satu blok
"Lingkungan eksekusi (parity)" di bawah laporan doctor biasa, dan temuannya ikut dihitung di
ringkasan `Result: OK=.. WARN=.. ERROR=..`.

Robot juga bisa dipakai langsung (mis. untuk alat lain):

```js
import { runEnvCheck } from './lib/env-check.mjs'
const { facts, findings, summary } = runEnvCheck(projectRoot)
```

## Input / Output

- **Input:** `projectRoot` (akar project yang diperiksa). Opsi: `{ skipSpawn }` (lewati deteksi
  PowerShell/Git — untuk tes deterministik), `{ baseline }` (cap lingkungan acuan; kalau **tak**
  diberikan, `runEnvCheck` **auto-baca** dari `project.lintas.jsonc` blok `environment` — Quick Win #3).
- **Output:** `{ facts, findings, summary }`.
  - `facts` — potret bebas-rahasia: versi Node, platform + build OS, arsitektur, versi PowerShell &
    Git (atau `null` kalau tak terdeteksi), alat-paket, ada/tidaknya `node_modules`/lockfile/`.env.local`.
  - `findings` — daftar temuan `{ level, label, message, hint? }`. `level` ∈ `OK`/`WARN`/`ERROR`/`INFO`.
  - `summary` — `{ ok, warn, err }` (hitungan per level; `INFO` tidak dihitung).

Temuan inti: **versi Node vs ambang** (dari `engines.node` project, atau default lintasAI `>=18`),
**`node_modules` hilang** (WARN + saran `install`), **lockfile hilang** (INFO), **PowerShell tak
terdeteksi di Windows** (WARN).

## Dependensi

- `lib/project-detect.mjs` — `getPackageManager` (tebak alat-paket + nama lockfile).
- `lib/fs-text.mjs` — `readTextSafe` (baca `package.json` + buang BOM Windows tanpa menyedak `JSON.parse`).
- `lib/project-manifest.mjs` — `readLintasProjectManifest`/`resolveLintasManifestPath` (baca "cap lingkungan"
  acuan dari `project.lintas.jsonc` blok `environment` — pembanding dev vs client, Quick Win #3).
- Node bawaan: `os`, `fs`, `path`, `child_process` (`spawnSync` untuk deteksi PowerShell/Git).
- Dipanggil dari `kit.mjs` → `invokeDoctor(kitDir, projectRoot, extra)` saat `extra` memuat `--env`.

## Catatan

- **KEAMANAN (dikunci tes `tests/env-check.test.mjs`):** robot HANYA mengumpulkan nomor versi +
  platform + boolean ada/tidak. **DILARANG** mengambil/mencetak hostname, username, jalur absolut,
  isi env var, atau ISI `.env` (cuma cek NAMA `.env.local` ada/tidak). Lihat `CLAUDE_universal_v1.md`
  §8.1 #6. Tes keamanan memastikan output tidak memuat `os.hostname()` / username / jalur project.
- **FAIL-HONEST:** kalau deteksi PowerShell/Git gagal atau timeout (5 detik) → lapor "tidak
  terdeteksi", **bukan** diam-diam "OK" (§6.3 #4 "timbangan mati ≠ 0 kg"). Spawn pakai array-args
  (tanpa shell → tak ada injeksi) + `-ExecutionPolicy Bypass` (pelajaran MOTW: tanpa ini, di PC
  Restricted/AllSigned spawn ditolak).
- **Node-only (sengaja):** `--env` fitur baru hanya di port Node; cadangan `kit.ps1 doctor` tetap
  perilaku LAMA (arah migrasi Strangler Fig, ADR-003/004). `kit doctor` polos tetap identik PS↔Node.
- **Ambang Node:** `parseEnginesNodeMajor` ambil major MINIMAL dari rentang semver (`>=18`→18,
  `^20`→20, `20 || 22`→20). Sederhana sengaja — cukup untuk gerbang "Node terlalu lama".
- Source: `lib/env-check.mjs` (robot), `kit.mjs:725` (case doctor → teruskan `extra`),
  `kit.mjs` blok "7. Lingkungan eksekusi" (integrasi cetak + penghitung).
