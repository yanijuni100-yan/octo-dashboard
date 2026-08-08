# SPLIT_REPO_PREPROVISION_v1.md — Pasang lintasAI Sekaligus ke 3 Folder Split (Tahap A)

> Versi 1 · 2026-06-10 · auto-generated (lintasAI) · dipakai AI saat Stage 0 split

## Tujuan

Untuk siapa: **AI (Claude Code)** yang menjalankan Stage 0 split-repo + **owner** non-programmer.
Masalah yang diselesaikan: setelah split jadi 3 folder, dulu staff harus **"install lintasAI lagi" di tiap repo**. Panduan ini bikin AI **memasang lintasAI lengkap + berkas pengaturan + file rahasia (aman) ke tiap folder SEKALIGUS saat split** — sehingga begitu owner push ke GitHub, **tim tinggal clone → lintasAI sudah ada di dalamnya → langsung kerja**.

> 🏢 Analogi: kayak **pindahan kantor ke 3 ruko**. Dulu: pindahin barang dulu, baru tiap ruko pasang listrik+wifi+CCTV sendiri-sendiri (ribet). Sekarang: tiap ruko **langsung datang lengkap** dengan listrik+wifi+CCTV terpasang — karyawan tinggal masuk + kerja.

## Kapan dipakai

Dipanggil otomatis oleh `SPLIT_REPO_MIGRATION_PROMPT_v1.md` **Step 0.5b** (setelah folder dibuat + file disalin, sebelum lapor ke owner). BUKAN dijalankan sendiri.

## Langkah pre-provision per folder (AI eksekusi untuk MASING-MASING: backend, frontend, shared)

Untuk **tiap** dari 3 folder (`<project>-backend`, `<project>-frontend`, `<project>-shared`):

**[1] Salin lintasAI lengkap (`.claude-kit/`)**
- COPY folder `.claude-kit/` dari monolith ke folder split (`Copy-Item -Recurse`). Ini berisi aturan tim + alat bantu.
- **JANGAN** ikut menyalin berkas yang khusus monolith: `.install-manifest.json`, `.git-identity-set`, `.git-identity-skipped`, `.split-state`, `.manifest-secret`, `.audit-log` — itu khusus per-install, harus dibuat ulang per repo (kalau ikut tersalin → identitas/penanda jadi salah/basi).

**[2] Bikin `CLAUDE.md` (pemuat aturan) di akar folder**
- Isi 2 baris pemuat: `@./.claude-kit/CLAUDE_universal_v1.md` + `@./AGENTS.md` (pakai format `CLAUDE.md.template`).
- Ini yang bikin aturan **otomatis kebaca tiap sesi** Claude Code di repo itu. Tanpa ini, staff tidak dapat aturan.

**[3] Pasang `AGENTS.md` sesuai peran**
- Backend → dari `templates/split-agents/BACKEND.md` (kuasa penuh database + DDL; di Mode [2] = repo `-core`/aggregator).
- Frontend → dari `templates/split-agents/FRONTEND.md` (cuma tampilan, TIDAK ada akses database).
- Shared → dari `templates/split-agents/SHARED.md` (cuma bentuk data, baca-saja bagi yang lain).
- **(Mode [2] microservice) Engine `<kapabilitas>`** → dari `templates/split-agents/ENGINE.md` (algoritma RAHASIA + schema sendiri; DILARANG bicara langsung ke dashboard/frontend — selalu lewat backend).
- **(Mode [2] microservice) Dashboard** → dari `templates/split-agents/DASHBOARD.md` (tampilan + BFF; NOL akses DB/engine; semua data lewat backend).
- Isi placeholder: nama proyek, tanggal, nama owner, URL repo. **JANGAN biarkan placeholder mentah** (`<NAMA_PROYEK>`) — staff bingung.

**[4] Bikin berkas pengaturan (DERIVE dari monolith, jangan nebak)**
- `package.json`, `tsconfig.json`, `.gitignore`, `README.md` per folder.
- **Cara benar:** BACA `package.json`/`tsconfig.json` monolith yang asli, lalu ambil hanya yang relevan per peran (backend: server libs + prisma client; frontend: react + ui libs; shared: typescript + tsup, prisma sebagai devDep). Ini lebih akurat daripada template generik.
- `.gitignore` per folder WAJIB berisi: `node_modules`, `.env*`, build artifacts.

**[5] Bagi file rahasia (`.env`) dengan AMAN — INI PALING PENTING**
- **JANGAN PERNAH menyalin `.env` monolith mentah ke folder mana pun yang bukan `sensitive`.** File `.env` monolith berisi rahasia (kunci database, kunci API).
- **Aturan UMUM per tingkat-sensitif (berlaku untuk BANYAK repo, bukan cuma frontend):** lihat `access_tier` repo itu — dari Buku Induk `lintasai-portfolio.yml` kalau ada, atau dari peran kalau belum:
  - **`sensitive`** (mis. `backend`, `service` berisi resep rahasia): boleh punya `.env.example` dengan `DATABASE_URL=`, kunci server, dll.
  - **`feature`** (mis. `frontend`, `dashboard`, repo tampilan): **HANYA** kunci berawalan `NEXT_PUBLIC_*` (yang memang boleh dilihat publik). **DILARANG** ada `DATABASE_URL` / kunci rahasia apa pun. Mereka ambil data lewat **API backend**, bukan colok DB langsung.
  - **`shared`** (cuma bentuk-data): `.env.example` biasanya **kosong** (tidak butuh rahasia).
- Bikin **`.env.example` per folder** (bukan `.env` asli) berisi NAMA kunci tanpa nilai, sesuai tingkat di atas.
- Pastikan `.env` asli **ter-ignore** (`.gitignore`) di tiap folder supaya rahasia tidak terbawa ke GitHub.

**[6] Tulis penanda `.claude-kit/.split-state`**
- YAML berisi: `role` (backend/frontend/shared), `base_name`, `split_date` (dari owner/args, JANGAN pakai jam sistem di skrip), `sibling_repos`.
- Penanda ini mencegah AI menjalankan split LAGI di repo yang sudah jadi.

**[7] Buat ULANG nota-pasang per repo (PENTING — supaya update & copot tidak mentok)**
- Pre-provision SENGAJA tak menyalin nota-pasang monolith (`.install-manifest.json`, `.manifest-secret` — lihat [1], biar penanda tidak basi). Akibatnya di repo hasil-pecah, perintah **update lintasAI** & **copot (uninstall)** akan **BERHENTI** karena nota itu hilang — terbukti di kode: `uninstall.mjs:246-258` (uninstall menolak lanjut: *"berkas pencatat pasang hilang"* + saran pulih) + `update-kit.mjs:505-529` (anggap pasang-baru, lewati cek versi). Ini **AMAN** (tidak merusak/crash, ada jalur pulih), TAPI bikin staff non-programmer bingung saat update/copot pertama gagal.
- **Solusi:** di TIAP repo hasil-pecah, jalankan **sekali** `npx lintasai init` supaya nota-pasang + kunci-nota dibuat ulang. Sesudah itu update & copot jalan mulus.
- AI **WAJIB sebut langkah ini ke owner** saat melapor hasil pecah — jangan biarkan staff menemukannya sendiri saat update pertama gagal. 🏢 Analogi: saat pindah rumah kamu bawa semua perabot, tapi "buku garansi" sengaja ditinggal — di rumah baru wajib cetak ulang buku garansi sekali, supaya klaim servis nanti tidak ditolak.

## Pengaman WAJIB (guardrails — supaya tanpa bug)

| Pengaman | Kenapa |
|---|---|
| **COPY, bukan MOVE** | Monorepo asli tetap utuh sebagai jaring pengaman (bisa balik kalau ada yang salah) |
| **Repo non-`sensitive` `.env.example` DILARANG punya `DATABASE_URL`/secret** (frontend/dashboard/feature) — **ditegakkan robot** `node .claude-kit/lib/split-guard.mjs` (bukan cek-mata) | Cegah kebocoran rahasia ke repo yang diakses lebih banyak orang. Robot GENTING > 0 → **STOP**, jangan lapor "siap push" |
| **Jangan salin penanda per-install** (.install-manifest.json, .git-identity-*, dll) | Cegah identitas/penanda basi yang bikin AI salah deteksi |
| **JANGAN push / publish** | Owner yang push (`git push`) + terbitkan paket bersama (`npm publish`) — keputusan manusia |
| **Validasi dulu sebelum lapor "selesai"** | Pastikan tiap folder benar-benar siap, bukan setengah jadi |

## Validasi per folder (AI cek sebelum lapor selesai)

**Langkah PERTAMA & WAJIB — jalankan robot penjaga anti-bocor (bukan "cek mata").** Pengaman rahasia
TIDAK boleh lagi bergantung pada AI ingat memeriksa teks. Untuk TIAP folder hasil-pecah, jalankan:

```bash
node .claude-kit/lib/split-guard.mjs --repo-root <folder>
# peran/tier dibaca otomatis dari .claude-kit/.split-state; kalau perlu paksa: --tier sensitive | --role frontend
```

Robot memeriksa deterministik (lihat `docs/split-guard.md`): `.env` asli nyelip · `.gitignore` tak
menutup `.env` · repo non-rahasia punya kunci rahasia (`DATABASE_URL`/`SECRET`/…) · nilai rahasia
asli di `.env.example` · struktur DB (`prisma/`) di repo tampilan. **Keluar-kode > 0 (ada GENTING)
→ JANGAN lapor "siap push".** Robot **tak pernah mencetak nilai rahasia** (cuma nama berkas/kunci).

Setelah robot **BERSIH (0 GENTING)**, lanjut cek sisanya (yang butuh penilaian, belum di-robot-kan):
- [ ] `.claude-kit/CLAUDE_universal_v1.md` ada (aturan tim).
- [ ] `CLAUDE.md` ada + berisi 2 baris pemuat (`@./.claude-kit/CLAUDE_universal_v1.md`).
- [ ] `AGENTS.md` ada + placeholder sudah terisi (tidak ada `<NAMA_PROYEK>` mentah).
- [ ] `package.json` + `tsconfig.json` bisa di-baca (parse valid).
- [ ] `.claude-kit/.split-state` ada dengan `role` yang benar (robot juga membacanya untuk menentukan tier).
- [ ] Tidak ada penanda per-install monolith yang ikut tersalin.

Kalau **robot GENTING > 0 ATAU salah satu cek gagal** → **JANGAN lapor "siap push"**. Lapor folder mana + apa yang kurang.

## Yang TETAP manual (sengaja, bukan bug)

- **Identitas git per orang**: tiap staff isi email-nya sendiri sekali saat pertama clone (identitas pribadi, tidak bisa dititipkan).
- **Terbitkan paket bersama** (`npm publish` shared) pertama kali: 1 langkah owner.
- **Push ke GitHub**: owner yang `git push` per folder.

> Hasil akhir untuk staff: clone repo → buka Claude Code → aturan + dokumentasi sudah ada → isi email sekali → **langsung kerja**. Tidak perlu "install lintasAI lagi".

## Input / Output

- **Input:** monolith yang sudah lewat Step 0.3-0.4 (3 folder dibuat + file disalin).
- **Output:** 3 folder yang masing-masing **sudah ada lintasAI lengkap + pengaturan + `.env.example` aman + penanda** — siap di-push owner. BUKAN push otomatis.

## Dependensi

- `SPLIT_REPO_MIGRATION_PROMPT_v1.md` Stage 0 (pemanggil).
- `templates/split-agents/{BACKEND,FRONTEND,SHARED}.md` (Mode [1]) + `{ENGINE,DASHBOARD}.md` (Mode [2] microservice) (template aturan peran).
- `CLAUDE.md.template` (format pemuat aturan).

## Catatan

- Gampang salah: menyalin `.env` monolith mentah ke frontend → **kebocoran rahasia**. Selalu `.env.example` (nama kunci tanpa nilai) + frontend hanya `NEXT_PUBLIC_*`. **Robot `split-guard` menangkap ini otomatis** (`docs/split-guard.md`) — tapi tetap jangan disalin sejak awal.
- Gampang salah: pakai MOVE → monolith hilang, tidak bisa balik. **Selalu COPY.**
- Pre-provision = **memasang**, bukan **menyalakan**. Repo baru "menyala" setelah owner push + (untuk shared) terbitkan paket.
