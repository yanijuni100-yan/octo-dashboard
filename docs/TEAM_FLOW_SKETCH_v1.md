# templates/TEAM_FLOW_SKETCH_v1.md — Flow Kerja Tim (Staff IT Non-Programmer + Claude Code)

> Versi 1 · 2026-06-09 · Panduan end-to-end: siapa ngapain, serah-terima antar peran, staging→production, cek bug, deploy aman. Bahasa non-programmer.
> Audience: semua staff (backend/frontend/UI, senior & junior) + owner. Baca sekali saat onboarding.

---

## 0. Inti yang harus nempel (3 kalimat)

1. **Kamu ngomong maksud pakai bahasa biasa; AI (Claude Code) yang nulis kode/SQL/git.** Tak perlu jadi programmer.
2. **Production (data asli) tak pernah disentuh langsung.** Semua dikerjakan di **staging** dulu, lalu owner promote ke production.
3. **Koordinasi antar orang lewat REPO + chat, bukan antar-AI.** AI tiap orang terpisah — yang menyambungkan = file di repo (`@project/shared`) + sinyal di chat.

> Aturan pendukung: [MCP_SETUP.md](MCP_SETUP.md) Aturan #0 "1 login = 1 orang" + Option D tiering. Kontrak otomatis: [CROSS_REPO_TYPES_PIPELINE.md](CROSS_REPO_TYPES_PIPELINE.md).

---

## 1. Siapa ngapain (5 peran)

Contoh tugas: *"Tambah halaman Laporan Penjualan Bulanan + tombol Export PDF."*

| Peran | Tugasnya | Yang dia KETIK ke Claude Code (bahasa biasa) | Sentuh struktur DB? |
|---|---|---|---|
| 🏛️ **Backend Senior Architect** | Rancang bentuk data + **kontrak API** + jalankan migrasi. Review junior. | *"Aku mau laporan penjualan bulanan. Rancang struktur data efisien (jangan bikin query lambat), tulis migrasinya, jelaskan trade-off-nya."* | ✅ Ya (DDL) |
| 🔧 **Backend Junior Dev** | Isi logika endpoint sesuai kontrak. Tulis 1 test. | *"Bikin endpoint ambil data penjualan per bulan, balikan sesuai kontrak ini: [tempel kontrak]."* | ❌ Tidak (DML) |
| 🏛️ **Frontend Senior Architect** | Rancang struktur komponen + alur data + 4 state UI. Review junior. | *"Susun struktur komponen halaman ini biar rapi & reusable. Jelaskan pilihanmu."* | — |
| 🎨 **Frontend Junior Dev** | Bikin komponen, sambungkan API, tampilkan 4 state. | *"Sambungkan halaman ke API `/api/reports/sales`. Tampilkan loading, 'belum ada data' kalau kosong, pesan error kalau gagal."* | — |
| ✨ **UI Developer** | Desain tampilan: layout, filter, tombol, warna/jarak (design token), kontras + keyboard (a11y). | *"Bikin tampilan: filter bulan di atas, tabel di bawah, tombol Export PDF biru pojok kanan. Pakai warna brand."* | — |

> **"Backend Owns the Contract"**: senior backend tetapkan kontrak DULU → junior BE + FE + UI kerja **paralel** mengikuti kontrak. Tidak nunggu-nungguan.

> **Jujur soal peran senior**: bahasa biasa cukup untuk *mengarahkan*, tapi senior tetap harus **baca kritis** hasil AI ("data model-nya bener? aman?"). Skill ini tumbuh seiring waktu — kit bantu lewat penjelasan + analogi + AI Reviewer. Keamanan datang dari **PROSES** (staging, review, owner-gate, tiering), bukan dari menuntut tiap orang jadi ahli.

---

## 2. Pipeline: perjalanan 1 fitur (staging → production)

```
        BRANCH (jalur kerja terpisah, tiap orang punya sendiri)
            │
   ┌────────┴─────────┐
   │  Bangun + tes    │  ← SEMUA nunjuk ke STAGING DB (BUKAN production!)
   │  di STAGING      │     diatur 1 baris setting: DATABASE_URL = staging
   └────────┬─────────┘
            │  ① cek bug LOKAL (AI jalankan: lint + type + build + test)
            ▼
         PR + REVIEW  ← senior architect + AI Reviewer auto + OWNER approve
            │
            ▼
   MERGE ke main → auto-deploy ke STAGING (dapat "preview URL")
            │  ② smoke test alur kritis di preview + cek log error
            ▼  (kalau OK)
   PROMOTE ke PRODUCTION  ← OWNER klik approve (gerbang terakhir)
            │  migrasi DB yang SUDAH TERUJI dijalankan ke prod DB
            ▼
   ③ SMOKE TEST di production (login, transaksi utama, halaman baru)
            │  (kalau rusak)
            ▼
   ROLLBACK 1-klik (balik versi sebelumnya) + restore snapshot DB
```

---

## 3. Tahap demi tahap

| # | Tahap | Siapa | Yang terjadi (staff cukup ngomong, AI eksekusi) |
|---|---|---|---|
| 0 | **Rencana & Kontrak** | Senior BE+FE | Tetapkan tabel/view, bentuk API, halaman. Output: catatan kontrak 1 halaman. |
| 1 | **Branch** | tiap dev | *"Buatkan branch `feat/laporan-penjualan`."* → kerja di jalur sendiri, `main` aman. |
| 2 | **Bangun di STAGING** | semua | Semua `DATABASE_URL` = **staging**. Senior BE jalankan migrasi di staging DB. |
| 3 | **Cek bug** | tiap dev | *"Cek dulu ada error/crash gak?"* → AI run lint+type+build+test+4 state. Merah → perbaiki. |
| 4 | **PR + Review** | junior→senior→owner | *"PR-ku siap."* → AI buka PR. Senior + AI Reviewer + owner approve. Junior tak merge sendiri. |
| 5 | **Merge → deploy STAGING** | otomatis | Merge ke `main` → auto-deploy ke staging (preview URL). Belum production. |
| 6 | **Verifikasi staging** | dev | Smoke test alur kritis di preview + cek log. Ada bug → balik ke branch. Production masih aman. |
| 7 | **Promote PRODUCTION** | OWNER | Owner approve → deploy prod. DB: senior jalankan **file migrasi SAMA** (teruji) ke prod DB. |
| 8 | **Smoke production** | dev/owner | Cek 3-5 alur kritis: login, transaksi utama, halaman baru. |
| 9 | **Rollback** (kalau perlu) | owner | Code: Vercel rollback 1-klik. DB: restore snapshot. Rencana rollback 1-baris wajib sebelum deploy. |

---

## 4. Serah-terima antar peran (3-bagian) — anti-gagal

Saat backend senior selesai, frontend/UI tau lewat **3 bagian** yang saling lengkapi:

| Bagian | Apa | Buat siapa |
|---|---|---|
| **① Kebenaran** | Kontrak/tipe **di-merge ke `@project/shared`** (paket di repo) | Dibaca **AI** — sumber tunggal, permanen di repo. |
| **② Sinyal GO** | **Notif** "FE+UI lanjut" (Discord/WA) | Sinyal buat **manusia**. |
| **③ Catatan serah-terima** | 2 baris di **deskripsi PR**: *"FE: pakai `getSalesReport(month)` dari @project/shared"* | Titik mulai jelas buat **AI orang berikutnya**. |

**Kenapa 3 bagian (bukan cuma chat)**: kalau pesan chat ke-skip, **kebenaran tetap di repo + PR** → orang berikutnya tinggal buka repo, AI-nya langsung paham. Tak ada yang hilang di chat.

> **PENTING**: AI tiap orang itu **TERPISAH**, tidak saling ingat. AI frontend belajar konteks dari **REPO** (`@project/shared` + `docs/architecture_auto.md`), **bukan** dari chat AI backend. Maka: kontrak penting **WAJIB di-commit ke repo**, jangan cuma diomongin di chat.

---

## 5. Otomasi penuh — yang TADINYA manual, sudah diakali jadi OTOMATIS

Kit sudah punya pipeline ini (tinggal owner setup sekali, lalu jalan sendiri):

| Langkah | Manual (cara lama) | **OTOMATIS (kit sekarang)** | File kit |
|---|---|---|---|
| Backend publish kontrak | `npm run build` + `npm publish` manual | Backend merge → CI auto-build + auto-publish `@project/shared` | [PUBLISH_SHARED_WORKFLOW.yml](github/PUBLISH_SHARED_WORKFLOW.yml) |
| Kabari frontend | Ketik di WA satu-satu | PR-merge → bot auto-posting Discord "✅ ready" | [DISCORD_BOT_INTEGRATION.md](DISCORD_BOT_INTEGRATION.md) |
| Frontend dapat update | `npm install` manual tiap orang | CI auto-bikin PR update di repo frontend (~4 menit) | [RECEIVE_BACKEND_UPDATE.yml](github/RECEIVE_BACKEND_UPDATE.yml) + [TRIGGER_FRONTEND_UPDATE.yml](github/TRIGGER_FRONTEND_UPDATE.yml) |
| Jaring kalau notif kelewat | — | Renovate auto-scan + auto-PR (cadangan) | [RENOVATE_FRONTEND.json](github/RENOVATE_FRONTEND.json) |
| AI tarik versi terbaru | Staff ketik `git pull` | AI auto-cek + `npm install` latest saat sesi mulai | aturan di AGENTS.md (lihat CROSS_REPO_TYPES_PIPELINE §"Session Start Auto-Check") |
| Cek bug di PR | Manual | CI auto-run lint+build+test + AI Reviewer auto-komentar | [workflows/ai-review.yml](github/workflows/ai-review.yml) |
| Deploy staging | Manual | Merge `main` → auto-deploy preview (Vercel) | (Vercel native) |
| Backup DB | Manual | Cron auto-backup harian per-schema | [workflows/backup-schemas.yml](github/workflows/backup-schemas.yml) |

**Mode paling otomatis (opsional)**: update NON-breaking `@project/shared` bisa **auto-merge** (lihat CROSS_REPO_TYPES_PIPELINE §"Auto-Merge"). Backend tandai perubahan besar dengan prefix `BREAKING:` → auto-merge di-skip, owner review.

---

## 6. Apa yang OTOMATIS vs apa yang TETAP manusia (sengaja)

Kit otomatiskan **semua pipa (plumbing)**, tapi **gerbang bahaya tetap manusia** — itu fitur, bukan kekurangan.

| Otomatis ✅ | Tetap gerbang manusia 🚦 (1 klik, bukan ketik perintah) |
|---|---|
| Publish kontrak, notif, frontend-PR, tarik versi | **Approve PR** (owner/senior — penilaian akhir) |
| Cek bug (lint/build/test) + AI Reviewer | **Promote ke production** (owner klik) |
| Deploy ke staging | **Aksi destruktif** (hapus data, ubah role DB) → AI minta konfirmasi |
| Backup DB harian | **Migrasi DB ke prod** (senior, lewat file teruji) |

> Kenapa prod-deploy tak full-otomatis? Karena deploy otomatis ke data asli = sekali salah, pelanggan kena. Gerbang owner = rem terakhir. Tapi rem-nya **1 klik**, bukan ketik perintah ribet.

---

## 7. Cara cek bug / error / crash (3 lapis)

| Lapis | Kapan | Dicek | Analogi |
|---|---|---|---|
| **① Lokal** | Sebelum PR | `lint` (rapi) + `type` (tipe cocok) + `build` (bisa dirakit) + `test` (logika benar) + 4 state UI | Matikan kompor sebelum tinggal dapur |
| **② Staging** | Setelah merge | Smoke test alur kritis di preview + baca log error | Gladi resik, penonton belum ada |
| **③ Production** | Setelah deploy | Smoke 3-5 alur kritis + healthcheck + rollback siaga | Cek panggung 5 menit sebelum konser |

Staff cukup bilang *"cek bug dulu"* / *"smoke test alur login"* → AI eksekusi + lapor pakai bahasa awam.

---

## 8. Khusus DB: "cek staging dulu, baru ke DB asli"

1. Perubahan DB ditulis sebagai **FILE migrasi** (Prisma), **bukan ketik manual** di SQL Editor.
2. Jalankan di **staging DB** → test → kalau benar...
3. ...jalankan **file SAMA** ke **production DB** (owner/senior).
4. File identik + sudah teruji → prod dapat perubahan yang terbukti aman.
5. **Snapshot prod DB dulu** sebelum migrasi yang menghapus/ubah kolom.
6. Tiering Option D: **junior tak bisa migrasi** → yang sentuh struktur prod cuma senior. Dobel aman.

---

## 9. FAQ

**Q: Kalau backend update `@project/shared`, frontend perlu `git pull` lagi?**
A: **Tidak manual.** Pipeline auto-bikin PR update di repo frontend (~4 menit), dan AI frontend auto-`npm install` latest saat sesi mulai. Staff cuma **approve PR** (1 klik) — git-nya ditangani CI + AI. Staff tak pernah ketik `git pull`/`npm install` sendiri.

**Q: AI frontend tau API backend dari mana?**
A: Dari **repo** — paket `@project/shared` (tipe yang backend publish) + `docs/architecture_auto.md`. BUKAN dari chat AI backend (sesi terpisah).

**Q: Kalau frontend salah pakai kontrak (mis. lupa parameter)?**
A: Langsung **error saat build** — ketahuan otomatis, bukan nunggu rusak di production.

**Q: Staff non-programmer beneran bisa semua ini?**
A: Ya untuk *menjalankan* (ngomong → AI eksekusi). Untuk *menilai benar/aman* (peran senior + owner-gate) butuh penilaian yang tumbuh seiring waktu — dan kit kasih jaring pengaman supaya kesalahan ketangkap sebelum ke production.

---

## 10. Cara pakai

**Owner (sekali setup):** ikuti [CROSS_REPO_TYPES_PIPELINE.md](CROSS_REPO_TYPES_PIPELINE.md) untuk pasang pipeline auto (2-3 jam, lalu zero-maintenance) + [MCP_SETUP.md](MCP_SETUP.md) §2.6b untuk tiering DB.

**Staff (harian):** buka Claude Code di repo-mu → ngomong maksud pakai bahasa biasa → AI yang kerjakan + jaga aturan (branch, test, PR, serah-terima). Kalau bingung istilah, AI jelaskan pakai analogi.
