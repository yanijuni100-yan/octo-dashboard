# parity-check.md - Alat banding Node vs PowerShell (detektor lapangan)

> Versi 1 · 2026-06-25 · auto-generated (migrasi PS→Node, ADR-005)

## Tujuan
Untuk **owner/staff** yang khawatir: "setelah migrasi PowerShell→Node, bagaimana tahu kalau logika Node
diam-diam memberi hasil BERBEDA di mesin client tertentu?" (kasus paling sulit: *kelihatan jalan, tapi
hasil salah* — tak ada alarm otomatis). Tes biasa jalan di mesin pengembang, bukan mesin client.

`parity-check` = **"2 kasir menghitung uang yang sama secara terpisah"**: untuk tiap pemeriksaan, ia
menjalankan jalur **Node** DAN jalur **PowerShell** pada input yang SAMA (mode aman cuma-baca), lalu
membandingkan. Kalau beda → langsung ketahuan, **tanpa** manusia perlu tahu jawaban benarnya.

## Cara Pakai
```
npx lintasai parity-check
```
Jalankan di dalam folder project yang memasang kit (di mana ada `.claude-kit/`). Tak mengubah apa pun.

Membaca hasilnya:
- `[COCOK]` = Node memberi hasil SAMA dengan PowerShell → logika Node sehat di mesin ini.
- `[BEDA]` = Node ≠ PowerShell → **laporkan ke tim teknis** (sertakan tampilannya).
- `[LEWATI]` = tak bisa dibandingkan (PowerShell tak terpasang ATAU berkas `.ps1` cadangan sudah dihapus).

## Input / Output
- Input: lokasi kit (`.claude-kit`, otomatis) + akar project (lewat `--project-root`, disuntik dispatcher).
- Output: tabel 3 pemeriksaan + ringkasan. **Kode-keluar (exit code) = jumlah pemeriksaan yang BEDA**
  (0 = semua cocok). PowerShell tak terpasang → exit 0 (bukan kegagalan, hanya "tak bisa banding").

3 pemeriksaan yang dibandingkan (semua cuma-baca):
1. **Robot kecocokan versi (MODE KIT)** — `invokeLintasConsistencyCheckKit` (Node) vs `consistency-check.ps1`
   (PS). Mencakup logika versi + buku-fakta + istilah-pensiun sekaligus.
2. **Doctor (integritas kit)** — kode-keluar `kit.mjs doctor` (Node) vs `kit.ps1 doctor` (PS).
3. **Penjaga junction/symlink (keamanan)** — `testReparseNode` (Node) vs `testReparsePowerShell` (PS) pada
   beberapa berkas nyata milik kit.

## Dependensi
- `lib/consistency-check.mjs` (`invokeLintasConsistencyCheckKit`) + `lib/consistency-check.ps1`.
- `kit.mjs` + `kit.ps1` (doctor).
- `lib/reparse-guard.mjs` (`testReparseNode` + `testReparsePowerShell`) + `lib/safety.ps1`.
- `lib/popup-shim.mjs` (`resolvePowerShellExe`).
- **PowerShell harus hadir** untuk sisi pembanding.

## Catatan
- **Alat transisi:** berguna SELAMA PowerShell masih ada sebagai cadangan. Saat berkas `.ps1` dihapus
  (bersih-total, [ADR-005](decisions/ADR-005-jalur-tim-100-persen-node.md)), alat ini ikut pensiun —
  tak ada lagi yang dibandingkan (semua `[LEWATI]`), dan keyakinan beralih ke rilis bertahap (canary) + tes.
- **Kenapa butuh PowerShell:** intinya membandingkan KE PowerShell. Tanpa PS, tak ada "kunci jawaban".
- **Bukan pengganti rilis bertahap (canary):** parity-check mendeteksi *Node ≠ PS*; canary (uji di 1-2
  project dulu) tetap penting untuk menangkap masalah yang lolos keduanya.
- Sumber: `lib/parity-check.mjs:1` (header + 3 comparator), wiring `bin/lintasai.js` (`COMMANDS_NODE` +
  `shouldPassProjectRoot`), tes `tests/parity-check.test.mjs`.
