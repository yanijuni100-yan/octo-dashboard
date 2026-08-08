# Project Stack Starter Templates - lintasAI

> Pre-built project boilerplate untuk start project BARU dengan lintasAI embedded.
> Audience: Owner yang mau bikin project baru (selain project current).
> Default Recommendation: project setengah jadi (mature) JANGAN pakai starter, langsung adapt lintasAI.

---

## Filosofi

Starter template = jumpstart project baru. SKIP setup awal 1-2 hari, langsung punya:

- Stack dasar terpasang (Next.js, Prisma, Supabase, dst)
- lintasAI v1.0.0 embedded di `.claude-kit/`
- Tier scope skeleton ready
- Discord webhook template
- Pre-commit hooks configured
- Sample auth flow + dashboard layout

Analogi: kayak beli rumah dengan furniture lengkap. Tinggal masuk, tata barang sendiri. Lebih cepat dari beli rumah kosong + furniture satu-satu.

Filosofi inti: starter template TIDAK pernah bawa logika bisnis. Cuma struktur + commodity code (auth, layout, validation). Owner tinggal isi bisnis di atas pondasi yang sudah siap.

---

## DEFAULT RECOMMENDATION

PERHATIAN: Untuk user yang sudah punya project setengah jadi, **SKIP starter template, langsung adapt lintasAI**.

Kenapa?

- Project setengah jadi sudah ada struktur sendiri (folder layout, konvensi naming, tooling)
- Apply starter template = harus refactor existing code biar match struktur starter
- Effort migrate >>> effort adapt
- Risiko regression tinggi (kode lama bisa break karena struktur baru)

Pakai starter cuma kalau:

- Project benar-benar baru (fresh, belum ada code)
- Mau setup ke-2 (project baru selain yang sekarang)
- Spin-off / new product line dari project existing
- Eksperimen / proof-of-concept yang nantinya bisa dibuang

Kalau ragu: tanya diri sendiri "kalau saya buang struktur project sekarang dan pakai starter, berapa file yang harus saya rewrite?" Kalau > 30% file, JANGAN pakai starter.

---

## Available Templates

> ⚠️ **STATUS JUJUR — baca dulu sebelum `git clone`:** repo starter `lintasai-starter-*` di bawah **BELUM diterbitkan** (masih rencana — lihat [Roadmap](#roadmap)). Perintah `git clone https://github.com/ojokesusu/lintasai-starter-...` akan **GAGAL** dengan pesan `repository not found`. **Jangan clone repo starter itu untuk sekarang.**
>
> **Cara yang PASTI JALAN hari ini** (hasil akhirnya sama — pondasi cepat + lintasAI tertanam): pakai perintah **resmi framework** untuk pondasi (mis. `npx create-next-app`), lalu jalankan **`npm create lintasai`** untuk menanam aturan + pengaman lintasAI di project itu. Langkah lengkap ada di [How to Use Template → Skenario A](#skenario-a-bikin-project-baru-fresh). Daftar "What's included" di bawah = **rencana isi** tiap starter (untuk acuan, bukan repo yang sudah ada).
>
> 🏢 Analogi: anggap ini **brosur menu yang menunya belum dijual** — resepnya benar & berguna sebagai acuan, tapi untuk makan sekarang kamu masak sendiri pakai bahan yang tersedia (create-next-app) lalu bumbui dengan lintasAI.

### Template 1: lintasai-starter-nextjs-prisma-supabase

Status: 🚧 Rencana (repo belum tersedia) — untuk SaaS dengan database. Cara jalan hari ini: pakai blok "Cara pakai" di bawah.

Stack:

- Next.js (lihat STACK_VERSIONS.md untuk versi terbaru) (App Router + Server Action)
- Prisma (lihat STACK_VERSIONS.md untuk versi terbaru) ORM
- Supabase PostgreSQL
- NextAuth v4 (Credentials + OAuth)
- Tailwind v4 + Shadcn UI
- TypeScript strict
- lintasAI v1.0.0 embedded

What's included:

- Sample auth flow: register, login, password reset
- Sample dashboard layout (sidebar + topbar)
- Sample protected route
- Sample API route dengan validation
- Sample Prisma schema (User, Account, Session, VerificationToken)
- Sample migration
- Pre-commit hook (lint + typecheck)
- Discord webhook template untuk notif deploy
- `.env.example` lengkap dengan komentar

Setup time: ~30 menit sampai `npm run dev` jalan

Cara pakai (PASTI JALAN hari ini — repo starter belum terbit, jadi pakai pondasi resmi + tanam lintasAI):

```bash
# 1) Pondasi Next.js resmi (mengganti 'git clone' repo starter yang belum ada)
npx create-next-app@latest my-new-app --typescript --tailwind --app
cd my-new-app
# 2) Tambah Prisma + Supabase (ikuti STACK_GUIDE.md bagian "Next.js + Supabase")
npm install prisma @prisma/client && npx prisma init
# 3) Tanam aturan + pengaman lintasAI ke project ini
npm create lintasai
# 4) Isi rahasia lalu jalankan
cp .env.example .env.local 2>/dev/null || true   # edit DATABASE_URL, NEXTAUTH_SECRET, dst
npm run dev
```

### Template 2: lintasai-starter-nextjs-shadcn-tailwind

Status: 🚧 Rencana (repo belum tersedia) — untuk project fokus UI. Cara jalan hari ini: `npx create-next-app` + `npm create lintasai` (lihat Skenario A).

Stack:

- Next.js (lihat STACK_VERSIONS.md untuk versi terbaru) (no Prisma, no DB)
- Shadcn UI + Tailwind v4
- Component library starter (50+ pre-built component)
- Storybook configured
- Playwright E2E configured
- TypeScript strict
- lintasAI v1.0.0 embedded

Best untuk:

- Landing page builder
- Component library demo
- Static site dengan dashboard
- No backend project
- Marketing site dengan CMS headless

Setup time: ~15 menit (no DB = lebih cepat)

### Template 3: lintasai-starter-monorepo-turborepo

Status: 🚧 Rencana (repo belum tersedia) — untuk team 5+ yang mau monorepo dari awal. Cara jalan hari ini: `npx create-turbo@latest` + `npm create lintasai` (lihat Skenario A).

Stack:

- Turborepo workspaces
- `apps/web` (Next.js)
- `apps/api` (Hono atau Next.js API mode)
- `packages/ui` (shared components)
- `packages/shared` (types)
- `packages/tools` (scripts)
- Discord webhook integration
- CODEOWNERS skeleton
- lintasAI v1.0.0 embedded di root

Best untuk:

- Team yang mau split repo dari awal (skip migration nanti)
- Confident dengan monorepo tooling
- Multi-app product (web + mobile + admin)

Setup time: ~45 menit (lebih banyak konfigurasi workspace)

### Template 4: lintasai-starter-mobile-expo

Status: Future (belum tersedia, target Q3 2026)

Stack:

- React Native + Expo
- React Query
- AsyncStorage
- Push notifications setup
- lintasAI v1.0.0 embedded

---

## How to Use Template

### Skenario A: Bikin Project Baru (Fresh)

> Repo starter `lintasai-starter-*` belum terbit. Pakai pondasi resmi framework lalu tanam lintasAI — hasil akhirnya sama.

```bash
# Step 1: Bikin pondasi project pakai perintah resmi framework
#         (Next.js contoh; untuk monorepo pakai `npx create-turbo@latest`)
npx create-next-app@latest <project-baru> --typescript --tailwind --app
cd <project-baru>
# (create-next-app sudah `git init` otomatis — tak perlu reset)

# Step 2: Bikin repo baru di GitHub
gh repo create ojokesusu/<project-baru> --private --source=. --remote=origin --push

# Step 3: Tanam aturan + pengaman lintasAI ke project ini
npm create lintasai
# Ini yang memuat .claude-kit/ + memandu setup (Fase B). Tak perlu git clone manual.

# Step 4: Setup env
cp .env.example .env.local 2>/dev/null || true
# Edit .env.local: isi DATABASE_URL, NEXTAUTH_SECRET, API keys

# Step 5: Install + dev
npm install
npm run dev
```

### Skenario B: Project Sudah Ada (Setengah Jadi)

JANGAN pakai starter template. Langsung adapt lintasAI:

```bash
cd <existing-project>
git clone https://github.com/ojokesusu/lintasAI.git .claude-kit
.claude-kit/setup-pola-b.ps1
```

LintasAI akan auto-detect stack (via `STACK_DETECTION_PATTERN.md`) dan customize setup berdasarkan project existing.

---

## Maintenance Starter Templates

Owner (lintasAI maintainer) update template tiap kit version baru:

1. Update template repo dengan kit baru (`.claude-kit/` refresh)
2. Update sample code kalau ada API change (Next.js bump, Prisma bump, dst)
3. Test fresh clone -> jalan tanpa error
4. Tag template repo dengan version (`v1.0.0`, `v1.1.0`, dst)
5. Update CHANGELOG di tiap template repo

User yang sudah clone template TIDAK otomatis update. Mereka manual sync `.claude-kit/` via:

```bash
.claude-kit/kit.ps1 update
```

Sample code (auth flow, dashboard, dst) TIDAK auto-sync. User cherry-pick manual kalau mau adopt pattern baru.

---

## Roadmap

Template yang akan dirilis nanti:

- Mobile app (React Native + Expo) - Q3 2026
- AI chatbot (Vercel AI SDK + streaming) - Q4 2026
- E-commerce (Next.js + Stripe + Inventory) - Q4 2026
- SaaS dashboard (multi-tenant + billing) - Q1 2027
- Internal tool (Next.js + drag-drop form builder) - TBD

User feedback welcome untuk request template baru. Submit issue di repo `ojokesusu/lintasAI` dengan label `starter-template-request`.

---

## FAQ

**Q: Bisa pakai starter buat project yang sudah ada?**
A: Tidak recommended. Refactor existing > 80% kode = lebih effort dari mulai fresh. Pakai adapt lintasAI saja (Skenario B).

**Q: Starter punya algoritma rahasia?**
A: TIDAK. Starter = struktur + commodity code (auth flow, layout, validation). Tidak ada IP proprietary. Logika bisnis = owner isi sendiri.

**Q: Bisa fork starter + customize?**
A: BISA. Lisensi: MIT (free use, modify, redistribute). Fork, ganti nama, jual, terserah.

**Q: Berapa cost pakai starter?**
A: $0. Starter = repo template gratis. Cost cuma untuk hosting (Vercel, Supabase, dst) yang sama saja kalau bikin dari nol.

**Q: Starter update tiap berapa lama?**
A: Mengikuti release lintasAI kit (rata-rata 2-4 minggu) + bump major framework (Next.js, Prisma).

**Q: Kalau Next.js major version baru keluar (lihat STACK_VERSIONS.md), starter auto-upgrade?**
A: Tidak otomatis. Owner test dulu di staging, baru release versi baru starter dengan tag `v2.0.0`.

**Q: Bisa kombinasi 2 starter?**
A: Tidak praktis. Pilih satu yang paling dekat ke kebutuhan, lalu adapt manual.

**Q: Starter cocok buat hackathon?**
A: SANGAT cocok. Template 1 (Next.js + Prisma + Supabase) bisa hemat 1-2 hari setup di hackathon 48 jam.

---

## Catatan Tambahan

- Semua starter pakai TypeScript strict mode (no `any` allowed)
- Semua starter ada `.editorconfig` + `.prettierrc` konsisten
- Semua starter ada GitHub Actions skeleton (lint, typecheck, test)
- Semua starter embed `.claude-kit/` di root, ready pakai workflow lintasAI

Untuk owner solo (kayak user current): starter template = nice-to-have, bukan must. Adapt lintasAI ke project existing biasanya cukup.
