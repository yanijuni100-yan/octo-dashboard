# Feature Flag Pattern (ADVANCED - Post-Launch Only)

> ⚠️ **JANGAN PAKAI FILE INI DI EARLY-STAGE PROJECT (progress <50% / belum launch ke user nyata).**
>
> Default workflow tim = **staging-only** (Vercel Preview per PR). Lihat `CLAUDE_TEAM_GUIDE.md` section 7b (Risk Level Decision Tree).
>
> File ini cuma dipakai **post-launch** kalau project sudah punya user aktif dan butuh:
> - Kill switch instant untuk fitur kritis (mis. payment toggle saat Black Friday)
> - A/B test gradual rollout (10% → 50% → 100%)
> - Per-user targeting (beta tester subset)

---

## Filosofi: Kapan UPGRADE dari Staging-Only ke Feature Flag?

Project pertama kali = simpler is better. Tambah complexity HANYA kalau ada **pain point konkret**, bukan karena "best practice di tutorial".

### Sinyal kamu butuh feature flag (post-launch):

| Sinyal | Contoh |
|---|---|
| Rollback `git revert` sudah TIDAK cukup cepat | Bug payment terdeteksi jam 11 malam, butuh kill switch <30 detik (bukan 5 menit redeploy) |
| Butuh test fitur ke subset user dulu | Beta launch ke 100 user terpilih sebelum public |
| Butuh A/B test resmi | "Versi A vs Versi B landing page, monitor conversion 2 minggu" |
| Butuh deploy kode tapi launch terpisah | Code deploy sekarang, launch announcement minggu depan |

Kalau **tidak ada** sinyal di atas → **STAY di staging-only**. Feature flag tanpa pain point = premature optimization.

---

## Implementasi: Env Var Vercel

Simple feature flag pakai env var Vercel (no library tambahan):

```ts
// lib/flags.ts
export const flags = {
  newDashboard: process.env.NEXT_PUBLIC_FF_NEW_DASHBOARD === 'true',
  betaPayment: process.env.FF_BETA_PAYMENT === 'true', // server-only
}

// Pakai di Server Component
import { flags } from '@/lib/flags'

export default function Page() {
  if (flags.newDashboard) return <NewDashboard />
  return <OldDashboard />
}
```

### Naming Convention

Semua flag wajib pakai prefix `NEXT_PUBLIC_FF_<AREA>_<NAMA>`:
- `FF` = Feature Flag
- `<AREA>` = domain (mis. `BILLING`, `INBOX`, `AUTH`)
- `<NAMA>` = nama fitur snake-uppercase

Contoh: `NEXT_PUBLIC_FF_BILLING_NEW_PRICING`, `NEXT_PUBLIC_FF_INBOX_V2_FILTER`.

**Wajib di-comment di kode** dengan tanggal lahir + target hapus:

```tsx
// FLAG: NEXT_PUBLIC_FF_INBOX_V2_FILTER
// Created: 2026-06-15
// Target removal: 2026-07-15 (setelah 100% rollout 2 minggu stabil)
const showNewFilter = process.env.NEXT_PUBLIC_FF_INBOX_V2_FILTER === 'true';
```

---

## Gradual Rollout

1. Set `NEXT_PUBLIC_FF_NEW_DASHBOARD=false` di Production → fitur tersembunyi.
2. Set `NEXT_PUBLIC_FF_NEW_DASHBOARD=true` di Preview → tim QA test.
3. Saat siap launch → ubah Production env var ke `true` → redeploy 2-5 menit.
4. Setelah 1-2 minggu stabil → hapus flag, code path lama dihapus (lihat **Cleanup Ritual**).

> Prefix `NEXT_PUBLIC_` = ter-expose ke browser. Untuk flag rahasia (mis. feature internal), pakai env var tanpa prefix → cek di Server Component/Action only.

---

## Per-User Flag (Canary Rollout)

Kalau butuh rollout ke 10% user random (bukan all-or-nothing), pakai hash deterministik dari userId. Jangan pakai `Math.random()` (user bakal kelap-kelip).

```ts
import { cookies } from 'next/headers'
import { createHash } from 'crypto'

export function isNewDashboardEnabled() {
  const userId = cookies().get('userId')?.value ?? ''
  if (!userId) return false

  // sha256 = distribusi merata + stabil per userId
  const hash = createHash('sha256').update(userId).digest('hex')
  const bucket = parseInt(hash.slice(0, 4), 16) % 100
  return bucket < 10 // 10% user
}
```

> **Kenapa sha256?** Charcode sum (`'abc'` → 97+98+99 = 294) gampang collision. Sha256 merata & tahan collision.

---

## Cleanup Ritual (Cegah Flag Debt)

Flag yang sudah "selesai" tapi dibiarkan = **flag debt** (kode penuh `if (flag) {}` zombie).

Aturan:
1. **1-2 minggu setelah flag = `true` stabil di prod tanpa bug**:
   - Bikin PR baru: hapus pemanggilan env var dari kode (else branch lama dihapus).
   - Hapus env var dari Vercel dashboard (Settings → Environment Variables → Delete) di semua environment.
2. **Quarterly ritual**: review flag yang `Target removal`-nya lewat. Grep `NEXT_PUBLIC_FF_` di kode + cocokkan dengan Vercel dashboard.

> Rule of thumb: **kalau flag sudah lebih lama dari fitur yang dilindunginya, itu flag debt.**

---

## Testing Flag

Tiap flag wajib minimal 2 unit test (case ON + case OFF):

```ts
import { vi, describe, it, expect, afterEach } from 'vitest'
import { isNewDashboardEnabled } from '@/lib/flags'

describe('flag NEXT_PUBLIC_FF_NEW_DASHBOARD', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('flag ON → render path baru', () => {
    vi.stubEnv('NEXT_PUBLIC_FF_NEW_DASHBOARD', 'true')
    expect(isNewDashboardEnabled()).toBe(true)
  })

  it('flag OFF → render path lama', () => {
    vi.stubEnv('NEXT_PUBLIC_FF_NEW_DASHBOARD', 'false')
    expect(isNewDashboardEnabled()).toBe(false)
  })

  it('flag undefined → default OFF (fail-safe)', () => {
    vi.stubEnv('NEXT_PUBLIC_FF_NEW_DASHBOARD', '')
    expect(isNewDashboardEnabled()).toBe(false)
  })
})
```

---

## Trade-off Penting (Sebelum Pakai Flag)

| Aspek | Implikasi |
|---|---|
| **NEXT_PUBLIC_ vs server-only** | Keduanya butuh redeploy Vercel saat flip (~2-5 menit). Tidak instant. |
| **Staff access** | Staff tanpa akses Vercel TIDAK bisa toggle flag. Flag = owner-only operation. |
| **Code complexity** | Kode jadi bercabang (`if/else`). Susah review, susah test full coverage. |
| **Maintenance** | Wajib cleanup flag yang sudah stabil (else jadi flag debt). |

Kalau butuh **instant toggle (sub-detik) tanpa redeploy** → migrasi ke **DB-backed flag** (Prisma `FeatureFlag` table + Server Action dengan cache TTL pendek). Tapi itu kompleksitas extra lagi - pertimbangkan dengan matang.

---

## Aktivasi Workflow Feature Flag (Saat Siap Post-Launch)

Saat project sudah launch dan kamu mau pakai feature flag default:

1. Update `CLAUDE_TEAM_GUIDE.md` section 7b: tambah sub-section "Decision Tree Branch + Flag" (lihat git history kit, sebelum stripped).
2. Update `PROMPT_LIBRARY.md` Prompt 11: tambah field `[Flag?]` di template task.
3. Update `AGENTS.md` proyek: tambah link ke file ini di section "Workflow & Komunikasi Task".
4. Setup channel Slack/Discord untuk announce tiap flag flip (transparency).

Atau: PR ke kit `lintasAI` untuk re-enable flag workflow di default kit (kalau team udah scale 20+).
