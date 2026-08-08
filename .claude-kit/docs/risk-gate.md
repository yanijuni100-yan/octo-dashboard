# risk-gate.md — Palang Rem Otomatis (penegak-mesin aksi berisiko)

> Versi 3 · 2026-06-26 · pendamping `lib/risk-gate.js` (runtime Node.js sejak v1.57.0) + `lib/ensure-risk-gate-hook.mjs` (tombol nyalakan 1-langkah)

## Tujuan
Untuk siapa: tim (terutama staff non-programmer) yang ingin **pengaman yang benar-benar MEMAKSA**, bukan cuma kebijakan teks. Masalah yang diselesaikan: aturan kit soal aksi merusak (§8.2 Aturan 5 konfirmasi-verbatim, §8.1 #3, §9, §4.14 #2 Prisma) selama ini bergantung **AI mau patuh**. Palang ini memasangnya sebagai **hook Claude Code** yang membaca tiap aksi AI yang akan jalan, lalu **meminta konfirmasi klik** kamu untuk aksi berisiko — atau **menolak** aksi yang menembus pagar.

🏢 Analogi: selama ini ada **rambu tulisan** "AWAS JURANG"; palang ini = **palang besi** yang menghentikan mobil dulu + tanya sopir "yakin lewat sini?".

> **Runtime = Node.js** (keputusan owner, ADR-002): benchmark menunjukkan Node ~7,7× lebih cepat dari PowerShell 5.1 (~66ms vs ~509ms/panggilan). Karena palang dipakai aktif (nyala tiap aksi), kecepatan jadi penting. Node sudah ada kalau kit dipasang via npm (`engines node>=18`).

## Cara Pakai (default NYALA sejak v1.61.0 — dipasang otomatis tiap setup)

> Sejak v1.61.0, `setup-pola-b` memasang Palang Rem **otomatis** tiap init/update (fail-safe: settings rusak/terkunci → dilewati, tak ditimpa). Bagian di bawah hanya perlu kalau kamu memasang manual / pernah mematikannya / settings sempat rusak saat setup.

**Cara cepat (1 langkah):** minta AI *"nyalakan Palang Rem risk-gate"* → AI menjalankan `npx lintasai enable-risk-gate` (atau `node .claude-kit/lib/ensure-risk-gate-hook.mjs`). Helper itu menggabungkan hook ke `.claude/settings.json` **tanpa menghapus setelananmu yang lain** (idempoten = aman dijalankan berulang + fail-safe = kalau settings rusak/terkunci, TIDAK diutak-atik + tulis-atomik). Ingin lihat dulu tanpa menulis? tambah `--dry-run`. Lalu **buka chat baru** (hook dimuat saat sesi mulai) + uji-jalan (langkah 4 di bawah). Matikan: hapus blok `PreToolUse` risk-gate dari `.claude/settings.json`.

**Cara manual (kalau ingin atur sendiri):**
1. Pastikan **Node.js terpasang** (`node --version` jalan) + kit terpasang (`risk-gate.js` ada, biasanya di `.claude-kit/lib/`).
2. Salin blok `hooks` dari `templates/hooks/risk-gate.settings.example.json` ke **`.claude/settings.json`** project-mu (gabungkan kalau sudah ada `hooks` lain). Sesuaikan path ke `risk-gate.js`.
3. **Buka chat baru** (hook dimuat saat sesi mulai).
4. **Uji-jalan**: minta AI melakukan sesuatu yang berisiko di lingkungan AMAN (mis. "coba hapus folder-test secara rekursif"). Harusnya muncul **dialog Setujui/Tolak** dengan alasan Bahasa Indonesia. Kalau muncul → palang aktif. Kalau tidak → cek `node --version` + path di settings.
5. **Matikan**: hapus blok `hooks` dari `.claude/settings.json`.

## Input / Output
- **Input**: JSON tool-call dari Claude Code di stdin (`tool_name`, `tool_input.command` / `tool_input.file_path`). BOM di awal (kalau ada) dibuang otomatis sebelum di-parse.
- **Output** (kontrak PreToolUse Claude Code):
  - **ask** (aksi berisiko 1-6): exit 0 + stdout JSON `permissionDecision: "ask"` → Claude Code munculkan dialog **Setujui/Tolak** dengan alasan.
  - **block** (menembus pagar / unduh-lalu-jalankan): exit 2 + pesan stderr → aksi diblokir.
  - **allow** (aman / input rusak): exit 0 tanpa output → aksi lanjut normal.

## Aksi yang dijaga
| Kategori | Contoh | Keputusan |
|---|---|---|
| Hapus rekursif paksa | `rm -rf`, `Remove-Item -Recurse -Force` | ask |
| SQL merusak | `DROP TABLE`/`TRUNCATE`, `DELETE FROM` tanpa `WHERE` | ask |
| Prisma berbahaya | `prisma migrate dev`, `deleteMany`/`updateMany` tanpa `where` | ask |
| Git berbahaya | `push --force`, `reset --hard`, `--no-verify` | ask |
| Sentuh rahasia | tulis/ubah `.env*` | ask |
| Format disk | `Format-Volume`, `diskpart`, `mkfs`, `dd of=/dev/...` | ask |
| Menembus pagar | `--dangerously-skip-permissions`, `curl/iwr ... \| iex/bash` | **block** |

Aksi aman (mis. `deleteMany({ where })`, `DELETE ... WHERE`, `migrate deploy`, `rm berkas.txt`, `npm install`) **TIDAK** memicu dialog (anti alarm-palsu).

## Dependensi
- **Node.js ≥18** (`node` di PATH). Sudah terpasang kalau kit dipasang via npm.
- Claude Code (mekanisme hook `PreToolUse` di `.claude/settings.json`).
- Tidak butuh jaringan, tidak menyimpan state, ~0 token. Lintas-OS (Node jalan di Windows/Mac/Linux).

## Catatan
- **Default NYALA sejak v1.61.0** (dipasang otomatis tiap setup). Pengaman ini **MEMBATASI** AI (mengurangi risiko) → default-nyala selaras "keamanan dulu" (tie-breaker #1), BEDA dari mode-OTONOMI (co-pilot/auto-confirm) yang tetap default MATI (§4.12). **Mudah dimatikan**: hapus blok `PreToolUse` risk-gate dari `.claude/settings.json`.
- **FAIL-OPEN**: input rusak/kosong → loloskan (jangan kunci kerja tim). Pengecualian: kategori menembus-pagar yang terdeteksi tetap diblokir. Lihat `lib/risk-gate.js` (fungsi `decide()` di-export untuk diuji).
- **Bukan jaminan mutlak**: menutup pola berbahaya yang DIKETAHUI; permukaan dinamis tetap butuh pagar perilaku-AI (§8.1) + verifikasi manusia.
- **Verifikasi efek di lingkunganmu** (§4.6): efek runtime ada di sesi nyata — uji-jalan langkah 4 sebelum menganggap aktif. Source: `lib/risk-gate.js:1`, rancangan `docs/plans/palang-rem-otomatis.md`, keputusan runtime `docs/decisions/ADR-002-runtime-hook-powershell-vs-node.md`.
- **Pelajaran (didokumentasikan):** pipa Windows kadang menambah BOM di awal stdin → tanpa pembersih BOM, `JSON.parse` gagal → hook fail-open diam-diam (gagal melindungi). Sudah ditangani (`risk-gate.js` buang BOM dulu). Diuji `tests/risk-gate.Tests.ps1`.
- **Kredit (MIT)**: pola hook diadaptasi dari ECC v2.0.0 `config-protection.js` + `gateguard-fact-force.js` — ditulis-ulang + mode "ask" bahasa Indonesia.
