# templates/MIGRATE_TO_SUBFOLDER_PROMPT_v1.md - Migrasi docs/ Flat → Subfolder

> Versi 1 · 2026-06-01
> Paste prompt ini saat docs/ sudah flat banyak (>= 20 file) dan mau restrukturisasi ke subfolder grouping.

---

## Kapan pakai prompt ini?

- ✅ `docs/` flat >= 20 file pendamping kode, navigasi mulai berat.
- ✅ Project punya struktur source yang clear domain (`src/lib/payment/`, `src/lib/auth/`, `src/app/api/<resource>/`) tapi docs masih flat.
- ✅ Mau pisahkan docs technical (`auth.md`, `prisma.md`) dari docs panduan tim (`CLAUDE_TEAM_GUIDE.md`, `PROMPT_LIBRARY.md`).

**JANGAN paste prompt ini kalau**:
- ❌ docs/ masih < 10 file (flat masih oke).
- ❌ Project tidak punya struktur source domain (semua file flat di src/).
- ❌ Belum siap commit migrasi (rename file = riwayat git penting).

---

## Untuk AI (mulai dari sini)

### Peran
Kamu adalah **Documentation Refactor Specialist**. Tujuan: migrasi `docs/` dari flat → subfolder grouping tanpa break cross-reference + git history preserved.

### Aturan kerja
- **Bahasa Indonesia**, junior-friendly.
- **Akurasi > speed**. Lebih baik 1 batch kecil + verify daripada bulk yang break links.
- **Pakai `git mv`** (bukan delete + create) supaya git history preserved.
- **Update SEMUA cross-reference** setelah move.
- **JANGAN touch file tim panduan** (`CLAUDE_TEAM_GUIDE.md`, `PROMPT_LIBRARY.md`, `ONBOARDING.md`, `STACK_GUIDE.md`, `MCP_SETUP.md`, `_PATTERNS.md`, `_EXAMPLE.md`, `architecture.md`, `glossary.md`, `architecture_auto.md`) - file ini stay di root docs/.

### Workflow 5 fase

#### FASE 1 - Audit current state

1. List semua `.md` di `docs/` root (skip subfolder existing kalau ada).
2. Untuk tiap `.md`, identifikasi source code yang related (mis. `docs/auth.md` ↔ `src/lib/auth.ts` ↔ `src/app/api/auth/...`).
3. Buat tabel ASCII:

```
| docs/ file               | Related source         | Suggested subfolder |
|--------------------------|------------------------|---------------------|
| auth.md                  | src/lib/auth.ts        | security/           |
| prisma.md                | src/lib/prisma.ts      | lib/                |
| encryption.md            | src/lib/encryption.ts  | security/           |
| permissions.md           | src/lib/permissions.ts | security/           |
| rate-limit.md            | src/lib/rate-limit.ts  | security/           |
| middleware.md            | src/middleware.ts      | (keep at root)      |
| api-auth-nextauth.md     | src/app/api/auth/...   | api/auth/           |
| api-security.md          | src/app/api/security/.. | api/security/      |
| api-vault.md             | src/app/api/vault/...  | api/vault/          |
| ...                      | ...                    | ...                 |
```

#### FASE 2 - Tampilkan ke user + konfirmasi

```
[Migrasi docs/ flat → subfolder]

Total docs/ flat: <N> file
Suggested grouping:
  - docs/security/ - <X> file (auth, encryption, permissions, rate-limit)
  - docs/lib/ - <Y> file (prisma, geo, cache, ...)
  - docs/api/ - <Z> file (api routes, group by resource)
  - docs/features/ - <W> file (per feature folder source)
  - root docs/ - <K> file tim panduan (preserve)

Total move operations: <M>
Cross-reference updates needed: <C> lines across <F> files

Lanjut migrasi? (y/n)
  y / Enter → mulai (per kategori, dengan verify per batch)
  n → batalkan
```

Auto-confirm: kalau user kosong / Enter → "y" (default auto-confirm).

#### FASE 3 - Migrasi per kategori (batch)

Ulangi per kategori (security, lib, api, features):

1. **Buat subfolder** kalau belum ada:
   ```bash
   mkdir -p docs/security
   mkdir -p docs/api/auth docs/api/vault # dst per resource
   ```

2. **Move file** dengan `git mv`:
   ```bash
   git mv docs/auth.md docs/security/auth.md
   git mv docs/encryption.md docs/security/encryption.md
   # dst
   ```

3. **Update cross-reference**:
   - Baca tiap `.md` di docs/ tree (termasuk yang baru di-move).
   - Cari pattern `[text](relative-path.md)` atau `[[basename]]` link.
   - Update path relatif sesuai lokasi baru:
     - Dari root → subfolder: `[auth.md](auth.md)` → `[auth.md](security/auth.md)`.
     - Antar subfolder: `[auth.md](security/auth.md)` → `[auth.md](../security/auth.md)`.
     - Dari subfolder → root: `[architecture.md](architecture.md)` → `[architecture.md](../architecture.md)`.

4. **Verify batch**: list file di subfolder + cek cross-ref tidak broken.

5. **Lanjut batch berikutnya** atau pause kalau user request.

#### FASE 4 - Update architecture_auto.md

Setelah semua migrasi selesai:

1. Re-generate `docs/architecture_auto.md` dengan struktur baru:

```markdown
# docs/architecture_auto.md - Registry semua file .md pendamping (TOC)

> Auto-maintained oleh AI

## Top-level (file tim panduan, preserve)
- [architecture.md](architecture.md) - peta makro proyek
- [glossary.md](glossary.md) - kamus istilah
- [_PATTERNS.md](_PATTERNS.md) - aturan dokumentasi tim
- [_EXAMPLE.md](_EXAMPLE.md) - contoh format
- [CLAUDE_TEAM_GUIDE.md](CLAUDE_TEAM_GUIDE.md) - panduan tim
- [PROMPT_LIBRARY.md](PROMPT_LIBRARY.md) - 22 prompt siap-pakai
- [ONBOARDING.md](ONBOARDING.md) - playbook dev baru
- [STACK_GUIDE.md](STACK_GUIDE.md) - stack guide
- [MCP_SETUP.md](MCP_SETUP.md) - MCP setup
- [RLS_SETUP_PROMPT.md](RLS_SETUP_PROMPT.md) - RLS prompt
- [DB_SCHEMA_SCAN_PROMPT.md](DB_SCHEMA_SCAN_PROMPT.md) - schema scan prompt
- [db-schema.md](db-schema.md) - DB schema (kalau ada)

## Security (docs/security/)
- [security/auth.md](security/auth.md) - NextAuth credentials + session
- [security/encryption.md](security/encryption.md) - AES-256-GCM vault
- [security/permissions.md](security/permissions.md) - RBAC matrix
- [security/rate-limit.md](security/rate-limit.md) - sliding-window limiter

## Library (docs/lib/)
- [lib/prisma.md](lib/prisma.md) - Prisma client singleton
- ...

## API routes (docs/api/)
### Auth
- [api/auth/nextauth.md](api/auth/nextauth.md) - NextAuth handler mount
- [api/auth/captcha.md](api/auth/captcha.md) - captcha endpoint
...

### Vault
- [api/vault/index.md](api/vault/index.md) - GET/POST vault
- [api/vault/reveal.md](api/vault/reveal.md) - decrypt password
...

## Features (docs/features/)
[Per feature folder kalau ada]

## ADR (docs/decisions/)
[Auto-link ADR files]

## Riwayat migrasi
| Tanggal | Aksi | Catatan |
|---|---|---|
| 2026-06-01 | Migrate flat -> subfolder | Total <N> file di-restructure |
```

#### FASE 5 - Commit + verify

1. **Commit** dengan message jelas:
   ```bash
   git add -A
   git commit -m "refactor(docs): migrate flat to subfolder grouping (security/, lib/, api/, features/)"
   ```

2. **Verify**:
   - Klik random 5 cross-ref di markdown editor - semua link work.
   - Cek `docs/architecture_auto.md` - entry up-to-date.
   - Test render markdown di GitHub / IDE preview.

3. **Lapor ke user**:
   ```
   ✅ Migrasi selesai
   - Total file di-move: <N>
   - Subfolder dibuat: <K> (security/, lib/, api/, features/)
   - Cross-reference di-update: <C> baris di <F> file
   - Commit: <hash>
   
   Verifikasi: docs/architecture_auto.md sudah refresh dengan struktur baru.
   ```

---

## Aturan SETELAH migrasi

- **LAZY-GENERATE 7.2b** aktif: docs baru otomatis ke subfolder yang relevan (kalau folder source punya >= 3 file CRITICAL).
- **AUTO-SYNC 7.1**: tiap edit code yang ada `.md` pendamping di subfolder, AI WAJIB update `.md` di lokasi yang benar (bukan root).
- **READ-MINIMAL 7.3**: AI baca `architecture_auto.md` dulu → tahu struktur subfolder → cherry-pick relevant.

---

## Troubleshooting

### Broken link setelah migrasi
- Cek output `git diff` cross-reference - ada path yang ke-skip update?
- Run grep: `grep -r "\[.*\](.*\.md)" docs/` → cari path yang tidak match file actual.

### Conflict antar-domain
- File `payment.md` related ke `src/lib/payment/` (lib) ATAU `src/app/api/payment/` (api)?
- Solusi: pisah jadi 2 file (`docs/lib/payment.md` + `docs/api/payment.md`) dengan cross-link.
- Atau pakai folder paling spesifik (`docs/payment/` containing both `lib.md` + `api.md`).

### Git history rusak setelah `git mv`
- Pastikan pakai `git mv`, BUKAN delete + create.
- Cek dengan `git log --follow docs/security/auth.md` - history harus tetap visible.

---

## Referensi
- Aturan 7.2b Folder auto-detect grouping: `./.claude-kit/CLAUDE_universal_v1.md` seksi 7.2b
- Aturan 7.4 ARCHITECTURE REGISTRY format: seksi 7.4
- Bootstrap workflow: `./.claude-kit/PROJECT_LIFECYCLE_PROMPT_v1.md` (Stage 2 (Bikin Catatan Proyek): Bootstrap Docs)
