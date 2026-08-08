> ⚠️ OPT-IN: File ini hanya dipakai kalau team >20 staff, compliance audit, ATAU kalau pakai 4-repo split (Backend Staff men-jalankan admin scripts dari repo terpisah). Untuk team kecil-sedang dengan 3-repo split default, admin scripts cukup di `<project>-backend/scripts/` (Backend Staff + owner access).
>
> Audience: owner + Backend Staff (2 orang) saat 4-repo split aktif. Frontend Staff TIDAK punya akses.

# TEMPLATE: `<project>-tools/AGENTS.md`

> Template ini di-deploy oleh AI saat split repo migration.
> Customization: replace `<project>` dengan nama project user.

```markdown
# AGENTS.md - <project>-tools

> Repo ini: Admin scripts, sync tools, migration helpers.
> Audience AI: Owner ONLY.
> Staff TIDAK punya akses (repo private, owner-only access).

## Scope Kamu (AI)

Kamu di repo `<project>-tools`. Kamu BOLEH:
- Bikin script CLI untuk admin tasks
- Bikin sync script (prod -> staging dengan PII redact)
- Bikin migration helpers (wrapper di atas `prisma migrate`)
- Bikin one-time scripts (backfill data, cleanup, dst.)
- Akses credential owner via `scripts/.env.owner`
- Akses Supabase MCP untuk owner-level ops

Kamu TIDAK BOLEH:
- Commit credential ke git (cek `.gitignore` sebelum stage)
- Jalankan script destructive ke prod tanpa konfirmasi owner eksplisit
- Print password / secret ke stdout / log file
- Share script ini ke repo lain (scope owner-only)

## Stack
- Node.js (ESM, `"type": "module"` di `package.json`)
- `pg` untuk direct DB access (saat butuh raw SQL di luar Prisma)
- `@faker-js/faker` untuk generate demo data
- `dotenv-cli` untuk env management
- `commander` atau `yargs` untuk CLI argument parsing

## Scripts Library

```
scripts/
  sync-prod-to-staging.mjs    <- PII redacted sample sync
  backup-prod.mjs             <- Snapshot via pg_dump
  migrate-deploy-prod.mjs     <- Wrapped `prisma migrate deploy`
  audit-staff-access.mjs      <- Check Supabase user activity log
  rotate-secrets.mjs          <- Helper rotate API key + push ke Vercel
  cleanup-orphan-records.mjs  <- One-time cleanup utility
```

## Security

- Owner credential CUMA di laptop owner (jangan upload ke server shared)
- `scripts/.env.owner` WAJIB gitignored, JANGAN commit
- Output log: mask password di `DATABASE_URL` (regex replace sebelum print)
- Audit log: tiap script run, append ke `logs/owner-actions.log`
  - Format: `<ISO timestamp> | <script name> | <args summary> | <exit code>`
- Saat clone repo di laptop baru, fetch `.env.owner` dari password manager (1Password / Bitwarden)

## Workflow

Saat owner prompt untuk bikin script baru:

1. Identifikasi: ini one-time atau reusable?
2. Kalau one-time: simpan di `scripts/oneoffs/<date>-<desc>.mjs`
3. Kalau reusable: simpan di `scripts/` dengan `--help` flag + `README.md` entry
4. WAJIB confirm step sebelum eksekusi destructive op:
   ```js
   await confirm('Are you sure? This will delete X rows. [y/N]')
   ```
5. WAJIB dry-run mode (`--dry-run` flag) untuk script yang ubah data

## Project-Specific Rules

<!-- Owner: tambahkan rules spesifik project di sini -->
```
