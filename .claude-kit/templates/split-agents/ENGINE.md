# TEMPLATE: `<project>-<kapabilitas>/AGENTS.md` (repo ENGINE — Mode [2] microservice)

> Template ini di-deploy oleh AI saat split repo migration **Mode [2] (per-Kapabilitas / microservice varian shared-database)**.
> Untuk TIAP repo engine/kapabilitas (mis. `<project>-seoanalysis`, `<project>-data-domain`).
> Customization: replace `<project>` + `<kapabilitas>` + `<schema>` dengan nilai nyata.

```markdown
# AGENTS.md - <project>-<kapabilitas> (ENGINE — algoritma rahasia)

> Repo ini: ENGINE kapabilitas `<kapabilitas>` = ALGORITMA RAHASIA + laci-data (schema) sendiri.
> Audience AI: Claude Code untuk 1-2 staff tepercaya pemegang engine ini + owner.
> PRIVATE - staff Dashboard/Frontend (mayoritas) DAN engine LAIN TIDAK punya akses ke repo ini.
>
> Posisi di topologi (microservice varian shared-DB): engine → **backend (aggregator)** → dashboard.
> Aturan keras: data SELALU mengalir `engine → backend → dashboard`. Engine TIDAK pernah bicara
> langsung ke dashboard/frontend — selalu lewat backend.

## Scope Kamu (AI)

Kamu di repo engine `<project>-<kapabilitas>`. Kamu BOLEH:
- Bikin/edit ALGORITMA rahasia kapabilitas ini (perhitungan, scraping, scoring, model)
- Baca/tulis HANYA schema milik engine ini: `<schema>` (mis. `engine_seo`)
- Baca schema engine lain HANYA kalau diberi role baca eksplisit (least-privilege) — default TIDAK
- Sediakan "loket" (API/fungsi) yang mengeluarkan **HASIL MATANG** saja (skor/ringkasan/status)
- Import types/kontrak dari `@<project>/shared` (tipe murni, TANPA logika)

Kamu TIDAK BOLEH:
- **Mengeluarkan DATA MENTAH atau RUMUS rahasia keluar loket** — hanya kirim hasil matang + "daftar putih" kolom yang disepakati. Resep tinggal di dalam engine, tidak pernah keluar.
- **Menerima koneksi LANGSUNG dari dashboard/frontend** — semua akses dari luar lewat backend-aggregator. Dashboard/frontend DILARANG memanggil repo/endpoint engine ini langsung.
- **Menulis ke schema engine LAIN** atau schema `operasional` — itu domain engine lain / backend.
- Hardcode rahasia (kunci DB, API key) di kode — pakai env var + `.env` gitignored.
- Expose endpoint publik tanpa lapis auth (kalau ada loket HTTP, hanya backend yang boleh memanggil — batasi via network/secret/allowlist, bukan terbuka ke internet).
- Bypass pemeriksaan otorisasi.

## Stack (sesuaikan)
- Python (FastAPI/Django) ATAU Node (sesuai bahasa engine) — engine boleh beda bahasa dari backend
- Akses DB: role database **least-privilege** yang HANYA boleh `<schema>` engine ini (bukan kunci master)
- Connection string di **env server** (Railway/Render/Vercel secret) — BUKAN di kode, BUKAN di laptop
- Validasi semua input di pintu masuk (boundary) sebelum diproses

## Aturan anti-bocor (INTI — kenapa repo ini PRIVATE)
- Engine = "wilayah rahasia". Yang keluar loket = **hasil**, bukan **cara**. Rumus/threshold/bobot
  algoritma TIDAK pernah dikirim keluar.
- Kalau backend butuh data gabungan, **backend yang membaca schema engine via role baca** (lihat
  `docs/plans/POLA_REPO_AMAN.md` tabel "kartu akses") — BUKAN engine yang push ke dashboard.
- Tambah algoritma baru di wilayah yang SAMA = **tambah file di engine ini**, bukan repo baru.

## Workflow

Saat staff/owner prompt kamu untuk kapabilitas baru:

1. Baca prompt, identify TASK ID
2. Kalau butuh struktur data baru: update schema `<schema>` milik engine ini saja (migration ber-file)
3. Implement algoritma di service/module terisolasi
4. Sediakan loket (fungsi/endpoint) yang keluarkan hasil matang — daftar putih kolom
5. Tulis minimal 1 test untuk jalur utama algoritma
6. Open PR ke `main`; owner/lead review (CODEOWNERS)
7. **Prompt berantai**: di akhir, tuliskan 1 prompt siap-pakai untuk tim BACKEND (cara panggil loket + input + output) supaya backend bisa menggabung tanpa tahu isi algoritma

## Critical Safety
- Role DB engine ini WAJIB least-privilege (cuma `<schema>`). Kalau role-nya bisa baca semua schema → lapor owner, itu salah-konfigurasi (bocor antar-engine).
- JANGAN expose data mentah lewat API "biar praktis" — itu membatalkan seluruh alasan pisah-repo.
- Migrasi schema ke prod = manual owner setelah backup (sama aturan backend).

## Project-Specific Rules

<!-- Owner: tambahkan rules spesifik engine di sini -->
<!-- Contoh: sumber data, batas rate scraping, daftar-putih kolom yang boleh keluar loket -->
```
