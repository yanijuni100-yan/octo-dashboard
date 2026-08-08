# TEMPLATE: `<project>-frontend/AGENTS.md`

> Template ini di-deploy oleh AI saat split repo migration.
> Customization: replace `<project>` dengan nama project user + SESUAIKAN jumlah/peran staff di bawah
> (angka "4 orang" = CONTOH ilustratif dari satu kasus nyata; tim-mu bisa beda — lihat POLA_REPO_AMAN.md).

```markdown
# AGENTS.md - <project>-frontend

> Repo ini: Frontend UI only (Next.js SPA mode atau React Vite).
> Audience AI: Claude Code untuk Frontend Staff (4 orang yang akses repo `<project>-frontend` + `<project>-shared`).
>
> Privileges Frontend Staff:
> - DAPAT edit data (CRUD: SELECT / INSERT / UPDATE / DELETE) di DB lewat API backend
> - TIDAK punya DDL (CREATE TABLE / ALTER / DROP) - DDL = domain Backend staff + owner

## Scope Kamu (AI)

Kamu di repo `<project>-frontend`. Kamu BOLEH:
- Edit UI components, pages, layouts (di `src/app/`, `src/components/`)
- Call API backend via fetch/axios (CRUD data lewat endpoint yang sudah ada)
- Import types dari `@<project>/shared` (auto-installed npm dep)
- Styling (Tailwind, CSS modules)
- Update copy/teks UI sesuai brief dari staff content

Kamu TIDAK BOLEH:
- Bikin endpoint API (itu di `<project>-backend`, kamu tidak akses)
- Direct database query (Prisma) - termasuk dilarang DDL apapun
- **Query/tulis DB langsung pakai Supabase client (`createClient` / `@supabase/supabase-js`) dari frontend** — walau cuma pakai `anon key` publik (BUKAN `DATABASE_URL`). `createClient` di browser = akses database langsung yang HANYA dijaga RLS (Row Level Security — gampang salah-konfigurasi), MELEWATI validasi + otorisasi backend. SEMUA akses data WAJIB lewat API backend (`NEXT_PUBLIC_API_URL`). Kalau butuh data, panggil endpoint backend; jangan colok Supabase langsung.
- Modify `@<project>/shared` (cuma owner / Backend staff yang publish version baru)
- Implement business logic (validation, calculation, workflow rules)
- Akses `.env` yang berisi `DATABASE_URL` atau API SECRET
- Hardcode URL backend; selalu pakai env var

## Stack
- Next.js (lihat STACK_VERSIONS.md untuk versi terbaru) atau React Vite (frontend only)
- TailwindCSS + Shadcn/ui untuk component primitives
- TypeScript strict mode
- React Query / SWR untuk data fetching
- React Hook Form + Zod (validasi client-side, schema dari `@<project>/shared`)

## Workflow

Saat staff non-programmer prompt kamu:

1. Baca prompt, identify TASK ID (e.g., `TASK-101`)
2. Kalau prompt vague, tanya 1-2 clarifying question (max 2!)
3. Cek `@<project>/shared` types yang relevan untuk endpoint yang dipakai
4. Bikin/edit komponen + page
5. Call API via fetch ke backend URL (`NEXT_PUBLIC_API_URL` env var)
6. Test di localhost (`npm run dev`)
7. Open PR ke `main`, kasih link preview Vercel ke staff
8. Tunggu approval owner sebelum merge

## API URL

```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
```

- Local dev: `http://localhost:3001` (backend dev server)
- Staging: `https://api-staging.<project>.id`
- Production: `https://api.<project>.id`

## Style Guide

- Format: Prettier auto, no manual semicolon decisions
- Naming: `camelCase` untuk function, `PascalCase` untuk Component
- File: `kebab-case` untuk page route, `PascalCase` untuk component file
- Komentar: minimal, hanya kalau non-obvious (kenapa, bukan apa)
- Komponen: prefer functional component + hooks, hindari class component
- State: lokal pakai `useState`, server state pakai React Query

## Tools

- Storybook: `npm run storybook` (UI dev tanpa app context)
- Vitest: `npm test` (unit test komponen)
- Playwright: `npm run e2e` (end-to-end di staging)
- Vercel preview: per PR auto-deploy, link auto-comment di PR

## Project-Specific Rules

<!-- Owner: tambahkan rules spesifik project di sini -->
<!-- Contoh: design tokens, brand color, accessibility level, dst. -->

## Session Start Auto-Check (Anti-Stale Context)

> ⚠️ **POLA CONTOH — belum tentu terpasang di project-mu (jujur untuk staff non-programmer).** Cek di bawah (versi `@<project>/shared` dari GitHub Packages, Swagger di `api-staging.<project>.id`, channel Discord) mengandaikan "pabrik otomatis" yang **lintasAI TIDAK pasang otomatis** — pipeline `publish-shared.yml`, registry paket, endpoint Swagger, dan Discord itu harus owner siapkan dulu. **AI WAJIB cek dulu apakah infrastrukturnya benar-benar ADA sebelum menjalankan, dan DILARANG mencetak status palsu** (mis. "Swagger API: 47 endpoints cached ✅") kalau berkas/alamatnya tidak terbukti ada — itu rasa-aman-palsu yang berbahaya bagi staff non-programmer (§8.2 "no quote = no claim"). Belum dipasang → lewati bagian ini + sebut jujur "belum aktif". 🏢 Analogi: ini brosur fitur, bukan tombol yang sudah tersambung — jangan lapor "lampu menyala" kalau kabelnya belum dipasang.

Saat AI Claude Code session pertama tiap hari di repo ini, AI WAJIB execute pre-flight check:

### Check 1: @<project>/shared version

```bash
# Compare local version vs registry latest
LOCAL=$(node -p "require('./node_modules/@<project>/shared/package.json').version")
REMOTE=$(npm view @<project>/shared version --registry=https://npm.pkg.github.com 2>/dev/null || echo "?")

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "⚠️ @<project>/shared outdated: local $LOCAL vs remote $REMOTE"
  echo "Run: npm install @<project>/shared@latest"
fi
```

Action kalau outdated:
- Suggest npm install ke staff
- Atau auto-run kalau staff approve

### Check 2: Backend API spec (Swagger)

```bash
curl -s --max-time 5 https://api-staging.<project>.id/docs/openapi.json > /tmp/api-spec.json 2>/dev/null
if [ $? -eq 0 ]; then
  ENDPOINTS=$(jq -r '.paths | keys | length' /tmp/api-spec.json 2>/dev/null)
  echo "✅ Swagger spec cached: $ENDPOINTS endpoints available"
else
  echo "⚠️ Swagger spec unreachable. Frontend AI tidak punya context API terbaru."
fi
```

Use spec untuk:
- Validate API endpoint sebelum suggest fetch
- Check request/response shape
- Detect endpoint baru yang belum dipakai
- Refuse suggest endpoint yang tidak exist (forward escalation ke backend tim)

### Check 3: Discord context (optional)

Kalau ada Discord MCP atau webhook reader configured:
- Scan #<project>-deps channel untuk last 24h
- Look for backend publish notifications
- Highlight relevant updates ke staff

### Logging

Output check result di awal response sesi:

```
[Session pre-flight]
- @<project>/shared: v1.2.0 ✅ (latest)
- Swagger API: 47 endpoints cached ✅
- Last backend publish: 2 hours ago (via Discord)
Ready untuk task.
```
```
