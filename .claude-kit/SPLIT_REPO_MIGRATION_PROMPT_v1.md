# Split Repo Migration Prompt - lintasAI v1.10.0 (🧪 BETA - belum diuji end-to-end di GitHub nyata)

> **Ini Tangga Refactor TINGKAT 3 (Repository Split / Polyrepo)** — tingkat paling berat. Default kit = **Tingkat 1 (Refactoring di tempat)**; naik ke sini **bertahap** (pola Strangler Fig), hanya saat modul sudah matang + butuh tim/akses(IP) terpisah. Lihat "Tangga Refactor 3-Tingkat" di `LINTASAI_WORKFLOWS_v1.md` §4.2.
>
> **Paste ke Claude Code di project monolithic kamu** untuk migrate jadi multi-repo.
> Ada **2 bentuk split** — pilih dulu di "Mode Selector" di bawah: **[1] per-Lapisan (2-3 repo)** atau **[2] per-Kapabilitas (jumlah ikut wilayah rahasia + tim)**. **Jumlah repo = ikut kebutuhan, BUKAN angka tetap** — sumber tunggal keputusan topologi: `docs/plans/POLA_REPO_AMAN.md` (jangan salin angka dari sini).
> Goal: TRUE READ isolation untuk business logic, foundation untuk scale 3-30+ staff.
> Effort: 4-6 minggu owner (otomatis dengan AI).
>
> **Note:** <project>-tools sebagai repo terpisah cuma kalau team grow >20 staff atau compliance audit. Default: scripts di backend/scripts/.

---

## Mode Selector — pilih BENTUK split (WAJIB tanya di awal, JANGAN asumsikan 3 repo)

Heavy-refactor / split repo punya **2 bentuk**. AI WAJIB tampilkan pilihan ini dulu (popup Tipe A — **kotak klik** `AskUserQuestion` kalau tersedia, blok teks = isi + fallback; aturan untuk SEMUA popup di file ini: `JALANKAN_KIT.md` > "Cara Tampil Popup", termasuk aturan opsi-AMAN-pertama untuk popup berisiko), sebelum analisa apa pun:

```
Mau memecah (split) project jadi beberapa repo — tempat simpan kode terpisah di GitHub — dengan bentuk yang mana?

  [1] Split per-Lapisan (2-3 repo) — "layered / per-tier split"   ⭐ DEFAULT (rekomendasi — paling murah dirawat, pola kebanyakan tim)
      Bagi per LAPISAN teknis: <base>-frontend (tampilan) / <base>-backend (logika+data) + <base>-shared (tipe bersama, OPSIONAL — boleh skip jadi 2 repo; lihat POLA_REPO_AMAN Model 1).
      Cocok: 1 aplikasi yang mau dipisah tampilan / logika+data.
      Paling murah dirawat. Ini pola kebanyakan tim.

  [2] Split per-Kapabilitas (jumlah repo IKUT wilayah rahasia + tim, bukan angka tetap) — "capability split" (istilah teknis: bounded-context dari DDD / Domain-Driven Design — membagi per wilayah bisnis yang berdiri sendiri)
      Bagi by KAPABILITAS BISNIS: <base>-dashboard / <base>-shared / <base>-core /
      <base>-<kapabilitas> x N (mis. bigseo-data-domain, bigseo-seo-intel, bigseo-pbn).
      Cocok: PLATFORM dengan beberapa kapabilitas berbeda yang JELAS + mau isolasi
      tim/IP (kekayaan intelektual — resep rahasia bisnis) per-kapabilitas + gabung banyak dashboard lama jadi 1 dashboard.

Default (Enter/kosong) -> [1] Split per-Lapisan
```

### Aturan keras (berlaku walau pilih [2])
- **[1] adalah default.** Pilih **[2] HANYA kalau** ADA bounded context yang jelas **sekarang** (kapabilitas bisnis yang benar-benar beda) **DAN** butuh isolasi tim/IP per-kapabilitas. **Ragu → [1].** (Lihat "Berapa repo cukup" di bawah — lebih banyak repo TIDAK otomatis lebih aman.)
- **[2] = microservice VARIAN SHARED-DATABASE (coarse-grained), BUKAN microservice MURNI.** Ini "beberapa layanan kasar": tiap repo = 1 kapabilitas + laci-data (schema) sendiri + loket API. Tetap **multi-repo + multi-schema (1 DB bersama)**, BUKAN event-bus / service-mesh / saga / database-per-service. (Faktor ribet microservice murni = bagian terpisah di bawah.)
- **Isolasi IP sama untuk dua mode**: repo PRIVATE + akses per-staf seminimal mungkin + logika rahasia di backend. Mode [2] **tidak** lebih aman karena jumlah repo — ia cuma memetakan repo ke kapabilitas + tim.
- **Mulai kecil tetap berlaku.** Walau pilih [2], BOLEH mulai dengan `core + shared + dashboard` + tiap kapabilitas sebagai **FOLDER** (laci-data sudah dipisah sejak awal), lalu **"lepas" jadi repo** saat trigger menyala (backend kapabilitas itu **>500 file** ATAU **>50 model** — lihat "Further-Split Triggers"). Schema dipisah dari awal → pelepasan nanti = **pindah kode, bukan pindah data**.

### Penamaan standar (professional)
| Bentuk | Istilah standar | Pola nama repo |
|---|---|---|
| **[1] per-Lapisan** | *layered split / per-tier (n-tier)* | `<base>-frontend`, `<base>-backend` (+ `<base>-shared` opsional → boleh 2 repo) |
| **[2] per-Kapabilitas** | *capability split / bounded-context polyrepo (DDD)* | `<base>-dashboard`, `<base>-shared`, `<base>-core`, `<base>-<kapabilitas>` (mis. `bigseo-data-domain`) |

### Kalau pilih [2] — peta pola (ringkas)
- **`<base>-shared`** = kamus bersama (tipe/kontrak + helper murni, TANPA rahasia, tidak di-run). Sama untuk dua mode.
- **`<base>-core`** = layanan auth + users + accounts (laci-data `core`). Satu-satunya yang MEMUTUSKAN login.
- **`<base>-dashboard`** = 1 layar terpadu + lapisan penghubung (BFF) yang memanggil loket tiap layanan. BFF dibatasi owner/lead (CODEOWNERS).
- **`<base>-<kapabilitas>`** (×N) = tiap kapabilitas bisnis = 1 repo backend + laci-data sendiri + loket API berbentuk seragam. Resep rahasia tinggal di sini, tidak pernah keluar loket (kirim "daftar putih" kolom saja).
- **Peta lengkap topologi + tabel kartu-akses database (siapa boleh baca/tulis schema mana) = `docs/plans/POLA_REPO_AMAN.md`** — AI **WAJIB membacanya** sebelum eksekusi Mode [2], supaya pembagian schema benar (engine rahasia tidak numpuk di 1 repo).
- Selebihnya (idempotency guard, marker `.split-state`, triggers, langkah migrasi di bawah) **berlaku untuk DUA mode** — tapi yang BEDA **bukan cuma jumlah & nama repo, melainkan juga letak schema database**: Mode [1] menaruh seluruh `prisma/` di `shared`; Mode [2] **memisah schema per-kapabilitas** (tiap engine simpan schema-nya sendiri; `shared` TANPA schema; dashboard/frontend NOL DB). Lihat Step 0.4 "Letak schema database — TERGANTUNG MODE".

## Berapa repo cukup + melindungi bisnis (IP) dari duplikasi

**2-3 repo (backend + frontend, `shared` opsional) CUKUP untuk hampir semua kasus.** JANGAN tambah repo cuma "biar aman" — lebih banyak repo **TIDAK melindungi bisnis**, malah nambah ongkos (sinkron versi, koordinasi, lebih banyak tempat yang harus diamankan). Tambah repo HANYA kalau ada kebutuhan nyata (mis. layanan benar-benar terpisah + tim sangat besar).

**Takut bisnis diduplikasi/dicopy? Lebih banyak repo BUKAN jawabannya.** Copy itu soal **siapa punya AKSES**, bukan jumlah repo. Yang benar-benar melindungi:

1. **Logika rahasia WAJIB di backend (server), JANGAN di frontend.** Kode frontend SELALU bisa dilihat siapa pun yang buka app (lewat browser DevTools). Rahasia bisnis (cara hitung harga, algoritma) taruh di backend — sumbernya tidak pernah dikirim ke user. Split sudah membantu: frontend tidak dapat kode server/DB.
2. **Repo PRIVATE + akses seminimal mungkin.** Staff frontend cuma diberi akses repo frontend (tidak bisa clone backend). **Inilah perlindungan IP nyata dari split** — bukan jumlah repo. Kontraktor/staff yang cuma pegang frontend tidak bisa menyalin logika backend.
3. **Lisensi PROPRIETARY** ("Hak Cipta Dilindungi" / All Rights Reserved, BUKAN open-source MIT) untuk kode bisnis = perisai HUKUM (bisa menuntut kalau dicopy), bukan pencegah teknis.
4. **NDA / kontrak kerja** dengan staff (apalagi puluhan orang) = perlindungan hukum nyata kalau ada yang membocorkan.

> Ringkas: **3 repo + PRIVATE + akses seminimal mungkin + logika rahasia di backend + lisensi proprietary + NDA.** Itu jauh lebih melindungi daripada "banyak repo". Menambah repo = menambah ongkos & permukaan serang, bukan keamanan.

### Kalau memang perlu kelola BANYAK repo terpisah (+ atur akses per-repo)

Konsisten dengan poin di atas: yang melindungi = **siapa punya AKSES**, bukan jumlah repo. Kalau kamu punya beberapa **kelompok yang tidak boleh saling melihat** (mis. 3-5 orang inti boleh lihat backend+DB; ~40 staff cuma repo fitur), pisahkan repo **mengikuti batas-akses itu** lalu tegakkan izin clone per repo. Alatnya:
- **Buku Induk** `lintasai-portfolio.yml` (+ `PORTFOLIO_REGISTRY_v1.md`) — catat tiap repo + siapa boleh akses.
- **Kontrol-akses** `ACCESS_CONTROL_NREPO_v1.md` — ubah Buku Induk jadi izin clone GitHub nyata (mode cetak-rencana; owner yang eksekusi).

> **Tetap berlaku:** jumlah repo **ikut jumlah batas-akses nyata**, BUKAN angka target. 6-10 repo sah HANYA kalau ada 6-10 kelompok terpisah; kalau cuma 2 kelompok, 2-3 repo cukup.

---

## Idempotency guard - Post-Split Detection (WAJIB di awal)

Sebelum analyze atau propose, AI WAJIB run `Test-PostSplitState -ProjectRoot $PWD` (dari `lib/project-detect.ps1`) untuk cek apakah project sudah pernah split:

- **Layer 1 (paling reliable)**: marker file `.claude-kit/.split-state` exist → IsPostSplit = true.
- **Layer 2**: `AGENTS.md` mention "post-split" / "multi-repo coordination" / "sister repo:" / "cross-repo types pipeline" → IsPostSplit = true.
- **Layer 3**: sibling folder `../<project>-frontend|backend|shared|web|api|ui|server` exist → IsPostSplit = true.

**Kalau IsPostSplit = true** → AI WAJIB STOP execute migration ulang. Tampilkan:

```
Project ini SUDAH PERNAH dipecah jadi beberapa repo (terdeteksi lewat penanda ke-<layer>).
Repo pasangannya: tampilan (frontend)=<path>, mesin (backend)=<path>, bersama (shared)=<path>

Aksi yang VALID dari sini:
  [1] Cek apakah perlu dipecah LEBIH LANJUT (kalau repo backend > 500 file, atau cetakan tabel data / Prisma model > 50)
  [2] Cek apakah perlu DIGABUNG balik jadi satu (kalau jumlah staff turun >50% dalam 6 bulan, atau >5 kali/minggu satu perubahan harus dibarengkan di beberapa repo)
  [3] Stop, owner review dulu (default, safe choice) (rekomendasi — paling aman, tidak mengubah apa pun sampai owner cek dulu)
Default (Enter/kosong) -> [3] Stop
```

JANGAN auto-execute migration ulang — fail-closed default.

### Marker file format (.claude-kit/.split-state)

Setelah split sukses, AI WAJIB tulis marker:

```yaml
split_date: 2026-06-08
role: backend          # daftar TERBUKA: backend | frontend | shared | dashboard | service | tools
base_name: akses
access_tier: sensitive # opsional: sensitive | feature | shared (sejalan Buku Induk)
portfolio_ref: ../akses-meta/lintasai-portfolio.yml  # opsional: link ke Buku Induk kalau kelola banyak repo
sibling_repos:
  frontend: ../akses-frontend
  shared: ../akses-shared
split_migration_doc: docs/decisions/2026-06-08-split-repo-migration.md
```

> Catatan: `role` adalah **daftar terbuka** (bukan cuma 3). Untuk mengelola **banyak repo terpisah** + atur akses per-repo, isi `portfolio_ref` ke **Buku Induk** (`lintasai-portfolio.yml`) — lihat `PORTFOLIO_REGISTRY_v1.md` + `ACCESS_CONTROL_NREPO_v1.md`.

---

## Further-Split Triggers (Post-Split Lifecycle)

Setelah project sudah split, AI WAJIB nawarin further-split kalau salah satu trigger fire:

1. **Backend repo file count > 500** + multiple subdomain folders (api/ + worker/ + cron/ + queue/) → suggest split per subdomain (api-server, worker-server, cron-jobs).
2. **Frontend repo punya 2+ platform folders** (web/ + mobile/ + admin/ + dashboard/) → suggest split per frontend platform.
3. **Backend Prisma schema model count > 50** + clear bounded contexts (auth/, billing/, inventory/) → suggest microservice extraction per bounded context.
4. **Shared repo > 100 files** atau > 30 exported types + version churn > 10 commits/week → suggest split per concern (shared-types, shared-utils, shared-ui).
5. **CI build time > 15 min** atau test suite > 30 min → suggest split (build performance pressure).

## Re-Merge Triggers (Kalau Split Hurts Velocity)

Default: skip diam-diam. Kalau salah satu trigger fire, AI suggest re-merge ke monorepo:

1. **Staff drop > 50% in 6 months** (mis. 6 → 2 staff) → coordination overhead lebih mahal dari isolation benefit.
2. **Cross-repo PR coordination > 5/week** (FE PR + BE PR + Shared PR coupled per feature) → split hurts velocity.
3. **Shared package version bump > 3/week** → integration friction terlalu tinggi.

---

## Yang akan saya (AI) lakukan setelah kamu paste prompt ini

1. **Analyze project structure** kamu sekarang:
   - Detect: Next.js (full-stack monolith)? Other stack?
   - Inventory: berapa lib file, API route, component, prisma model
   - Identify: which file = UI (frontend), which = business logic (backend), which = types (shared); ops scripts default ke backend/scripts/
   - Estimate: total LOC per kategori, complexity score, dependency graph

2. **Propose detailed migration plan**:
   - 3 repo target name + content map per repo
   - Migration timeline (minggu 1-6)
   - Risk + rollback strategy
   - Tools yang perlu di-setup (Swagger, Storybook, dst)
   - Cost impact (Vercel, GitHub Package, dst)

3. **Wait konfirmasi owner** sebelum eksekusi.
   Pilihan:
     [1] Ya, jalankan SEMUA langkah migrasi sekarang
     [2] Tidak, berhenti dulu — simpan rencananya ke docs/migration-plan-draft.md (default, safe choice) (rekomendasi — paling aman, cuma menyimpan rencana, belum mengubah/memindah berkas apa pun)
     [3] Ubah dulu — owner sesuaikan pembagian file (mapping) atau jadwalnya dulu
   Default (Enter/kosong) -> [2] Tidak, simpan rencana dulu untuk review

4. **Execute migration step-by-step**:
   - Create 3 GitHub repo (panduan manual + verify)
   - Extract code ke repo masing-masing
   - Setup @<project>/shared package
   - Setup Swagger di backend
   - Setup AGENTS.md per repo (template dari lintasAI)
   - Setup deployment pipeline (Vercel x2 + GitHub Package npm)
   - Verify dengan smoke test
   - Update CODEOWNERS + tier mapping

5. **Generate transition doc untuk staff**:
   - Cheatsheet prompt non-programmer
   - Owner playbook ongoing
   - Cross-team coordination guide

---

## Pre-requisite (Yang Owner Siapkan Sebelum Paste)

- [ ] Project mature (sudah ada code real, bukan boilerplate fresh Next.js)
- [ ] Sudah pakai lintasAI v1.0.0+ (cek .claude-kit/CHANGELOG.md)
- [ ] Sudah hire 3+ staff (atau planning untuk hire)
- [ ] Mau invest 4-6 minggu time
- [ ] Backup repo current (git tag pre-split-backup)
- [ ] Punya akses owner ke GitHub org (untuk bikin 3 repo private)
- [ ] Punya akses Vercel (atau platform deploy lain) dengan slot project minimal 2
- [ ] CI/CD current di-pause atau di-freeze selama migration

---

## Yang Saya Butuhkan Sebelum Mulai

Sebelum jalankan migration, saya akan tanya:

1. Nama project kamu apa? (untuk pola penamaan repo: <project>-frontend, dst)
2. GitHub username owner: ojokesusu atau lain?
3. Berapa staff total saat ini? Berapa Backend Staff (yang punya akses backend)?
4. Teknologi dasar (stack) project saat ini: Next.js? Atau lain?
5. Bagian tampilan (frontend) baru pakai apa? (Next.js mode satu-halaman/SPA / React Vite / lain)
6. Bagian mesin/server (backend) baru pakai apa? (Next.js mode API / Hono / Express / lain)
7. Database: Supabase, atau lain?
8. Tools yang mau di-setup: pilih dari list (Swagger, Storybook, Playwright, webhooks, Sentry, dst)

Tambahan opsional yang membantu (boleh skip kalau belum tahu):
- Apakah ada kunci rahasia (secret / isi file .env) yang TIDAK boleh bocor ke repo tampilan (frontend)? (sebutkan kata kuncinya)
- Apakah ada module legacy yang TIDAK akan di-migrate (usang / tidak dipakai lagi)?
- Target tanggal tayang (deploy)? (biar jadwal bisa dihitung mundur dari tanggal itu)

---

## Stage 0 — Quick Split Prep (v1.5.13+ NEW, untuk Tier A popup POST_SETUP Poin #5)

> v1.5.13 owner directive 2026-06-08: "file nya tidak akan bisa di push ke [project]-backend, [project]-frontend, [project]-shared, aku maunya file tersebut telah di persiapkan atau di pisah2kan filenya, sehingga kalau sudah di pisahkan maka tinggal push ke github repo nya terpisah2 itu"

**Stage 0 = LITE version yang AI execute dalam 1 sesi** (bukan full 4-6 minggu workflow). Output: **sibling folder siap push ke GitHub repo terpisah** (Mode [1] = 3 folder; Mode [2] = N folder per-kapabilitas — lihat Step 0.3). Monolith original di-preserve sebagai fallback (COPY, bukan MOVE).

> **Catatan mode (penting):** langkah Step 0.x di bawah ditulis dengan **Mode [1] (3-repo per-Lapisan) sebagai contoh default**. Perbedaan untuk **Mode [2] (per-Kapabilitas / microservice varian shared-DB)** ditandai inline di **Step 0.3** (set folder), **Step 0.4** (letak schema — paling kritis untuk keamanan engine rahasia), dan **Step 0.4b** (denah DB). Kalau owner pilih Mode [2], AI **WAJIB baca `docs/plans/POLA_REPO_AMAN.md` dulu** + ikuti cabang Mode [2] di tiap step (jangan default ke "semua `prisma/` → shared").

### Stage 0 Workflow (~30-60 menit AI execute)

**Step 0.1 — Backup safety net** (selalu first):
- Snapshot project state ke `<parent>/<project>-pre-split-backup-<timestamp>/`
- Idempotency guard: cek `.claude-kit/.split-state` marker (kalau exist → STOP, sudah pernah split)

**Step 0.2 — Auto-detect boundary** (read-only):
- Scan struktur project: backend marker (api routes), frontend marker (components/dashboard/pages), shared marker (prisma, lib/auth, types)
- Lapor ringkasan ke owner: "Terdeteksi: N file mesin (backend), M file tampilan (frontend), K file bersama (shared)"

**Step 0.2b — Tawaran refactor-ringan SEBELUM pecah (v1.6.8 NEW — lintas-divisi)**:
- **Kenapa di sini**: memecah monolith yang berantakan = menyalin kekacauan ke 3 repo (3x lebih susah dirapikan nanti). Rapikan yang TERPARAH dulu → pecah dari dasar yang lebih bersih.
  > 🏢 Analogi: buang barang rusak/dobel SEBELUM pindah ke 3 ruko — jangan boyong sampah ke 3 tempat.
- **AI audit cuma-baca LINTAS-DIVISI** (read-only): pakai `templates/REFACTOR_STANDARD.md` v2 (tabel 11 divisi: Backend/Frontend/Database/DevOps/Security/UI-UX/Web Design/QA/SEO-Performa/ML-AI/Arsitektur). Cari worst offenders: file raksasa (>300 baris), komponen dobel, rahasia di kode, query berulang (N+1), validasi tersebar, sisa konversi (mis. html→nextjs), **sambungan nyampur (frontend colok LANGSUNG ke database/backend — bukan lewat loket/API; ini biang #1 yang bikin split putus untuk monorepo bikinan AI)**. Beri label 🔴 GENTING / 🟡 PENTING / 🟢 RAPIKAN.
- **WAJIB popup tawarkan** (Tipe A — kotak klik kalau tersedia; blok di bawah = isi kanonik + fallback teks):
  ```
  🧹 Sebelum pecah ke 3 repo, ditemukan N hal yang sebaiknya dirapikan dulu
     (terparah: <contoh, mis. 1 file 8000 baris + komponen X dibuat 4x>).

  [1] Ya, rapikan yang TERPARAH dulu (rekomendasi kalau ada 🔴/🟡 — buang kekacauan dulu, biar tidak terbawa ke 3 repo dan 3x lebih susah dirapikan nanti) — lalu baru pecah
  [2] Pecah langsung, rapikan nanti per-repo
  [skip] Pecah langsung (jangan tawarkan lagi)
  Default (Enter/kosong) -> [1] kalau ada 🔴/🟡; selain itu -> [2]
  ```
- **Kalau [1]**: jalankan refactor **RINGAN & TERARAH** (worst offenders SAJA, BUKAN rombak total) per `REFACTOR_STANDARD.md` "5 langkah aman" — konfirmasi per item + cek otomatis (test) lulus tiap langkah. SETELAH selesai + test hijau → lanjut Step 0.3.
- **Kalau [2]/[skip]**: lanjut Step 0.3; catat di laporan akhir "pembersihan ditunda ke per-repo".
- **LARANGAN**: audit = cuma-baca dulu; JANGAN refactor tanpa izin per item; JANGAN rombak total (ringan & terarah saja); JANGAN campur refactor besar dengan split (pisahkan); test sebelum & sesudah. Kalau owner tolak → JANGAN paksa, lanjut pecah.

**Step 0.2c — Cek-ulang ringan SEBELUM pecah (v1.7.0 NEW — standar profesional: re-baseline)**:
- **Kenapa WAJIB**: standar IT — sebelum perubahan BESAR (pecah-repo = migrasi susunan), selalu mulai dari "kondisi sehat yang sudah DIPASTIKAN + peta yang masih AKURAT". Memecah pakai peta basi / kondisi belum dicek = 3 repo mewarisi kekacauan (mahal diperbaiki belakangan, 3 tempat bukan 1). Ini cek **RINGAN** (bukan audit berat ketiga).
  > 🏢 Analogi: sebelum pindahan rumah, tukang nyalakan semua keran + cek denah kamar TERBARU dulu — bukan boyong barang pakai denah lama.
- **3 cek cepat** (read-only + jalankan test yang SUDAH ada — JANGAN ubah file):
  1. **Tes-asap**: 5-10 alur utama (login, buat data, cetak, hapus, cari) masih jalan + test otomatis hijau setelah refactor Step 0.2b. Ada yang rusak → balik (git revert) dulu, JANGAN pecah.
  2. **Gambar-ulang batas modul**: ULANGI deteksi boundary Step 0.2 (file pindah-pindah saat dirapikan → peta lama basi). Pakai peta BARU ini untuk distribusi Step 0.4 — bukan peta sebelum refactor.
  3. **Sambungan bersih**: pastikan frontend TIDAK impor kode server/DB langsung (harus lewat loket/API). Masih nyampur → biang yang bikin split putus; rapikan dulu (balik ke Step 0.2b [1]) ATAU lapor owner risikonya sebelum lanjut.
- **3 cek lulus** → lanjut Step 0.3. **Ada yang gagal** → JANGAN pecah; lapor owner apa yang perlu dibereskan dulu.
- **Kalau Step 0.2b di-skip** (owner pilih [2]/[skip] tanpa refactor): tetap jalankan minimal cek #1 + #3 (tes-asap + sambungan). Kalau sambungan nyampur parah → WAJIB lapor owner risikonya SEBELUM pecah, jangan diam-diam lanjut.

**Step 0.3 — Bikin sibling folder** (di parent directory) — **jumlah & isi TERGANTUNG MODE** (Mode Selector di atas):

**Mode [1] (per-Lapisan, default) — 3 folder:**
- `<parent>/<project>-backend/` — API routes + server-only code
- `<parent>/<project>-frontend/` — components + dashboard + pages
- `<parent>/<project>-shared/` — Prisma schema + cross-cutting types + auth utilities

**Mode [2] (per-Kapabilitas / microservice varian shared-DB) — N folder** (WAJIB rujuk `docs/plans/POLA_REPO_AMAN.md` "2 model" + tabel kartu-akses):
- `<parent>/<project>-core/` — auth + users + accounts (schema `core` sendiri)
- `<parent>/<project>-shared/` — HANYA tipe/kontrak + helper murni, **TANPA `prisma/`** (beda dari Mode [1])
- `<parent>/<project>-dashboard/` — 1 layar terpadu + penghubung (BFF) ke loket tiap layanan
- `<parent>/<project>-<kapabilitas>/` ×N — tiap engine/kapabilitas = 1 repo backend + **schema-nya sendiri** (mis. `<project>-data-domain` → schema `engine_data_domain`). Nama `<kapabilitas>` AUTO-DETEKSI dari fitur project (engine SEO → `-seoanalysis`; data domain → `-data-domain`).

**Step 0.4 — Distribute files via copy** (BUKAN move — monolith tetap utuh):
- Pakai `Copy-Item -Recurse` (PowerShell) atau `cp -r` (bash)
- Backend folder dapat: `src/app/api/`, `src/lib/<server-only>.ts`, server-side scripts
- Frontend folder dapat: `src/app/{dashboard,login,page.tsx,*}.{tsx,css}`, `src/components/`
- **Letak schema database (`prisma/`) — TERGANTUNG MODE:**
  - **Mode [1] (per-Lapisan):** seluruh `prisma/` → folder **shared**, + `src/lib/{auth,prisma,types,*-crypto}.ts`, `src/lib/security/`. (Aman: 1 aplikasi 1 schema; shared dibaca tim inti.)
  - **Mode [2] (per-Kapabilitas / microservice) — 🚨 JANGAN taruh seluruh `prisma/` di shared.** Itu membocorkan struktur schema **SEMUA engine rahasia** ke 1 repo yang dibaca staff luas (langgar pelindung POLA_REPO_AMAN "frontend/staff luas NOL akses struktur DB"). Sebagai gantinya **pisah schema per kapabilitas**: tiap repo `<project>-<kapabilitas>` dapat HANYA potongan schema-nya sendiri (mis. `engine_data_domain` → repo data-domain saja); `-core` dapat schema `core`/auth; `-shared` dapat **tipe/kontrak saja (TANPA `prisma/`)**; `-dashboard`/frontend dapat **NOL schema + NOL `DATABASE_URL`** (ambil data lewat loket/API). Backend-aggregator membaca beberapa schema lewat **role database per-schema** (POLA_REPO_AMAN tabel "kartu akses" + "Backend = aggregator"), BUKAN dengan menyalin semua berkas schema ke 1 repo. Detail: `docs/plans/POLA_REPO_AMAN.md`.

**Step 0.4b — Distribusi `docs/` (catatan) ke tiap folder (v1.7.2 NEW — supaya owner TIDAK pindah manual)**:
- **Prinsip**: catatan ikut OTOMATIS ke repo yang benar. Owner non-programmer tidak memindah satu file pun manual.
- **Catatan kode per-bagian** (`docs/<modul>.md` companion) → ikut kodenya ke repo yang dapat kode itu. (Untuk jalur [1] LENGKAP project matang: catatan ini **dibuat ULANG per repo** di JALANKAN_KIT Bagian 6b — tidak perlu disalin.)
- **Denah database** (`docs/db-schema.md`) — **TERGANTUNG MODE** (sejalan Step 0.4):
  - **Mode [1]:** → repo **shared** (schema tinggal di shared) + salinan ke **backend** (pemakai DB).
  - **Mode [2]:** → tiap repo kapabilitas dapat **denah schema-NYA SENDIRI saja** (bukan denah semua engine); backend-aggregator dapat denah gabungan (read-only) seperlunya untuk menyajikan; **dashboard NOL denah DB**. (Jangan kumpulkan denah semua engine rahasia di 1 repo yang dibaca luas.)
  - **JANGAN ke frontend** (frontend tak boleh tahu struktur DB — sejalan pengaman `.env`).
- **Peta besar + kamus istilah** (`docs/architecture.md`, `docs/architecture_auto.md`, `docs/glossary.md`) → tiap repo dapat **versinya SENDIRI** (dibuat-ulang/disesuaikan agar cuma menjelaskan repo itu — fokus + AI baca lebih sedikit + tidak ada yang basi). **BUKAN** 1 file induk disalin sama ke 3 (itu cepat basi + bikin staff frontend lihat isi backend yang bukan urusannya).
- **Catatan keputusan** (`docs/decisions/`) → keputusan yang relevan ikut repo terkait; keputusan "pecah-repo" disalin ke **KETIGA** repo (jejak audit).
- **PLUS bikin `docs/cross-repo-overview.md`** (peta hubungan 3-repo, **SINGKAT**: backend = API + logika DB; frontend = tampilan; shared = tipe data + denah DB sebagai paket npm; siapa depend ke siapa) → salin ke **KETIGA** repo. Singkat + stabil (topologi jarang berubah) → aman diduplikasi, dan staff non-programmer lihat gambaran besar **tanpa loncat ke repo lain**.

**Step 0.5 — Setup standalone manifest per folder**:
- `package.json` per folder (dependencies yang relevan saja per scope):
  - Backend: next, prisma client, @prisma/client, server libs
  - Frontend: next, react, ui libs (kalau pakai shadcn/ui)
  - Shared: prisma (devDep), TypeScript, type-only libs
- `tsconfig.json` per folder (path mapping ke `@shared/*` kalau pakai package npm private)
- `README.md` per folder (1-pager: "this is the [backend|frontend|shared] repo for <project>")
- `.gitignore` per folder (relevan: node_modules, .env*, build artifacts)
- `AGENTS.md` per folder. **Mode [1]:** paste dari `templates/split-agents/{BACKEND,FRONTEND,SHARED}.md`. **Mode [2] (microservice):** `BACKEND.md` (untuk `-core`/aggregator) + `SHARED.md` + `DASHBOARD.md` (ganti FRONTEND — NOL akses DB/engine) + `ENGINE.md` untuk TIAP repo `-<kapabilitas>` (algoritma rahasia + schema sendiri, DILARANG bicara langsung ke dashboard)

**Step 0.5b — Pre-provision lintasAI + `.env` aman ke tiap folder** (v1.6.0 NEW — Tahap A):
- **WAJIB ikuti `templates/SPLIT_REPO_PREPROVISION_v1.md`** untuk MASING-MASING folder: salin `.claude-kit/` lengkap (KECUALI penanda per-install: `.install-manifest.json`, `.git-identity-*`, `.split-state`, `.manifest-secret`, `.audit-log`) + bikin `CLAUDE.md` loader (`@./.claude-kit/CLAUDE_universal_v1.md` + `@./AGENTS.md`) + isi placeholder `AGENTS.md` (jangan biarkan `<NAMA_PROYEK>` mentah) + bikin `.env.example` per peran.
- **PENGAMAN KERAS**: frontend `.env.example` DILARANG punya `DATABASE_URL`/secret — hanya `NEXT_PUBLIC_*`. JANGAN salin `.env` monolith mentah ke frontend.
- Tujuan: begitu owner push, staff tinggal clone → lintasAI + aturan + dokumentasi SUDAH ADA → langsung kerja (tidak perlu "install lintasAI lagi" di tiap repo).

**Step 0.6 — Setup cross-repo type sharing strategy** (default: NPM private package):
- Shared folder = NPM private package `@<project>/shared`
- Backend + Frontend `package.json` dependency ke `@<project>/shared`
- Owner publish shared ke NPM private registry SEBELUM backend/frontend push
- Alternative: git submodule (lebih kompleks, skip default)

**Step 0.7 — Verify standalone**:
- **WAJIB jalankan robot penjaga anti-bocor per folder DULU** (deterministik, bukan cek-mata):
  `node .claude-kit/lib/split-guard.mjs --repo-root <folder>` (peran/tier auto dari `.split-state`;
  paksa dengan `--tier sensitive`/`--role frontend` kalau perlu). **Keluar-kode > 0 (GENTING) → STOP,
  jangan lapor "siap push".** Robot tak pernah mencetak nilai rahasia. Detail: `docs/split-guard.md`.
- Per folder, smoke check (checklist lengkap di `SPLIT_REPO_PREPROVISION_v1.md` > "Validasi per folder"):
  - `package.json` parse valid
  - `tsconfig.json` parse valid
  - File count masuk akal (no leftover monolith path refs)
  - **lintasAI terpasang**: `.claude-kit/CLAUDE_universal_v1.md` + `CLAUDE.md` loader ada + `AGENTS.md` placeholder terisi
  - **Frontend `.env.example` BEBAS secret** (tidak ada `DATABASE_URL`/kunci rahasia) — **ditegakkan robot `split-guard` di atas**, bukan cek-mata
  - **Catatan ter-distribusi (Step 0.4b)**: tiap repo punya `docs/architecture.md` sendiri + `docs/cross-repo-overview.md`; denah database (`db-schema.md`) ada di **shared + backend**, dan **TIDAK** di frontend
  - Tidak ada penanda per-install monolith yang ikut tersalin
- Tulis marker `.claude-kit/.split-state` di MASING-MASING folder hasil pecah dengan role (backend/frontend/shared), **DAN tulis penanda ringan di monolith INDUK** (`.claude-kit/.split-state` role:source / `split_done`) supaya guard idempotency (`Test-PostSplitState` Layer 1 yang membaca `$PWD` = monolith) benar-benar menyala kalau di-run ulang dari dalam monolith — jangan cuma andalkan deteksi nama folder sibling (Layer 3) yang mudah berubah saat folder di-rename.
- Kalau salah satu cek gagal → JANGAN lapor "siap push"; lapor folder mana + apa yang kurang

**Step 0.8 — Lapor ke owner**:
- Output ringkasan: "3 folder pendamping sudah disiapkan di `<parent>/<project>-{backend,frontend,shared}/`. Langkah owner berikutnya:"
  - `cd <parent>/<project>-shared && npm publish` (terbitkan/publish paket shared dulu ke gudang paket npm)
  - `cd <parent>/<project>-backend && git init && git remote add origin https://github.com/<owner>/<project>-backend.git && git push -u origin main`
  - Idem untuk frontend
  - Setelah 3 repo aktif + sudah dicek, owner bisa putuskan: simpan project lama (monolith) sebagai cadangan, atau hapus

### Stage 0 LARANGAN

- ⚠️ AI **TIDAK BOLEH execute Stage 0 tanpa popup konfirmasi** owner (irreversible — file duplication di disk).
- ⚠️ AI **TIDAK BOLEH MOVE** file dari monolith — selalu COPY supaya monolith tetap utuh sebagai fallback.
- ⚠️ AI **TIDAK BOLEH push** ke GitHub repos — owner manual via `git push` per folder.
- ⚠️ AI **TIDAK BOLEH publish** ke NPM private — owner manual `npm publish` shared dulu.
- ⚠️ AI **TIDAK BOLEH menyalin `.env` monolith mentah ke folder frontend** — frontend `.env.example` hanya `NEXT_PUBLIC_*` (cegah kebocoran rahasia). Lihat `SPLIT_REPO_PREPROVISION_v1.md` Step [5].
- ⚠️ Refactor di **Step 0.2b = OPSIONAL + cuma-baca dulu**. AI TIDAK BOLEH refactor tanpa popup [1] + konfirmasi per item. Kalau owner pilih [2]/[skip] → langsung pecah, jangan paksa. Refactor = RINGAN & TERARAH (worst offenders saja), bukan rombak total.
- ⚠️ **Step 0.2c = cek-ulang WAJIB** sebelum pecah (tes-asap + gambar-ulang peta batas + sambungan bersih). AI TIDAK BOLEH lompat dari refactor/skip LANGSUNG ke Step 0.3 tanpa cek ini. Cek-ulang = **RINGAN** (baca + jalankan test yang ada), bukan audit berat ketiga, dan tetap **cuma-baca** (tidak ubah file).
- ⚠️ **Step 0.4b = distribusi catatan WAJIB otomatis** — jangan biarkan folder `docs/` tertinggal di monolith. Owner non-programmer tidak memindah file manual. **Frontend TIDAK dapat denah database** (`db-schema.md`) — hanya shared + backend.

### Stage 0 vs Full Workflow (Week 1-6)

| Aspek | Stage 0 Quick Prep | Full Workflow (Week 1-6 di bawah) |
|---|---|---|
| Effort | 30-60 menit AI 1 sesi | 4-6 minggu owner + AI |
| Output | 3 folder COPY-ready | 3 repo LIVE + CI/CD + staff onboarded |
| Reversible | Ya (monolith utuh) | Sebagian (Week 4+ deploy = harder) |
| Trigger | POST_SETUP Poin #5 Tier A popup | Owner brief eksplisit "full split migration" |
| AI execute | Read + Copy + Write per folder | Full lifecycle (extract, deploy, onboard, cutover) |

Stage 0 cocok untuk: dogfood test, POC, owner mau lihat hasil split dulu sebelum commit ke 4-6 minggu effort.

---

## Workflow Migration Full (Yang Saya Eksekusi untuk Owner Brief Eksplisit Full Migration)

### Week 1 - Setup Repo + Tools

**Day 1: Backup + Plan**
- `git tag pre-split-backup-<date>` di repo current
- Push tag ke origin
- Bikin doc PLAN.md di repo current (timeline + responsible)
- Snapshot DB Supabase (kalau pakai) sebagai safety net

**Day 2-3: Create 3 GitHub repo**
- Owner: bikin `<project>-frontend` (Private, invite Frontend Staff)
- Owner: bikin `<project>-backend` (Private, invite Backend Staff ONLY)
- Owner: bikin `<project>-shared` (Private, semua staff read)
- Setup branch protection: main = require PR + review
- Setup CODEOWNERS per repo (backend/scripts/ → owner-only via CODEOWNERS rule)

**Day 4-5: Setup tools per repo**
- `<project>-backend`: install Hono/Express ATAU setup Next.js API mode
- `<project>-backend`: install `next-swagger-doc` untuk auto-Swagger UI
- `<project>-shared`: setup TypeScript + tsup build
- `<project>-frontend`: clean up old API routes (move ke backend)
- Install `.claude-kit` lintasAI di tiap repo
- Bikin `AGENTS.md` per repo (template berbeda untuk frontend vs backend)

### Week 2-3 - Extract Code

**Identify per file:**

| Source path (monolith) | Target repo |
|---|---|
| `src/lib/auth`, `billing`, `security`, `encryption`, `*-crypto` | `<project>-backend` |
| `src/lib/format`, `useDebounce`, `hooks` (UI) | STAY at frontend |
| `prisma/` | `<project>-backend` |
| `src/app/api/` | `<project>-backend` (refactor as Hono route atau Next.js API) |
| `src/app/(public)/`, `dashboard/` UI | `<project>-frontend` |
| `src/components/` | `<project>-frontend` |
| TypeScript types shared | `<project>-shared` |
| Scripts ops (`scripts/*.ts` audit, migration, cron) | `<project>-backend/scripts/` (owner-only via CODEOWNERS) |
| `.github/workflows/*` | Split per repo |

**Refactor imports:**

```ts
// SEBELUM (monolith)
import { OrderType } from '@/lib/types'
import { db } from '@/lib/db'

// SESUDAH frontend
import { OrderType } from '@<project>/shared'
const data = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders`)

// SESUDAH backend
import { OrderType } from '@<project>/shared'
import { db } from './db'
```

**API Route Pattern (Decision Point):**

> Catatan internal AI (JANGAN ikut ditampilkan ke user): per RULE-4b (CLAUDE_universal_v1.md Section 14.1) — opsi yang disarankan WAJIB di posisi [1] supaya staff yang tekan Enter langsung ikut rekomendasi. Detail penjelasan tiap opsi ada di dalam blok di bawah.

```
Pilihan arsitektur:
  [1] Frontend Shell Wrapper — pintu penerus tipis di sisi tampilan (rekomendasi, default — kerja ±2x lebih cepat + rahasia tetap aman di backend) ⭐ DEFAULT
  [2] Pure SPA — tampilan benar-benar terpisah, semua data diminta langsung ke server backend
Default (Enter/kosong) -> [1] Frontend Shell Wrapper

---

[1] Frontend Shell Wrapper — pintu penerus tipis di sisi tampilan (rekomendasi, default — kerja ±2x lebih cepat + rahasia tetap aman di backend)

Frontend tetap punya app/api/ berisi "pintu penerus" 3 baris yang meneruskan permintaan ke backend:
  // frontend/src/app/api/orders/route.ts
  import { handleOrdersList, handleOrdersCreate } from '@<project>/backend-client'
  export const GET = handleOrdersList
  export const POST = handleOrdersCreate

Kelebihan:
- Tetap dapat fitur cepat Next.js (Server Action) — kerja ±2x lebih cepat
- Rahasia aman: logika di @<project>/backend-client dikirim dalam bentuk sudah "dimasak" (hasil kompilasi/compiled JS), bukan resep mentah (kode sumber TypeScript)
- Tipe data (TypeScript types) nyambung otomatis
- Pola standar aplikasi SaaS besar (Linear, Notion)

Kekurangan:
- Sedikit dobel (alamat loket/route ditulis di 2 tempat)

> 🔒 **WAJIB (cegah IDOR = ganti ID di URL untuk curi data orang lain):** validasi input + otorisasi per-resource SELALU di **backend** (handler asli `handleOrdersList` dst, pakai identitas server-side terverifikasi) — shell wrapper frontend HANYA meneruskan, JANGAN PERNAH menaruh keputusan akses di frontend. Kalau tidak, permintaan user A bisa membuka data user B. Selaras `LINTASAI_WORKFLOWS_v1.md` §4.13 Backend + §8.

---

[2] Pure SPA — tampilan benar-benar terpisah, semua data diminta langsung ke server backend

Frontend sama sekali tidak punya app/api/. Semua permintaan data langsung ke alamat server backend.

Kelebihan:
- Pemisahan benar-benar total
- Tidak ada alamat loket dobel

Kekurangan:
- Kehilangan fitur cepat Next.js (Server Action)
- Perlu setelan izin akses lintas-alamat (CORS)
- Kerja harian sedikit lebih lambat
```

**Update package.json:**
- Frontend: tambah `@<project>/shared` as dep
- Backend: tambah `@<project>/shared` as dep
- Backend: tambah `next-swagger-doc` atau equivalent
- Backend scripts (di `backend/scripts/`): minimal deps (tsx, zod, supabase client) - share package.json backend

### Week 4 - Deploy Pipeline

- Vercel project baru untuk frontend (`<project>-frontend`)
- Vercel project baru untuk backend (`<project>-backend`) - atau Railway/Render kalau Hono
- GitHub Package untuk `@<project>/shared` (atau private npm)
- Environment vars:
  - Frontend: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_*` only
  - Backend: `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, secrets, dst
  - Shared: TIDAK ada env
- Setup CI/CD per repo (GitHub Actions: lint, typecheck, test, deploy)
- Setup preview deployment per PR

### Week 5 - Onboard Staff

- Brief staff dengan cheatsheet (deploy `SPLIT_REPO_NON_PROGRAMMER_PROMPTS.md`)
- Migrate `.staff-profile.md` per laptop:
  - Frontend Staff: clone `<project>-frontend` + `<project>-shared`
  - Backend Staff: clone `<project>-backend` + `<project>-shared`
- Test workflow: backend tim build API endpoint baru, frontend tim consume via Swagger doc
- Setup Slack/chat channel cross-repo coordination
- Train staff hit endpoint backend dengan `curl` atau Postman

### Week 6 - Smoke Test + Cutover

- E2E test full flow (login → action → DB write → read)
- Switch DNS/Vercel ke split deployment
- Monitor 1 minggu: error rate, latency, build success rate
- Decommission monolithic repo (archive di GitHub, BUKAN delete)
- Update dokumentasi external (README publik, status page, dst)

---

## Workflow Auto-Push 3 Repo dari Monolith

### Pre-Migration (Owner Manual)

Owner pre-buat 3 repo di GitHub (5 menit):

1. github.com/new → Create:
   - Name: <project>-frontend
   - Visibility: Private
   - DO NOT add README, .gitignore, atau license (truly empty)
2. Repeat untuk <project>-backend dan <project>-shared

Invite collaborator sesuai role:
- frontend: 4 Frontend Staff + 2 Backend Staff + owner
- backend: 2 Backend Staff + owner
- shared: 6 staff (read) + owner (write)

### Migration Execution (AI Auto-Push)

User paste prompt ke Claude Code:

```
Migrate <project> ke split repo. Repo URL:
- Frontend: https://github.com/<owner>/<project>-frontend
- Backend: https://github.com/<owner>/<project>-backend
- Shared: https://github.com/<owner>/<project>-shared
```

AI execute (otomatis, tanpa konfirmasi step-by-step):

1. Analyze project current (auto-detect via STACK_DETECTION_PATTERN.md)

2. Generate file mapping (berdasarkan role system):
   - File Backend grade → backend
   - File Frontend UI → frontend
   - Types → shared

3. Create 3 temp folder lokal:
   - C:\temp\<project>-split\<project>-frontend\
   - C:\temp\<project>-split\<project>-backend\
   - C:\temp\<project>-split\<project>-shared\

4. Per temp folder:
   - Copy files berdasarkan mapping
   - Generate package.json, tsconfig.json, AGENTS.md per repo (dari template split-agents/)
   - Generate .gitignore standard
   - git init
   - git branch -M main
   - git add .
   - git commit -m "initial commit from <project> monolith split"
   - git remote add origin <URL>
   - git push -u origin main

5. Output report:
   ```
   Migrasi selesai. 3 repo sudah terkirim ke GitHub:
   - https://github.com/<owner>/<project>-frontend (95 files)
   - https://github.com/<owner>/<project>-backend (28 files)
   - https://github.com/<owner>/<project>-shared (13 files)

   Next steps:
   1. Pasang penayangan (deploy) di Vercel untuk frontend + backend (panduan di SPLIT_REPO_TOOLS_SETUP.md)
   2. Cek undangan akses staff di masing-masing repo
   3. Brief staff dengan SPLIT_REPO_NON_PROGRAMMER_PROMPTS.md
   ```

6. Ask: "Mau pertahankan folder sementara (temp) C:\temp\<project>-split\ sebagai cadangan?
   Pilihan:
     [1] Ya, simpan folder + arsipkan (nonaktifkan tanpa hapus) repo asli <project> (rekomendasi, default — jaring pengaman cadangan, tidak ada yang dihapus permanen)
     [2] Tidak, hapus folder sementara
   Default (Enter/kosong) -> [1] Ya, simpan cadangan"

### Pre-Requisite Checks

AI verify sebelum mulai:
- [ ] 3 repo URLs accessible (HTTP 200 ke API GitHub)
- [ ] Owner punya write permission di 3 repo
- [ ] 3 repo TRULY empty (no commits)
- [ ] Local Git installed
- [ ] GitHub credentials setup (gh auth status)
- [ ] Working tree clean (no uncommitted changes)

Kalau ada gagal, AI lapor + minta owner fix dulu.

### Rollback Plan

Kalau migration error di tengah:
1. Temp folders preserve (tidak auto-delete saat error)
2. Original monolith repo TIDAK ke-modify
3. 3 repo baru bisa di-reset:
   - github.com/<owner>/<repo>/settings → Delete repository
   - Atau: bikin ulang dari scratch
4. Owner cuma kehilangan 4-6 jam effort, no data loss

### Estimasi Effort

| Step | Effort |
|---|---|
| Owner pre-buat 3 repo | 5 menit |
| Owner paste prompt | 30 detik |
| AI execute (file copy + push) | 30-60 menit |
| Owner review + verify | 15 menit |
| **Total** | **~1.5 jam** |

---

## Penting: Reversibility

Kalau setelah migration berasa tidak suit:
- 3 repo masih ada di GitHub (private, bisa di-restore)
- Repo lama (monolith) di-archive, BUKAN dihapus (cuma archive)
- Bisa re-merge balik ke monolith dalam 1-2 minggu kalau perlu
- DB tetap sama (Supabase shared), tidak ada data loss risk
- Vercel project lama bisa di-pause (tidak hapus), revert dengan rebuild

**Rollback procedure (kalau Week 5-6 fail):**
1. Pause Vercel project frontend + backend baru
2. Re-deploy Vercel project monolith dari tag `pre-split-backup-<date>`
3. Update DNS balik ke monolith
4. Brief staff: "kembali ke workflow lama, debrief root cause minggu depan"
5. 3 repo split tetap di GitHub (jangan hapus) untuk forensic + retry

---

## Cara Pakai Prompt Ini

1. Pastikan kamu di project root (yang sudah pakai lintasAI v1.0.0+)
2. Verify `git status` clean (commit semua WIP dulu)
3. Copy SEMUA isi file ini dari header sampai akhir
4. Paste ke chat Claude Code
5. AI akan analyze project + tanya 8 pertanyaan kamu
6. Jawab pertanyaan, AI generate plan + minta konfirmasi
7. Konfirmasi lewat popup ([1] Ya / [2] Tidak / [3] Ubah dulu), AI kerjakan langkah-demi-langkah
8. Owner review + verify per minggu (cek doc weekly-checkpoint.md yang saya generate)

---

## FAQ

**Q: Skala project saya kecil (cuma 2 staff), perlu split?**
A: Tidak. Pakai monorepo + CODEOWNERS sudah cukup. Split repo make sense untuk 3+ staff + mau privacy code business logic.

**Q: Bisakah skip beberapa step?**
A: Migration tools (Swagger, Storybook) bisa skip awal, tambah belakangan. Tapi 3 repo setup wajib (frontend + backend + shared). Tools/scripts ops default ke `backend/scripts/` - naik ke repo terpisah cuma kalau team >20 staff atau compliance audit.

**Q: Apa kalau gagal di tengah?**
A: Tag `pre-split-backup` masih ada. Rollback dengan `git reset` + delete 3 repo baru (atau archive). Tidak ada damage permanent ke production karena DB shared.

**Q: Vercel cost naik?**
A: Free tier support multiple project. Pro $20/bln cukup untuk 2-3 project. Cost increment kecil (< $20/bln tambahan).

**Q: Staff tim langsung paham?**
A: Tidak. Butuh brief 1 hari pakai `SPLIT_REPO_NON_PROGRAMMER_PROMPTS.md` cheatsheet. Setelah 1 minggu adoption, mereka familiar.

**Q: Bagaimana kalau Frontend Staff iseng curi-curi clone backend repo?**
A: GitHub repo private = Frontend Staff TIDAK ada akses (403 saat clone). Ini real READ isolation, bukan sekedar `.gitignore`.

**Q: API contract berubah, frontend break?**
A: Itu manfaat Swagger. Backend update OpenAPI spec → frontend regenerate types dari spec → TypeScript compile error muncul di frontend = early signal. Tidak perlu wait runtime error.

**Q: Shared package update, harus rebuild semua repo?**
A: Iya, tapi auto. Setup GitHub Action: shared push → trigger frontend + backend rebuild + redeploy. Atau pakai workflow_dispatch manual kalau mau lebih hati-hati.

**Q: Database migration jadi gimana?**
A: Pindah ke `<project>-backend` (yang punya akses Prisma). Frontend tidak punya Prisma sama sekali. Migration dijalankan dari backend CI/CD.

**Q: Apa kalau owner solo (tidak ada Backend Staff)?**
A: Owner pegang semua 3 repo. Split tetap berguna untuk: (1) discipline arsitektur, (2) onboarding staff masa depan, (3) ready-state untuk hire Backend Staff.

**Q: Berapa lama break-even effort 4-6 minggu ini?**
A: Tipikal: 3 bulan setelah migration, owner save 5-10 jam/minggu karena (1) staff onboarding faster, (2) review PR scope smaller, (3) build time per repo lebih cepat. Total ROI ~6 bulan.

**Q: Kalau project saya non-Next.js (misal SvelteKit, Nuxt, Remix)?**
A: AI saya akan adapt plan ke stack kamu. Konsep 3 repo + shared package + Swagger contract sama, cuma implementasi berbeda. Tanya saat pre-flight pertanyaan ke-4.

**Q: Bagaimana dengan auth (NextAuth, Clerk, Auth0)?**
A: Auth provider biasanya stay di backend (token issued by backend, frontend hanya consume session). NextAuth → migrate ke backend, frontend pakai `next-auth/react` client-side only. Clerk/Auth0 → both side perlu key (publishable di frontend, secret di backend).

---

## Risk Catalog (Yang Saya Mitigasi)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Build break karena import path salah | High | Medium | TypeScript strict + CI typecheck per PR |
| Staff bingung workflow baru | High | Medium | Cheatsheet + brief 1 hari + Slack channel |
| Swagger doc out-of-sync dengan implementasi | Medium | High | Auto-generate dari decorator/annotation, CI validate |
| Shared package version drift | Medium | Medium | Lockfile + auto-bump via Renovate/Dependabot |
| Vercel build longer karena 2 project | Low | Low | Build paralel, total time tetap sama |
| Secrets leak ke frontend repo accidentally | Low | Critical | **Ditegakkan robot deterministik** `node .claude-kit/lib/split-guard.mjs --repo-root <folder>` (Step 0.7 — GENTING > 0 → STOP; `docs/split-guard.md`): cek `.gitignore` menutup `.env` + `.env.example` repo non-rahasia bebas `DATABASE_URL`/secret + tak ada nilai rahasia asli + frontend NOL struktur DB. Tak lagi "cek manual". Penguatan tambahan opsional: salin `.github/workflows/secret-guard.yml` ke tiap repo, atau aktifkan GitHub push protection. |
| Owner kelelahan 4-6 minggu | Medium | High | Weekly checkpoint, skip-able tools, rollback option |

---

## Output Artifacts (Yang Saya Generate)

Setelah migration selesai, kamu akan punya:

1. **3 GitHub repo** dengan AGENTS.md per repo
2. **PLAN.md** di tiap repo (timeline + decisions)
3. **CODEOWNERS** per repo
4. **`.claude-kit/`** terinstall di tiap repo (lintasAI v1.0.0+)
5. **Swagger UI** di `<project>-backend/api/docs`
6. **Storybook** di `<project>-frontend/storybook` (opsional)
7. **`SPLIT_REPO_NON_PROGRAMMER_PROMPTS.md`** untuk brief staff
8. **`OWNER_PLAYBOOK.md`** untuk ongoing maintenance
9. **`CROSS_TEAM_COORDINATION.md`** untuk komunikasi frontend-backend
10. **Weekly checkpoint doc** (`docs/migration-week-N.md`) untuk audit trail

---

## Checkpoint Verifikasi (Per Minggu)

**End of Week 1:** 3 repo created, tools installed, AGENTS.md committed. Verify: `gh repo view <project>-frontend`, dst.

**End of Week 2-3:** Code extracted, imports refactored, build pass per repo. Verify: `pnpm build` di tiap repo.

**End of Week 4:** Deploy preview live di Vercel, Swagger UI accessible, smoke test endpoint OK. Verify: hit `<backend-url>/api/health`.

**End of Week 5:** Staff onboarded, first PR dari staff di split repo merge. Verify: cek GitHub activity per staff.

**End of Week 6:** Production switch, monitoring 7 hari clean. Verify: error rate < baseline, latency stabil.

---

## Penting: Komunikasi Staff

Setelah Day 1 (`pre-split-backup` tag), AI saya akan generate **announcement template** untuk kamu kirim ke staff:

```
Hi tim,

Mulai minggu depan, kita pindahkan project jadi 3 tempat penyimpanan kode (repo) terpisah:
- <project>-frontend (tampilan layar)
- <project>-backend (mesin: loket API + database + skrip operasional)
- <project>-shared (tipe data bersama)

Selama 6 minggu transisi:
- Repo lama TETAP dipakai untuk perbaikan mendesak (hotfix)
- Repo baru disiapkan berdampingan (yang lama tidak diganggu)
- Brief detail tanggal X

Tidak ada perubahan akses kalian sekarang. Akses baru setelah Week 5 brief.

Tanya kalau ada concern.

-- Owner
```

Awareness-first, bukan mendadak. Sesuai feedback policy proyek.

---

[MULAI EKSEKUSI: PASTE PROMPT INI KE CLAUDE CODE]

---

Setelah saya analyze project kamu, saya akan present plan dengan format:
- Inventory project current (berapa file, where business logic, where UI)
- Mapping target (file mana ke repo mana)
- Tools recommended berdasarkan stack
- Timeline + effort estimate
- Risks + mitigations

Tanya saja kalau ada konteks tambahan owner mau saya tahu (misal: ada module legacy, ada constraint compliance, ada deadline rilis fitur, dst).

---

**Versi prompt:** v1.10.0 (sync dengan lintasAI v1.58.0)
**Audience:** Owner project, NOT staff
**Estimated AI execution time:** 4-6 minggu (paralel dengan owner kerja normal)
**Reversibility:** Full rollback support sampai Week 6
