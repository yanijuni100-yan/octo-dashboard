# install-secret-hook.md — Pasang penjaga rahasia pre-commit OTOMATIS saat install

> Versi 1 · 2026-06-24 · auto-generated · pendamping `lib/install-secret-hook.mjs`

## Tujuan

Memasang **penjaga rahasia pre-commit** (hook git) ke `.git/hooks/pre-commit` project klien **otomatis saat pemasangan kit** — supaya rahasia (file `.env` asli, kunci/token API) **ditolak DI LAPTOP sebelum ter-commit**, bukan baru ketahuan telat di server (saat itu rahasia sudah masuk riwayat → wajib ganti-kunci + tulis-ulang riwayat, mahal & menakutkan).

🏢 **Analogi non-programmer:** kayak **detektor logam di pintu masuk** — barang berbahaya (rahasia) ketahuan **sebelum** masuk gedung (server), bukan setelah sudah di dalam. Dipasang sekali saat kit di-install, jaga seumur hidup, staf tak perlu ingat memasang manual.

👨‍💻 **Programmer:** menutup celah nyata — template `templates/hooks/pre-commit-secret-scan.sh` + installer PowerShell `templates/hooks/install-secret-hook.ps1` sudah ada + teruji, TAPI pemasang aktif kini Node (`setup-pola-b.mjs`) tak menyambungnya → hook tak pernah terpasang otomatis. Modul ini memport installer ke Node + disambung ke `setup-pola-b.mjs` (jalan di init DAN update).

## Cara Pakai

Otomatis — tidak ada yang perlu dilakukan staf. Saat `npm create lintasai` (atau `npx lintasai update`), `setup-pola-b.mjs` memanggil `installSecretHook(projectRoot)` setelah memasang hook bahasa. Manual (opsional): `node .claude-kit/lib/install-secret-hook.mjs [projectRoot]`.

**Uji cepat** (buktikan ia bekerja): stage file `.env` palsu lalu `git commit` → harus **DITOLAK**.
**Lewati darurat / alarm-palsu:** `git commit --no-verify`.

## Input / Output

- **Input:** `installSecretHook(projectRoot, { dryRun?, templatePath?, clock? })`.
- **Output:** `{ installed, reason, hookPath, backupPath }`.
  - `reason`: `'dipasang'` | `'dipasang-cadangkan-lama'` | `'sudah-ada'` | `'tak-ada-git'` | `'template-hilang'` | `'simulasi'`.
  - `installed: true` HANYA saat hook benar-benar ditulis (atau akan ditulis di `dryRun`). `'sudah-ada'` = `installed:false` (idempoten).

## Sifat (cermin pola `ensureLangHook`)

- **Idempoten** — penanda `HOOK_MARKER` ('lintasAI pre-commit secret guard') sudah ada → skip, tak menulis dobel.
- **Fail-open** — git belum init / template hilang / `.git/hooks` tak bisa ditulis → **lewati** (tak crash; pemasangan TETAP berhasil). Hook = jaring tambahan, bukan syarat install.
- **Aman thd hook lain** — pre-commit bukan-punya-kita → **dicadangkan** ke `pre-commit.backup-<yyyyMMdd-HHmmss>`, **tidak** di-merge/timpa diam-diam.
- **LF wajib** — bash rusak kalau CRLF → normalize CRLF→LF.
- **Tulis atomik** — temp + rename.

## Dependensi

- `lib/fs-text.mjs` (`stripBom`). Template: `templates/hooks/pre-commit-secret-scan.sh` (self-locating via `import.meta.url`).
- Disambung: `setup-pola-b.mjs` (setelah `ensureLangHook`). Didaftarkan: `lib/kit-files.psd1` (`node_lib`).
- Tes: `tests/install-secret-hook.test.mjs` (installer) + `tests/secret-precommit.Tests.ps1` (logika deteksi rahasia di `.sh`).

## Catatan — KETERBATASAN JUJUR (PENTING, bukan "kritis/lengkap")

Ini **PENTING**, **bukan jaminan menyeluruh** — penting dipahami supaya tak ada rasa-aman-palsu:

- **Cegah COMMIT BARU, bukan riwayat lama.** Rahasia yang **sudah** ter-commit tak tertangkap hook ini — butuh audit riwayat terpisah (lihat `templates/SECURITY_INCIDENT_PLAYBOOK.md`).
- **Deteksi NAMA berkas (`.env*`) + pola kunci**, bukan analisa isi menyeluruh. Bisa ada yang lolos.
- **Bisa dilewati** `git commit --no-verify` (sengaja — untuk darurat/alarm-palsu).
- **Pertahanan berlapis:** hook lokal (lapis-1, shift-left) + `.github/workflows/secret-guard.yml` (lapis-2, CI server) + `lib/risk-gate.js` (lapis-3, opsional). Hook ini menggeser deteksi **lebih awal** di siklus kerja — nilai nyata, tapi **CI lapis-2 tetap perlu**.
- **Hanya jalur Node** (pemasang aktif). Pemasang PowerShell lama (`setup-pola-b.ps1`, cadangan ADR-004) tidak auto-menyambung — gunakan `templates/hooks/install-secret-hook.ps1` manual bila perlu.

Source: `lib/install-secret-hook.mjs:1`, wiring `setup-pola-b.mjs` (setelah `ensureLangHook`).
