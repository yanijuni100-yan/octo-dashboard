# templates/STACK_GUIDE.md - Panduan Stack Standar Tim AI-first

> Versi 1 · 2026-06-01

---

## 1. Pengantar

> ⚠️ **PENTING — panduan ini KHUSUS stack Next.js + Vercel + Supabase**, bukan "universal lintas-stack". Kalau proyekmu pakai stack lain (Python/Django, Go, Rust, PHP/Laravel, dll.), JANGAN paksakan panduan ini — minta AI buatkan panduan sesuai stack-mu (AI deteksi stack via `STACK_DETECTION_PATTERN.md` lalu menyesuaikan). Yang "universal" di kit ini adalah **aturan kerja** (`CLAUDE_universal_v1.md`), bukan pilihan stack.

File ini = **panduan opinionated** untuk stack standar tim AI-first.
Target stack default:

- **Frontend + Backend** → Next.js (lihat STACK_VERSIONS.md untuk versi terbaru) (App Router) + TypeScript 5+
- **Hosting primary** → Vercel (deploy auto dari Git)
- **Database** → Supabase (PostgreSQL managed)
- **UI** → Tailwind 4 + shadcn/ui
- **Future migration path** → Railway / Render (kalau butuh background worker native atau biaya Vercel kelebihan)

### Filosofi opinionated

- **Satu cara untuk satu hal** - jangan campur Pages Router & App Router, jangan campur Server Action & client-fetch untuk mutation.
- **Server-first** - default Server Component, baru ke Client kalau butuh interaktivitas.
- **Vendor-aware tapi tidak vendor-locked** - pakai Vercel sampai mahal, lalu pindah ke Railway/Render. Jangan pakai fitur Vercel-only kalau ada padanan portable.
- **AI-first** - semua konvensi di file ini juga dibaca AI tiap sesi → AI nulis kode yang konsisten tanpa user perlu ulang-ulang aturan.

> *Opinionated* = punya pendapat tegas soal cara kerja. Lawannya *unopinionated* (bebas pilih cara apa saja, tapi tim jadi berantakan).

---

## 2. Next.js App Router Convention

### 2.1. Server Component vs Client Component

**Default = Server Component** (tanpa `'use client'` di atas file).

Kapan pakai `'use client'`:

| Butuh                                            | Pakai `'use client'`? |
|--------------------------------------------------|------------------------|
| `useState`, `useEffect`, `useRef`                | YA                     |
| Event handler (`onClick`, `onChange`, `onSubmit`)| YA                     |
| Browser API (`window`, `localStorage`, `navigator`) | YA                  |
| Library client-only (mis. Framer Motion, Chart.js) | YA                   |
| Cuma render data dari DB / API                   | TIDAK (Server saja)    |
| Form static (pakai Server Action)                | TIDAK (Server saja)    |

**Pola yang benar**: Server Component sebagai *shell*, Client Component sebagai *island* interaktif kecil.

```tsx
// app/dashboard/page.tsx - Server Component (default)
import { db } from '@/lib/db'
import { LikeButton } from './like-button' // ini Client

export default async function DashboardPage() {
  const posts = await db.post.findMany() // fetch langsung di Server

  return (
    <div>
      {posts.map((post) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <LikeButton postId={post.id} /> {/* island interaktif */}
        </article>
      ))}
    </div>
  )
}
```

```tsx
// app/dashboard/like-button.tsx - Client Component
'use client'
import { useState } from 'react'

export function LikeButton({ postId }: { postId: string }) {
  const [liked, setLiked] = useState(false)
  return <button onClick={() => setLiked(!liked)}>{liked ? '♥' : '♡'}</button>
}
```

### 2.2. Data Fetching

**WAJIB**: fetch data di **Server Component** pakai `async/await` langsung.
**JANGAN**: pakai `useEffect` + `fetch` di Client Component untuk initial data.

```tsx
// BENAR - Server Component
export default async function Page() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 60 } // ISR: re-fetch tiap 60 detik
  }).then(r => r.json())
  return <div>{data.title}</div>
}

// SALAH - useEffect di Client Component untuk initial data
'use client'
export default function Page() {
  const [data, setData] = useState(null)
  useEffect(() => { fetch('...').then(...) }, []) // loading spinner, SEO buruk
}
```

Kapan pakai client-fetch (`SWR`, `React Query`, `useEffect+fetch`): **hanya** kalau data harus auto-refresh per interval atau triggered by user action setelah halaman load.

### 2.3. Metadata SEO

Setiap route export `metadata` (static) atau `generateMetadata` (dynamic).

```tsx
// Static metadata
export const metadata = {
  title: 'Dashboard | Akses',
  description: 'Panel admin proyek <project>.',
  openGraph: {
    title: 'Dashboard | Akses',
    description: 'Panel admin proyek <project>.',
    images: ['/og-dashboard.png'],
  },
}

// Dynamic metadata (per slug / per ID)
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await db.post.findUnique({ where: { slug: params.slug } })
  return {
    title: `${post.title} | Akses`,
    description: post.excerpt,
    openGraph: { images: [post.coverImage] },
  }
}
```

Di `app/layout.tsx` root, set default site-wide:

```tsx
export const metadata = {
  metadataBase: new URL('https://<project>.app'),
  title: { default: 'Akses', template: '%s | Akses' },
  description: 'Manajemen akses & dashboard.',
  robots: { index: true, follow: true },
}
```

### 2.4. Form & Mutation

**WAJIB**: pakai **Server Action** untuk semua mutation (create, update, delete).
**JANGAN**: pakai client `fetch('/api/...', { method: 'POST' })` untuk form internal.

```tsx
// app/posts/new/page.tsx - form static + Server Action
import { createPost } from './actions'

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <textarea name="content" required />
      <button type="submit">Simpan</button>
    </form>
  )
}
```

```tsx
// app/posts/new/actions.ts - Server Action
'use server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  // validasi (pakai Zod di produksi)
  if (!title || title.length < 3) throw new Error('Title min 3 char')

  await db.post.create({ data: { title, content } })
  revalidatePath('/posts')
  redirect('/posts')
}
```

Kalau butuh feedback interaktif (loading, error) di form → wrap dengan Client Component pakai `useActionState` (React 19).

### 2.5. Loading & Error State (File Convention)

Next.js App Router auto-render file ini di tiap route segment:

```text
app/
├── dashboard/
│   ├── page.tsx          // halaman utama
│   ├── loading.tsx       // muncul saat page.tsx masih loading data
│   ├── error.tsx         // muncul kalau page.tsx throw error
│   └── not-found.tsx     // muncul kalau notFound() dipanggil
```

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return <div className="animate-pulse">Memuat data...</div>
}

// app/dashboard/error.tsx - WAJIB 'use client'
'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>Ada error</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Coba lagi</button>
    </div>
  )
}
```

### 2.6. Image & Font Optimization

**Gambar**: pakai `next/image` (auto-resize, lazy-load, AVIF/WebP).

```tsx
import Image from 'next/image'

<Image
  src="/hero.jpg"
  alt="Hero proyek <project>"
  width={1200}
  height={600}
  priority // untuk above-the-fold (LCP)
/>
```

**Font**: pakai `next/font` (self-hosted, no layout shift, no FOUT).

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

---

## 3. Vercel Setup (Primary Hosting)

### 3.1. Connect Repo

1. Login https://vercel.com pakai akun GitHub tim.
2. **Add New → Project** → pilih repo dari GitHub.
3. Framework Preset: **Next.js** (auto-detect).
4. Root directory: `./` (kecuali monorepo).
5. Build command default: `next build` (jangan ganti kecuali perlu).

### 3.2. Environment Variables (Production / Preview / Development)

Vercel punya 3 environment terpisah:

| Env         | Kapan dipakai                                        |
|-------------|------------------------------------------------------|
| Production  | Deploy dari branch `main` (= public domain)          |
| Preview     | Deploy auto per PR / branch lain (= URL random)      |
| Development | Saat `vercel dev` lokal (jarang dipakai)             |

**WAJIB**: split env vars per environment. Production pakai DB produksi, Preview pakai DB staging (kalau ada).

Contoh isi env vars di dashboard Vercel:

```text
Production:
  DATABASE_URL = postgresql://...@prod-db.supabase.co:6543/postgres
  NEXT_PUBLIC_SITE_URL = https://<project>.app

Preview:
  DATABASE_URL = postgresql://...@staging-db.supabase.co:6543/postgres
  NEXT_PUBLIC_SITE_URL = https://<project>-preview.vercel.app
```

Variabel `NEXT_PUBLIC_*` = ter-expose ke browser (jangan taruh secret di sini). Tanpa prefix = server-only.

### 3.3. Custom Domain + SSL

1. Project Settings → **Domains** → Add domain (mis. `<project>.app`).
2. Update DNS di registrar: tambah record `A` ke `76.76.21.21` atau `CNAME` ke `cname.vercel-dns.com`.
3. SSL otomatis (Let's Encrypt) - tunggu 1-5 menit.
4. Tambah subdomain `www` → set redirect ke apex (atau sebaliknya).

### 3.4. Edge Function (untuk Middleware)

File `middleware.ts` di root → otomatis jalan di Edge Runtime (cepat, deploy global).

```ts
// middleware.ts - proteksi route /dashboard
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const token = req.cookies.get('session')?.value
  if (!token && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = { matcher: ['/dashboard/:path*'] }
```

### 3.5. Web Analytics + Speed Insights

Gratis di plan Hobby. Wajib pasang untuk SEO + Core Web Vitals monitoring.

```bash
npm i @vercel/analytics @vercel/speed-insights
```

```tsx
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

Aktifkan di dashboard: Project → Analytics → Enable; Speed Insights → Enable.

### 3.6. Preview Deploy Workflow

- Push ke branch apa saja (kecuali `main`) → Vercel auto-deploy **Preview** dengan URL unik (mis. `<project>-git-feat-login-team.vercel.app`).
- Buka PR di GitHub → Vercel bot auto-comment URL Preview.
- QA test di Preview URL, kalau OK → merge ke `main`.

### 3.7. Production Deploy

- Merge PR ke `main` → Vercel auto-deploy ke Production (domain custom).
- Deploy time biasanya 30-90 detik (Next.js + Tailwind).
- Build log lengkap di dashboard → Project → Deployments → klik deployment.

### 3.8. Rollback

Kalau production rusak setelah deploy:

1. Dashboard → Project → **Deployments**.
2. Cari deployment lama yang stabil.
3. Klik `...` (tiga titik) → **Promote to Production**.
4. Selesai dalam <10 detik - traffic langsung pindah ke deployment lama.

> Rollback **tidak** memutar balik DB. Kalau migrasi DB sudah jalan, rollback aplikasi saja bisa bikin error skema. Solusi: pakai migrasi backward-compatible (additive only).

---

## 4. Migration ke Railway / Render (Advanced --- Post-Launch)

> Default tim = **Vercel saja**. Section ini cuma jadi pointer.

Migrasi ke Railway atau Render = **operasi advanced** yang baru relevan kalau salah satu kondisi ini terjadi: (a) bill Vercel sudah lewat budget (mis. >$100/bulan untuk satu project), atau (b) butuh **background worker persistent** / **WebSocket long-lived** yang tidak cocok di model serverless Vercel. Untuk Day 0--1 staff IT non-programmer: **abaikan section ini**, pakai Vercel + Supabase saja. Detail step-by-step setup (provision, env vars, Dockerfile, worker, cron, healthcheck) ada di **`templates/STACK_MIGRATION_GUIDE.md`** --- file terpisah supaya STACK_GUIDE tetap fokus ke default workflow. Decision Matrix vendor (Vercel vs Railway vs Render) tetap dipertahankan di section 9 sebagai bahan pertimbangan kapan harus migrasi.

---

## 6. SEO Checklist Mandatory

Kategori prioritas:

- **Quick Wins** = WAJIB pre-launch. Tanpa ini, situs tidak ter-index Google atau muncul broken.
- **Bertahap** = affect ranking. Boleh nyusul minggu pertama setelah launch.
- **Strategi Besar** = boost ranking. Optimasi lanjutan, nice-to-have.

### Quick Wins (wajib pre-launch)

- [ ] `metadata.title` & `metadata.description` di tiap route (bukan default Next.js).
- [ ] `metadataBase` di root `layout.tsx` (untuk URL absolut di OG image).
- [ ] `robots.txt` di `app/robots.ts` atau `public/robots.txt` - pastikan **tidak** disallow `/` di production.
- [ ] `sitemap.xml` di `app/sitemap.ts` (Next.js auto-generate dari array).
- [ ] `lang="id"` (atau bahasa sesuai target) di tag `<html>`.
- [ ] Canonical URL di metadata (`alternates: { canonical: '...' }`) untuk halaman dengan query string.
- [ ] HTTPS aktif (Vercel auto, tidak perlu config).
- [ ] No `noindex` accidental di production (cek `robots` meta tag).

### Bertahap (affect ranking)

- [ ] Open Graph image (`og-image.png`, 1200x630px) per route penting.
- [ ] Structured data (JSON-LD) untuk artikel, produk, FAQ (pakai `<script type="application/ld+json">`).
- [ ] Alt text di semua `<Image>` (jangan kosong, jangan filename mentah).
- [ ] Heading hierarchy benar (`h1` satu per halaman, `h2/h3` ter-nest logis).
- [ ] Internal linking antar-halaman (anchor text deskriptif, bukan "klik di sini").
- [ ] Core Web Vitals: LCP <2.5s, CLS <0.1, INP <200ms (monitor via Speed Insights).
- [ ] Mobile responsive (test di Chrome DevTools device mode).

### Strategi Besar (boost ranking)

- [ ] Breadcrumb structured data.
- [ ] FAQ structured data di halaman dengan Q&A.
- [ ] Page speed: convert image ke AVIF/WebP (next/image auto-handle).
- [ ] Preconnect ke domain eksternal sering dipakai (`<link rel="preconnect" href="https://fonts.googleapis.com">`).
- [ ] Lazy-load iframe (YouTube embed, map).
- [ ] hreflang tag kalau multi-bahasa.

Contoh `app/robots.ts`:

```ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/'] },
    sitemap: 'https://<project>.app/sitemap.xml',
  }
}
```

Contoh `app/sitemap.ts`:

```ts
import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await db.post.findMany({ select: { slug: true, updatedAt: true } })
  return [
    { url: 'https://<project>.app', lastModified: new Date(), priority: 1 },
    ...posts.map(p => ({
      url: `https://<project>.app/post/${p.slug}`,
      lastModified: p.updatedAt,
      priority: 0.8,
    })),
  ]
}
```

---

## 7. Security Checklist

### 7.1. Env Vars

- [ ] Tidak ada secret hard-coded di repo (cek pakai `gitleaks` atau `truffleHog`).
- [ ] `.env.local` di `.gitignore`.
- [ ] Secret di Vercel env vars di-mark **Sensitive** (icon mata) - encrypted at rest.
- [ ] `NEXT_PUBLIC_*` cuma untuk data yang aman ke browser (URL, feature flag boolean) - JANGAN API key, JANGAN service_role_key.
- [ ] Rotate secret tiap quarter atau saat staff keluar.

### 7.2. Auth

- [ ] Session token via cookie `HttpOnly` + `Secure` + `SameSite=Lax`.
- [ ] Password hash pakai `bcrypt` (cost ≥10) atau `argon2`. JANGAN MD5/SHA1.
- [ ] CSRF protection di Server Action (Next.js handle by default via origin check, tapi kalau cross-domain → tambah token manual).
- [ ] Rate limit login endpoint (`@upstash/ratelimit` atau Vercel Edge Config).
- [ ] Lock account setelah 5 percobaan gagal (15 menit).

### 7.3. DB Connection

- [ ] Pakai **connection pooling** Supabase (`port 6543`, mode `transaction`) untuk serverless Vercel.
- [ ] JANGAN expose `service_role_key` ke client - itu bypass RLS.
- [ ] Pakai `anon_key` (limited) di browser, `service_role_key` di Server Action saja. **(Berlaku untuk arsitektur NON-split / monolith. Pada split-repo / microservice: frontend NOL akses DB — JANGAN colok Supabase dari browser sama sekali; semua data lewat API backend. Lihat `templates/split-agents/FRONTEND.md`.)**
- [ ] Row-Level Security (RLS) aktif di semua tabel publik.

### 7.4. CSP Header

Content Security Policy mencegah XSS injection.

```ts
// next.config.js
module.exports = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      ],
    }]
  },
}
```

---

## 8. Feature Flag Pattern (ADVANCED - Post-Launch Only)

> ⚠️ **Default workflow tim TIDAK pakai feature flag.** Untuk early-stage project (belum launch / progress <50%), staging via **Vercel Preview Deploy per PR** sudah cukup. Lihat `CLAUDE_TEAM_GUIDE.md` section 7b (Risk Level Decision Tree) untuk default workflow.
>
> Feature flag = advanced operation yang butuh owner familiar dengan Vercel env vars + redeploy cycle. **Tambahkan post-launch** kalau project sudah punya user aktif dan butuh:
> - Kill switch instant untuk fitur kritis (mis. payment toggle saat Black Friday)
> - A/B test gradual rollout (10% → 50% → 100%)
> - Per-user targeting (beta tester subset)

Detail implementasi lengkap (decision tree, naming convention, cleanup ritual, testing pattern, per-user hash) di **`./.claude-kit/templates/feature-flags-advanced.md`** - file terpisah supaya tidak ngebebanin kit default workflow.

**Untuk early-stage <project> (progress ~5%)**: skip section ini, pakai Risk Level (CLAUDE_TEAM_GUIDE.md 7b) + staging-only.

---

## 9. Decision Matrix: Vercel vs Railway vs Render

| Aspek                           | Vercel                | Railway              | Render               |
|---------------------------------|-----------------------|----------------------|----------------------|
| **Setup speed**                 | ★★★★★ (auto Next.js)  | ★★★★ (Nixpacks)      | ★★★ (manual config)  |
| **DX (Developer Experience)**   | ★★★★★                 | ★★★★                 | ★★★                  |
| **Preview deploy per PR**       | YA (default)          | YA (default)         | YA (paid plan)       |
| **Background worker persistent**| TIDAK (serverless)    | YA                   | YA                   |
| **Cron native**                 | Vercel Cron (Pro+)    | YA (gratis)          | YA (gratis)          |
| **WebSocket / SSE long-lived**  | Terbatas (Edge)       | YA                   | YA                   |
| **PostgreSQL bundled**          | TIDAK (pakai Supabase)| YA (plugin)          | YA (managed)         |
| **Pricing transparency**        | ★★★ (function invoke) | ★★★★ (per-resource)  | ★★★★★ (flat)         |
| **Free tier (small project)**   | Hobby gratis cukup    | $5 credit/bulan      | Free 750 jam/bulan   |
| **Vendor lock-in**              | Tinggi (Edge runtime) | Rendah (Docker)      | Rendah (Docker)      |
| **Best untuk**                  | Marketing site, SaaS, dashboard | App butuh worker / WS | Stabilitas + predictable |

### Rekomendasi default

- **0 → MVP**: Vercel (deploy 5 menit, gratis).
- **MVP → 1000 user**: Tetap Vercel, monitor cost. Pakai Supabase untuk DB.
- **1000 → 10k user**: Cek bill Vercel. Kalau >$100/bulan & butuh worker → pindah ke Railway.
- **Enterprise / butuh on-premise**: Render (lebih konservatif) atau self-host Docker.

---

## 10. Checklist Pre-Launch

Sebelum announce launch produksi:

- [ ] Semua Quick Wins SEO terisi (section 6).
- [ ] Semua Security checklist terisi (section 7).
- [ ] Speed Insights + Analytics aktif.
- [ ] Custom domain + SSL aktif (bukan `.vercel.app`).
- [ ] Rollback plan dipahami (section 3.8).
- [ ] Backup DB Supabase aktif (Settings → Database → Backups).
- [ ] Error monitoring (Sentry / Vercel logs) aktif.
- [ ] Healthcheck endpoint `/api/health` ada (untuk uptime monitor).
- [ ] Robots & sitemap di-submit ke Google Search Console.
- [ ] Feature flag default = stable path (rollout fitur baru bertahap).

---

## Referensi Eksternal

- Next.js App Router docs: https://nextjs.org/docs/app
- Vercel docs: https://vercel.com/docs
- Railway docs: https://docs.railway.app
- Render docs: https://render.com/docs
- Google Search Central (SEO): https://developers.google.com/search
- Web.dev (Core Web Vitals): https://web.dev/vitals

---

> **Update file ini** tiap kali tim ganti vendor, ganti versi major Next.js, atau ada keputusan stack baru. Catat di `CHANGELOG.md` kit + bump versi.
