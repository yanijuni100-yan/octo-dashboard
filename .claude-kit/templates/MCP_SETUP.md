# templates/MCP_SETUP.md - Setup MCP Servers untuk Tim AI-first

> Versi 2 · 2026-06-09 (tambah Option D - Tiered Shared Schema + Aturan #0 "1 login = 1 orang")

---

## Daftar Isi

- [0. Decision Tree - Pilih MCP yang Mana?](#0-decision-tree--pilih-mcp-yang-mana)
- [1. Pengantar](#1-pengantar)
- [2. PostgreSQL MCP dengan Schema Isolation](#2-postgresql-mcp-dengan-schema-isolation)
  - [2.1 Phase-Based DB Environment Strategy](#21-phase-based-db-environment-strategy-pilih-berdasarkan-stage-project)
  - [2.2 Seed Data Strategy](#22-seed-data-strategy--penting-untuk-ai-context-quality)
  - [2.3 Multi-Layer Backup Strategy](#23-multi-layer-backup-strategy-defense-in-depth)
  - [2.4 Pilih Multi-Schema Strategy](#24-pilih-multi-schema-strategy--sesuai-stage-project)
  - [2.5 Setup PostgreSQL Role per-User - Option A](#25-setup-postgresql-role-per-user--option-a-owner-only-step)
  - [2.6 Setup Per-Staff Isolated Schema - Option B](#26-setup-per-staff-isolated-schema--option-b-untuk-development)
  - [2.6b Setup Tiered Shared Schema - Option D (Senior DDL + Junior DML)](#26b-setup-tiered-shared-schema--option-d-senior-ddl--junior-dml)
  - [2.7 Setup Hybrid Strategy - Option C](#27-setup-hybrid-strategy--option-c-sandbox--read-prod)
  - [2.8 Backup Plan untuk Option B & C](#28-backup-plan-untuk-option-b--c-wajib)
  - [2.9 Restore Flow](#29-restore-flow-kalau-staff-accidentally-drop-table)
  - [2.10 Promote Sandbox Schema → Production Schema](#210-promote-sandbox-schema--production-schema-saat-fitur-ready)
  - [2.11 Verifikasi Schema Isolation](#211-verifikasi-schema-isolation)
  - [2.12 Connection String per-Dev](#212-connection-string-per-dev-format-benar--supabase-pooler)
  - [2.13 RLS Setup Workflow](#213-rls-setup-workflow-wajib-sebelum-data-produksi-masuk)
  - [2.14 MCP Config di Claude Code](#214-mcp-config-di-claude-code)
  - [2.15 Audit Trail](#215-audit-trail)
- [3. Supabase MCP (Owner Only - WARNING)](#3-supabase-mcp-owner-only--warning)
- [4. GitHub MCP](#4-github-mcp)
- [5. Filesystem MCP (Default Claude Code)](#5-filesystem-mcp-default-claude-code)
- [6. Anti-Pattern (Jangan Lakukan)](#6-anti-pattern-jangan-lakukan)
- [7. Audit + Rotation](#7-audit--rotation)
- [8. Troubleshooting](#8-troubleshooting)

---

## 0. Decision Tree - Pilih MCP yang Mana?

```
Kamu siapa?
├─ Staff IT / Developer schema-scoped
│   → Pakai PostgreSQL MCP (Section 2) ⭐ DEFAULT
│   → Username: dev_<dev>.<project-ref> via Supabase pooler
│   → Akses HANYA schema kamu (terisolasi dari tenant lain)
│   → WAJIB setup RLS di schema kamu sebelum data masuk (Section 2.13)
│
└─ Owner / Admin database
    → Boleh PostgreSQL MCP (Section 2) untuk operasi sehari-hari
    → Boleh Supabase MCP (Section 3) untuk debug owner-level
      ⚠️ Supabase MCP pakai service_role_key = BYPASS RLS = SUPERUSER
      ⚠️ JANGAN share key ini ke staff IT
      ⚠️ Hanya pakai saat butuh akses lintas-schema (audit, migrasi global)
```

**Aturan ketat untuk Staff IT**:
- ❌ JANGAN pakai username `postgres.<ref>` (= superuser, akses SEMUA tenant)
- ❌ JANGAN pakai `service_role_key` (= bypass RLS, akses data user lain)
- ✅ PAKAI username `dev_<dev>.<project-ref>` dengan password kamu sendiri
- ✅ PAKAI Supabase pooler URL (port 6543 untuk app, 5432 untuk DDL/migrasi)

---

## 1. Pengantar

### Apa itu MCP?

**MCP (Model Context Protocol)** = standar protokol yang dibikin Anthropic untuk hubungkan AI (Claude Code) ke **tool eksternal**: database, GitHub, filesystem, API custom, dll.

Analogi: kalau Claude Code = otak, MCP server = tangan & mata. Tanpa MCP, AI cuma bisa baca yang user paste manual. Dengan MCP, AI bisa query DB sendiri, baca issue GitHub, edit file di workspace.

### Kenapa standardize?

Kalau tiap dev setup MCP beda-beda → AI assistant tiap orang punya "power" beda → hasil kerja inconsistent + risiko keamanan beda.

Standar tim AI-first:

- **Semua dev** pakai MCP yang sama (PostgreSQL + GitHub + Filesystem).
- **Tiap dev** punya kredensial sendiri (PostgreSQL role per-user, GitHub PAT per-user).
- **Tidak ada** akses superuser via MCP (cegah privilege escalation).
- **Audit trail** aktif (siapa query apa, kapan).

> *Privilege escalation* = naik level akses tanpa izin. Mis. user biasa bisa jadi admin lewat bug → cegah dengan least-privilege di awal.

---

## 2. PostgreSQL MCP dengan Schema Isolation

### Latar belakang security

**Jangan pakai Supabase MCP** (yang official) untuk staff IT. Alasan:

- Supabase MCP butuh **service_role_key** → bypass RLS (Row-Level Security) → AI bisa baca/edit data user lain.
- Service_role_key = full superuser → tidak bisa di-scope per-orang.
- Audit trail terbatas (semua query muncul atas nama service_role).

**Pakai `@modelcontextprotocol/server-postgres`** dengan **PostgreSQL role per-user** + **schema isolation**. Tiap dev cuma bisa akses schema yang relevan dengan kerjaannya.

### Aturan #0 (WAJIB, berlaku SEMUA option): 1 login = 1 orang. Schema bersama ≠ password bersama.

Walau beberapa backend dev pakai **SATU schema yang sama** (mis. 6 orang sama-sama ke schema `shared_main`), mereka **TIDAK boleh berbagi 1 username + 1 password**. Tiap orang = **1 login DB sendiri**.

**Analogi (3 lapis):**
- 🏢 **Sehari-hari**: 1 gedung kantor dipakai bersama, tapi tiap karyawan punya **kartu akses sendiri** — bukan 1 kartu digilir. Kalau 1 kartu hilang, cabut kartu itu saja; gedung & karyawan lain tetap jalan.
- 📱 **Tools populer**: kayak **rekening bersama tapi tiap orang punya kartu ATM + PIN beda**. Atau Netflix "1 rumah" tapi tiap orang punya **profil sendiri**. Uang/film sama, tapi siapa-ngapain tetap ke-track per orang.
- 🎯 **Di proyekmu**: 6 backend dev semua ke schema `shared_main`, **TAPI** login-nya beda — `dev_andi`, `dev_budi`, `dev_citra`, dst. Bukan satu `backend / password123` dipakai ramai-ramai.

**Kenapa wajib (3 alasan):**
1. **Audit jelas** — kalau ada tabel ter-`DROP` atau data hilang, log DB tahu **PERSIS siapa** yang jalankan. Kalau login bersama, yang ke-catat cuma "salah satu dari 6 orang" → mustahil usut.
2. **Cabut akses 1 orang tanpa ganggu 5 lainnya** — staff resign? Tinggal `DROP ROLE dev_dia`. Kalau password bersama, harus ganti password + broadcast ulang ke semua orang (ribet + rawan bocor).
3. **Hak akses bisa beda per-orang** — senior boleh migrasi, junior tidak (lihat Option D di 2.6b). Ini **mustahil** kalau semua pakai 1 login yang sama.

> Implementasi teknis "1 login = 1 orang" ada di tiap SQL template di bawah (`CREATE ROLE <orang> LOGIN ...` per nama, bukan 1 role dipakai bareng).

### 2.1. Phase-Based DB Environment Strategy (PILIH BERDASARKAN STAGE PROJECT)

**SEBELUM milih multi-schema option**, tentukan dulu **DB environment strategy** sesuai stage project kamu. Ini KRITIKAL - salah pilih = staff bisa accidentally rusak data prod.

#### 🚦 Aturan Emas (Conditional, BUKAN Absolut)

**TIDAK ADA staff non-programmer yang boleh punya WRITE access ke schema PROD - KALAU ada user real / payment masuk / PII customer.**

Aturan ini BUKAN absolut. Untuk **early-stage project tanpa user real**, aturan ini TIDAK berlaku karena:
- Belum ada PII customer yang harus dilindungi (compliance N/A)
- Belum ada revenue stream yang loss kalau down
- Belum ada reputation risk (no users tahu kalau ada incident)
- Backup berlapis cukup mitigasi risk DROP TABLE (recoverable <1 hari)
- Velocity early-stage > Safety overhead

Backup mengurangi DAMPAK kalau bencana terjadi. Access control CEGAH bencana terjadi. **Kedua-duanya perlu saat ada user real**. Sebelum itu - backup berlapis sudah cukup.

#### Phase 0 - Pre-Launch (Project Belum Punya User Real) ⭐ KAMU SEKARANG

**Setup**: **1 Supabase project = single environment** (technically called "DEV" tapi sebenarnya satu-satunya DB yang ada)

```
Supabase Project: <project> (single environment)
├── Schema dev_a   (Bagus owner - full CREATE/SELECT/INSERT/UPDATE/DELETE)
├── Schema dev_b   (Andi owner - full akses)
├── Schema dev_c   (Citra owner - full akses)
├── Schema shared_main       (shared "main" schema - semua staff FULL akses sementara)
└── Schema public       (default PostgreSQL)
```

**Staff IT dapat full WRITE access ke schema shared_main**, plus schema mereka sendiri. Aturan emas "no write prod" **TIDAK berlaku** di phase ini.

**Strategy**:
- Belum ada user real = belum ada PROD secara konsep
- Staff full akses Option B atau C (per-staff schema isolated) + shared shared_main
- Faker library untuk seed data realistic (penting untuk AI context, lihat 2.2 di bawah)
- Backup 3-5 layer aktif (Supabase Daily + per-schema pg_dump + Cloudflare R2 + BackBlaze B2)
- Owner masih kontrol Prisma migration via Git PR (gatekeeper untuk DDL structure)

**Kapan TRANSISI ke Phase 1 (split DEV + PROD)?**

Trigger transisi (ANY of these → IMMEDIATELY split):
- 🔴 **First real user signup** (bukan owner/staff IT)
- 🔴 **First payment / transaction masuk** (revenue stream aktif)
- 🔴 **First PII customer data masuk** (email/NPWP/alamat real)
- 🔴 **Compliance requirement aktif** (GDPR, UU PDP, SOC2, klien minta audit)
- 🔴 **SLA dengan klien eksternal** (uptime/response time contract)

Saat salah satu trigger di atas terjadi → IMMEDIATELY setup Phase 1 (split DEV + PROD).

**Cocok untuk akses sekarang (5% progress)**. Pakai Phase 0 sampai salah satu trigger di atas.

#### Phase 1 - Soon Launch / Early Users (Salah Satu Trigger Phase 0 Terpenuhi)

**Setup**: **2 Supabase project terpisah** (free tier cukup, max 2 project)

```
Supabase Project: <project>-dev (existing, downgrade dari "<project>" yang dulu)
└── Staff full access (dev_a/b/c + shared_main)

Supabase Project: <project>-prod (BARU, dispawn saat trigger Phase 0 hit)
└── Owner only - staff TIDAK punya akses
```

**Transisi Phase 0 → Phase 1 step-by-step**:
1. Spin up Supabase project baru `<project>-prod`
2. Export schema dari `<project>` (current) via `pg_dump --schema-only`
3. Import schema-only ke `<project>-prod` (no data, fresh start)
4. Setup user real signup di app pakai env var DATABASE_URL → `<project>-prod`
5. Restrict staff: revoke akses ke `<project>-prod`, mereka stay di `<project>-dev` (rename `<project>` → `<project>-dev`)
6. Vercel preview deploy → connect `<project>-dev` DB
   Vercel production deploy → connect `<project>-prod` DB (env var per-environment)
7. Setup migration workflow: owner approve PR yang ubah schema → Vercel build run `prisma migrate deploy` ke `<project>-prod`

**Aturan emas WAJIB berlaku** mulai Phase 1: zero staff write access ke `<project>-prod`.

#### Phase 2 - Post-Launch Scale (>1000 Users atau Multiple Domain)

**Setup**: 3 environment (DEV + STAGING + PROD) **ATAU** Supabase Pro Branching

```
Option A: 3 environment manual
  - DEV: staff develop
  - STAGING: owner test merged code dengan data near-prod (sanitized snapshot)
  - PROD: live users

Option B: Supabase Pro ($25/bulan) + Branching
  - Per-PR auto-create DB branch (ephemeral)
  - Staff develop di branch DB-nya sendiri
  - Merge to main = auto-apply migration ke prod
```

**Untuk akses spesifik**: belum perlu Phase 2 sampai user 1000+ atau monthly active users tinggi.

### 2.2. Seed Data Strategy - Penting untuk AI Context Quality

**Masalah**: Kalau DEV environment cuma punya "Test User 1-5", AI tidak dapat context realistic → bisa miss edge cases (nama dengan apostrophe, panjang nama, format NPWP, distribusi performa real).

**Solusi**: Seed data realistic via Faker library (Indonesian locale).

```typescript
// prisma/seed.ts (jalankan: npx prisma db seed)
import { PrismaClient } from '@prisma/client'
import { faker } from '@faker-js/faker/locale/id_ID'

const prisma = new PrismaClient()

async function main() {
  // 1000 user Indonesia dengan distribusi realistic
  for (let i = 0; i < 1000; i++) {
    await prisma.user.create({
      data: {
        nama: faker.person.fullName(),       // "Bagus Setiawan", "Sri Wahyuni"
        email: faker.internet.email(),
        npwp: faker.numerics({ length: 16 }),
        alamat: faker.location.streetAddress(),
        created_at: faker.date.past({ years: 2 }),
      }
    })
  }
  
  // 10000 transaksi dengan range tanggal & amount realistic
  // dst untuk relasi yang penting
}

main()
```

**Setup `package.json`**:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

**Jalankan**: `npx prisma db seed` setiap kali setup DEV environment baru atau reset data.

**Hasil**: AI dapat context realistic → catch edge cases yang mirip prod → fitur lebih robust saat naik ke PROD.

**Phase 2+ Alternative**: Sanitized snapshot prod → DEV (monthly basis). Owner export prod, jalankan script masking (mask email, hash NPWP, ganti nama Faker), restore ke DEV.

### 2.3. Multi-Layer Backup Strategy (Defense in Depth)

Backup berlapis untuk redundancy + selective restore:

| Layer | Tool | Frekuensi | Retention | Selective Restore? | Cost |
|---|---|---|---|---|---|
| **L1: Supabase Daily Backup** | Built-in (free tier) | Daily otomatis | 7 hari (free) / 30 hari (Pro) | ❌ Full project only | Gratis |
| **L2: Manual Snapshot** | Owner via Supabase Dashboard | Pre-migration / risky op | Sampai owner delete | ❌ Full project only | Gratis |
| **L3: Per-Schema pg_dump** ⭐ | GitHub Action cron 03:00 WIB | Daily otomatis | 30 hari | ✅ **Per-schema selective** | ~$1/bulan storage |
| **L4: Off-site Backup R2** | Cloudflare R2 cron sync | Daily mirror dari L3 | 90 hari | ✅ Per-schema | ~$0.5/bulan |
| **L5: BackBlaze B2 Archive** | Monthly cold storage | Monthly | 1 tahun | ✅ Per-schema | ~$0.2/bulan |

**Total backup cost**: ~$2/bulan untuk redundancy berlapis. Insurance terbaik.

**Konfigurasi**: Lihat `.github/workflows/backup-schemas.yml` (L3) + setup manual untuk L4 + L5.

### 2.4. Pilih Multi-Schema Strategy - Sesuai Stage Project

**Sebelum lanjut setup**, pilih strategi yang cocok dengan stage project + level trust tim:

#### Option A - Shared Schema, Restricted CREATE (Production / Mature Project)

**Setup**: Semua staff pakai 1 schema bersama (mis. `pbn` atau `shared_main`). Owner kontrol DDL via Prisma migration di Git.

| Aspek | Detail |
|---|---|
| Schema | `pbn` (1 schema shared) |
| Staff permission | SELECT, INSERT, UPDATE, DELETE (CRUD data) - **TIDAK** punya CREATE TABLE |
| Schema change | Lewat Git PR + Prisma migrate, owner approve |
| Risk | Low - staff tidak bisa rusak struktur DB accidentally |
| Bottleneck owner | Code review PR (sama dengan code change biasa) |
| **Cocok untuk** | Project mature, data sudah live, butuh stabilitas |

→ Setup detail di section 2.5 di bawah.

#### Option B - Per-Staff Isolated Schema (Development / Early Stage) ⭐ RECOMMENDED untuk 5-30% progress

**Setup**: Tiap staff dapat **schema terisolasi sendiri**, full owner di schema-nya (CREATE TABLE bebas, eksperimen bebas).

| Aspek | Detail |
|---|---|
| Schema | `dev_a` (untuk dev_a), `dev_b`, `dev_c`, dst. |
| Staff permission | **OWNER schema sendiri** → full CREATE/ALTER/DROP TABLE |
| Cross-schema access | **BLOCKED** - dev_a tidak bisa lihat data dev_b |
| Schema change | Staff lakukan langsung di schema-nya. Tidak perlu owner. |
| Risk | Medium - staff bisa drop table own schema (mitigasi via backup) |
| Bottleneck owner | **Minimal** - cuma untuk promote ke schema main saat ready |
| **Cocok untuk** | Eksplorasi domain (mis. A ngerjain namecheap API, B setup security login), early-stage development |

→ Setup detail di section 2.6 di bawah.

#### Option C - Hybrid (Best of Both)

**Setup**: Staff punya sandbox schema sendiri (`dev_a` dst.) + read-only access ke schema shared (`shared_main` prod) + sandbox-only write.

→ Setup detail di section 2.7.

#### Option D - Tiered Shared Schema (Senior bisa DDL, Junior DML-only) ⭐ untuk tim backend berjenjang

**Setup**: 1 schema bersama (mis. `shared_main`), tapi hak akses **berjenjang**. Senior boleh ubah struktur tabel (migrasi/DDL), junior **hanya baca + tulis data** (DML) — tanpa hak hapus/ubah struktur tabel.

| Aspek | Detail |
|---|---|
| Schema | 1 schema shared (mis. `shared_main`) |
| Senior permission | DML + **DDL** (CREATE/ALTER/DROP TABLE, migrasi) di schema bersama |
| Junior permission | SELECT, INSERT, UPDATE, DELETE — **TIDAK** punya CREATE/ALTER/DROP/TRUNCATE |
| Cross-staff | semua lihat data yang sama (1 schema), tapi hak ubah-struktur dibatasi per-tier |
| Risk | Low-Medium - junior tak bisa rusak struktur DB; senior tetap hati-hati (backup sebelum migrasi destruktif) |
| **Cocok untuk** | Tim backend campur **2 senior + 3-4 junior** yang kerja di 1 codebase/DB bersama |

→ Setup detail + SQL siap-paste + kartu per-tier di section 2.6b di bawah.

**Bandingkan singkat**: Option A = semua CRUD sama (DDL lewat owner/Git PR). Option B = tiap orang punya schema sendiri (full DDL, terisolasi). **Option D = 1 schema bersama, tapi DDL cuma untuk tier senior.**

---

### 2.5. Setup PostgreSQL Role per-User - Option A (Owner-only step)

**Catatan**: Hanya OWNER yang jalankan SQL berikut di Supabase SQL Editor (login sebagai superuser `postgres`). Staff IT cukup terima username + password dari owner - tidak perlu jalankan ini.

**Asumsi**: ada schema multi-tenant di Supabase project (`<project-ref>` = ID project Supabase, mis. `GANTI_PROJECT_REF`):

- `public` - schema umum (semua bisa baca metadata)
- `pbn` - schema project PBN (untuk tim dev)
- `internal_data` - schema sensitif (cuma admin)
- `analytics` - schema laporan (read-only untuk semua)

```sql
-- ============================================
-- 1. Bikin role per-dev (sesuaikan nama)
-- Nama role di PostgreSQL = `dev_<dev>` (TANPA project-ref)
-- Project-ref disisipkan otomatis Supabase pooler saat koneksi.
-- ============================================
CREATE ROLE dev_a LOGIN PASSWORD 'GANTI_PASSWORD_KUAT_1';
CREATE ROLE dev_b LOGIN PASSWORD 'GANTI_PASSWORD_KUAT_2';
CREATE ROLE dev_c LOGIN PASSWORD 'GANTI_PASSWORD_KUAT_3';
CREATE ROLE dev_f LOGIN PASSWORD 'GANTI_PASSWORD_KUAT_4';
CREATE ROLE admin_dev  LOGIN PASSWORD 'GANTI_PASSWORD_KUAT_5';

-- ============================================
-- 2. Default: REVOKE semua dari semua schema
--    (clean slate, baru kasih akses yang perlu)
-- ============================================
REVOKE ALL ON SCHEMA public        FROM dev_a, dev_b, dev_c, dev_f;
REVOKE ALL ON SCHEMA pbn           FROM dev_a, dev_b, dev_c, dev_f;
REVOKE ALL ON SCHEMA internal_data FROM dev_a, dev_b, dev_c, dev_f;
REVOKE ALL ON SCHEMA analytics     FROM dev_a, dev_b, dev_c, dev_f;

-- ============================================
-- 3. Beri akses schema pbn ke tim dev
-- ============================================
GRANT USAGE ON SCHEMA pbn TO dev_a, dev_b, dev_c, dev_f;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pbn
  TO dev_a, dev_b, dev_c, dev_f;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pbn
  TO dev_a, dev_b, dev_c, dev_f;

-- Default privilege untuk tabel baru yang dibuat di pbn nanti:
ALTER DEFAULT PRIVILEGES IN SCHEMA pbn
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
  TO dev_a, dev_b, dev_c, dev_f;

-- ============================================
-- 4. Beri akses analytics READ-ONLY ke semua dev
-- ============================================
GRANT USAGE ON SCHEMA analytics TO dev_a, dev_b, dev_c, dev_f;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics
  TO dev_a, dev_b, dev_c, dev_f;

ALTER DEFAULT PRIVILEGES IN SCHEMA analytics
  GRANT SELECT ON TABLES
  TO dev_a, dev_b, dev_c, dev_f;

-- ============================================
-- 5. PASTIKAN internal_data TIDAK ter-akses
-- ============================================
-- (sudah di-REVOKE di step 2, ini cuma verifikasi)
-- Test: login sebagai dev_a → SELECT * FROM internal_data.users
-- Harus error "permission denied for schema internal_data"

-- ============================================
-- 6. Cegah privilege escalation
-- ============================================
-- Cegah dev bikin tabel sendiri di schema yang bukan miliknya
REVOKE CREATE ON SCHEMA public FROM dev_a, dev_b, dev_c, dev_f;
REVOKE CREATE ON SCHEMA pbn    FROM dev_a, dev_b, dev_c, dev_f;

-- Cegah dev kasih grant ke orang lain (chain privilege)
-- Default: GRANT tanpa WITH GRANT OPTION (sudah aman), tapi verify:
-- Jangan PERNAH jalankan: GRANT ... WITH GRANT OPTION
```

### 2.6. Setup Per-Staff Isolated Schema - Option B (Untuk Development)

**Tujuan**: Tiap staff punya schema isolated, full CREATE permission di schema-nya sendiri. Owner TIDAK jadi bottleneck untuk DDL.

---

## ⚠️ WARNING - JANGAN TULIS PASSWORD DI FILE INI

> SQL di bawah adalah **TEMPLATE**. `GANTI_PASSWORD_KUAT_N` = placeholder text, **BUKAN password real**.
>
> **OWNER WAJIB**:
> 1. **JANGAN PERNAH** tulis password real di file `MCP_SETUP.md` (atau file `.md` apapun di repo).
> 2. Run SQL **langsung di Supabase SQL Editor** (browser), ganti placeholder INLINE di editor - bukan di file repo.
> 3. **Share password via secure DM** (Signal/Telegram encrypted), bukan email atau channel chat publik.
> 4. **Hapus pesan DM** setelah staff konfirm sudah simpan ke password manager.
>
> **STAFF WAJIB**:
> 1. Simpan password ke **password manager** (1Password, Bitwarden) - bukan Notepad atau file teks biasa.
> 2. Paste connection string ke `.env.local` di laptop sendiri - file ini sudah ter-gitignore default.
> 3. **JANGAN paste password** di chat publik / Slack channel / email / commit message.
> 4. Kalau owner kirim password via email (BUKAN best practice), pakai password manager untuk auto-fill, jangan copy-paste manual.

### Owner Workflow Secure Password Sharing (Step-by-Step)

```
Step 1: Owner generate password kuat di password manager
        (1Password "Generate Password" → 24 char, mixed case + symbol)

Step 2: Owner login Supabase Dashboard → SQL Editor (sebagai postgres superuser)

Step 3: Paste SQL template di bawah, EDIT INLINE di SQL Editor browser:
        CREATE ROLE dev_a LOGIN PASSWORD 'aB9$xY2!mN7@kQ4...';
        ↑ EDIT INI DI BROWSER, BUKAN DI FILE REPO

Step 4: Run SQL → role terbentuk

Step 5: Owner buat connection string lengkap:
        DATABASE_URL=postgresql://dev_a.<project-ref>:aB9$xY2!mN7@kQ4...@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres

Step 6: Owner DM ke staff via Signal/Telegram (encrypted):
        "Connection string DB kamu (jangan share ke siapapun):
         DATABASE_URL=postgresql://dev_a.<ref>:aB9$xY2!mN7@kQ4...@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
         
         Simpan di password manager + paste ke .env.local kamu.
         Konfirm kalau sudah."

Step 7: Tunggu staff konfirm "OK, sudah simpan"

Step 8: Owner HAPUS pesan DM dari Signal/Telegram (paranoia level)
```

### Staff Workflow Secure Password Storage

```
Step 1: Buka password manager (1Password/Bitwarden)
Step 2: Tambah entry baru:
        - Title: "shared_main-project1 DB - dev_a"
        - Username: dev_a.<ref>
        - Password: aB9$xY2!mN7@kQ4...
        - URL: aws-1-ap-southeast-1.pooler.supabase.com:6543
        - Notes: "Project <project> - dev DB. Jangan share."
Step 3: Konfirm ke owner via DM: "OK sudah simpan ke 1Password"
Step 4: Buka project di laptop:
        cd /path/to/project
        cp .env.example .env.local
        notepad .env.local (atau VS Code)
Step 5: Paste connection string DARI password manager (bukan dari DM lagi)
Step 6: Save .env.local
Step 7: Verifikasi .gitignore:
        cat .gitignore | grep "env.local"
        Harus ada: ".env.local" atau ".env*"
Step 8: Test:
        npx prisma generate
        pnpm dev → http://localhost:3000 jalan tanpa error "database unreachable"
```

### Pre-commit Hook untuk Mencegah Accidental Password Commit (Optional)

Owner setup `.husky/pre-commit` di project untuk block commit kalau detect .env file atau pattern password:

```bash
#!/bin/sh
# .husky/pre-commit (require husky installed: pnpm add -D husky && pnpm husky init)

# Block kalau .env* file ke-stage
if git diff --cached --name-only | grep -E '^\.env'; then
  echo "🚨 BLOCKED: jangan commit .env files. Pakai .env.example untuk template saja."
  exit 1
fi

# Block kalau ada pattern password hardcoded di file yang ter-stage
if git diff --cached | grep -E "PASSWORD\s*=\s*['\"][^'\"]{6,}['\"]"; then
  echo "🚨 BLOCKED: terdeteksi hardcoded password di staged files."
  echo "Pakai env var dari .env.local sebagai gantinya."
  exit 1
fi

# Block kalau ada pattern token sensitif (sk-ant-, eyJ, dst.)
if git diff --cached | grep -E "sk-ant-|eyJ[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{36}"; then
  echo "🚨 BLOCKED: terdeteksi token sensitif (Anthropic API key / JWT / GitHub PAT)."
  echo "Pindahkan ke .env.local. Lihat SECURITY_INCIDENT_PLAYBOOK.md."
  exit 1
fi

exit 0
```

Setup once per project, semua dev otomatis dapat protection ini saat clone + `pnpm install`.

---

### SQL Template (RUN DI SUPABASE SQL EDITOR, ISI PASSWORD INLINE DI BROWSER)

```sql
-- ============================================
-- 1. Bikin role per-staff (sama seperti Option A)
-- ============================================
CREATE ROLE dev_a LOGIN PASSWORD 'GANTI_PASSWORD_KUAT_1';
CREATE ROLE dev_b LOGIN PASSWORD 'GANTI_PASSWORD_KUAT_2';
CREATE ROLE dev_c LOGIN PASSWORD 'GANTI_PASSWORD_KUAT_3';

-- ============================================
-- 2. Bikin schema per-staff, staff = OWNER schema
-- ============================================
CREATE SCHEMA dev_a AUTHORIZATION dev_a;
CREATE SCHEMA dev_b AUTHORIZATION dev_b;
CREATE SCHEMA dev_c AUTHORIZATION dev_c;

-- AUTHORIZATION = staff jadi OWNER schema → full DDL (CREATE/ALTER/DROP).
-- Tidak perlu GRANT manual untuk DDL - sudah include di OWNER privilege.

-- ============================================
-- 3. BLOCK cross-schema access (dev_a tidak bisa lihat dev_b)
-- ============================================
REVOKE ALL ON SCHEMA dev_b FROM dev_a, dev_c;
REVOKE ALL ON SCHEMA dev_c FROM dev_a, dev_b;
REVOKE ALL ON SCHEMA dev_a FROM dev_b, dev_c;

-- ============================================
-- 4. BLOCK staff akses ke schema 'shared_main' atau schema prod lainnya
--    (kalau ada, sesuaikan nama)
-- ============================================
REVOKE ALL ON SCHEMA public FROM dev_a, dev_b, dev_c;
-- REVOKE ALL ON SCHEMA shared_main FROM dev_a, dev_b, dev_c; -- uncomment kalau ada

-- ============================================
-- 5. Set search_path default ke schema sendiri
--    Tujuan: tiap staff query `SELECT * FROM users` otomatis cari di schema-nya
-- ============================================
ALTER USER dev_a SET search_path TO dev_a;
ALTER USER dev_b SET search_path TO dev_b;
ALTER USER dev_c SET search_path TO dev_c;

-- ============================================
-- 6. Test isolation (login sebagai dev_a)
-- ============================================
-- SELECT * FROM dev_b.users;  -- harus error "permission denied for schema dev_b"
-- CREATE TABLE dev_a.test_table (id int); -- harus sukses
-- DROP TABLE dev_a.test_table; -- harus sukses
```

### 2.6b. Setup Tiered Shared Schema - Option D (Senior DDL + Junior DML)

**Kapan pakai**: 1 schema bersama (mis. `shared_main`), tim backend campur **senior + junior**. Senior boleh migrasi (ubah struktur tabel), junior **hanya baca + tulis data** tanpa hak hapus/ubah struktur.

**Model 2 grup hak + login per-orang**:
- `app_senior` (grup NOLOGIN) → pemilik schema + semua tabel → boleh DDL.
- `app_junior` (grup NOLOGIN) → DML-only (SELECT/INSERT/UPDATE/DELETE).
- Tiap orang punya **login sendiri** yang "menempel" ke salah satu grup (**Aturan #0**: 1 login = 1 orang).

> **Password**: ikuti WARNING di section 2.6 — JANGAN tulis password real di file ini. Set password terpisah di SQL Editor (langkah 4 di bawah) + kirim via password manager.

> **Sebelum prod**: Option D = staff bisa WRITE ke schema bersama. Patuhi "Aturan Emas" di 2.1 — kalau sudah ada user/PII/payment real, schema ini harus PROD-terpisah & junior tetap DML-only. Tes SQL ini di **staging** dulu (schema mirip prod), baru promote.

> **SQL ini sudah diuji empiris** di proyek Supabase live (PostgreSQL 17, `postgres` non-superuser) + 4 lensa adversarial. Versi di bawah = v3 (sudah ditambal: REVOKE CREATE dari PUBLIC, idempotent penuh, guard schema sistem, RLS WAJIB-bersyarat).

#### SQL Template (RUN DI SUPABASE SQL EDITOR sebagai `postgres`, GANTI `{{SCHEMA}}`)

```sql
-- =====================================================================
-- OPTION D - TIERED SHARED SCHEMA (Senior bisa DDL, Junior DML-only)
-- Ganti {{SCHEMA}} dengan nama schema KERJA TIM (mis. shared_main).
-- JALANKAN sebagai 'postgres' di Supabase SQL Editor.
-- IDEMPOTENT: aman dijalankan ulang (mis. saat tambah dev / tabel baru).
-- =====================================================================

-- ---------- GUARD: tolak schema sistem (cegah {{SCHEMA}}=public dll) ----------
DO $$
BEGIN
  IF '{{SCHEMA}}' IN ('public','auth','storage','extensions','graphql','graphql_public',
                      'realtime','vault','pgsodium','supabase_functions','supabase_migrations',
                      '_analytics','net','cron') THEN
    RAISE EXCEPTION 'Jangan jalankan Option D pada schema sistem "%". Pakai schema kerja tim (mis. shared_main).', '{{SCHEMA}}';
  END IF;
END $$;

-- ---------- 0. Grup hak akses (NOLOGIN, idempotent) ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_senior') THEN CREATE ROLE app_senior NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_junior') THEN CREATE ROLE app_junior NOLOGIN; END IF;
END $$;

-- Supaya 'postgres' tetap bisa kelola object yang nanti dimiliki app_senior (aman diulang).
GRANT app_senior TO postgres;

-- ---------- 1. Senior = pemilik schema + semua tabel (boleh DDL) ----------
ALTER SCHEMA {{SCHEMA}} OWNER TO app_senior;

-- Pindahkan kepemilikan tabel + sequence existing ke grup senior.
-- Per-iterasi pakai EXCEPTION: kalau 1 object tak bisa di-reown (mis. dimiliki
-- supabase_admin), SKIP + lanjut — jangan gagalkan & rollback seluruh script.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT format('ALTER TABLE %I.%I OWNER TO app_senior', schemaname, tablename) AS cmd
      FROM pg_tables WHERE schemaname = '{{SCHEMA}}'
    UNION ALL
    SELECT format('ALTER SEQUENCE %I.%I OWNER TO app_senior', sequence_schema, sequence_name)
      FROM information_schema.sequences WHERE sequence_schema = '{{SCHEMA}}'
  LOOP
    BEGIN
      EXECUTE r.cmd;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'SKIP (tak bisa re-own, cek manual): %', r.cmd;
    END;
  END LOOP;
END $$;

-- ---------- 2. Cabut CREATE dari PUBLIC + junior, lalu beri DML ke junior ----------
-- PENTING: tanpa REVOKE CREATE, junior bisa CREATE TABLE → jadi OWNER → bisa
-- ALTER/DROP tabel itu. Baris ini menutup celah DDL via kepemilikan.
REVOKE CREATE ON SCHEMA {{SCHEMA}} FROM PUBLIC;
GRANT  USAGE  ON SCHEMA {{SCHEMA}} TO app_junior;
REVOKE CREATE ON SCHEMA {{SCHEMA}} FROM app_junior;
REVOKE ALL ON ALL TABLES IN SCHEMA {{SCHEMA}} FROM PUBLIC;

-- Junior: HANYA baca + tulis DATA. TANPA TRUNCATE, TANPA CREATE/DROP/ALTER.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA {{SCHEMA}} TO app_junior;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA {{SCHEMA}} TO app_junior;

-- Tabel BARU yang dibuat senior nanti → otomatis DML untuk junior.
ALTER DEFAULT PRIVILEGES FOR ROLE app_senior IN SCHEMA {{SCHEMA}}
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_junior;
ALTER DEFAULT PRIVILEGES FOR ROLE app_senior IN SCHEMA {{SCHEMA}}
  GRANT USAGE, SELECT ON SEQUENCES TO app_junior;

-- ---------- 3. Login per-orang (1 login = 1 orang) — IDEMPOTENT ----------
-- Ganti isi 2 array di bawah dengan nama login tim kamu. Password diisi langkah 4.
DO $$
DECLARE
  seniors text[] := ARRAY['dev_andi','dev_sinta'];   -- boleh migrasi/DDL
  juniors text[] := ARRAY['dev_budi','dev_rina','dev_tono'];  -- DML-only
  nm text;
BEGIN
  FOREACH nm IN ARRAY seniors LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = nm) THEN
      EXECUTE format('CREATE ROLE %I LOGIN', nm);
    END IF;
    EXECUTE format('GRANT app_senior TO %I', nm);
    -- objek baru yang dibuat senior → otomatis dimiliki GRUP app_senior
    -- (bukan pribadi), supaya senior lain ikut bisa ALTER:
    EXECUTE format('ALTER ROLE %I SET role = %L', nm, 'app_senior');
  END LOOP;
  FOREACH nm IN ARRAY juniors LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = nm) THEN
      EXECUTE format('CREATE ROLE %I LOGIN', nm);
    END IF;
    EXECUTE format('GRANT app_junior TO %I', nm);
  END LOOP;
END $$;

-- ---------- 4. Set password TERPISAH (WAJIB — login belum bisa dipakai tanpa ini) ----------
-- Role di atas = role DB murni (BUKAN user Supabase Auth/GoTrue) & BELUM bisa login
-- sampai diberi password. Jalankan satu per satu, ganti inline (jangan di file repo):
--   ALTER ROLE dev_andi  PASSWORD 'GANTI_KUAT_1';
--   ALTER ROLE dev_sinta PASSWORD 'GANTI_KUAT_2';
--   ALTER ROLE dev_budi  PASSWORD 'GANTI_KUAT_3';   -- dst per dev
-- Login string pooler: dev_andi.<project-ref> (lihat 2.12).
-- DDL/migrasi senior → pakai port 5432 (session/direct), BUKAN pooler 6543.

-- ---------- 5. RLS — KAPAN WAJIB (bukan sekadar opsional) ----------
-- Option D mengatur siapa boleh ubah STRUKTUR (DDL), BUKAN baris mana yang
-- boleh dilihat. Junior dapat DML ke SEMUA tabel; senior = pemilik → BYPASS RLS.
-- ENABLE + FORCE RLS + policy WAJIB KALAU: schema ini multi-tenant (data milik
-- banyak customer) DAN login dipakai untuk query data app (bukan cuma migrasi).
-- Tanpa RLS, junior & senior bisa baca/tulis baris SEMUA tenant. Per tabel:
--   ALTER TABLE {{SCHEMA}}.<tabel> ENABLE ROW LEVEL SECURITY;  -- aktifkan dulu
--   ALTER TABLE {{SCHEMA}}.<tabel> FORCE  ROW LEVEL SECURITY;  -- owner (senior) ikut tunduk
--   CREATE POLICY ... ;   -- lihat RLS_SETUP_PROMPT.md / section 2.13
-- View BYPASS RLS (security definer). PG15+: ALTER VIEW ... SET (security_invoker = true).
```

#### Verifikasi (login sebagai junior, harus sebagian GAGAL = benar)

```sql
-- Cek junior TIDAK punya CREATE di schema (harus 'f'/false):
SELECT has_schema_privilege('app_junior', '{{SCHEMA}}', 'CREATE');

SET ROLE dev_budi;   -- simulasi login junior

-- Harus BERHASIL (DML):
SELECT * FROM {{SCHEMA}}.<tabel> LIMIT 1;
-- INSERT / UPDATE / DELETE data → boleh

-- Harus GAGAL ("permission denied" / "must be owner of table") = INI YANG BENAR:
CREATE TABLE {{SCHEMA}}.coba (id int);
DROP TABLE {{SCHEMA}}.<tabel>;
ALTER TABLE {{SCHEMA}}.<tabel> ADD COLUMN x int;
TRUNCATE {{SCHEMA}}.<tabel>;

RESET ROLE;
```

Setup **benar** kalau: `has_schema_privilege` = false **dan** 4 perintah DDL terakhir semuanya gagal untuk junior. Kalau ada yang berhasil → cek ulang langkah 2 (REVOKE CREATE).

#### Catatan keandalan (dari uji empiris)

- **DDL pakai koneksi DIRECT port 5432**, bukan pooler 6543. Setelan `SET role = app_senior` (yang bikin tabel baru otomatis milik grup) bisa tak konsisten lewat pooler transaction-mode.
- **Tambah senior baru nanti?** Cukup tambahkan namanya ke array `seniors` lalu **jalankan ulang script** (sudah idempotent) — ini juga memasang setelan `SET role` untuk dia. Tanpa itu, tabel buatan dia jadi milik pribadi → senior lain tak bisa ALTER + junior bisa kehilangan DML ke tabel baru itu secara senyap.
- **Jangan `RESET ROLE` saat menjalankan DDL** sebagai senior — nanti tabel baru jadi milik login pribadimu, bukan grup.

#### Kartu 1-halaman per tier (copy / print, kasih ke tiap dev)

**KARTU AKSES — BACKEND JUNIOR** (login `dev_<nama>`, grup `app_junior`)

```
✅ BOLEH:
  - Baca data:    SELECT ...
  - Tambah data:  INSERT ...
  - Ubah data:    UPDATE ...
  - Hapus baris:  DELETE ...  (per-baris, BUKAN seluruh tabel)

❌ TIDAK BOLEH (akan muncul "permission denied" / "must be owner"):
  - Ubah struktur:    ALTER TABLE / ADD COLUMN
  - Bikin/hapus tabel: CREATE TABLE / DROP TABLE
  - Kosongkan tabel:   TRUNCATE
  - Migrasi Prisma:    prisma migrate deploy

🆘 KALAU BUTUH UBAH STRUKTUR TABEL:
  1. Jangan dipaksa — itu memang hak senior, bukan error/bug.
  2. Minta backend senior (dev_andi / dev_sinta) jalankan migrasinya.
  3. Atau buat PR berisi perubahan schema → senior review + apply.
```

**KARTU AKSES — BACKEND SENIOR** (login `dev_<nama>`, grup `app_senior`)

```
✅ BOLEH (di schema bersama):
  - Semua yang junior bisa (SELECT/INSERT/UPDATE/DELETE)
  - Ubah struktur:  CREATE / ALTER / DROP TABLE
  - Migrasi:        prisma migrate deploy

⚠️ TANGGUNG JAWAB EKSTRA:
  - Migrasi destruktif (DROP / hapus kolom) → snapshot/backup DULU.
  - Pakai migrasi terversion (file di repo), JANGAN ketik manual di SQL Editor.
  - Tabel baru otomatis bisa di-DML junior (default privilege sudah diset).
  - Kamu "pemilik tabel" → otomatis BYPASS RLS. Untuk tes RLS, pakai login
    app role (lewat aplikasi), bukan login DB-mu langsung.
```

#### Aturan untuk AI (Claude Code) — Tier-Guard

Saat staff IT non-programmer brief task DB di proyek yang pakai Option D, AI **WAJIB**:

1. **Cek tier sebelum DDL/migrasi.** Sebelum coba `CREATE/ALTER/DROP/TRUNCATE TABLE` atau `prisma migrate deploy`, cek tier login aktif (tanya user "kamu login pakai role apa?", atau lihat grup di `.env`/connection string). Kalau **junior** (DML-only) → **JANGAN jalankan DDL**. Jelaskan: *"Login kamu tier junior — boleh ubah DATA, tapi tidak boleh ubah STRUKTUR tabel. Ini bukan error, memang dibatasi. Minta backend senior (mis. dev_andi) untuk jalankan migrasi, atau aku bantu buatkan PR perubahan schema biar senior review."*
2. **Terjemahkan error, jangan tampilkan mentah.** Kalau muncul `permission denied for table` / `must be owner of table`, JANGAN cuma tempel error SQL. Terjemahkan ke bahasa non-programmer + langkah berikutnya (lihat tabel di section 8 Troubleshooting).
3. **Default deny.** Kalau ragu tier-nya apa, anggap junior (lebih aman) → tawarkan jalur "minta senior / buat PR", bukan langsung eksekusi DDL.

### 2.7. Setup Hybrid Strategy - Option C (Sandbox + Read Prod)

Kombinasi Option A + B:
- Staff punya schema sandbox sendiri (full CREATE)
- Staff bisa READ schema prod shared (mis. `shared_main`) untuk reference
- Staff TIDAK bisa WRITE ke schema prod

```sql
-- Step 1-3 sama seperti Option B (per-staff schema dengan OWNER)
-- (lihat 2.6 di atas)

-- Plus: kasih READ access ke schema prod
GRANT USAGE ON SCHEMA shared_main TO dev_a, dev_b, dev_c;
GRANT SELECT ON ALL TABLES IN SCHEMA shared_main TO dev_a, dev_b, dev_c;

-- Default privilege: tabel baru di shared_main otomatis read-only untuk staff
ALTER DEFAULT PRIVILEGES IN SCHEMA shared_main
  GRANT SELECT ON TABLES TO dev_a, dev_b, dev_c;

-- BLOCK write ke shared_main
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA shared_main FROM dev_a, dev_b, dev_c;
REVOKE CREATE ON SCHEMA shared_main FROM dev_a, dev_b, dev_c;
```

### 2.8. Backup Plan untuk Option B & C (WAJIB)

Karena staff punya full CREATE/DROP di schema mereka = risiko accidentally drop table. **3 layer backup**:

#### Layer 1: Supabase Daily Backup (Default, Gratis)
- Aktif by default di Supabase free tier
- Retention: 7 hari (free tier) / 30 hari (Pro tier)
- Restore: Dashboard → Database → Backups → Restore
- ⚠️ **Caveat**: full project restore = wipe semua schema. **Tidak selective per-schema**.

#### Layer 2: Manual Snapshot Sebelum Risky Operation
- Owner trigger via Supabase Dashboard → Database → Backups → "Create Manual Backup"
- Kapan: sebelum staff lakukan migrasi besar, sebelum approve PR yang touch schema
- Retention: sampai owner delete manual
- Cost: gratis

#### Layer 3: Per-Schema pg_dump Daily (Otomatis via GitHub Action)
- Cronjob daily ~03:00 WIB
- Dump tiap schema staff terpisah: `pg_dump --schema=dev_a --no-owner --clean`
- Upload ke Supabase Storage / S3 / Google Drive
- Retention: 30 hari (configurable)
- Restore selective per-schema: `psql < dev_a-2026-06-15.sql`

GitHub Action template: `.github/workflows/backup-schemas.yml` (auto-copy oleh setup script).

### 2.9. Restore Flow (Kalau Staff Accidentally Drop Table)

```
Skenario: dev_a tidak sengaja jalankan `DROP TABLE dev_a.namecheap_logs;`

1. Staff lapor owner via DM (per SECURITY_INCIDENT_PLAYBOOK)
2. Owner cek backup terbaru sebelum incident:
   - Layer 3 (pg_dump): biasanya 03:00 WIB tadi malam
   - Layer 2 (manual): kalau ada snapshot belakangan
3. Owner restore selective:
   - Login Supabase SQL Editor sebagai postgres superuser
   - Run: psql < backup-dev_a-2026-06-15.sql
   - Verify: SELECT count(*) FROM dev_a.namecheap_logs; 
4. Owner DM staff: "Restored, lanjut kerja"
5. Post-mortem dalam 24 jam (per SECURITY_INCIDENT_PLAYBOOK)
```

⚠️ **JANGAN pakai Layer 1 (full project restore) untuk restore selective per-staff** - bisa wipe progress staff lain. Pakai Layer 3 dengan `pg_dump` per-schema.

### 2.10. Promote Sandbox Schema → Production Schema (Saat Fitur Ready)

Saat staff selesai develop di sandbox dan fitur ready untuk prod:

```
1. Staff lapor owner: "Fitur namecheap API ready di dev_a, mau promote ke shared_main"
2. Owner review schema staff (DDL + sample data)
3. Owner buat Prisma migration di branch:
   - Edit prisma/schema.prisma → tambah model yang sudah di-test di dev_a
   - npx prisma migrate dev --name add_namecheap_models
4. PR review + AI Reviewer check
5. Merge → Prisma migrate deploy ke shared_main (prod)
6. Owner optional: pindahkan data dari dev_a.namecheap_logs ke shared_main.namecheap_logs
   (INSERT INTO shared_main.namecheap_logs SELECT * FROM dev_a.namecheap_logs;)
7. Staff lanjut develop fitur baru di sandbox-nya
```

---

### 2.11. Verifikasi Schema Isolation

Login pakai role baru, test akses:

```sql
-- Login sebagai dev_a (pakai psql atau Supabase SQL Editor dengan SET ROLE)
SET ROLE dev_a;

-- Harus BERHASIL:
SELECT * FROM pbn.projects LIMIT 5;
SELECT * FROM analytics.daily_stats LIMIT 5;

-- Harus GAGAL ("permission denied"):
SELECT * FROM internal_data.users LIMIT 5;
CREATE TABLE pbn.test_table (id int);
CREATE TABLE public.test_table (id int);

-- Reset role:
RESET ROLE;
```

### 2.12. Connection String per-Dev (Format BENAR - Supabase Pooler)

**Format Supabase Pooler** (yang dipakai produksi): username harus disuffix dengan project-ref `dev_<dev>.<project-ref>`. Project-ref bisa dilihat di Supabase Dashboard → Project Settings → General → Reference ID (mis. `GANTI_PROJECT_REF`).

```text
# App/runtime (port 6543, transaction mode pooler) - DEFAULT untuk MCP + Next.js app
postgresql://dev_a.GANTI_PROJECT_REF:GANTI_PASSWORD_KUAT_1@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres

# DDL/migrasi (port 5432, session mode pooler) - Prisma migrate / psql command
postgresql://dev_a.GANTI_PROJECT_REF:GANTI_PASSWORD_KUAT_1@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require
```

**Kapan pakai port mana?**

| Port  | Mode pooler  | Pakai untuk                                              |
|-------|--------------|----------------------------------------------------------|
| 6543  | Transaction  | App runtime (Next.js Prisma client, MCP server-postgres) - short-lived queries |
| 5432  | Session      | DDL (`CREATE TABLE`, `ALTER`), `prisma migrate deploy`, psql interactive, full session |

**Region pooler**: sesuaikan dengan project Supabase. Contoh region:
- `aws-1-ap-southeast-1.pooler.supabase.com` (Singapore)
- `aws-0-us-east-1.pooler.supabase.com` (US East)

Cek di Supabase Dashboard → Connect (pojok kanan atas) untuk URL persis project kamu.

**LARANGAN KERAS** (sesuai update keamanan tim):

- ❌ JANGAN pakai username `postgres.<ref>` (= superuser, akses SEMUA tenant) - **DITUTUP** demi keamanan.
- ❌ JANGAN pakai `service_role_key` Supabase (REST API bypass RLS, full superuser).
- ❌ JANGAN share connection string di chat / Slack / Discord - kirim via password manager (1Password, Bitwarden) atau encrypted DM auto-delete.
- ✅ PAKAI `dev_<dev>.<project-ref>` dengan password kamu sendiri.
- ✅ Kalau password lupa, minta owner generate ulang (owner: `ALTER USER dev_x PASSWORD 'NEW';`).

### 2.13. RLS Setup Workflow (WAJIB sebelum data produksi masuk)

**Konteks**: setelah dapat akses schema sendiri, staff IT WAJIB setup Row-Level Security (RLS) untuk mencegah pemegang `anon` / `publishable_key` (yang PUBLIK) baca/tulis data atau melewati cek role app.

**ATURAN RLS WAJIB DIPATUHI**:

1. **JANGAN ENABLE RLS sebelum bikin policy dulu** - RLS tanpa policy = app error semua query gagal.
2. **Tes lewat APP asli** (login tiap role di UI), BUKAN psql / SQL Editor - koneksi langsung dari owner tabel **bypass RLS** karena PostgreSQL role rule.
3. **JANGAN pakai `USING(true)` untuk operasi TULIS** - policy tulis HARUS cek role app yang authoritative.
4. **HANYA sentuh schema kamu sendiri** - jangan touch tabel di schema lain.

**Workflow per-tabel** (ulangi tiap tabel di schema kamu):

```sql
-- ========== Langkah 1: Bikin policy DULU (sebelum enable RLS) ==========
-- Contoh tabel `posts` di schema `pbn`, app punya role `admin_access`.

-- Policy READ: cuma admin_access yang boleh baca
CREATE POLICY posts_read_policy ON pbn.posts
  FOR SELECT
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'admin_access');

-- Policy INSERT: cuma admin_access boleh insert
CREATE POLICY posts_insert_policy ON pbn.posts
  FOR INSERT
  WITH CHECK (current_setting('request.jwt.claims', true)::json->>'role' = 'admin_access');

-- Policy UPDATE: cuma admin_access boleh update
CREATE POLICY posts_update_policy ON pbn.posts
  FOR UPDATE
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'admin_access')
  WITH CHECK (current_setting('request.jwt.claims', true)::json->>'role' = 'admin_access');

-- Policy DELETE: cuma admin_access boleh delete
CREATE POLICY posts_delete_policy ON pbn.posts
  FOR DELETE
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'admin_access');

-- ========== Langkah 2: ENABLE RLS setelah policy lengkap ==========
ALTER TABLE pbn.posts ENABLE ROW LEVEL SECURITY;

-- ========== Langkah 3: REVOKE anon (kalau app wajib login) ==========
REVOKE ALL ON pbn.posts FROM anon;
-- Catatan: kalau app punya endpoint public (login page, marketing), JANGAN revoke anon - gunakan policy yang lebih spesifik.

-- ========== Langkah 4: TEST via APP asli ==========
-- Login UI sebagai admin → buka halaman yang baca/tulis pbn.posts → harus berhasil.
-- Logout → coba akses tanpa login → harus error 401/403 (bukan 500).
-- Login sebagai role lain (kalau ada) → harus block sesuai matrix RBAC.

-- ========== Langkah 5: VERIFIKASI anon terblokir ==========
-- Pakai Supabase Dashboard "API" tab atau curl dengan publishable_key:
-- curl -H "apikey: <publishable_key>" <project-url>/rest/v1/posts
-- Harus return 401 / 403 / empty array (depending on policy).
```

**Prompt siap-paste untuk staff IT**: lihat `RLS_SETUP_PROMPT.md` di kit (`./.claude-kit/templates/RLS_SETUP_PROMPT.md`).

### 2.14. MCP Config di Claude Code

File: `%APPDATA%\Claude\claude_desktop_config.json` (Windows) atau `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac).

Untuk Claude Code CLI: `~/.claude/settings.json` atau `.claude/settings.local.json` per-proyek.

```json
{
  "mcpServers": {
    "postgres-pbn": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://dev_a.GANTI_PROJECT_REF:GANTI_PASSWORD_KUAT_1@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
      ]
    }
  }
}
```

**Penting**:
- Username pakai format `dev_<dev>.<project-ref>` (BUKAN `dev_a` saja).
- Port `6543` (transaction mode) - cocok untuk MCP read query + sebagian besar Prisma query.
- Untuk MCP yang butuh DDL (mis. `ALTER TABLE` via AI), pakai port `5432?sslmode=require`.
- Region pooler match dengan project kamu (cek Dashboard → Connect).

Untuk Windows + WSL, atau kalau npx lambat, install global:

```bash
npm install -g @modelcontextprotocol/server-postgres
```

Lalu config:

```json
{
  "mcpServers": {
    "postgres-pbn": {
      "command": "mcp-server-postgres",
      "args": ["postgresql://dev_a.GANTI_PROJECT_REF:GANTI_PASSWORD_KUAT_1@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"]
    }
  }
}
```

### 2.15. Audit Trail

#### Cek aktif siapa sekarang

```sql
SELECT pid, usename, application_name, client_addr, state, query_start, query
FROM pg_stat_activity
WHERE usename LIKE 'dev_%' OR usename = 'admin_dev'
ORDER BY query_start DESC;
```

#### Aktifkan pgaudit (lanjutan, optional)

Extension `pgaudit` log semua DDL + DML per role. Di Supabase:

```sql
-- Cek apakah pgaudit tersedia
SELECT * FROM pg_available_extensions WHERE name = 'pgaudit';

-- Kalau tersedia:
CREATE EXTENSION IF NOT EXISTS pgaudit;

-- Config (perlu superuser):
ALTER SYSTEM SET pgaudit.log = 'write, ddl';
ALTER SYSTEM SET pgaudit.log_relation = on;
SELECT pg_reload_conf();
```

Log muncul di Supabase Dashboard → Logs → Postgres Logs.

#### Audit GRANT/REVOKE (manual quarterly)

```sql
-- Lihat semua privilege per role
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee LIKE 'dev_%'
ORDER BY grantee, table_schema, table_name;

-- Lihat siapa punya akses ke schema sensitif
SELECT nspname AS schema, r.rolname, has_schema_privilege(r.rolname, n.nspname, 'USAGE') AS has_usage
FROM pg_namespace n
CROSS JOIN pg_roles r
WHERE n.nspname IN ('internal_data', 'pbn', 'analytics')
  AND r.rolname NOT LIKE 'pg_%'
  AND r.rolcanlogin = true
ORDER BY schema, rolname;
```

---

## 3. Supabase MCP (Owner Only - WARNING)

> ⚠️ **PERINGATAN KERAS**: Section ini **HANYA untuk OWNER database** (orang yang punya `service_role_key`). Staff IT / developer schema-scoped **TIDAK BOLEH** pakai konfigurasi ini. Pakai PostgreSQL MCP (Section 2) sebagai gantinya.

### 3.1. Kenapa Supabase MCP berisiko untuk staff IT?

Supabase MCP official pakai `service_role_key` - yang artinya:

- **BYPASS RLS** (Row-Level Security) - AI bisa baca/edit data SEMUA user di SEMUA schema.
- **FULL SUPERUSER** - bisa `DROP TABLE`, `REVOKE` siapapun, ubah policy.
- **TIDAK ADA isolation per-tenant** - semua orang yang pegang key punya akses identik.
- **Audit trail buruk** - semua query muncul "atas nama service_role", tidak bisa trace per-dev.

Konsekuensi kalau key bocor: data SEMUA tenant kompromi sekaligus.

### 3.2. Kapan OWNER boleh pakai Supabase MCP?

Hanya untuk kasus spesifik yang PostgreSQL MCP tidak bisa cover:

| Use case | Justifikasi |
|---|---|
| **Migrasi schema lintas-tenant** | Butuh ALTER SCHEMA di banyak schema sekaligus (mis. tambah audit column ke semua tenant) |
| **Investigasi keamanan** | Audit "siapa baca apa" lintas tenant saat suspected breach |
| **Setup awal Supabase** | Bikin role + policy template untuk tenant baru |
| **Backup / restore** | Snapshot full database (`pg_dump` superuser) |

Untuk operasi OWNER sehari-hari (cek data sendiri, debug Prisma), tetap pakai PostgreSQL MCP dengan role `admin_dev` (Section 2.5) - bukan Supabase MCP.

### 3.3. Setup Supabase MCP (kalau benar-benar perlu)

Install Supabase MCP server:

```bash
npm install -g @supabase/mcp-server-supabase
```

Atau cek paket resmi terbaru di https://github.com/supabase/mcp-server-supabase.

Config (`~/.claude/settings.local.json` - **JANGAN** commit):

```json
{
  "mcpServers": {
    "supabase-owner": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase"],
      "env": {
        "SUPABASE_URL": "https://<project-ref>.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "${SUPABASE_SERVICE_ROLE_KEY}"
      }
    }
  }
}
```

`SUPABASE_SERVICE_ROLE_KEY` ambil dari OS env var (Windows: System Properties → Environment Variables), JANGAN tulis literal di JSON.

### 3.4. Aturan saat pakai Supabase MCP

- ⚠️ **JANGAN pernah share `service_role_key`** ke siapapun (termasuk staff IT, ditanya pun jangan).
- ⚠️ **JANGAN commit `service_role_key`** ke repo / Slack / Discord / email / WhatsApp.
- ⚠️ **JANGAN aktifkan Supabase MCP saat sesi screen-share** - AI bisa execute query yang ter-display.
- ✅ **Rotation tiap 3 bulan minimum** - generate key baru di Supabase Dashboard → Settings → API → Reset service_role.
- ✅ **Disable Supabase MCP saat tidak butuh** - buka `settings.local.json`, comment out section, restart Claude Code.
- ✅ **Audit setelah pakai** - cek `pg_stat_activity` 24 jam terakhir, lihat query apa yang dijalankan.

### 3.5. Kalau staff IT minta Supabase MCP

Tolak. Kasih PostgreSQL MCP (Section 2) + schema-scoped role mereka. Kalau mereka argue butuh akses lintas-schema, eskalasi ke owner - **owner yang jalankan query**, BUKAN delegate key.

---

## 4. GitHub MCP

### 4.1. Setup PAT (Personal Access Token)

1. Buka https://github.com/settings/tokens → **Generate new token (classic)** atau **fine-grained**.
2. **Fine-grained** (recommended):
   - Repository access: pilih repo yang relevan (jangan "All repositories").
   - Permissions:
     - **Contents**: Read & write (untuk commit + read code)
     - **Issues**: Read & write
     - **Pull requests**: Read & write
     - **Metadata**: Read (auto)
     - **Workflows**: Read (untuk lihat CI status)
3. Expiration: **90 hari** (paksa rotation tiap quarter).
4. Copy token, simpan di password manager. **JANGAN** commit ke repo.

### 4.2. MCP Config

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### 4.3. Use Case

Dengan GitHub MCP aktif, AI bisa:

- Buka issue: "Buka issue baru di repo `<your-project>` dengan judul X dan body Y."
- Review PR: "Lihat PR #42, ringkas perubahan, kasih saran."
- Cek CI: "Cek status workflow di branch feat/login."
- Search code: "Cari semua occurrence `service_role_key` di organisasi."

---

## 5. Filesystem MCP (Default Claude Code)

Claude Code sudah bundled filesystem access ke working directory. Tidak perlu config tambahan untuk kasus normal.

### Limit Access ke Workspace Folder

Kalau pakai Claude Desktop (bukan CLI), perlu config eksplisit:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\workspace\\<project-folder>"
      ]
    }
  }
}
```

**JANGAN** kasih access ke root `C:\` atau `/` - AI bisa baca file sistem / kredensial OS lain.

**JANGAN** kasih access ke folder yang berisi `.env`, password manager export, atau key SSH.

---

## 6. Anti-Pattern (Jangan Lakukan)

### 6.1. Pakai `service_role_key` Supabase untuk staff IT

```json
// SALAH - bypass RLS, full superuser, audit trail buruk
{
  "mcpServers": {
    "supabase": {
      "env": {
        "SUPABASE_SERVICE_ROLE_KEY": "eyJxxx..."
      }
    }
  }
}
```

**Kenapa salah**: service_role_key bypass RLS → AI bisa edit data user mana saja → kalau token bocor, semua data kompromi. Plus tidak ada audit per-dev (semua query "atas nama service_role").

**Yang benar**: PostgreSQL role per-dev (section 2.5).

### 6.2. Share connection string di chat

```text
// SALAH - di Slack channel #dev:
"Tolong test pake connection ini ya: postgresql://dev_a:Pass123@..."
```

**Kenapa salah**: Slack di-index, history nyimpen. Kalau Slack workspace di-breach atau ada eks-member, kredensial bocor.

**Yang benar**: kirim via password manager shared vault (1Password, Bitwarden Organizations), atau encrypted DM yang auto-delete.

### 6.3. Pakai role `postgres` (superuser) sebagai default

```json
// SALAH - superuser, bisa DROP TABLE, REVOKE, dll
{
  "command": "mcp-server-postgres",
  "args": ["postgresql://postgres:xxxxx@db.xxx.supabase.co:5432/postgres"]
}
```

**Kenapa salah**: AI bisa jalankan `DROP TABLE users;` tanpa konfirmasi. Sekali typo command, data hilang.

**Yang benar**: role per-dev dengan privilege terbatas (no CREATE, no DROP di schema sensitif).

### 6.4. Commit MCP config ke repo

```bash
# SALAH - config dengan token ter-commit
git add .claude/settings.json
git commit -m "add mcp config"
git push
```

**Kenapa salah**: token di history Git permanent. Walaupun di-revert, history tetap ada (kecuali rewrite force-push).

**Yang benar**: pakai `.claude/settings.local.json` (sudah di `.gitignore` default Claude Code) untuk config yang ada secret. Atau pakai env var dari OS:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PAT}"
      }
    }
  }
}
```

Lalu set `GITHUB_PAT` di env OS user (Windows: System Properties → Environment Variables).

---

## 7. Audit + Rotation

### 7.1. Jadwal Rotation

| Kredensial                  | Frekuensi rotation | Triggered by                          |
|-----------------------------|--------------------|----------------------------------------|
| GitHub PAT                  | Tiap 3 bulan       | Calendar reminder + token expiry       |
| PostgreSQL password role    | Tiap 3 bulan       | Calendar reminder                      |
| Semua kredensial dev keluar | Immediate          | Hari H+0 staff keluar / di-PHK         |
| Suspected leak              | Immediate          | Saat dicurigai bocor (push accident)   |

### 7.2. Quarterly Audit Checklist

Tiap Q1 (Maret), Q2 (Juni), Q3 (September), Q4 (Desember):

- [ ] Cek `pg_stat_activity` 7 hari terakhir - siapa query schema sensitif?
- [ ] Cek `information_schema.role_table_grants` - ada privilege escalation tidak terdeteksi?
- [ ] Cek GitHub audit log - ada PAT dengan scope berlebih?
- [ ] Rotate semua password role PostgreSQL.
- [ ] Generate ulang GitHub PAT yang akan expire.
- [ ] Review MCP config tiap dev - apakah masih relevan dengan kerjaan sekarang?
- [ ] Hapus role PostgreSQL untuk dev yang sudah keluar (sebelumnya: pastikan tidak ada object yang owned by role tsb).

### 7.3. Cara Hapus Role Dev yang Keluar

```sql
-- 1. Cek apakah role punya object
SELECT n.nspname AS schema, c.relname AS object, c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_roles r ON r.oid = c.relowner
WHERE r.rolname = 'dev_x';

-- 2. Kalau ada, transfer ownership dulu
REASSIGN OWNED BY dev_x TO admin_dev;

-- 3. Drop semua privilege
DROP OWNED BY dev_x;

-- 4. Drop role
DROP ROLE dev_x;
```

### 7.4. Incident Response: Token Bocor

Kalau PAT GitHub atau password DB ke-commit / ke-post di publik:

1. **Immediate (5 menit)**:
   - GitHub: revoke token di https://github.com/settings/tokens (klik token → Delete).
   - PostgreSQL: `ALTER USER dev_a PASSWORD 'NEW_STRONG_PASSWORD';`
2. **Short-term (1 jam)**:
   - Cek audit log (`pg_stat_activity`, GitHub audit log) - ada akses suspicious 7 hari terakhir?
   - Cek apakah ada commit / push yang tidak diakui di repo.
3. **Cleanup (24 jam)**:
   - Update MCP config semua dev yang affected.
   - Notify tim via channel resmi (jangan via channel yang sama dengan leak source).
   - Post-mortem: kenapa bisa bocor? Update process supaya tidak terulang.

---

## 8. Troubleshooting

### MCP server tidak nyala

- Cek log Claude Code: `~/.claude/logs/` (Linux/Mac) atau `%APPDATA%\Claude\logs\` (Windows).
- Test connection string manual: `psql "postgresql://dev_a:...@host:5432/postgres"`.
- Kalau error "FATAL: password authentication failed" → password salah / role belum dibikin.

### "permission denied for schema X"

- Role belum di-GRANT USAGE ke schema tsb. Cek section 2.5 step 3.
- Atau memang sengaja (mis. `internal_data` untuk dev_a) - switch ke role yang punya akses.

### "permission denied" / "must be owner" saat junior coba ubah struktur tabel (Option D)

Ini **BUKAN bug** — memang by design (tier junior = DML-only). AI WAJIB terjemahkan ke bahasa non-programmer, jangan tempel error mentah:

| Error Postgres | Arti buat user (non-programmer) | Aksi yang benar |
|---|---|---|
| `permission denied for table X` | Login kamu tak punya hak untuk aksi itu di tabel X | Kamu coba ALTER/DROP/TRUNCATE? Itu hak senior. Minta senior. |
| `must be owner of table X` | Cuma pemilik tabel (tier senior) yang boleh ubah strukturnya | Minta backend senior jalankan migrasi, atau buat PR perubahan schema. |
| `permission denied for schema X` | Login kamu belum diberi akses masuk ke schema itu | Minta owner `GRANT USAGE`, atau cek — mungkin kamu salah schema. |

**Analogi**: kayak kartu akses kantor (📱 mirip kartu e-toll) — kartu junior bisa buka pintu ruang kerja (baca/tulis data), tapi **tidak bisa** buka ruang panel listrik (ubah struktur gedung). Bukan kartunya rusak — memang aksesnya dibatasi. Untuk ke ruang panel, panggil teknisi (senior).

### MCP terlalu lambat

- Pakai pooled connection (port 6543) untuk Supabase, bukan direct (5432) - overhead lebih rendah.
- Atau install MCP server global (`npm i -g @modelcontextprotocol/server-postgres`) supaya tidak perlu npx download tiap kali.

---

## Referensi

- MCP spec: https://modelcontextprotocol.io
- PostgreSQL MCP server: https://github.com/modelcontextprotocol/servers/tree/main/src/postgres
- GitHub MCP server: https://github.com/modelcontextprotocol/servers/tree/main/src/github
- Filesystem MCP server: https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
- PostgreSQL GRANT/REVOKE docs: https://www.postgresql.org/docs/current/sql-grant.html
- pgaudit extension: https://www.pgaudit.org

---

> **Update file ini** tiap kali ada MCP server baru yang di-standardize, atau ada perubahan policy security (mis. rotation period berubah). Catat di `CHANGELOG.md` kit + bump versi.
