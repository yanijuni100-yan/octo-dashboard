# TEMPLATE: `<project>-backend/AGENTS.md`

> Template ini di-deploy oleh AI saat split repo migration.
> Customization: replace `<project>` dengan nama project user + SESUAIKAN jumlah/peran staff di bawah
> (angka "2 orang"/"4 orang" = CONTOH ilustratif dari satu kasus nyata; tim-mu bisa beda — lihat POLA_REPO_AMAN.md).

```markdown
# AGENTS.md - <project>-backend

> Repo ini: Backend API + Business Logic + Database.
> Mode microservice (varian shared-DB): backend juga = AGGREGATOR / Backend-for-Frontend — baca banyak schema engine (`engine_*`) lalu gabung jadi 1 jawaban untuk dashboard (lihat POLA_REPO_AMAN.md bagian "Backend = aggregator").
> Audience AI: Claude Code untuk Backend Staff (2 orang yang akses semua 3 repo: `<project>-frontend`, `<project>-backend`, `<project>-shared`) + owner.
> PRIVATE - 4 Frontend Staff TIDAK punya akses ke repo ini.
>
> Privileges Backend Staff:
> - FULL DB control: CRUD + DDL (CREATE TABLE / ALTER / DROP / migration)
> - Publish version baru `@<project>/shared`
> - Modify Prisma schema dan generate migration

## Scope Kamu (AI)

Kamu di repo `<project>-backend`. Kamu BOLEH:
- Bikin/edit API endpoint (Hono/Express atau Next.js API routes)
- Direct database access via Prisma
- Implement business logic (validation, calculation, workflow)
- Modify Prisma schema + generate migration
- Update `@<project>/shared` types (lalu publish version baru)
- Akses Supabase logs via MCP saat debug

Kamu TIDAK BOLEH:
- Edit UI components (itu di `<project>-frontend`)
- Hardcode rahasia di code (pakai env vars + `.env` gitignored)
- Bypass authentication / authorization checks
- Skip migration files saat schema change (semua DDL via Prisma migrate)
- Run `prisma db push` ke production (selalu pakai migration)
- Drop / truncate tabel produksi tanpa konfirmasi owner eksplisit

## Stack
- Hono OR Next.js API routes (Node.js runtime, bukan edge)
- Prisma ORM (lihat STACK_VERSIONS.md untuk versi terbaru)
- Supabase PostgreSQL (shared dengan staging via branch)
- JWT atau session-based auth (lihat `src/lib/auth.ts`)
- Zod untuk schema validation (semua input WAJIB di-validate)

## Workflow Backend-First

Saat owner/delegate prompt kamu untuk fitur baru:

1. Baca prompt, identify TASK ID
2. Cek apakah ada perubahan data model:
   - Kalau ya: update `prisma/schema.prisma` dulu
   - Generate migration: `npx prisma migrate dev --name <descriptive>`
   - Review SQL hasil migration sebelum apply
3. Bikin route handler dengan validation Zod
4. Implement business logic di service layer (`src/services/`)
5. Update `@<project>/shared` types kalau ada shape baru
6. Test API dengan curl atau Postman atau Hono `testClient`
7. Tulis unit test minimum 1 per endpoint baru
8. Open PR ke `main`
9. Tag version baru `@<project>/shared` kalau ada types update
10. Notify frontend tim via Discord: "API `<endpoint>` ready, types @ v1.X.Y"

## Critical Safety

- Sebelum `prisma migrate deploy` ke prod, CEK `DATABASE_URL` host (pastikan BUKAN database produksi yang salah sasaran)
- Migrasi ke prod = **manual oleh OWNER saja** (bukan AI / staf biasa), SETELAH backup snapshot
- Pengaman migrasi-prod TIDAK datang otomatis dari kit. Kalau mau, owner WAJIB **membuat sendiri** skrip pengaman (mis. `scripts/prisma-guard.mjs` ⟵ **harus dibuat dulu**) yang menolak `migrate deploy` kalau host = produksi. JANGAN anggap pengaman ini sudah ada sebelum benar-benar dibuat (anti-halusinasi — lihat aturan kit §8.2 "no quote = no claim")
- DILARANG menyediakan / memakai "mode paksa" untuk menerobos pengaman migrasi (lihat §8.1 #10). Kalau pengaman memblokir → STOP + lapor owner, BUKAN di-bypass
- Backup snapshot owner SEBELUM apply migration destructive (drop column, rename, dst.)

## API Documentation

- Auto-generated via `next-swagger-doc` atau Hono OpenAPI plugin
- Available di: `http://localhost:3001/docs` (local dev)
- Available di: `https://api-staging.<project>.id/docs` (staging)
- Frontend tim baca di sini, BUKAN baca source code backend
- Saat add/update endpoint, WAJIB update OpenAPI annotation

## Style Guide

- Sama dengan frontend (Prettier, naming, TypeScript strict)
- Tambahan: setiap endpoint WAJIB Zod schema validation di input
- Tambahan: error handling pakai `Result<T, E>` pattern atau exception class custom, bukan throw string
- Tambahan: logging pakai `pino` (structured JSON), bukan `console.log`

## Auto-Publish @<project>/shared (Trigger Rule)

> ⚠️ **POLA CONTOH — belum tentu terpasang di project-mu (jujur untuk staff non-programmer).** Alur di bawah (Step 5: `push → .github/workflows/publish-shared.yml` auto-publish ke GitHub Packages + Discord notify) mengandaikan "pabrik otomatis" yang **lintasAI TIDAK pasang otomatis** — `publish-shared.yml` tidak ikut terpasang kit (owner buat dulu). **AI WAJIB cek dulu apakah workflow/registry-nya benar-benar ADA sebelum menjanjikannya ke user, dan DILARANG bilang "auto-publish akan jalan setelah push" kalau pipeline-nya belum terbukti ada** — itu rasa-aman-palsu (§8.2 "no quote = no claim"). Belum dipasang → terbitkan paket bersama secara manual + sebut jujur "auto-publish belum aktif". 🏢 Analogi: jangan janji "paket otomatis terkirim" kalau mesin pengirimnya belum dibeli.

Saat AI Claude Code execute task yang touching:
- Prisma schema (prisma/schema.prisma)
- API endpoint signature
- Response/request shape changes
- New domain types

AI WAJIB:

### Step 1: Update src/shared/ dengan types yang affected

    // src/shared/schemas/tracking.ts
    import { z } from 'zod'

    export const TrackingSchema = z.object({
      order_id: z.number(),
      status: z.enum(['pending', 'shipped', 'delivered']),
      shipped_at: z.string().datetime(),
      estimated_arrival: z.string().datetime().nullable(),
      delivered_at: z.string().datetime().nullable(),
    })

    export type OrderTracking = z.infer<typeof TrackingSchema>

### Step 2: Re-export di src/shared/index.ts

Pastikan semua public types ke-export.

### Step 3: Build + Verify

    npm run generate:types
    # Verify shared-dist/ punya types baru
    ls shared-dist/index.d.ts

### Step 4: Commit dengan conventional message

    git commit -m "feat(shared): add OrderTracking type"
    # Conventional message penting untuk semantic-release auto-bump version

### Step 5: Push → GitHub Actions auto-pipeline

Push trigger workflow .github/workflows/publish-shared.yml yang:
- Bump version (patch untuk fix, minor untuk new type, major untuk breaking)
- Publish ke GitHub Packages
- Discord notify

### Aturan Penting untuk AI

KALAU types berubah TANPA update @<project>/shared:
- AI JANGAN commit changes
- AI JANGAN claim "task done"

SELALU:
- Update shared types DULU
- Verify build OK
- Commit dengan conventional message
- Push (publish workflow akan handle sisanya)

Bahasa Indonesia untuk user-facing output:
"Saya update types di @<project>/shared juga (auto-publish akan jalan setelah push). Frontend tim dapat notif via Discord + Renovate PR."

## Project-Specific Rules

<!-- Owner: tambahkan rules spesifik project di sini -->
<!-- Contoh: rate limit policy, audit log requirement, RBAC matrix -->
```
