# split-guard.md — Robot Penjaga Anti-Bocor Saat Pecah-Repo

> Versi 1 · 2026-06-24 · pendamping `lib/split-guard.mjs`

## Tujuan

Mencegah **rahasia (`.env` / kunci database / kunci API) bocor ke repo yang salah** saat project
dipecah jadi banyak repo (split). Bahaya terbesar: kunci DB nyelip ke repo **tampilan**
(frontend/dashboard) yang dilihat **40-50 orang**.

Sampai sebelum robot ini, pengaman itu cuma **"dicek manual oleh AI"** (Risk Catalog
`SPLIT_REPO_MIGRATION_PROMPT_v1.md`, baris *"Secrets leak"* ~691 — **dulu** *"dicek manual saat verify"*,
**kini** sudah *"Ditegakkan robot deterministik"* berkat robot ini). Bertumpu pada AI ingat = bisa lupa. Robot ini mengubahnya jadi
**mesin deterministik yang tak bisa lupa** (BERTAHAP-2 dari audit topologi 2026-06-23).

🏢 Analogi: **mesin X-ray bandara** untuk tiap folder hasil-pecah sebelum "dikirim" (push) — kalau
ada rahasia nyelip ke koper yang salah, alarm bunyi + perjalanan ditahan. Bukan lagi petugas yang
harus ingat memeriksa satu-satu dengan mata.

## Cara Pakai

```bash
# Periksa satu folder hasil-pecah (peran/tier dibaca otomatis dari .claude-kit/.split-state):
node lib/split-guard.mjs --repo-root ../akses-frontend

# Paksa tingkat-sensitif (kalau marker belum ada / salah):
node lib/split-guard.mjs --repo-root ../akses-backend --tier sensitive
node lib/split-guard.mjs --repo-root ../akses-frontend --role frontend

# Senyap (cuma kode-keluar, untuk dipakai di skrip/gerbang):
node lib/split-guard.mjs --repo-root ../akses-frontend --quiet
```

Keluar-kode = **jumlah temuan GENTING** (0 = aman). Dipakai AI di **Step 0.7 "Verify"** split +
"Validasi per folder" (`SPLIT_REPO_PREPROVISION_v1.md`): GENTING > 0 → **JANGAN lapor "siap push"**.

## Input / Output

- **Input:** `--repo-root <folder>` (folder yang diperiksa; default = folder saat ini),
  `--tier <sensitive|feature|shared>` / `--role <peran>` (opsional; timpa marker), `--quiet`.
- **Tier (urut prioritas):** `--tier` > `--role` > `.claude-kit/.split-state` (`access_tier` lalu
  `role`) > **default `feature`** (paling ketat, fail-closed).
- **Output:** objek `{ Findings; Count; Genting; Penting; Rapikan; Tier; TierSource }`; tiap temuan =
  `{ Tingkat; Kode; File; Line; Pesan }`. Kode: `C1_ENV_RAHASIA`/`C1_ENV_LOKAL`/`C1_ENV_PUBLIK`,
  `C2_GITIGNORE`, `C3_KUNCI_RAHASIA`, `C4_NILAI_RAHASIA`, `C5_DB_DI_FRONTEND`, `TIER_KONFLIK`,
  `SCAN_TAK_LENGKAP`, `FOLDER_HILANG`.

## Yang diperiksa (deterministik, per folder)

| Kode | Cek | Tingkat |
|---|---|---|
| C1 | Berkas `.env`/`.env.local`/`*.env`/`.flaskenv`/`.envrc` **asli** nyelip — **vonis menurut ISI**: berisi rahasia → GENTING; env-lokal bersih → PENTING; env publik (`.env.production` cuma `NEXT_PUBLIC_*`) → RAPIKAN | GENTING/PENTING/RAPIKAN |
| C2 | `.gitignore` tak menutup `.env` **telanjang** (`.env.*`/`.env/`/`config/.env` saja TIDAK cukup) | GENTING |
| C3 | Repo non-rahasia (frontend/dashboard/shared) `.env.example` memuat kunci rahasia (`DATABASE_URL`/`SECRET`/`SERVICE_ROLE`/…) | GENTING |
| C4 | `.env.example` (tier mana pun) memuat **nilai** rahasia asli (`sk-`/`AKIA`/JWT/`rk_live_`/`whsec_`/PEM/URL-DB-ber-kredensial). Placeholder klasik (`sk-xxxx`/`AKIA…EXAMPLE`) **tidak** ditandai | GENTING |
| C5 | Repo tampilan (feature) punya struktur DB (`*.prisma`/`*.sql` migrasi/`db-schema.*`/`*.dbml`) — "frontend NOL kartu DB" | GENTING |
| TIER_KONFLIK | `.split-state` `access_tier` vs `role` bertentangan → pakai paling ketat + lapor | PENTING |
| SCAN_TAK_LENGKAP | Folder terlalu besar → pemindaian terpotong → **tak bilang "aman"** (fail-closed) | GENTING |

## Dependensi

Node ≥ 18 (tanpa paket eksternal). Reuse `lib/fs-text.mjs` (`readTextSafe`, `pathExists`). Berdiri sendiri.

## Catatan

- **TAK PERNAH mencetak nilai rahasia** (§8.1 #6): laporan cuma sebut nama berkas/kunci + nomor
  baris — tak pernah isinya. Dikunci tes "tak pernah memuat NILAI rahasia di pesan".
- **Fail-closed:** kalau peran tak terbaca dari `.split-state` → diasumsikan **paling ketat**
  (`feature`/non-rahasia). Lebih baik salah-tolak daripada salah-loloskan (default deny, §5).
- **Anti alarm-palsu:** kunci publik (`NEXT_PUBLIC_*`, `VITE_*`, `*PUBLISHABLE*`, `*_PUBLIC_KEY`)
  **tidak** ditandai. Placeholder klasik (`sk-xxxx…`, `AKIA…EXAMPLE`, `sk-000…`, URL DB ber-`localhost`/
  `<...>`/`your-…example`) dianggap contoh (tak ditandai); hanya nilai yang tampak **sungguhan** yang
  kena. `.env.production` yang isinya hanya var publik **tidak** memblokir gerbang (RAPIKAN). Backend/
  engine **boleh** punya `DATABASE_URL` + `prisma/` (tier `sensitive`).
- **Pola rahasia** sengaja diselaraskan dengan `lib/ai-config-check.mjs` + `templates/hooks/
  pre-commit-secret-scan.sh` (belum disatukan ke 1 modul karena `ai-config-check` dijaga
  byte-identik dengan padanan PowerShell-nya — konsolidasi = refactor terpisah). Sumber:
  `lib/split-guard.mjs:1`.
- **Bukan jaminan mutlak:** menutup pola kebocoran yang **diketahui** secara deterministik — bukan
  klaim "anti-bocor sempurna". Jujur soal batas (anti rasa-aman-palsu).
- **Batas yang diketahui (Mode-2 `shared` + `prisma/`):** robot **tak** menandai repo `shared` yang
  punya struktur DB (`prisma/`). Sebabnya: di Mode [1] (per-Lapisan), `shared` **memang** memegang
  `prisma/` (sah); di Mode [2] (per-Kapabilitas) `shared` harus TANPA `prisma/`. Robot tak tahu mode
  dari berkas → menandai akan jadi alarm-palsu untuk Mode [1] (default). Mitigasi tetap ada: repo
  `shared` dibaca **tim inti** (~10 orang), bukan 40-50 frontend (blast radius kecil), dan kunci
  rahasia di `shared/.env.example` tetap kena C3. Penegakan "shared NOL prisma di Mode-2" tetap lewat
  panduan + mata owner (lihat Step 0.4 Mode [2]). Cek otomatisnya = pekerjaan lanjutan (butuh mode
  ditulis ke `.split-state`).
- **Penegakan:** `tests/split-guard.test.mjs` — tiap skenario bocor tertangkap + folder
  bersih lolos + backend boleh punya DB + output tak bocorkan nilai + 14 celah/alarm-palsu hasil
  cek-silang skeptis 2026-06-24 dikunci tesnya (scan fail-closed, gitignore ketat, env non-standar,
  placeholder vendor, kunci publik, C1 by-isi, marker ber-kutip, C5 luas).
