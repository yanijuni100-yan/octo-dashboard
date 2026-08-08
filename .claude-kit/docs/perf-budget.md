# perf-budget.md — Penjaga Anggaran Ukuran Halaman (Next.js)

> Versi 1 · 2026-06-26 · pendamping `lib/perf-budget.mjs`

## Tujuan
Cek perkiraan ukuran JavaScript yang dimuat tiap halaman (route) Next.js vs "anggaran" (default **500 KB**, §10), supaya halaman tak diam-diam membengkak (lambat dibuka + boros kuota user). CUMA-LAPOR (READ-ONLY) — tak mengubah apa pun.

🏢 Analogi: kayak **timbangan bagasi di bandara** — menimbang tiap koper (halaman) lalu menandai yang kelebihan, bukan menyita; kamu yang putuskan apa yang dikeluarkan.

## Cara Pakai
1. **Build dulu**: `npm run build` (robot membaca hasil build di `.next/`).
2. Jalankan: `npx lintasai perf-budget` (atau `node .claude-kit/lib/perf-budget.mjs`). Ubah anggaran: `--budget-kb 350`.
3. Robot mencetak ukuran JS per route (terberat dulu) + menandai yang melewati anggaran.

- **Belum build / bukan Next.js** → robot **dilewati dengan anggun** (lapor "DILEWATI", BUKAN error/alarm).
- Juga ikut di `npx lintasai preflight` sebagai **RAPIKAN** (saran, tak memblokir) — auto-skip kalau belum build. Paling berguna dijalankan **setelah build** (mis. di CI post-build).

## Input / Output
- **Input**: `.next/build-manifest.json` + `.next/app-build-manifest.json` (hasil `npm run build`) + ukuran berkas di `.next/`.
- **Output**: tabel route → perkiraan ukuran JS + daftar yang lewat-anggaran. Tak ada berkas yang diubah.

## Catatan
- Ini **PERKIRAAN** ukuran JS dari manifest (jumlah berkas `.js` unik per route) — **bukan** angka "First Load JS" persis ala Next (yang menghitung shared-chunk dengan rumus internalnya). Cukup untuk menyorot route yang jauh lebih berat.
- Tingkat **RAPIKAN** — saran optimasi (code-splitting, lazy-load, hapus dependency berat), tak pernah memblokir rilis.
- READ-ONLY + deterministik (~0 token). Source: `lib/perf-budget.mjs`, diuji `tests/perf-budget.test.mjs`.
