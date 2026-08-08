# README - Kit Aturan AI Kerja Profesional
> · 2026-06-24 · Windows-only · standar tim IT · **Team Mode default** + Senior AI Reviewer + Schema Isolation + 8 file panduan tim
> [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [License: MIT](LICENSE)
> Repo: [github.com/ojokesusu/lintasAI](https://github.com/ojokesusu/lintasAI) (privat — repo standar tim) · paket npm: [lintasai](https://www.npmjs.com/package/lintasai) (publik)

---

## 🌟 Versi stabil sekarang: **v1.61.0** (2026-06-24)

> Ringkasan ini = "pinned message" untuk staff IT non-programmer. Detail lengkap per versi ada di [CHANGELOG.md](CHANGELOG.md).

> ### ⚠️ Status fitur (jujur — baca sebelum pakai)
> - ✅ **INTI — STABIL & teruji**: pasang kit, aturan AI auto-load, dokumentasi, audit, refactor, workflow non-programmer. **Aman dipakai sehari-hari.** (ratusan cek otomatis lulus — jalankan `tests/Run-Tests.ps1` untuk jumlah terkini — + dipakai sendiri di repo kit ini.)
> - 🧪 **Split-repo + robot lintas-repo — BETA (sedang diuji)**: pecah monorepo jadi 3 repo + robot otomatis (terbit paket bersama, auto-gabung update, kunci pengaman). **Belum diuji menyeluruh di GitHub sungguhan.** Boleh dicoba di **repo uji**, tapi **jangan** diandalkan untuk produksi tim sampai lulus `.claude-kit/templates/ROBOT_CI_TESTING_PLAYBOOK.md`. Naik "stabil" **setelah robot lulus uji di repo nyata** (panduan `.claude-kit/templates/ROBOT_CI_TESTING_PLAYBOOK.md`) — bukan dipatok di nomor versi tertentu.

### Cara pasang (1 perintah)

Buka **Claude Code chat** di project kamu, paste:

```
npm create lintasai
```

Kit akan otomatis memasang aturan AI tim + menyalin dokumentasi + mengatur izin akses AI (daftar perintah yang boleh dijalankan otomatis). Tunggu ~1 menit.

> 💡 **Kalau AI menanyakan izin** untuk menjalankan `npm create lintasai` (muncul kotak pilihan mirip *"Cara jalan"* — Claude Code memang ekstra hati-hati dengan perintah `npm`; ini **NORMAL**, **bukan** error lintasAI): pilih **"Izinkan di repo ini"**. Dengan begitu AI memasang di project-mu lalu **langsung lanjut memandu** (Fase B). Hindari opsi *"jalankan sendiri di terminal"* kalau ingin AI tetap auto-lanjut memandu.

### Janji inti — yang DIJAMIN vs yang DITAWARKAN

> 🎚️ Sebelum daftar fitur di bawah, ini **inti** kit lintasAI:
> - ✅ **WAJIB & otomatis (tak bisa dimatikan):** **8 ahli IT profesional** — backend, frontend, database, webdesain, kenyamanan-pakai (UI/UX), pengiriman-ke-server (DevOps), keamanan, biar-ketemu-di-Google (SEO) — ikut menjaga mutu **tiap kali kamu prompt**, tanpa kamu mengetik apa pun. Ditambah **pagar keselamatan** (anti-bocor rahasia, anti-ngarang, bahasa awam). 🏢 Seperti 8 satpam tetap di tiap cabang — boleh kamu tambah, tak bisa dipecat.
> - 🎛️ **Sisanya = REKOMENDASI yang DITAWARKAN (bukan keharusan):** semua fitur di tabel bawah + standar kode/dokumentasi/proses = AI **menyarankan & menjalankan default**, tapi **kamu yang pilih** — boleh pakai/lewati/matikan per project.
> - 📈 **Kamu tumbuh sendiri:** tiap jawaban AI ditulis **2 versi** (👨‍🎓 untuk yang sedang belajar koding + 🙂 bahasa sehari-hari) — sengaja, supaya kamu makin paham sendiri dari waktu ke waktu (non-programmer → junior-programmer), bukan selamanya bergantung.

### Apa yang kit kasih (10 highlight versi stabil)

| # | Fitur | Analogi tools digital |
|---|---|---|
| 1 | **AI auto-pakai aturan tiap sesi** — `CLAUDE_universal_v1.md` auto-load | Mirip **WhatsApp template balasan otomatis** — AI ikut aturan tim tanpa kamu reminder tiap kali |
| 2 | **Bahasa Indonesia default** — semua respons AI + dokumentasi | Mirip **Google Translate** yang sudah preset Bahasa Indonesia — staff baru langsung paham |
| 3 | **Bahasa Non-Programmer** — jargon dijelaskan dengan bahasa awam (1 kalimat; analogi singkat opsional) | Mirip **Notion AI Q&A** yang jelasin pakai bahasa sederhana, bukan istilah teknis mentah |
| 4 | **Anti-Halusinasi Protocol** — AI WAJIB verify klaim file/fungsi sebelum diutter | Mirip **fact-check Instagram** sebelum post — cegah AI ngarang yang confident-salah |
| 5 | **Post-Install Auto-Trigger** — AI auto-tampilkan 3 popup (Setup Mode + Bulk-Bootstrap + Skenario) setelah install | Mirip **iPhone setup wizard** baru — auto-pandu kamu langkah demi langkah, tidak stop di tengah |
| 6 | **Role-based Scope** — staff IT non-programmer dibagi 3 level (Architect / Developer / UI Developer) per file path | Mirip **Google Drive permission folder** — tiap orang cuma bisa edit area yang relevan dengan role-nya |
| 7 | **Update Strategy 4-tier** — kit update otomatis classify Tier 1-4 (Silent / AI-auto-sync / BREAKING / SCAN-REQUIRED) + analogi tools | Mirip **iPhone iOS update** kasih info "minor update" vs "major upgrade" + step migration yang jelas |
| 8 | **Audit Post-Setup** — multi-dimensional read-only audit dengan ranked low→high risk + analogi non-programmer | Mirip **Tokopedia Seller Center health check** — laporkan apa yang perlu fix, prioritas mana dulu, risk apa |
| 9 | **Stage 4 (Rapikan ke Standar Tim) Migration** — proyek setengah-jadi ke standar tim (audit + GAP table + migration plan Quick Wins/Bertahap/Strategi Besar) | Mirip **pindahan rumah** — daftar barang yang sudah, belum, dan harus dibuang (bukan rewrite besar-besaran) |
| 10 | **Safety net 3-layer** — backup pre-install, manifest HMAC signed, safe uninstall via diff | Mirip **Google Drive versi history** — kalau salah update, kembali ke versi sebelumnya gampang |

### Untuk staff IT non-programmer (Day 0)

Baca dulu: [MULAI_DI_SINI.md](MULAI_DI_SINI.md) (bahasa awam, 1 halaman). Skip rest of README — itu dev reference.

### Untuk owner / tim lead

Baca: [TEAM_ROLLOUT_GUIDE_v1.md](TEAM_ROLLOUT_GUIDE_v1.md) (panduan rollout ke staff).

### Peta Keputusan — "Mau apa → buka/paste file ini"

Bingung mulai dari mana? Cari niatmu di kolom kiri, lalu buka/paste file di kolom kanan ke Claude Code:

| Kamu mau... | Buka / paste file ini |
|---|---|
| 🚀 Pasang kit pertama kali | `npm create lintasai` (atau paste `JALANKAN_KIT.md`) |
| 📍 Di mana menyimpan kit + cara pasang aman (anti salah-taruh) | `PANDUAN_PASANG_AMAN.md` |
| 📄 Bikin / refresh dokumentasi proyek | `PROJECT_LIFECYCLE_PROMPT_v1.md` |
| 🔍 Audit / cek kesehatan proyek | `AUDIT_POST_SETUP_PROMPT_v1.md` |
| ⬆️ Update kit ke versi baru | chat "update kit" (atau paste `UPDATE_KIT_PROMPT_v1.md`) |
| 🧩 Pecah proyek jadi banyak repo (lanjutan) | `SPLIT_REPO_MIGRATION_PROMPT_v1.md` |
| ❓ Bingung istilah teknis | `docs/GLOSSARY_NON_PROGRAMMER.md` |
| 🚨 Ada insiden keamanan | `docs/SECURITY_INCIDENT_PLAYBOOK.md` |

> Tidak hafal? Tidak apa-apa. Chat saja maksudmu pakai bahasa biasa ("mau audit proyek") — AI otomatis arahkan ke file yang tepat.

### Roadmap dekat

- **Penyempurnaan kecil berkelanjutan** — perbaikan perilaku AI + dokumen + tes. Tidak merusak yang sudah jalan; staff cukup jalankan `kit.ps1 update`.
- **v2.0.0 (target ke depan)** — dukungan lintas-platform (macOS + Linux). Ditandai perubahan-besar karena sekarang khusus Windows.

---

## Struktur paket
```
claude-ai-rules-kit/
├── README.md                              ← kamu baca ini sekarang
├── CHANGELOG.md                           ← log perubahan per versi
├── CONTRIBUTING.md                        ← panduan usul perubahan aturan
├── LICENSE                                ← MIT (bebas pakai/modif/distribusi)
├── CLAUDE_universal_v1.md                 ← aturan utama (auto-load tiap sesi, Pola A)
├── LINTASAI_WORKFLOWS_v1.md               ← rujukan workflow on-demand (§4.2-4.5, §8.3) — tiering hemat token
├── PROJECT_LIFECYCLE_PROMPT_v1.md         ← prompt 4-stage (Kickoff / Bootstrap / Update Docs / Migration) - AI auto-route
├── UPDATE_KIT_PROMPT_v1.md                ← prompt update kit ke versi baru (AI auto-classify tier)
├── AUDIT_POST_SETUP_PROMPT_v1.md          ← prompt audit komprehensif setelah setup awal
├── SPLIT_REPO_MIGRATION_PROMPT_v1.md      ← prompt pecah-repo (jumlah ikut kebutuhan; lihat POLA_REPO_AMAN)
├── TEAM_ROLLOUT_GUIDE_v1.md               ← panduan owner standar tim (kamu)
├── AGENTS.md.template                     ← template AGENTS.md untuk root proyek (Pola B)
├── JALANKAN_KIT.md                        ← prompt SINGLE-PASTE Pola B (default T = Team Mode / skip) + verifikasi setup
├── bin/lintasai.js                        ← ENTRY-POINT RESMI: dispatcher Node (`npm create lintasai` / `npx lintasai`)
├── lib/                                   ← helper engine (Node `*.mjs` DIUTAMAKAN + PowerShell `*.ps1` cadangan)
├── install-windows.ps1  (+ .mjs)          ← installer Pola A global — Node utama (.mjs), PowerShell cadangan
├── setup-pola-b.ps1     (+ .mjs)          ← auto-setup Pola B (5 skeleton docs + auto-copy 35 file tim) — Node utama, PS cadangan
├── update-kit.ps1       (+ .mjs)          ← auto-update kit (re-clone + backup + setup, rollback-safe) — Node utama, PS cadangan
├── uninstall.ps1        (+ .mjs)          ← safe uninstall via manifest sha256 diff — Node utama, PS cadangan
├── kit.ps1              (+ kit.mjs)       ← router perintah kit (doctor/scan/version/help) — Node utama, PS cadangan
└── templates/
    ├── architecture.md                    ← template peta proyek
    ├── glossary.md                        ← template kamus istilah domain
    ├── _PATTERNS.md                       ← aturan dokumentasi tim profesional generic
    ├── _EXAMPLE.md                        ← contoh format .md pendamping siap-copy
    ├── architecture_auto.md               ← registry TOC AI-maintained (skeleton)
    ├── CLAUDE_TEAM_GUIDE.md               ← panduan tim AI-first (workflow harian, branching, review)
    ├── PROMPT_LIBRARY.md                  ← 22 prompt pattern siap-pakai (tambah fitur, fix bug, SEO, deploy + chat-driven workflow)
    ├── ONBOARDING.md                      ← playbook dev baru hire (Day 0 - Day 14)
    ├── STACK_GUIDE.md                     ← Next.js + Vercel + SEO + security + Feature Flag
    ├── MCP_SETUP.md                       ← MCP setup + PostgreSQL schema isolation (CyberSecurity)
    ├── GLOSSARY_NON_PROGRAMMER.md         ← kamus istilah AI/coding untuk non-programmer (WAJIB baca dulu)
    ├── SECURITY_INCIDENT_PLAYBOOK.md      ← playbook respon insiden keamanan (~5 menit baca)
    ├── RLS_SETUP_PROMPT.md                ← prompt setup Row Level Security Supabase
    ├── DB_SCHEMA_SCAN_PROMPT.md           ← prompt audit schema DB
    ├── feature-flags-advanced.md         ← panduan feature flag advanced (POST-LAUNCH ref)
    ├── STACK_MIGRATION_GUIDE.md          ← panduan migrasi Vercel -> Railway/Render (ADVANCED)
    ├── TEAM_FLOW_SKETCH_v1.md            ← flow kerja tim end-to-end (siapa ngapain, staging→prod, deploy aman)
    ├── CROSS_REPO_TYPES_PIPELINE.md      ← pipeline auto-generate types lintas-repo (backend → shared → frontend)
    ├── decisions/                         ← ADR (Architecture Decision Record) folder
    │   ├── _TEMPLATE.md                   ← template ADR ringkas
    │   └── README.md                      ← panduan kapan tulis ADR
    └── github/                            ← template GitHub Actions/PR/CODEOWNERS (di-copy ke proyek .github/)
        ├── workflows/ai-review.yml        ← Senior AI Reviewer GitHub Action
        ├── workflows/backup-schemas.yml   ← auto-backup schema DB ke artifact
        ├── scripts/ai-review.cjs           ← Script reviewer Claude API
        ├── CODEOWNERS.template            ← auto-assign reviewer per folder
        └── pull_request_template.md       ← PR template tim
```

## Halo!
Hai, bro/sis! Paket ini isinya **aturan kerja AI** yang aku pakai sehari-hari biar Claude Code (AI coding assistant-nya Anthropic) gak ngasal - outputnya rapi, ada dokumentasi, dan junior-friendly. Aku bagikan ke kamu supaya kamu gak perlu nyusun aturan dari nol. Sekali install, semua proyek kamu di komputer ini langsung "patuh" tanpa kamu copy-paste aturan tiap sesi. Estimasi setup: **5 menit**.

> Kit ini dipakai sebagai **standar tim IT** kita. Semua anggota tim pakai versi yang sama biar konsisten antar-proyek. Detail soal versi & update di section **Standar tim** di bawah.

> *Claude Code* = CLI (Command Line Interface) resmi Anthropic buat ngobrol sama AI Claude langsung dari terminal. Mirip ChatGPT tapi bisa baca/tulis file di komputer kamu.

## Apa isi paket ini?
"Pola A install" = ke-copy ke `%USERPROFILE%\.claude\` saat jalanin `install-windows.ps1`. "Pola B kit-only" = stay di folder kit (untuk embed `.claude-kit/` di proyek). "Meta" = file pengantar, tidak ke-copy ke `~/.claude/` tapi penting di kit folder.

| File | Fungsi singkat | Kategori |
|---|---|:-:|
| `CLAUDE_universal_v1.md` | Aturan utama - AI baca otomatis tiap sesi (bahasa ID, anti-bug, wajib docs) | Pola A install |
| `PROJECT_LIFECYCLE_PROMPT_v1.md` | Prompt **4-stage lifecycle** (Stage 1 (Proyek Baru): Kickoff proyek baru / Stage 2 (Bikin Catatan Proyek): Bootstrap docs proyek lama / Stage 3 (Perbarui Catatan): Update Docs refresh `.md` / Stage 4 (Rapikan ke Standar Tim): Migration proyek setengah jadi) - AI auto-route ke stage yang tepat | Pola A install |
| `UPDATE_KIT_PROMPT_v1.md` | Prompt **update kit ke versi baru** - AI auto-classify tier perubahan & action items | Pola A install |
| `AUDIT_POST_SETUP_PROMPT_v1.md` | Prompt **audit komprehensif setelah setup awal** - verifikasi kit, gap, & rekomendasi | Pola A install |
| `SPLIT_REPO_MIGRATION_PROMPT_v1.md` | Prompt **migrate ke split-repo** (per-Lapisan 2-3 repo: frontend + backend, shared opsional — atau microservice per-kapabilitas; jumlah ikut wilayah rahasia, sumber `docs/plans/POLA_REPO_AMAN.md`) | Pola A install |
| `TEAM_ROLLOUT_GUIDE_v1.md` | Panduan **pemimpin tim** (kamu) buat rollout kit ini jadi standar tim | Pola A install |
| `templates/architecture.md` | Template peta isi folder `docs/` proyek | Pola A install |
| `templates/glossary.md` | Template kamus istilah proyek | Pola A install |
| `templates/_PATTERNS.md` | **Standar dokumentasi tim profesional** (kapan wajib ada `.md`, format, anti-pattern) | Pola A install |
| `templates/_EXAMPLE.md` | Contoh konkret 1 file `.md` pendamping siap-copy (reference format) | Pola A install |
| `templates/architecture_auto.md` | Registry TOC AI-maintained (auto-tracker semua `.md` di `docs/`) | Pola A install |
| `templates/TEAM_FLOW_SKETCH_v1.md` | Flow kerja tim end-to-end (siapa ngapain, serah-terima, staging→prod, deploy aman) - bahasa non-programmer | Pola A install |
| `templates/CROSS_REPO_TYPES_PIPELINE.md` | Pipeline auto-generate types lintas-repo (backend ubah schema → shared publish → frontend auto-PR) | Pola A install |
| `AGENTS.md.template` | Template `AGENTS.md` untuk dicopy ke root proyek (Pola B) | Pola B kit-only |
| `JALANKAN_KIT.md` | Prompt **SINGLE-PASTE** Pola B - AI tanya cara pasang (LENGKAP/CEPAT/PILIH-SENDIRI) + audit + ukuran tim & bentuk kode + setup + 4 aturan + 35 file tim profesional + verifikasi | Pola B kit-only |
| `setup-pola-b.ps1` | Script auto-setup Pola B di root proyek (copy AGENTS.md + 5 skeleton docs/) | Pola B kit-only |
| `install-windows.ps1` | Script auto-install Windows untuk Pola A (global) | Meta |
| `README.md` | File ini - baca dulu | Meta |
| `CHANGELOG.md` | Log perubahan per versi | Meta |
| `CONTRIBUTING.md` | Panduan anggota tim untuk usul perubahan aturan | Meta |
| `LICENSE` | MIT - bebas pakai/modif/distribusi | Meta |
| `.gitignore` | Untuk repo standar tim (kalau kit ini di-track di Git) | Meta |

> Catatan path: kit ini Windows-only. `~/.claude/` di PowerShell sama dengan `%USERPROFILE%\.claude\` (mis. `C:\Users\<NamaKamu>\.claude\`). Backslash `\` dan slash `/` dua-duanya jalan di PowerShell modern.

## Persiapan (sekali saja)
1. Install **Claude Code** dulu kalau belum: https://claude.com/claude-code
2. Login ke akun Anthropic kamu (ikutin instruksi installer).
3. Cek dia jalan: buka terminal, ketik `claude --version`. Kalau keluar nomor versi, aman.

## Cara Install (Recommended untuk Staff)

> 🧭 **Bingung pilih yang mana? Tidak perlu.** Untuk hampir semua orang cukup **1 perintah: `npm create lintasai`** (Cara 1 di bawah). Cara/Opsi lain di halaman ini = **alternatif untuk situasi khusus** (owner, advanced, atau komputer tanpa npm) — staff non-programmer **abaikan saja**.
>
> | Kondisi kamu | Pakai ini |
> |---|---|
> | Staff biasa / paling umum | **`npm create lintasai`** (Cara 1) |
> | Owner / butuh perintah lanjutan (update, doctor, rollback) | `npx lintasai <perintah>` |
> | Komputer tanpa npm / terisolasi / owner advanced | Git clone + `JALANKAN_KIT.md` (lihat **"Distribusi via GitHub repo"**) |
>
> Ketiganya berujung ke pemasang yang **sama** — bukan 3 hal berbeda yang bersaing.

### Cara 1: lewat Claude Code chat (1 perintah, paling cepat — disarankan)

Buka **Claude Code chat** di folder project kamu, lalu ketik/paste:

```
npm create lintasai
```

Biarkan **AI yang menjalankan** perintah ini (lewat chat). Pemasang versi Node berjalan **otomatis penuh** (tanpa popup jendela Windows) — kamu **langsung** masuk ke popup pemandu di dalam chat. Kit auto-deploy + setup project. Total ~1 menit.

> Mau jalankan sendiri di terminal? Boleh — buka PowerShell di folder project lalu jalankan `npm create lintasai`. Sejak pemasang versi Node, pemasangan **otomatis penuh** (tanpa popup jendela Windows) baik lewat chat maupun terminal; pilihan (AGENTS.md, email, buka VS Code) diatur lewat AI di chat sesudah pemasangan.

Untuk update, cukup minta AI di chat: **"tolong update kit"** (AI yang jalankan). Atau manual dari dalam project:
```bash
.\.claude-kit\kit.ps1 update
```

### Cara 2: Git Clone (untuk owner / advanced)

Lihat section **"Distribusi via GitHub repo"** di bawah untuk detail git clone, degit, atau prompt-driven setup.

---

## Cara Install Manual (Advanced)

> Section ini untuk owner / advanced user yang ingin install global (Pola A) atau setup manual tanpa NPM. Staff IT non-programmer disarankan pakai **Cara 1 (NPM)** di atas.

### Cara 3: Otomatis post-clone (cepat, ~10 detik)

Buka PowerShell di folder paket ini, jalanin:
```powershell
# Allow script jalan di sesi ini saja (aman, mati saat PowerShell ditutup)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# Install
.\install-windows.ps1
```
Script otomatis nge-`Unblock-File` (handle Mark-of-the-Web kalau zip didownload dari internet). Mau cek tanpa nimpa apapun? Tambah flag `-DryRun`.

Kalau di folder profil udah ada `CLAUDE.md`, **script otomatis backup** ke `CLAUDE.md.backup-YYYYMMDD-HHMMSS` sebelum nimpa - jadi file lamamu aman.

### Cara 4: Manual copy post-clone

Tujuan: copy file paket ke folder profil Claude kamu - `%USERPROFILE%\.claude\` (= `C:\Users\<NamaKamu>\.claude\`).

Mapping file:

| Dari (paket) | Ke (folder profil) |
|---|---|
| `CLAUDE_universal_v1.md` | `%USERPROFILE%\.claude\CLAUDE.md` *(rename!)* |
| `LINTASAI_WORKFLOWS_v1.md` | `%USERPROFILE%\.claude\LINTASAI_WORKFLOWS_v1.md` |
| `PROJECT_LIFECYCLE_PROMPT_v1.md` | `%USERPROFILE%\.claude\PROJECT_LIFECYCLE_PROMPT_v1.md` |
| `TEAM_ROLLOUT_GUIDE_v1.md` | `%USERPROFILE%\.claude\TEAM_ROLLOUT_GUIDE_v1.md` |
| `templates\architecture.md` | `%USERPROFILE%\.claude\templates\architecture.md` |
| `templates\glossary.md` | `%USERPROFILE%\.claude\templates\glossary.md` |
| `templates\_PATTERNS.md` | `%USERPROFILE%\.claude\templates\_PATTERNS.md` |
| `templates\_EXAMPLE.md` | `%USERPROFILE%\.claude\templates\_EXAMPLE.md` |
| `templates\architecture_auto.md` | `%USERPROFILE%\.claude\templates\architecture_auto.md` |

> WARNING: Kalau folder profil udah ada `CLAUDE.md`, **backup dulu manual** (rename jadi `CLAUDE.md.backup-20260530-093000` - pakai timestamp sekarang) sebelum nimpa. Format ini sama persis dengan yang dipakai script otomatis, biar konsisten.

## Verifikasi install
Di PowerShell:
```powershell
Get-ChildItem $env:USERPROFILE\.claude\
Get-Content $env:USERPROFILE\.claude\CLAUDE.md -TotalCount 3
```
Harus kelihatan: `CLAUDE.md`, 3 file panduan (`LINTASAI_WORKFLOWS_v1.md`, `PROJECT_LIFECYCLE_PROMPT_v1.md`, `TEAM_ROLLOUT_GUIDE_v1.md`), dan folder `templates\`. Baris pertama `CLAUDE.md` harus nampilin header versi (mis. `v1 · 2026-05-30`) - itu tandanya file bener-bener ke-copy. Mau yakin AI baca aturannya? Buka Claude Code, lalu tanya: *"Kamu baca aturan dari file apa? Sebutin versi di header."* Kalau dia jawab `%USERPROFILE%\.claude\CLAUDE.md` + versi yang sama, sukses.

## Pakai sehari-hari - 1 prompt, 4 stage

Sejak v1.5+, **3 skenario lama (KICKOFF / BOOTSTRAP / MIGRATION) + UPDATE_DOCS** sudah digabung jadi **1 prompt single-entry**: `PROJECT_LIFECYCLE_PROMPT_v1.md`. Kamu cukup paste prompt yang sama di semua skenario - AI **auto-route ke Stage 1/2/3/4** berdasarkan kondisi proyek.

### Cara pakai (semua skenario)
```powershell
cd C:\path\ke\proyek    # atau mkdir proyek-baru; cd proyek-baru; git init
claude
```
Di sesi Claude, **paste isi `%USERPROFILE%\.claude\PROJECT_LIFECYCLE_PROMPT_v1.md`**. AI akan auto-detect kondisi & route:

- **Stage 1 (Proyek Baru) - Kickoff** → proyek BARU dari nol (folder kosong / cuma `.git`). AI nanyain stack, bikin struktur folder, setup `docs/` otomatis.
- **Stage 2 (Bikin Catatan Proyek) - Bootstrap Docs** → proyek LAMA punya code tapi belum punya `.md` pendamping. AI baca code lalu auto-fill semua `.md` di `docs/`.
- **Stage 3 (Perbarui Catatan) - Update Docs** → docs sudah ada tapi backlog tertinggal jauh dari code. AI bulk-refresh `.md` pendamping yang outdated.
- **Stage 4 (Rapikan ke Standar Tim) - Migration** → proyek SETENGAH JADI (sudah jalan + mungkin punya konvensi sendiri). AI audit read-only → tampilkan tabel gap (Quick Wins/Bertahap/Strategi Besar) → bikin `docs/MIGRATION_TO_STANDARD.md` → eksekusi Quick Wins dengan konfirmasi per langkah.

Filosofi tetap sama untuk semua stage: **bentrok OK**, perbaikan bertahap (boy scout rule), no paksa rewrite besar. Sesi berikutnya: paste prompt yang sama → AI baca state file → lanjut dari item pending.

### Sesi biasa di proyek yang udah jalan
Tinggal `claude` aja di folder proyek - aturan global ke-load otomatis, gak perlu paste apa-apa.

---

## Standar tim (kalau dipakai >1 orang)
Kit ini dirancang jadi **standar tim IT 3-10 orang**. Filosofi: hemat energi, konsisten lintas-proyek, perbaikan bertahap. Beberapa hal yang penting saat dipakai tim:

- **Semua anggota pakai versi yang sama** - taruh kit di Git repo private internal dengan tag versi (`v1`, `v1.1`, dst). Bukan Google Drive bebas yang versinya nyasar.
- **1 owner standar** (mis. pemimpin tim) yang approve perubahan aturan + rilis versi baru. Anggota lain usul via issue/PR di repo standar.
- **Channel diskusi tunggal** (`#it-standard` di Slack/Discord/WA) untuk usulan, announce update, troubleshooting.
- **Update otomatis backup** - saat owner rilis v1.2, anggota jalanin `install-windows.ps1` lagi. Script backup file lama dengan timestamp, gak rusak setting existing.
- **Exception per-proyek dicatat** - kalau proyek X opt-out aturan Y, catat di `exceptions.md` di repo standar dengan sunset date. Review tiap bulan.
- **Adopsi per-proyek pakai `PROJECT_LIFECYCLE_PROMPT_v1.md`** - 1 prompt, AI auto-route ke Stage 1 (Proyek Baru / Kickoff) / 2 (Bikin Catatan Proyek / Bootstrap Docs) / 3 (Perbarui Catatan / Update Docs) / 4 (Rapikan ke Standar Tim / Migration) sesuai kondisi proyek.

Detail lengkap (governance, distribusi update, metric kesehatan tim, anti-pattern, FAQ tim) ada di **`%USERPROFILE%\.claude\TEAM_ROLLOUT_GUIDE_v1.md`** - baca kalau kamu pemimpin tim / owner standar.

## Distribusi via GitHub repo

Kit ini di-publish di **`github.com/ojokesusu/lintasAI`** (private repo standar tim). Staff IT clone langsung dari sana - tidak perlu kirim zip via email/chat. Update kit cukup `git pull` di local clone. **4 opsi setup** (dilabeli A-D supaya tak bingung dengan "Cara 1-4" di bagian "Cara Install" atas):

### Opsi A - Git clone (paling umum, butuh git terpasang)

```powershell
# Dari root proyek
git clone --depth 1 https://github.com/ojokesusu/lintasAI.git .claude-kit
# Hapus .git/ supaya tidak konflik dengan git proyek user:
Remove-Item .claude-kit\.git -Recurse -Force
# Setup
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.claude-kit\setup-pola-b.ps1
# Buka Claude Code, paste isi .claude-kit\JALANKAN_KIT.md
```

`--depth 1` = clone shallow (tanpa history) supaya cepat + ringan (~80 KB vs MB-level).

### Opsi B - git clone shallow lalu buang `.git/` (output bersih)

```powershell
git clone --depth 1 https://github.com/ojokesusu/lintasAI.git .claude-kit
Remove-Item .claude-kit\.git -Recurse -Force
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.claude-kit\setup-pola-b.ps1
# Buka Claude Code, paste isi .claude-kit\JALANKAN_KIT.md
```

Membuang `.git/` = output bersih siap-pakai (tanpa riwayat git nyangkut di project).

### Opsi C - Prompt ke Claude Code (paling simple)

Buka Claude Code di root proyek, prompt:

```
Mohon clone https://github.com/ojokesusu/lintasAI ke folder .claude-kit
(hapus .git/ setelahnya), lalu jalankan setup-pola-b.ps1, lalu eksekusi
isi JALANKAN_KIT.md.
```

AI akan handle git clone + cleanup + setup + JALANKAN_KIT workflow end-to-end.

### Opsi D - Download zip dari GitHub Releases (fallback)

Kalau staff IT tidak install git / Node.js, download zip dari [Releases](https://github.com/ojokesusu/lintasAI/releases) → extract ke `.claude-kit/`. Workflow sama seperti zip biasa.

### Update kit ke versi baru

**Cara termudah & disarankan:** minta AI di chat — **"tolong update kit"** — atau jalankan `npm create lintasai` (jalur Node, default sejak migrasi PS→Node). AI memetakan tier perubahan + konfirmasi sebelum jalan. Setara langsung: `.\.claude-kit\kit.ps1 update`.

> Bagian di bawah = **referensi developer** untuk jalur git-clone manual. Sejak migrasi PS→Node, mesin update utama = `update-kit.mjs` (dipanggil otomatis oleh jalur di atas); `update-kit.ps1` di bawah = **jalur PowerShell langsung (cadangan)**, hasilnya setara (parity-tested).

#### Opsi A - Auto-update langsung via `update-kit.ps1` (jalur PowerShell cadangan)

Kit punya **script auto-update** yang handle re-clone fresh + backup + setup script + version detection dalam 1 command:

```powershell
# Dari root proyek (folder yang ada .claude-kit/ di dalamnya):
.\.claude-kit\update-kit.ps1
```

Script otomatis lakukan:
1. ✅ **Backup** `.claude-kit/` lama ke `.claude-kit.backup-<timestamp>` (rollback-safe).
2. ✅ **Clone fresh** dari `github.com/ojokesusu/lintasAI` (depth 1, hemat bandwidth).
3. ✅ **Hapus `.git/` internal** (cegah konflik dengan git proyek user).
4. ✅ **Re-run `setup-pola-b.ps1 -Force`** (anti-overwrite preserve `docs/` existing).
5. ✅ **Detect versi lama vs baru** + tampilkan action items.

**Parameter opsional**:
- `-NoBackup` - skip backup (irreversible). Akan minta konfirmasi dulu; untuk unattended/CI tambah `-Force`.
- `-RepoUrl <url>` - override default (untuk fork private kamu sendiri).
- `-Branch <name>` - clone branch lain (default: `main`).
- `-DryRun` - preview tindakan tanpa eksekusi.

**Kalau git clone gagal** (network/auth issue): script auto-rollback restore backup. Zero half-state risk.

#### Opsi B - Manual re-clone (kalau update-kit.ps1 tidak available di kit kamu)

```powershell
cd <project-root>
Remove-Item .claude-kit -Recurse -Force
git clone --depth 1 https://github.com/ojokesusu/lintasAI.git .claude-kit
Remove-Item .claude-kit\.git -Recurse -Force
.\.claude-kit\setup-pola-b.ps1 -Force
```

Sama hasilnya dengan Opsi A, tapi manual + tidak ada backup otomatis.

#### Opsi C - git clone manual (fallback)

```powershell
Remove-Item .claude-kit -Recurse -Force
git clone --depth 1 https://github.com/ojokesusu/lintasAI.git .claude-kit
Remove-Item .claude-kit\.git -Recurse -Force
.\.claude-kit\setup-pola-b.ps1 -Force
```

**PENTING - selalu re-run `setup-pola-b.ps1` setelah update kit** (otomatis lewat Opsi A; manual di Opsi B/C). Itu yang trigger copy file skeleton BARU dari kit ke `docs/` (anti-overwrite tetap aktif → file `docs/*.md` user existing AMAN, tidak ditimpa).

**Action items setelah update**:
1. Baca `CHANGELOG.md` section `[vX.Y.Z]` untuk overview perubahan.
2. Update `AGENTS.md` field `Versi kit aktif: vX.Y.Z` di root proyek.
3. Kalau CHANGELOG sebut workflow change di `JALANKAN_KIT.md` → re-paste ke Claude Code untuk aktifkan.
4. Verify 1 sesi Claude Code untuk pastikan kit jalan smooth.

### Trade-off private vs public repo

| Aspek | **Private repo** (saat ini default) | **Public repo** |
|---|---|---|
| Staff IT clone | Wajib GitHub auth (SSH key / PAT) | Zero auth - `git clone` langsung |
| Bocoran ke pihak luar | Tidak - repo invisible | Public - tapi kit ini generic + MIT license, tidak ada secret |
| Adopsi external (community) | Tidak | Bisa - komunitas eksternal bisa fork / contribute |
| Setup friction | +1 step setup GitHub auth per staff IT | 0 |
| Saran owner | Cocok kalau tim kecil + tidak mau external visibility | Cocok kalau OK community contribution + lebih simple untuk staff IT baru |

**Default rekomen**: **public** kalau kit ini generic infrastructure. Pilih private cuma kalau ada concern internal-only.

---

## Pola B: Embed kit di proyek (manual extract, tanpa GitHub)

Selain install global di `%USERPROFILE%\.claude\` (Pola A) atau clone dari GitHub (di atas), kit ini bisa di-embed manual dari zip yang kamu dapat (mis. lewat chat/email) sebagai `.claude-kit/`. Cocok kalau kit mau **di-track di git proyek** biar version-locked (semua anggota tim dapat versi sama persis saat clone repo), atau kalau proyek punya aturan khusus beda dari aturan global. Bedanya: Pola A berlaku untuk **semua proyek** di laptop user, Pola B cuma berlaku untuk **satu proyek** itu saja. Versi kit aktif paket ini = lihat baris versi teratas `.claude-kit\CHANGELOG.md` setelah extract (selalu akurat, tak perlu disebut angka di sini supaya tak basi).

### Cara setup otomatis

Buka PowerShell dan `cd` ke **root proyek** dulu (tempat `package.json` / `.git` berada). Semua perintah di bawah asumsikan cwd = root proyek.

```powershell
# 1. Allow script di sesi ini saja (aman, mati saat PowerShell ditutup)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# 2. Extract zip kit jadi folder .claude-kit\ di root proyek
#    Ganti <path-ke-zip-kamu> dengan lokasi zip yang kamu download (Slack/email/Downloads).
Expand-Archive -Path "<path-ke-zip-kamu>" -DestinationPath ".\.claude-kit" -Force

# 3. Jalankan setup script
.\.claude-kit\setup-pola-b.ps1
```

Script otomatis: (a) **deteksi nested extract** dan tawarkan auto-flatten; (b) **unblock Mark-of-the-Web** untuk semua file kit (cegah block kalau zip didownload via browser); (c) **deteksi CLAUDE.md existing** dan tanya: rename ke `.legacy-<timestamp>` / biarkan dua-duanya / batal; (d) copy `AGENTS.md.template` jadi `AGENTS.md`, isi placeholder; (e) auto-backup `AGENTS.md` lama kalau ada.

### Cara setup manual

Kalau lebih suka manual (atau script error), 3 langkah dari root proyek:

1. **Extract zip kit** jadi `.\.claude-kit\` (perintah `Expand-Archive` di atas).
2. **Copy template:** `Copy-Item .\.claude-kit\AGENTS.md.template .\AGENTS.md` (cek dulu `AGENTS.md` belum ada - kalau ada, backup pakai nama ber-timestamp).
3. **Edit `AGENTS.md`** di root: isi `<NAMA_PROYEK>`, `<TANGGAL_HARI_INI>`, override khusus proyek (boleh kosong dulu kalau belum ada).

### Verifikasi

Setelah langkah 1 + 2 di atas **selesai semua**, buka Claude Code di root proyek lalu paste isi `.\.claude-kit\JALANKAN_KIT.md` ke chat. AI cek `.claude-kit/` lengkap, versi kit match `AGENTS.md`, `AGENTS.md` ke-load, lalu kasih tour singkat. Kalau AI bilang "file X tidak ditemukan" atau "versi drift", berarti extract belum tepat - ulangi langkah 1. **PENTING:** jangan paste prompt sebelum script jalan, urutannya akan kacau.

### Pakai sehari-hari di Pola B

Workflow sama persis dengan Pola A (paste `PROJECT_LIFECYCLE_PROMPT_v1.md`, AI auto-route ke Stage 1/2/3/4), **bedanya cuma path prompt**: paste isi dari `.\.claude-kit\PROJECT_LIFECYCLE_PROMPT_v1.md`, bukan dari `%USERPROFILE%\.claude\PROJECT_LIFECYCLE_PROMPT_v1.md`. `AGENTS.md` otomatis kasih tau AI: kalau ada `./.claude-kit/`, baca prompts dari situ.

> Kalau user **dua-duanya punya** (install global + `.claude-kit/`), `AGENTS.md` proyek menang - pas buat override aturan global untuk proyek tertentu.

### Trade-off vs install global

| Aspek         | Pola B (embed di proyek)                              | Pola A (install global)                          |
|---------------|-------------------------------------------------------|--------------------------------------------------|
| Auto-load     | Via `CLAUDE.md` di root proyek (`@import` `.claude-kit/CLAUDE_universal_v1.md` + `AGENTS.md`) | Via `CLAUDE.md` global di `%USERPROFILE%\.claude\` |
| Scope         | Cuma proyek itu                                       | Semua proyek di laptop user                      |
| Update kit    | Extract zip versi baru → overwrite `.claude-kit\` → `git commit` | Replace file di `%USERPROFILE%\.claude\` (1x untuk semua proyek) |
| Duplikasi     | Tiap proyek punya copy sendiri (~beberapa MB/proyek)  | 1 copy dipakai semua proyek                      |

### Hapus kit dari proyek (uninstall yang aman)

Mau hapus lintasAI dari proyek? **JANGAN delete folder `docs/` atau `.github/` mentah-mentah** - folder itu kemungkinan campur antara file kit dan file proyek kamu sendiri. Pakai `uninstall.ps1` yang tahu mana file kit vs mana file proyek.

**Alur disarankan untuk user baru (3 langkah):**

**Langkah 1 - Preview dulu (WAJIB, supaya tahu apa yang akan dihapus):**
```powershell
.\.claude-kit\kit.ps1 uninstall -DryRun
```
Script tampilkan: daftar file PRISTINE (akan dihapus), MODIFIED (akan DILEWATI), SYMLINK/BLOCKED/LOCKED (SKIP dengan alasan), dan ringkasan total. Tidak ada satu pun file yang dihapus di langkah ini.

**Langkah 2 - Hapus beneran (konservatif, RECOMMENDED):**
```powershell
.\.claude-kit\kit.ps1 uninstall
```
Jawab `Y` saat ditanya konfirmasi. Script hapus cuma file PRISTINE. File yang sudah kamu edit TETAP ada.

**Langkah 3 - Hapus folder `.claude-kit\` sendiri (manual):**
Script tidak bisa hapus folder yang sedang dia jalankan dari sana. Setelah langkah 2 selesai, **TUTUP semua VSCode / editor yang membuka file di `.claude-kit\`**, lalu jalankan di PowerShell baru:
```powershell
Remove-Item -Recurse -Force .\.claude-kit
```

**Opsi tambahan (advanced):**
```powershell
# Hapus juga file kit yang sudah kamu edit (backup .bak dulu, jadi rollback-able):
.\.claude-kit\kit.ps1 uninstall -Force

# Hapus juga AGENTS.md (default skip karena heavy customization):
.\.claude-kit\kit.ps1 uninstall -DeleteAgents

# Suppress instruksi self-delete .claude-kit\ (kalau memang mau retain folder kit):
.\.claude-kit\kit.ps1 uninstall -KeepKit

# CI / automation auto-confirm (PAKAI cuma kalau sudah lihat hasil SIMULASI / dry-run - jalan pura-pura, tidak menghapus apa pun):
.\.claude-kit\kit.ps1 uninstall -Yes

# Folder proyek di-rename setelah install (manifest project_root tidak match):
.\.claude-kit\kit.ps1 uninstall -AllowProjectRootMismatch
```

**Setelah selesai, kamu akan dapat konfirmasi:**
- File proyek asli di `docs/`, `src/`, `package.json`, dll. AMAN tidak disentuh.
- File kit yang kamu edit (tanpa `-Force`) masih ada di tempatnya.
- Verifikasi: jalankan `git status` - file proyek tidak boleh muncul sebagai deleted.

**Cara kerja:** setup-pola-b.ps1 tulis `.claude-kit/.install-manifest.json` yang berisi sha256 hash setiap file yang kit copy. Uninstall classify tiap file:

- **PRISTINE** (hash match) → auto-delete, file persis sama dengan kit.
- **MODIFIED** (hash beda) → kamu sudah edit; default SKIP. `-Force` → backup ke `.pre-uninstall-<timestamp>.bak` lalu hapus.
- **SYMLINK** (junction / symbolic link) → SKIP selalu (cegah leak isi file di luar project ke .bak).
- **BLOCKED** (path escape ke luar project root) → REJECT (proteksi path traversal kalau manifest di-tamper).
- **LOCKED** (hash gagal - file di-buka editor / AV) → SKIP, tutup editor + re-run.
- **MISSING** (file sudah tidak ada) → skip silent.
- **BACKUP** (file `.backup-*` dari setup -Force) → preserved, hapus manual kalau mau.

**Hard-fail** kalau `project_root` di manifest tidak match lokasi sekarang (cegah manifest project lain delete file di sini). Override via `-AllowProjectRootMismatch` untuk kasus folder di-rename.

**AGENTS.md default tidak dihapus** (heavy customization expected). Pakai `-DeleteAgents` kalau memang mau hapus.

**Direktori (`docs/`, `.github/`, dll.) cuma dihapus kalau EMPTY** setelah file kit dibersihkan. Project file kamu di sana TETAP aman. Junction/symlink dir terdeteksi → tidak diikuti.

**⚠ Catatan TOCTOU (waktu-cek vs waktu-pakai):** plan dry-run (SIMULASI - jalan pura-pura, tidak menghapus apa pun) adalah snapshot - kalau kamu edit file antara SIMULASI dan eksekusi nyata, script re-hash sebelum delete dan SKIP file yang berubah. Aman.

**⚠ Catatan re-create:** kalau kamu pernah `git checkout -- <file>` revert file kit ke versi original, hash akan match lagi → file ke-auto-delete sebagai PRISTINE. Selalu jalankan `-DryRun` dulu sebelum `-Yes` untuk automation.

#### Kalau manifest TIDAK ADA (kit lama / corrupt)

Untuk install pakai versi < v1.0.0 (sebelum manifest support) atau manifest hilang, script `uninstall.ps1` keluar dengan instruksi fallback manual. Daftar file yang kit deploy di Pola B:

- `AGENTS.md` (root proyek) - heavy customized, **JANGAN hapus tanpa baca dulu**
- `docs/architecture.md`, `docs/glossary.md`, `docs/architecture_auto.md`, `docs/_PATTERNS.md`, `docs/_EXAMPLE.md`
- `docs/CLAUDE_TEAM_GUIDE.md`, `docs/PROMPT_LIBRARY.md`, `docs/ONBOARDING.md`, `docs/STACK_GUIDE.md`, `docs/STACK_MIGRATION_GUIDE.md`
- `docs/MCP_SETUP.md`, `docs/RLS_SETUP_PROMPT.md`, `docs/DB_SCHEMA_SCAN_PROMPT.md`, `docs/GLOSSARY_NON_PROGRAMMER.md`, `docs/SECURITY_INCIDENT_PLAYBOOK.md`, `docs/feature-flags-advanced.md`
- `docs/decisions/_TEMPLATE.md`, `docs/decisions/README.md`
- `.github/workflows/ai-review.yml`, `.github/workflows/backup-schemas.yml`, `.github/scripts/ai-review.cjs`, `.github/CODEOWNERS`, `.github/pull_request_template.md`
- `.claude-kit/` folder itu sendiri

Review tiap file sebelum hapus - `docs/` dan `.github/` kemungkinan campur dengan file proyek kamu sendiri.

## Troubleshooting Pola B (kalau setup error)

**Error: `cannot be loaded because running scripts is disabled` (Execution Policy)**
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
Cuma berlaku di sesi PowerShell saat ini. Re-run setup script.

**Error: `Expand-Archive: Cannot find path '<path-ke-zip-kamu>'`**
Ganti `<path-ke-zip-kamu>` dengan path PENUH dari zip kit kamu, contoh:
```powershell
Expand-Archive -Path "$HOME\Downloads\claude-ai-rules-kit.zip" -DestinationPath ".\.claude-kit" -Force
```

**Error: script ke-block "this file is not digitally signed" / SecurityError**
Mark-of-the-Web (MOTW) - Windows nge-tag file dari internet. Setup script otomatis nge-unblock, tapi kalau gagal:
```powershell
Get-ChildItem .\.claude-kit\ -Recurse | Unblock-File
```

**Setup script bilang "DETEKSI: Kit ter-extract NESTED"**
Berarti zip extract jadi `.\.claude-kit\claude-ai-rules-kit\...` (nested). Pilih opsi `Y` saat ditanya - script otomatis flatten.

**`claude` command not found**
Install Claude Code dulu: https://claude.com/claude-code. Verifikasi: `claude --version`.

**AI tidak baca AGENTS.md / `.claude-kit/`**
Pastikan kamu jalankan Claude Code dari **root proyek** (folder tempat `AGENTS.md` berada), bukan dari subfolder. Tanya AI: *"Kamu baca file aturan dari path apa?"* - kalau jawab `~/.claude/CLAUDE.md` (Pola A), bukan `./AGENTS.md` (Pola B), kemungkinan kamu jalanin dari folder salah.

## FAQ singkat

**Q: Aku udah punya `CLAUDE.md` global, gimana?**
A: Pakai install global otomatis (`install-windows.ps1` — Cara 3 di bagian "Cara Install Manual" di atas): script otomatis backup ke `CLAUDE.md.backup-<timestamp>` sebelum nimpa. Habis itu kamu bisa merge bagian yang mau dipertahankan.

**Q: AI-nya bandel, gak ikut aturan?**
A: Tegur langsung: *"kamu ngelanggar aturan poin X di CLAUDE.md, ulangi"*. Biasanya nurut. Kalau sering, cek dia baca file yang bener: tanya *"path CLAUDE.md yang kamu baca apa?"*

**Q: Mau update aturan ke versi baru?**
A: Tinggal jalanin install script lagi - backup otomatis, file baru ke-pasang. Versi tertulis di header tiap file (mis. `v1 · 2026-05-30`).

**Q: Boleh aku modif aturannya?**
A: Boleh banget! Itu file kamu sendiri. Saran: naikkan versi & tanggal di header tiap kali nge-edit, biar gampang lacak.

**Q: Komputer kerja kantor, gimana?**
A: Aturan ini disimpan di profil user kamu (`~/.claude/`), gak ganggu setting kantor / proyek tim. Aman.

**Q: Bisa per-proyek juga?**
A: Bisa. Bikin `CLAUDE.md` di root proyek - isinya bakal **ditambahkan** ke aturan global (bukan menimpa total). Jadi aturan proyek = aturan global + tambahan dari file proyek. Cocok buat catatan khusus stack/konvensi proyek itu.

**Q: Memory & plans Claude Code disimpan di mana? Kenapa gak di `.claude-kit/`?**
A: Disimpan di `%USERPROFILE%\.claude\projects\<hash>\memory\` & `%USERPROFILE%\.claude\plans\` - **by-design Anthropic Claude Code**, bukan kit ini. Sengaja TIDAK di `.claude-kit/` karena:
- **Privacy** - memory berisi info pribadi (preferensi user, snapshot keamanan, kredensial dev). Kalau ter-commit = bocor sekali push.
- **Per-user** - memory kamu beda dari memory teman tim. Tidak share-able dalam 1 repo.
- **Auto-load** - Claude Code engine hardcode baca path tersebut. Pindah lokasi = auto-load mati.

Jadi 4 lokasi persistence Claude Code adalah:

| Lokasi | Ter-commit? | Peran |
|---|:-:|---|
| `.claude-kit/` + `AGENTS.md` (di repo) | ✅ YA | Aturan tim - shared ke semua |
| `docs/` (di repo) | ✅ YA | Dokumentasi teknis proyek |
| `%USERPROFILE%\.claude\projects\<hash>\memory\` | ❌ TIDAK | Catatan AI private (per-user) |
| `%USERPROFILE%\.claude\plans\` | ❌ TIDAK | Draft plan AI sementara (per-user) |

**Saran:** generate file `docs/CLAUDE_PERSISTENCE_MAP.md` di proyek kamu - peta singkat lokasi persistence di atas (4 lokasi) + catatan mana yang ter-commit / tidak. Tim baru tinggal baca peta itu, gak perlu nanya lagi. AI bisa bantu generate sekali kalau kamu minta.

## Quality & Audit

lintasAI menjalani audit komprehensif untuk memastikan stabilitas distribusi:
- **2026-06-06**: 132-agent multi-lens scan, 59 confirmed findings, semua critical di-fix di v1.2.0-v1.2.2
- Lihat [docs/AUDIT_HISTORY.md](docs/AUDIT_HISTORY.md) untuk:
  - Detail audit + findings + verdict timeline
  - Items deferred + rationale
  - Roadmap + distribution rollout plan

Kalau kamu mau audit ulang atau extend, ikuti pattern di file itu.

---

## Penutup
Kalau masih bingung, buka Claude Code **di folder proyek setelah install kelar**, lalu chat: "Halo, aku staff baru. Tolong cek install kit + briefing aturan dasar." AI akan auto-detect kondisi dan apply Guided Step-by-Step Workflow (lihat `CLAUDE_universal_v1.md` section 4.3). Selamat ngoding bareng AI yang patuh!
