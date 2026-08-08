# TEMPLATE: `<project>-dashboard/AGENTS.md` (repo DASHBOARD — Mode [2] microservice)

> Template ini di-deploy oleh AI saat split repo migration **Mode [2] (per-Kapabilitas / microservice varian shared-database)**.
> Untuk repo `<project>-dashboard` (1 layar terpadu + penghubung/BFF ke backend).
> Customization: replace `<project>` dengan nama project user.

```markdown
# AGENTS.md - <project>-dashboard (DASHBOARD — tampilan + BFF, NOL akses DB/engine)

> Repo ini: Dashboard UI (1 layar terpadu) + lapisan penghubung tipis (BFF = Backend-for-Frontend)
> yang memanggil "loket" (API) backend. Next.js.
> Audience AI: Claude Code untuk staff Dashboard/Frontend (mayoritas staff).
> Posisi di topologi (microservice varian shared-DB): engine → backend (aggregator) → **dashboard**.
>
> Privileges: tampilan + panggil API backend. **NOL akses database. NOL akses engine langsung.**

## Scope Kamu (AI)

Kamu di repo `<project>-dashboard`. Kamu BOLEH:
- Edit UI components, pages, layouts (di `src/app/`, `src/components/`)
- Panggil API **backend** via fetch/axios (data lewat endpoint backend yang sudah ada)
- BFF tipis (Next.js route handler / server action) yang **cuma meneruskan ke backend** + menata bentuk respons untuk UI (tanpa logika bisnis rahasia)
- Import types dari `@<project>/shared` (auto-installed npm dep)
- Styling (Tailwind, CSS modules)

Kamu TIDAK BOLEH:
- **Memanggil repo/endpoint ENGINE langsung** — alur WAJIB `dashboard → backend → engine`. Frontend/dashboard ↔ engine = DILARANG (rahasia bocor + mayoritas staff dapat akses).
- **Query/tulis DB langsung pakai Supabase client (`createClient` / `@supabase/supabase-js`)** — walau cuma `anon key` publik. `createClient` di browser = akses DB langsung yang HANYA dijaga RLS, melewati validasi + otorisasi backend. SEMUA data WAJIB lewat API backend.
- Direct database query (Prisma) / akses `.env` berisi `DATABASE_URL` atau API SECRET
- Implement business logic rahasia (kalkulasi/scoring) — itu di engine/backend
- Hardcode URL backend; selalu pakai env var (`NEXT_PUBLIC_API_URL`)
- Modify `@<project>/shared` (cuma owner/Backend yang publish version baru)

## Stack
- Next.js (lihat STACK_VERSIONS.md untuk versi terbaru)
- TailwindCSS + Shadcn/ui
- TypeScript strict mode
- React Query / SWR untuk data fetching (dari backend)
- BFF (opsional): Next.js route handler server-side yang proxy ke backend (TIDAK menyimpan kunci DB)

## API URL

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
```

- Dashboard memanggil **backend-aggregator** (1 pintu). Backend yang menggabung data beberapa engine
  (lewat schema-per-engine) dan menyajikan "laporan jadi" ke dashboard. Dashboard tak pernah tahu
  ada berapa engine di belakang.

## Aturan anti-bocor (kenapa NOL akses DB/engine)
- Dashboard dilihat banyak orang → titik paling rawan. Maka dashboard NOL kunci DB, NOL akses engine.
- Kalau butuh data baru: minta endpoint ke tim BACKEND (prompt berantai), JANGAN cari jalan pintas
  colok DB/engine. Lihat `docs/plans/POLA_REPO_AMAN.md` (aturan sambungan 3-arah).

## Workflow

Saat staff non-programmer prompt kamu:

1. Baca prompt, identify TASK ID
2. Kalau prompt vague, tanya 1-2 clarifying question (max 2!)
3. Cek endpoint backend yang relevan (`@<project>/shared` types + dok API backend)
4. Bikin/edit komponen + page
5. Panggil API via fetch ke backend (`NEXT_PUBLIC_API_URL`)
6. Test di localhost (`npm run dev`)
7. Open PR ke `main` + link preview ke staff; tunggu approval owner sebelum merge
8. Butuh data yang belum ada di backend? → **prompt berantai ke tim BACKEND** (minta endpoint), jangan colok engine/DB

## Project-Specific Rules

<!-- Owner: tambahkan rules spesifik dashboard di sini -->
<!-- Contoh: design tokens, brand color, accessibility level -->
```
