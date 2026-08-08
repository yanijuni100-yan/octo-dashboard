# Cross-Repo Auto Types Pipeline - lintasAI

> Otomatisasi penuh: backend update schema → types auto-generate → @<project>/shared publish → Discord notify → frontend Renovate auto-PR.
> Audience: Owner setup awal (sekali).

---

## Filosofi: "Backend Owns the Contract"

Backend = single source of truth untuk:
- Database schema (Prisma)
- API endpoint signatures
- Business logic types

Frontend = consumer of contract via @<project>/shared package.

Tidak ada manual sync. Pipeline auto-handle.

Kenapa filosofi ini penting:
- Frontend tidak boleh "tebak-tebakan" bentuk data dari backend
- Setiap kontrak (type, schema, signature) hanya diubah di backend
- Frontend cuma konsumsi versi terbaru lewat package manager
- Conflict resolution jadi mudah karena cuma satu sumber kebenaran

---

## Setup di <project>-backend Repo

### Step 1: Install dependencies

```bash
cd <project>-backend
npm install --save-dev tsup typescript semantic-release @semantic-release/git @semantic-release/exec
npm install --save zod  # untuk shared validation schemas
```

Penjelasan tiap dependency:
- `tsup` - bundler super cepat untuk build TypeScript types
- `typescript` - compiler resmi
- `semantic-release` - opsional, untuk auto-bump version berdasarkan commit message
- `zod` - runtime validation schemas yang bisa di-share frontend + backend

### Step 2: Setup tsup config

Create <project>-backend/tsup.shared.config.ts:

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/shared/index.ts'],  // export types yang shared
  format: ['esm', 'cjs'],
  dts: true,                        // auto-generate .d.ts
  outDir: 'shared-dist',
  clean: true,
})
```

Catatan:
- `format: ['esm', 'cjs']` - support modern bundler (Vite, Next.js) sekaligus legacy (Jest, ts-node)
- `dts: true` - auto-generate file `.d.ts` (declaration file) untuk type inference di frontend
- `outDir: 'shared-dist'` - jangan di `dist/` supaya tidak konflik dengan build backend

### Step 3: Define shared types (manual + auto-generated)

Create <project>-backend/src/shared/index.ts:

```typescript
// Re-export Prisma types yang aman di-share ke frontend
export type {
  User,
  Order,
  Platform
  // Don't export: Credentials (sensitive), Sessions (internal)
} from '@prisma/client'

// Export Zod schemas untuk runtime validation
export { UserSchema, OrderSchema } from './schemas/user'
export { TrackingSchema, type OrderTracking } from './schemas/tracking'

// Manual types untuk API response wrappers
export type ApiResponse<T> = { data: T, meta?: any } | { error: string }
```

PENTING: Filter type yang sensitif:
- `Credentials`, `Sessions`, `ApiKey`, `Token` - JANGAN di-export
- Field internal seperti `internal_notes`, `cost_price`, `commission` - pakai DTO terpisah
- Buat type wrapper `PublicUser` (cuma field yang aman ke client) vs `User` (full Prisma model di backend)

### Step 4: Auto-generate script

Add to <project>-backend/package.json:

```json
{
  "scripts": {
    "generate:types": "prisma generate && tsup --config tsup.shared.config.ts",
    "publish:shared": "cd shared-dist && npm publish --registry=https://npm.pkg.github.com"
  }
}
```

Test lokal:
```bash
npm run generate:types
ls shared-dist/   # cek output: index.d.ts, index.js, index.mjs, package.json
```

### Step 5: GitHub Actions auto-pipeline

Create <project>-backend/.github/workflows/publish-shared.yml:

```yaml
name: Publish @<project>/shared on schema change

on:
  push:
    branches: [main]
    paths:
      - 'prisma/schema.prisma'
      - 'src/shared/**'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://npm.pkg.github.com'
      - run: npm ci
      - name: Generate types
        run: npm run generate:types
      - name: Bump version & publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          cd shared-dist
          npm version patch -m 'chore(shared): bump version [skip ci]'
          npm publish
      - name: Notify Discord
        run: |
          VERSION=$(node -p "require('./shared-dist/package.json').version")
          curl -X POST ${{ secrets.DISCORD_WEBHOOK_DEPS }} \
            -H 'Content-Type: application/json' \
            -d "{\"content\": \"@<project>/shared v$VERSION published. Frontend team: PR dari Renovate akan masuk dalam 24 jam, atau manual npm install untuk segera dapat update.\"}"
```

Catatan trigger:
- `paths` filter - workflow hanya jalan kalau yang berubah Prisma schema atau folder shared
- Kalau cuma update business logic backend (di luar shared/), workflow skip → hemat CI minutes
- `[skip ci]` di commit version bump - supaya tidak trigger workflow lagi (infinite loop)

---

## Real-Time Trigger Pattern (Recommended for Fast-Moving Teams)

> Backend publish → Frontend repo auto-update DALAM 3-5 MENIT (vs Renovate 24 jam).
> Pakai GitHub Actions repository_dispatch event.

### Filosofi

Renovate = polling-based (scan periodic). Untuk team yang kerja CEPAT (AI Claude Code-powered), 24 jam terlalu lama.

Solusi: push-based. Backend lapor SEKARANG, frontend respond SEKARANG.

### Setup Backend Side

Update .github/workflows/publish-shared.yml di <project>-backend, tambah step terakhir:

```yaml
      - name: Trigger frontend repo update
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.FRONTEND_REPO_DISPATCH_TOKEN }}
          repository: <owner>/<project>-frontend
          event-type: shared-package-published
          client-payload: |
            {
              "version": "${{ env.NEW_VERSION }}",
              "commit": "${{ github.sha }}",
              "changelog_url": "https://github.com/<owner>/<project>-backend/commits/main"
            }
```

Setup secret:
1. Generate Personal Access Token (PAT) di GitHub > Settings > Developer settings > Tokens (classic)
2. Scope: `repo` + `workflow` (untuk akses repo frontend)
3. Save ke <project>-backend > Settings > Secrets > FRONTEND_REPO_DISPATCH_TOKEN

### Setup Frontend Side

Create .github/workflows/receive-shared-update.yml di <project>-frontend:

```yaml
name: Receive @<project>/shared update

on:
  repository_dispatch:
    types: [shared-package-published]

jobs:
  update:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://npm.pkg.github.com'
          scope: '@<project>'
      - name: Install new shared version
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          npm install @<project>/shared@${{ github.event.client_payload.version }}
      - name: Create PR
        id: cpr
        uses: peter-evans/create-pull-request@v6
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: "chore(deps): bump @<project>/shared to ${{ github.event.client_payload.version }}"
          title: "Auto-update @<project>/shared to v${{ github.event.client_payload.version }}"
          body: |
            Triggered by backend publish.

            **Version**: v${{ github.event.client_payload.version }}
            **Backend commit**: [${{ github.event.client_payload.commit }}](${{ github.event.client_payload.changelog_url }})

            ## Action Required

            - Review changes di backend (klik commit link di atas)
            - Test di local: `npm run dev` + check halaman yang affected
            - Approve + merge kalau OK

            ## Auto-Generated
            Workflow: `.github/workflows/receive-shared-update.yml`
          branch: auto/shared-update-${{ github.event.client_payload.version }}
          labels: |
            auto-update
            shared-types
```

### Workflow End-to-End (3-5 Menit Total)

```
10:00:00 Backend staff prompt AI -> push schema change ke <project>-backend main
10:00:05 GitHub Actions: publish-shared.yml triggered
10:01:30 Types generated + version bumped + publish ke GitHub Packages
10:02:00 npm publish complete
10:02:05 Discord webhook notif posted
10:02:10 repository_dispatch ke <project>-frontend
10:02:15 Frontend repo: receive-shared-update.yml triggered
10:03:00 npm install @<project>/shared@latest
10:03:30 Create PR via peter-evans/create-pull-request
10:04:00 PR ready di <project>-frontend
10:04:05 Discord notif update: "PR ready di frontend repo, please review"

Total: ~4 menit dari backend push to frontend PR ready.
```

### Comparison: Renovate vs Real-Time Trigger

| Aspect | Renovate (24 jam) | Real-Time Trigger (4 menit) |
|---|---|---|
| Latency | <24 jam | <5 menit |
| Setup complexity | Low (1 file renovate.json) | Medium (2 workflow files + PAT) |
| Reliability | High (mature tool) | High (GitHub native event) |
| Cost | $0 | $0 |
| Best for | Slow teams, less critical updates | Fast teams, AI Claude Code-powered |

### Recommendation for akses

Pakai DUA-DUANYA:
- Real-time trigger = PRIMARY (handle real-time updates)
- Renovate = BACKUP (catch missed events, weekly scan)

Plus Discord notif at both stages untuk human awareness.

### Rambu "Gabung-Otomatis-Aman" (RECOMMENDED untuk tim 20-30 orang) — v1.6.2

Jangan auto-merge SEMUA (berisiko: perubahan besar langsung kena frontend). Pakai rambu
**gabung-otomatis-aman** yang pintar:
- Update **KECIL** (cuma perbaikan, nomor belakang naik 1.2.3→1.2.4) → digabung otomatis setelah cek hijau. Nol klik.
- Update **BESAR** (nomor depan/tengah naik) → DITAHAN + label `perlu-ditinjau-manusia` + komentar. Lead WAJIB cek manual.

**File template**: `.claude-kit/templates/github/AUTO_MERGE_SHARED_WORKFLOW.yml`
→ copy ke `<frontend-repo>/.github/workflows/auto-merge-shared.yml`, sesuaikan nama paket.

**PRASYARAT** — "gabung-otomatis" GitHub hanya aktif kalau repo sudah dinyalakan
**kunci pengaman gabung** (branch protection) + minimal 1 cek otomatis wajib. Jalankan sekali per repo:

```powershell
# SIMULASI dulu (cuma lihat, tidak mengubah):
.\.github\scripts\setup-branch-protection.ps1 -Repo "owner/project-frontend"
# Benar-benar nyalakan:
.\.github\scripts\setup-branch-protection.ps1 -Repo "owner/project-frontend" -RequiredCheck "ci" -Apply
```

**File template**: `.claude-kit/templates/github/scripts/setup-branch-protection.ps1`.

> Catatan: penomoran versi pintar (besar vs kecil) dijamin oleh `PUBLISH_SHARED_WORKFLOW.yml` v1.6.1
> yang membaca pesan commit (BREAKING/feat!: = besar). Jadi label "besar" akurat, bukan tebakan.

> **WAJIB sebelum gelar ke tim 20-30 orang**: baca `ROBOT_CI_TESTING_PLAYBOOK.md` —
> 5 cek uji robot di repo kecil dulu + 3 skenario cara pulih kalau robot salah +
> cara baca tab "Actions" untuk non-programmer. Jangan dipakai produksi sebelum 5 cek LULUS.

---

## Setup di <project>-frontend Repo

### Renovate Auto-PR (Backup, untuk catch missed real-time events)

### Step 1: Renovate config

Create <project>-frontend/renovate.json:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "schedule": ["after 9am every weekday"],
  "packageRules": [
    {
      "matchPackageNames": ["@<project>/shared"],
      "schedule": ["at any time"],
      "automerge": false,
      "groupName": "shared package",
      "reviewers": ["<owner-username>"],
      "labels": ["auto-update", "shared-types"]
    }
  ],
  "vulnerabilityAlerts": {
    "enabled": true
  }
}
```

Enable Renovate bot di GitHub: https://github.com/marketplace/renovate

Konfigurasi penting:
- `schedule: ["at any time"]` untuk @<project>/shared - bypass default schedule supaya update urgent type bisa langsung dibuatkan PR
- `automerge: false` - owner tetap review sebelum merge (safety)
- `reviewers` - auto-assign ke owner supaya notif langsung muncul

### Step 2: AI Auto-Check di session start

Edit <project>-frontend/.claude-kit/AGENTS.md tambah section:

```markdown
## Session Start Auto-Check (untuk AI Claude Code)

Saat session pertama tiap hari, AI WAJIB:

1. Cek @<project>/shared version:
   - Read package.json: catat version yang dipakai
   - Run: npm view @<project>/shared version --registry=https://npm.pkg.github.com (atau alternatif: curl GitHub Packages API)
   - Compare: kalau outdated, output warning:
     "@<project>/shared outdated (current: <local>, latest: <remote>)
      Lanjut npm install untuk update? Atau lanjut dengan version lama?"

2. Cek Swagger API spec:
   - Fetch: curl -s https://api-staging.<project>.id/docs/openapi.json > /tmp/api-spec.json
   - Cache spec untuk reference saat AI suggest API call
   - Kalau Swagger 404, log warning "Backend offline atau spec belum ready"

3. Cek Discord channel #<project>-deps untuk recent updates (manual check, owner periodically share).

Tujuan: Frontend AI selalu aware latest API contract + types.
```

---

## Setup Discord Webhook

1. Discord server > Settings > Integrations > Webhooks > New Webhook
2. Name: "<project>-shared-publisher"
3. Channel: #<project>-deps (bikin channel baru kalau belum ada)
4. Copy URL
5. Save sebagai GitHub Secret di <project>-backend:
   - Settings > Secrets > New: DISCORD_WEBHOOK_DEPS
   - Value: paste URL

Tips kanal Discord:
- Bikin role @deps-watcher dan mention di template message → tim FE dapat notifikasi langsung
- Aktifkan thread auto-create per release → diskusi breaking change tidak nyampur dengan notif lain
- Pin pesan pinned dengan link ke dokumen ini supaya tim baru tahu workflow

---

## Workflow End-to-End

```
Day 1, jam 10:00 - Backend staff
  Prompt: "tambah field estimated_arrival di Order"
    ↓
  AI:
    - Update prisma/schema.prisma
    - Run prisma migrate dev (local staging)
    - Update src/shared/schemas/tracking.ts (tambah type)
    - Run npm run generate:types
    - Commit + push
    ↓
Day 1, jam 10:05 - GitHub Actions
  - Detect push to main with schema change
  - Run publish-shared.yml workflow
  - Generate types
  - Bump @<project>/shared dari v1.1.0 → v1.1.1
  - Publish ke GitHub Packages
  - POST Discord webhook
    ↓
Day 1, jam 10:06 - Discord channel #<project>-deps
  Bot post: "@<project>/shared v1.1.1 published"
    ↓
Day 1, jam 11:00 - Renovate scan (atau next morning)
  - Detect @<project>/shared v1.1.0 → v1.1.1 available
  - Auto-create PR di <project>-frontend
  - Title: "chore(deps): bump @<project>/shared from 1.1.0 to 1.1.1"
    ↓
Day 2, jam 09:00 - Owner morning routine
  - Review PR di GitHub
  - Approve + merge
  - Frontend tim dapat update di next pull
    ↓
Day 2, jam 09:30 - Frontend staff
  Prompt: "bikin halaman tracking"
    ↓
  AI session start auto-check:
    - @<project>/shared v1.1.1 sudah pakai
    - Swagger spec fetched, endpoint tracking ada
    - AI proceed dengan up-to-date context
```

---

## Versioning & Breaking Changes

Pakai semver disiplin:
- PATCH (1.1.0 → 1.1.1) - tambah field optional, tambah type baru, fix typo
- MINOR (1.1.0 → 1.2.0) - tambah endpoint baru, tambah enum value
- MAJOR (1.x → 2.0.0) - hapus field, rename field, ubah signature

Untuk MAJOR:
1. Backend buat branch `breaking/v2` dulu
2. Publish dengan dist-tag `next` (bukan `latest`)
3. Frontend bisa coba `npm install @<project>/shared@next`
4. Setelah migration di frontend done, baru promote ke `latest`

---

## FAQ

**Q: Kalau backend gak mau auto-publish (mau review dulu)?**
A: Hapus trigger 'on: push: branches: [main]'. Ganti dengan 'on: workflow_dispatch' (manual trigger).

**Q: Kalau frontend gak mau auto-PR (mau pilih sendiri kapan update)?**
A: Disable Renovate, pakai manual npm install routine. Workflow routine (manual npm install) + AI auto-check saat session start tetap aktif.

**Q: Cost?**
A: $0. GitHub Actions free tier, GitHub Packages free (private up to 500MB), Renovate free.

**Q: Berapa lama setup?**
A: 2-3 jam owner one-time. Setelah itu zero ongoing maintenance.

**Q: Bagaimana kalau ada conflict antar staff yang ubah shared types bersamaan?**
A: Karena hanya backend yang punya akses tulis ke `src/shared/`, conflict cuma terjadi di repo backend. Resolusi pakai PR review standar GitHub.

**Q: Kalau Renovate tidak detect update dalam 24 jam?**
A: Buka manual: GitHub > <project>-frontend > Insights > Dependency graph > Renovate logs. Atau trigger manual via Dependency Dashboard issue.

**Q: Bagaimana audit history apa saja yang berubah di types?**
A: Lihat commit history di <project>-backend `src/shared/` + GitHub Packages versions page. Setiap version punya tag commit yang menghasilkan publish.

**Q: Apakah perlu pakai semantic-release?**
A: Tidak wajib. `npm version patch` di workflow sudah cukup untuk auto-bump. Pakai semantic-release kalau mau analyze commit message untuk decide patch/minor/major otomatis.

**Q: Kalau frontend tim banyak (>3), apakah workflow ini cukup?**
A: Cukup. Setiap dev tarik pakai `git pull` + `npm install` setelah PR Renovate merged. Tidak perlu koordinasi manual.
