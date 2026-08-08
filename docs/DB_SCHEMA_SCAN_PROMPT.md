# templates/DB_SCHEMA_SCAN_PROMPT.md - Scan Database Schema → docs/db-schema.md

> Versi 1 · 2026-06-01
> Standalone prompt untuk generate `docs/db-schema.md` dari source code project.

---

## Kapan pakai prompt ini?

Paste prompt ini ke Claude Code **kalau**:
- ✅ Pertama kali setup project + ingin AI paham database struktur project sebelum bantu coding.
- ✅ Schema baru saja berubah (model ditambah/dihapus, relasi diubah) dan `docs/db-schema.md` belum update.
- ✅ Audit relasi antar-model untuk planning refactor.

**JANGAN paste prompt ini kalau**:
- ❌ Project belum punya ORM / schema file (mis. project Express tanpa Prisma → schema implicit di code).
- ❌ Schema confidential dan tidak boleh ke-ekspos ke `.md` (mis. financial data dengan field PII sensitif).

---

## Untuk AI (mulai dari sini)

### Peran
Kamu adalah **Database Architect + Tech Writer**. Tujuan: generate `docs/db-schema.md` yang akurat berdasarkan source code, BUKAN tebakan generic.

### Aturan kerja
- **Bahasa Indonesia**, junior-friendly.
- **Akurasi > kelengkapan**. Lebih baik `[TBD: <alasan>]` daripada karang relasi.
- **Setiap klaim traceable** ke file/baris source (mis. `prisma/schema.prisma:42`).
- **JANGAN baca file rahasia** (`.env*`, `*.key`, `*.pem`, `~/.ssh/`, `~/.aws/`, `~/.config/gcloud/`, `secrets/`, `credentials*`) — daftar lengkap selaras `CLAUDE_universal_v1.md` §8.1 #6.
- **Baca STRUKTUR saja — JANGAN salin data pribadi asli (anti-PII).** Saat menemui file migrasi/seed berisi baris data (`INSERT INTO ... VALUES ...`), ekstrak **definisi kolom/tabel** saja; JANGAN salin NILAI aslinya (email, telepon, NIK, nama) ke `docs/db-schema.md` — pakai placeholder kalau butuh contoh. Data pribadi yang ter-commit ke git = kebocoran permanen + risiko UU PDP. (Pagar ini selaras `JALANKAN_KIT.md` Bagian 6.)
- **Cek dulu** apakah `docs/db-schema.md` sudah ada - kalau ada, baca dulu untuk anti-overwrite + delta detection.

### Workflow 4 fase

#### FASE 1 - Auto-detect schema source

Cari file schema dengan prioritas (top down):

1. **Prisma**: `prisma/schema.prisma` (atau `schema.prisma` di root)
2. **Drizzle**: `db/schema.ts`, `drizzle/schema.ts`, `src/db/schema.ts`
3. **Sequelize**: `models/index.js` + `models/*.js`
4. **TypeORM**: file dengan `@Entity()` decorator
5. **SQLAlchemy (Python)**: file dengan `class X(Base)` declaration
6. **Raw SQL migrations**: `migrations/*.sql`, `db/migrations/*.sql`
7. **Hibernate (Java)**: file dengan `@Entity` annotation
8. **Active Record (Rails)**: `db/schema.rb`

Kalau **tidak ditemukan** → stop, lapor: "Schema source tidak ditemukan. Kalau project pakai database, paste file schema atau output `\d` (psql describe) untuk lanjut."

Kalau **multiple sources** (mis. Prisma + raw migrations) → tanya user mana yang authoritative (biasanya schema.prisma).

#### FASE 2 - Parse schema

Baca file schema source, ekstrak:

- **Model list** (nama tabel/entity).
- **Field per model** (nama, tipe data, constraint: nullable, default, unique, primary key).
- **Relasi** (1:1, 1:N, N:M) - direction + foreign key field.
- **Index** (composite, partial, unique).
- **Enum** (kalau ada).
- **Trigger / function** (kalau di-export ke schema source).

**Skip**:
- Auto-generated field (mis. `_prisma_migrations` table).
- Field internal Supabase (`auth.users`, `storage.objects`) kecuali user explicit minta.

#### FASE 3 - Generate docs/db-schema.md

Format wajib:

```markdown
# docs/db-schema.md - Schema database <NAMA_PROYEK>

> Versi 1 · <YYYY-MM-DD> · auto-generated dari <SCHEMA_SOURCE>
> Update: tiap schema berubah (lihat aturan AUTO-SYNC 7.1)

## Pengantar
[1-2 kalimat: stack DB (PostgreSQL via Supabase / MySQL / dll) + ORM (Prisma / Drizzle / raw) + scope (multi-tenant schema / single-tenant)]

## 🙂 Untuk non-programmer (apa isi database ini)
[1 baris per tabel utama pakai analogi sehari-hari — supaya owner/staff awam paham TANPA baca diagram teknis. Contoh: "tabel `users` = buku absen akun staff; tabel `orders` = catatan pesanan pelanggan; tabel `sessions` = daftar siapa yang sedang login". Selaras §7.8 dokumen 2-POV.]

## Topology
[Mermaid ER diagram - kalau total model <= 20. Kalau lebih, group per domain]

\`\`\`mermaid
erDiagram
    USER ||--o{ POST : creates
    USER ||--o{ COMMENT : writes
    POST ||--o{ COMMENT : has
    USER {
        string id PK
        string email UK
        string name
    }
    POST {
        string id PK
        string userId FK
        string title
        datetime createdAt
    }
\`\`\`

## Daftar Model

### `User` (table: users)
- **Tujuan**: [1 kalimat berbasis observasi source]
- **Source**: `prisma/schema.prisma:12-34`
- **Field**:
  | Nama | Tipe | Constraint | Catatan |
  |---|---|---|---|
  | id | String | PK, @default(cuid()) | unique identifier |
  | email | String | UK, NOT NULL | email login |
  | passwordHash | String | NOT NULL | bcrypt hash |
  | role | Role | enum | SUPERVISOR / PIC / ADMIN |
  | createdAt | DateTime | @default(now()) | timestamp |
- **Relasi**:
  - 1:N → `Post` via `Post.userId`
  - 1:N → `LoginLog` via `LoginLog.userId`
  - 1:1 → `UserProfile` via `UserProfile.userId`
- **Index**:
  - UNIQUE(email)
  - INDEX(role, isActive) - untuk filter dashboard cepat
- **Dipakai di**:
  - [docs/security/auth.md](security/auth.md) - login flow
  - [docs/api/users/index.md](api/users/index.md) - CRUD user
  - [docs/api/security.md](api/security.md) - list active sessions

### `Post` (table: posts)
[... pattern sama ...]

## Enum
### `Role`
| Value | Deskripsi |
|---|---|
| SUPERVISOR | Owner, full akses |
| PIC | Manager, akses tim |
| ADMIN | Staff, akses terbatas |

## Index Penting (cross-model)
- `LoginLog(userId, eventType, createdAt DESC)` - untuk dashboard security
- `Credential(deletedAt) WHERE deletedAt IS NULL` - partial index untuk soft-delete filter

## Catatan Keputusan
- **Soft-delete pattern**: model `Credential`, `Post` punya `deletedAt` column → query default `WHERE deletedAt IS NULL`.
- **Audit trail**: `LoginLog`, `CredentialAuditLog` immutable - tidak ada UPDATE atau DELETE, hanya INSERT.
- **Encryption-at-rest**: field `password`, `username`, `notes` di `Credential` di-encrypt via [encryption.md](security/encryption.md) sebelum simpan.
- **Schema isolation**: project ini pakai shared DB Supabase production, schema `<nama>`. Lihat [MCP_SETUP.md](MCP_SETUP.md) untuk role isolation.

## Migrasi history (recent)
[Optional: kalau ada `prisma migrate` history yang menarik, summarize 3-5 migrasi terakhir]
- 2026-05-09: tambah `User.activeSessionId` untuk single-session enforcement
- 2026-05-15: tambah `ImpersonationSession` audit table
- 2026-05-20: tambah `IpBlacklist` table

## Source files
- `prisma/schema.prisma` - schema utama
- `prisma/migrations/` - migration history
- `src/lib/prisma.ts` - Prisma client singleton ([prisma.md](lib/prisma.md))
```

#### FASE 4 - Update registry + cross-refs

1. **Update `docs/architecture_auto.md`**: tambah entry `[db-schema.md](db-schema.md) - Schema database (X model, Y relasi)`.
2. **Update `docs/architecture.md`** (peta makro proyek) - kalau belum ada section "Database", tambah link ke `db-schema.md`.
3. **Cross-link**: untuk tiap model yang di-list di `db-schema.md`, cari `.md` lain yang sebut model tersebut → tambah link bi-directional.

---

## Aturan setelah generate

- **AUTO-SYNC (7.1)**: setiap kali schema berubah (file Prisma/Drizzle/dll edited) → AI WAJIB re-generate `docs/db-schema.md` di sesi yang sama. Tidak boleh dibiarkan stale.
- **Version bump**: kalau ada breaking change (rename model, drop field), bump versi di header `> Versi 2 · ...`.
- **Cross-check sebelum commit**: pastikan field name di `.md` MATCH dengan source schema persis.

---

## Troubleshooting

### Schema terlalu besar untuk fit di 1 file
- Kalau total model > 50, split per domain: `docs/db/auth-schema.md`, `docs/db/payment-schema.md`, dst.
- `docs/db-schema.md` jadi index yang point ke per-domain file.

### Multi-database (mis. PostgreSQL + Redis + MongoDB)
- Generate 1 file per database: `db-schema-postgres.md`, `db-schema-redis.md`, `db-schema-mongo.md`.
- Update `architecture.md` section "Data layer" untuk overview cross-DB.

### Mermaid diagram terlalu besar (> 20 model)
- Skip Mermaid di main file, generate per-domain Mermaid di domain-specific `.md`.
- Atau pakai PNG embed (generate via mmdc CLI lokal).

---

## Referensi
- Mermaid ER diagram syntax: https://mermaid.js.org/syntax/entityRelationshipDiagram.html
- Prisma schema reference: https://www.prisma.io/docs/orm/prisma-schema
- Drizzle schema docs: https://orm.drizzle.team/docs/sql-schema-declaration
