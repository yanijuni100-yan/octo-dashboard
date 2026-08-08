# docs/architecture.md - Peta Proyek `<NAMA_PROYEK>`
> Versi 1 · `[TBD: tanggal hari ini, format YYYY-MM-DD]`

## Pengantar
File ini adalah **peta proyek 1-halaman**. Dibaca sekali di awal sesi (oleh AI atau dev baru) untuk paham struktur tanpa harus jelajah repo. Update **tiap kali** ada perubahan signifikan: tambah modul, ganti stack, ubah ENV, atau ubah konvensi. Bukan dokumentasi mendalam - detail teknis tetap di file `.md` masing-masing fitur di folder `docs/`.

Semua dokumentasi proyek ditulis dalam **Bahasa Indonesia** (konsisten dengan `CLAUDE.md` global). File ini = peta makro proyek; kamus istilah ada di `docs/glossary.md`; registry semua `.md` pendamping (auto-maintained AI) ada di `docs/architecture_auto.md`.

---

## Tujuan Proyek
[TBD: 2-3 kalimat. Apa yang dibangun? Untuk siapa? Masalah apa yang diselesaikan?]

Contoh terisi: *"Aplikasi internal manajemen invoice untuk tim finance UKM. Menggantikan workflow Excel + email yang error-prone. Target user: 5-20 staff finance per tenant."*

---

## Stack
- **Bahasa utama**: [TBD: mis. TypeScript 5.4 / Python 3.12 / Go 1.22 / Dart 3.5]
- **Framework**: [TBD: lihat templates/STACK_VERSIONS.md untuk versi recommended]
- **Runtime / Build**: [TBD: mis. Node 20 LTS / Bun 1.1 / uv / go build]
- **UI / Styling**: [TBD: mis. Tailwind 4 + shadcn/ui / Jinja2 / Material 3]
- **DB / ORM**: [TBD: mis. PostgreSQL 16 + Prisma 5 / SQLAlchemy 2 / sqlc]

---

## Struktur Folder
<!-- Tree di bawah contoh proyek Node. Untuk Python/Go/Dart, ganti sesuai konvensi bahasa (mis. `cmd/`, `internal/`, `lib/`). -->
```text
<root>/
├── src/             // source code utama
├── public/          // aset statis (gambar, favicon)
├── docs/            // dokumentasi per-modul + architecture.md ini
├── prisma/          // skema DB & migrasi   [hapus kalau tidak pakai Prisma]
├── tests/           // unit & integration test
├── scripts/         // skrip operasional (seed, backup, dll)
├── .env.example     // template ENV (jangan commit .env asli!)
└── package.json     // (atau pyproject.toml / go.mod / pubspec.yaml)
```

---

## Entry Points
- **App utama**: [TBD: mis. `src/app/layout.tsx` (Next.js App Router) / `main.py` / `cmd/server/main.go` / `lib/main.dart`]
- **Halaman pertama**: [TBD: mis. `src/app/page.tsx` / route `"/"`]
- **Background worker / cron**: [TBD: mis. `src/workers/index.ts`. Kosongkan kalau tidak ada]

---

## Modul Inti
<!-- Isi 5-10 modul paling sering disentuh. Hapus baris contoh sebelum commit. -->
| Modul | Lokasi | Tujuan | Dependensi Utama |
|---|---|---|---|
| `<nama-modul-1>` | `<path>` | [TBD: tujuan singkat 1 baris] | [TBD: lib utama] |
| `<nama-modul-2>` | `<path>` | [TBD] | [TBD] |

---

## Dependensi Utama
<!-- Hanya library signifikan (5-10), bukan dump package.json. Sertakan alasan dipakai. -->
- **`<lib-1>`** - [TBD: 1 baris alasan. Contoh: *"Prisma - ORM type-safe, auto-generate types dari schema"*]
- **`<lib-2>`** - [TBD]

---

## Environment Variables
<!-- JANGAN tulis nilai asli. Selalu pakai contoh format / placeholder. -->
**Loader**: `.env.local` (dev) → `<platform>` dashboard (prod, mis. Vercel/Railway/Fly). Template: `.env.example` di root.

| Nama | Wajib? | Tujuan | Contoh Format |
|---|---|---|---|
| `DATABASE_URL` | ya | Koneksi DB utama | `postgresql://user:pass@host:5432/db` |
| `<NAMA_ENV_2>` | [ya/tidak] | [TBD] | [TBD] |

---

## Skrip & Perintah
<!-- Contoh di bawah Node. Ganti sesuai stack. -->
- `npm run dev` - server dev (hot reload) di port 3000  *(Python: `uv run dev` · Go: `go run ./cmd/server`)*
- `npm run build` - build production
- `npm run test` - jalankan unit test
- `npx prisma migrate dev` - bikin & apply migrasi DB lokal
- [TBD: skrip spesifik proyek - seed, lint, deploy, dll]

---

## Sumber Data Eksternal
- **Database utama**: [TBD: mis. *"Supabase Postgres (shared dev + prod, lihat `docs/db.md`)"*]
- **API eksternal**: [TBD: mis. *"Stripe (payment), Resend (email). Config client di `src/lib/clients/`"*]
- **Cache / Queue**: [TBD: mis. Redis Upstash, atau *"tidak pakai"*]
- **Storage file**: [TBD: mis. Supabase Storage bucket `<nama-bucket>`]

---

## Deploy & CI
- **Hosting**: [TBD: mis. Vercel (frontend) + Supabase (DB) / Railway / VPS DigitalOcean]
- **Branch auto-deploy**: [TBD: mis. `main` → production, `staging` → preview]
- **CI / Quality gate**: [TBD: mis. GitHub Actions - lint + test wajib hijau sebelum merge]
- **Rollback**: [TBD: mis. Vercel dashboard → Deployments → Promote previous]

---

## Deployment & Release Strategy

### Alur Deploy

```
branch (feat/*, fix/*)
  → PR di GitHub
  → Vercel Preview Deploy (auto, ~1-3 menit)
  → Review (owner + AI Reviewer bot)
  → Squash Merge ke main
  → Vercel Production Deploy (auto, ~2-5 menit)
```

`main` = production. Tidak ada manual "promote to production" - merge ke main = langsung deploy.

### Risk Level Strategy (Default - Staging-Only)

Default workflow tim TIDAK pakai feature flag. Tiap task diklasifikasi by Risk Level:

- **🟢 Low**: UI minor, copy edit, refactor internal - review cepat, merge, deploy.
- **🟡 Medium**: Fitur baru self-contained - test extensive di Vercel preview sebelum merge.
- **🔴 High**: Sentuh auth/billing/schema-user-visible/destruktif/eksperimental - owner HOLD MERGE sampai yakin, smoke test prod 5+ menit setelah deploy.

Decision tree lengkap: `./.claude-kit/templates/CLAUDE_TEAM_GUIDE.md` section 7b.

Feature flag = ADVANCED option (post-launch only): `./.claude-kit/templates/feature-flags-advanced.md`.

### Rollback Strategy

Target time-to-rollback **<5 menit** via git revert:
```
git revert HEAD && git push
```
Vercel auto-deploy versi sebelumnya 2-5 menit.

Playbook lengkap: `./.claude-kit/templates/CLAUDE_TEAM_GUIDE.md` section 13b.

### Database Backup

- Supabase Daily Auto-Backup: aktif, retention 7 hari (Dashboard → Database → Backups).
- Manual snapshot WAJIB sebelum approve PR yang sentuh migrasi Prisma.

---

## Testing & Quality Gates
- **Framework test**: [TBD: mis. Vitest / Jest / pytest / go test]
- **Coverage minimum**: [TBD: mis. 60% pada folder `src/lib/`, atau *"belum di-enforce"*]
- **Lint / format**: [TBD: mis. ESLint + Prettier, wajib lewat pre-commit hook]
- **Pre-push check**: [TBD: mis. `npm run check` (lint + typecheck + test)]

---

## Konvensi Penting
<!-- 3-7 aturan yang KALAU dilanggar = bug atau inkonsistensi. Hapus contoh, isi sesuai proyek. -->
- [TBD: contoh konvensi route - mis. *"semua handler API harus pakai middleware auth wrapper di `src/lib/<helper>.ts`"*]
- [TBD: penamaan file - lihat `docs/glossary.md` section "Aturan Penamaan"]
- [TBD: pola error handling - mis. *"selalu return `{ ok: false, error }` dari API, jangan throw"*]
- [TBD: format commit - mis. Conventional Commits (`feat:`, `fix:`, `refactor:`)]

---

## Dokumen Terkait
File lain di folder `docs/` yang melengkapi INDEX ini:

| File | Fungsi |
|---|---|
| `glossary.md` | Kamus istilah domain, role, status, & aturan penamaan |
| `<fitur-1>.md` | [TBD: mis. `auth.md` - detail flow login, session, RBAC] |
| `<fitur-2>.md` | [TBD: mis. `db.md` - skema DB, konvensi migrasi, ERD] |

> Aturan dokumentasi: tiap fitur/modul baru wajib punya `.md` pendamping (lihat `CLAUDE.md` global section 4).

---

## Riwayat Perubahan
| Versi | Tanggal | Author | Ringkasan |
|---|---|---|---|
| 1 | `[TBD: YYYY-MM-DD]` | `<nama/handle>` | Inisialisasi architecture.md |
