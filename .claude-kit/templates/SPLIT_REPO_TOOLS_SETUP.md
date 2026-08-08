# 19 Tools Setup Guide untuk Split Repo

> Setup tools yang memudahkan non-programmer + AI Claude Code di arsitektur multi-repo / microservice (varian shared-database).
> Audience: Owner saat setup awal split repo.

---

## Tier 1: WAJIB (Setup Awal)

### 1. AGENTS.md per Repo (sudah deploy via lintasAI)
Status: Auto-deployed dari template SPLIT_REPO_AGENTS_TEMPLATES.md
Effort: 0 (otomatis)
Manfaat: AI auto-context per repo, staff tidak perlu kasih konteks tiap prompt

### 2. @<project>/shared Types Package

**Setup di <project>-shared repo:**

```bash
mkdir <project>-shared && cd <project>-shared
npm init -y
npm install --save-dev typescript tsup
```

Create tsconfig.json:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

Create src/index.ts:
```ts
// Public API: re-export semua type
export * from './types/order'
export * from './types/user'
```

Create src/types/order.ts:
```ts
export type Order = {
  id: number
  status: 'pending' | 'shipped' | 'delivered'
  // ...
}
```

Build:
```bash
npx tsup src/index.ts --format esm,cjs --dts
```

Publish (GitHub Packages):
```bash
git tag v1.0.0
git push origin main --tags
# GitHub Actions auto-publish ke GitHub Packages
```

**Setup di frontend + backend:**

```bash
# .npmrc di root project
@<project>:registry=https://npm.pkg.github.com

# package.json
"dependencies": {
  "@<project>/shared": "^1.0.0"
}

npm install
```

### 3. Swagger UI untuk API Documentation

**Untuk backend Next.js API mode:**

```bash
cd <project>-backend
npm install --save next-swagger-doc swagger-ui-react
```

Create src/app/api/docs/route.ts:
```ts
import { createSwaggerSpec } from 'next-swagger-doc'

export async function GET() {
  const spec = createSwaggerSpec({
    apiFolder: 'src/app/api',
    definition: {
      openapi: '3.0.0',
      info: { title: '<project> API', version: '1.0.0' },
    },
  })
  return Response.json(spec)
}
```

Create src/app/docs/page.tsx untuk Swagger UI viewer.

Auto-doc dari JSDoc comment di route handler.

**Untuk Hono:**

```bash
npm install @hono/swagger-ui @hono/zod-openapi
```

Setup OpenAPI spec di app.ts. Hono auto-generate dari Zod schemas.

Buka di browser: http://localhost:3001/docs

### 4. Prompt Template Cheatsheet
Status: Already provided di SPLIT_REPO_NON_PROGRAMMER_PROMPTS.md
Action: Print, distribute ke staff

### 5. AI Clarifying Behavior
Status: Built-in Claude Code 4.7+
Action: 0 (otomatis)

---

## Tier 2: SANGAT RECOMMENDED

### 6. Vercel Preview Deploy

Setup:
- Otomatis aktif di Vercel kalau repo connected
- Setiap PR dapat preview URL
- Owner buka preview URL, smoke test
- Approve PR kalau OK

Verify:
- Buka https://vercel.com/dashboard
- Settings -> Git -> "Preview Deployments" should be enabled

**Bagaimana Staff Akses:**
- Vercel preview URL = PUBLIC by default (siapapun yang punya link bisa buka)
- Saat PR open di GitHub, Vercel bot auto-comment URL preview di PR
- Staff klik URL -> buka di browser -> smoke test fitur
- Untuk preview yang sensitive: upgrade Vercel Pro untuk "Password Protection" ($20/mo)
- Alternative: Vercel team invite (limit 5 di Hobby plan)

### 7. GitHub PR Template

Create .github/PULL_REQUEST_TEMPLATE.md:

```markdown
## TASK ID
TASK-XX

## Yang berubah
- 

## Cara test
1. 
2. 

## Screenshot/video (kalau UI)


## Checklist Owner
- [ ] Code review OK
- [ ] Vercel preview deploy OK
- [ ] Test flow OK
- [ ] Tidak ada console error
```

### 8. Discord Webhook Notif

Setup webhook URL:
- Discord server settings -> Integration -> Webhooks -> New Webhook -> copy URL

Vercel integration:
- Dashboard -> Settings -> Integrations -> Discord -> paste webhook URL

GitHub Actions integration:
- Repo Settings -> Webhooks -> add Discord URL

Notification types:
- PR opened/merged
- Vercel deploy success/fail
- GitHub Action result

### 9. Storybook untuk Frontend

```bash
cd <project>-frontend
npx storybook@latest init
npm run storybook
```

Buka http://localhost:6006. Develop UI component isolated dari app context.

AI bisa generate stories: "buat story untuk komponen OrderRow dengan 3 variant: pending, shipped, delivered".

### 10. Playwright E2E (untuk Non-Programmer SANGAT RECOMMENDED)

Analogi: bayangkan punya "robot QA otomatis yang test aplikasi" - robot ini buka browser sendiri, klik tombol, isi form, dan lapor pass/fail. Tidak capek, tidak lupa step, jalan tiap kali kode berubah.

```bash
cd <project>-frontend
npm init playwright@latest
```

Setup config untuk test against staging URL.

**Workflow non-programmer:**

1. AI generate test scenario dari prompt awam - owner/staff cukup deskripsi flow normal, AI translate ke kode test
2. Owner setup config sekali (base URL, browser, retry policy) di playwright.config.ts
3. Staff run: `npm run e2e:ui` (visual mode - klik test di sidebar untuk run, lihat browser jalan otomatis, lihat hasil langsung)
4. Hasil pass/fail visual - hijau = aman, merah = ada flow yang break, dengan screenshot + video replay

**Contoh prompt awam ke AI:**

> "AI, test E2E flow login + create order. Pastikan halaman tracking ke-render setelah submit."

AI akan generate file test lengkap dengan langkah: buka login page, isi email/password, klik submit, tunggu redirect, buat order, verify tracking page muncul.

Run: `npx playwright test --ui` (visual mode untuk non-programmer).

### 11. DevContainer (.devcontainer/) - Untuk Non-Programmer SANGAT RECOMMENDED

Penjelasan: tools yang bikin env staff 100% identik dengan env owner - tidak ada lagi "works on my machine" problem (kode jalan di laptop owner, tapi crash di laptop staff karena beda Node version, beda dependency, dll).

**Setup untuk owner (sekali saja):**

Bikin `.devcontainer/devcontainer.json` di repo:

```json
{
  "image": "mcr.microsoft.com/devcontainers/typescript-node:20",
  "features": {},
  "postCreateCommand": "npm install",
  "customizations": {
    "vscode": {
      "extensions": ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"]
    }
  }
}
```

**Untuk staff non-programmer:**

1. Install Docker Desktop sekali (~1 jam download + setup, ~500MB)
2. Buka VS Code di folder repo (clone via GitHub Desktop dulu)
3. Notif muncul di pojok kanan bawah: "Reopen in Container" → klik
4. Env auto-setup (Node, npm, dependencies, VS Code extensions) dalam ~10 menit (sekali doang, abis itu cepat)
5. Tidak perlu install Node manual, tidak ada conflict version, tidak ada "kenapa di laptop saya error?"

**Trade-off honest:**

- Pros: env identik 100%, zero "works on my machine", staff baru onboarding cuma butuh install Docker + clone repo
- Cons: butuh install Docker Desktop (~500MB disk), startup VS Code 30 detik lebih lama (container boot), butuh RAM ekstra (~2GB saat container jalan)

**Caveat:** kalau staff sudah comfortable manual setup Node + tidak pernah ada masalah env beda antara laptop owner & staff, fitur ini bisa di-SKIP. Berguna terutama kalau tim grow (3+ staff) atau ada staff yang awam soal setup developer env.

---

## Tier 3: PRODUCTION READY

### 12. Sentry untuk Error Monitoring

```bash
cd <project>-frontend
npm install --save @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Setup di backend juga. Production error -> Sentry capture -> owner alert.

Sentry dashboard show stack trace + reproduction steps.

### 13. Semantic Release + Auto Changelog

```bash
npm install --save-dev semantic-release
```

Setup .releaserc.json. GitHub Actions auto-tag + auto-changelog dari commit message.

Convention: 
- "feat: ..." -> minor bump
- "fix: ..." -> patch bump
- "feat!: ..." -> major bump (breaking)

### 14. Renovate / Dependabot

GitHub repo Settings -> Security -> Dependabot alerts -> Enable

Atau Renovate: install GitHub app, config di renovate.json.

Auto PR untuk update dependency. AI review safety.

### 15. GitHub Discussions

Settings -> General -> Features -> Discussions: enable

Categories:
- Q&A: staff tanya jawab
- Ideas: feature request
- Announcements: owner broadcast

Lebih bagus dari Slack untuk technical question (searchable, threaded).

---

## Bonus Tools

### 16. Code Lens / Inline AI

Claude Code built-in inline suggestions. Sudah aktif default.

### 17. Vitest UI + Playwright UI

```bash
npm run test:ui      # Vitest visual mode
npm run e2e:ui       # Playwright visual mode
```

Klik test untuk run, lihat hasil visual.

### 18. Loom Recording

Untuk owner share video demo ke staff non-programmer.
Free tier: loom.com (5 min video).
Atau: built-in Windows Snipping Tool Record.

### 19. Documentation Aggregator (Nextra)

Deploy semua docs/* sebagai searchable site.

```bash
npx create-next-app docs-site -e https://github.com/shuding/nextra/tree/main/examples/docs
```

Deploy ke Vercel. URL: docs.<project>.id

---

## Priority Order

**Week 1 (Setup awal split repo)**: Tier 1 (1-5)
**Week 2**: Tier 2 (6-11) - termasuk Playwright E2E + DevContainer untuk non-programmer
**Month 2**: Tier 3 (12-15)
**Future**: Bonus (16-19)

---

## Cost Summary

| Tool | Cost |
|---|---|
| AGENTS.md, types, Swagger | $0 (built-in) |
| Vercel Preview | $0 (default plan) |
| GitHub PR template, Discussions | $0 |
| Slack/Discord webhook | $0 |
| Storybook, Playwright, Vitest UI | $0 |
| Sentry | $0 (free tier 5K errors/month) |
| Renovate/Dependabot | $0 (GitHub free) |
| DevContainer | $0 (butuh Docker Desktop, ~5GB disk untuk images) |
| Loom | $0 (free tier) |
| Documentation site | $0 (Vercel hosting) |
| **TOTAL** | **$0** untuk small team |

Tools premium (Sentry Pro, Renovate Pro) start ~$25/bln, optional saat tim grow.

---

## Cost Total Updated

Ringkasan biaya berdasarkan tier baru (post-elevation Playwright + DevContainer):

- **All Tier 1 + Tier 2 (sections 1-11)**: **$0**
  - Catatan: DevContainer (section 11) butuh disk space untuk Docker images (~5GB) di laptop owner & staff, tapi tidak ada subscription cost
- **Tier 3 optional (sections 12-15)**: **~$25/bulan** kalau pakai Sentry Pro atau Renovate Pro; **$0** kalau cukup dengan free tier
- **Bonus tools (sections 16-19)**: **$0** untuk free tier semua tools (Loom 5min, Vercel hosting, dll). Optional, tidak wajib.

**Bottom line:** tim bisa start dengan **$0/bulan** sampai scale ke ~5+ staff atau ~5K+ errors/bulan, baru perlu pertimbangkan premium tier.
