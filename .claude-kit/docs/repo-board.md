# repo-board.md — Papan Status Lintas-Repo (cuma-baca)

> Versi 1 · 2026-06-20 · pendamping `lib/repo-board.ps1`

## Tujuan
Untuk siapa: tim yang mengelola **banyak repo** (portfolio multi-repo / microservice varian shared-database, 3-7+). Masalah: sulit melihat sekilas "repo mana yang berisiko" — ada perubahan belum disimpan, commit belum dikirim ke server (belum ter-backup), atau berkas rahasia (`.env`) belum aman. Robot ini memberi **satu pandangan terpusat** + skor risiko bahasa awam, **cuma-baca**, jalan **on-demand** (bukan daemon).

🏢 Analogi: seperti **papan tulis "status gudang" di pagi hari** — sekali lihat tahu gudang mana yang perlu diurus, tanpa keliling satu-satu.

## Cara Pakai
```powershell
# Pindai semua repo di satu folder induk:
.\.claude-kit\lib\repo-board.ps1 -Path "D:\proyek\multi-repo"

# Atau sebut repo tertentu:
.\.claude-kit\lib\repo-board.ps1 -Repos "D:\proyek\dashboard","D:\proyek\core"
```
Output = daftar repo + label risiko + catatan. **Tidak mengubah apa pun** (cuma membaca status git).

## Input / Output
- **Input**: `-Path <folder-induk>` (auto-temukan sub-folder ber-`.git`) ATAU `-Repos <path1>,<path2>`.
- **Output**: papan di layar (warna per risiko) + objek `{ Rows; Count; Genting; Penting; Rapikan }`. Exit 0 (papan = informasi, bukan gerbang lulus/gagal).

## Skor risiko (yang TERTINGGI menang)
| Skor | Arti |
|---|---|
| **[GENTING]** | Ada perubahan berkas rahasia (`.env`) belum aman — bisa ke-commit tak sengaja |
| **[PENTING]** | Ada commit belum dikirim ke server (belum ter-backup) ATAU perubahan belum disimpan |
| **[RAPIKAN]** | Ketinggalan dari server (perlu pull) / kepala terlepas (detached) / belum ada remote |
| **[OK]** | Bersih + sinkron dengan server |

## Dependensi
- Windows + PowerShell 5.1+.
- `git` terpasang (robot menjalankan perintah git **baca-saja**: `status`, `rev-parse`, `rev-list`).
- Tidak butuh jaringan untuk status lokal; `ahead/behind` dihitung dari remote-tracking yang sudah ada (jalankan `git fetch` manual dulu kalau mau angka behind terbaru).

## Catatan
- **Cuma-baca + on-demand**: TIDAK ada daemon, TIDAK menyimpan state, TIDAK mengubah repo. Keputusan (commit/push/pull) tetap di manusia.
- **Adaptasi RINGAN** konsep "session-tracking + risk-scoring" ecc2 ECC (yang aslinya control-plane Rust + daemon). Sengaja dibuat ringan sesuai filosofi kit (ADR-001: ambil konsep, buang mesin berat). Source: `lib/repo-board.ps1:1`.
- Fungsi inti `Get-LintasRepoRisk` = murni (logika skor), dites di `tests/repo-board.Tests.ps1` tanpa repo nyata.
- **Kredit (MIT)**: konsep dari ECC v2.0.0 ecc2, diadaptasi ringan PowerShell + bahasa Indonesia.
