# docs/_EXAMPLE.md - Contoh Format `.md` Pendamping (REFERENSI)

> Versi 1 · 2026-05-31 · generic untuk semua proyek tim
> File ini SISTEM (prefix `_`) - referensi format, **jangan dihapus**.

## Pengantar

File ini = **contoh konkret 1 file `.md` pendamping** yang ditulis sesuai format standar tim (`_PATTERNS.md` seksi 3). Pakai sebagai reference saat kamu (atau AI) buat `.md` pendamping baru - copy struktur, ganti isi sesuai modul aktual.

**Contoh di bawah = fiksional** (`users.ts` adalah file imajiner). Ini cuma reference format, bukan bagian dari proyekmu. Hapus atau biarkan - tidak akan mengganggu.

---

## CONTOH (mulai dari sini, copy & adapt)

```markdown
# users.md - Modul User Management (CRUD + RBAC)

> Versi 1 · 2026-05-31 · auto-generated

## Tujuan
Modul `users.ts` adalah **fasad CRUD untuk entitas user** di proyek ini. Tujuan utama: centralisasi semua operasi user (create / read / update / soft-delete) supaya validasi + audit log konsisten lintas endpoint. Cegah duplikasi query Prisma di banyak handler.

Konsumen: handler API (`/api/users/*`), background job (mis. cleanup user inactive), CLI seeding (`scripts/seed-users.ts`).

## Cara Pakai

```ts
import { createUser, getUserById, updateUser, softDeleteUser } from "@/lib/users";

// Create - validasi schema + hash password + audit log otomatis
const user = await createUser({
  email: "alice@example.com",
  password: "plain-text-here", // di-hash di dalam, jangan hash sendiri
  role: "MEMBER",
});

// Read - return null kalau tidak ada (jangan throw)
const u = await getUserById("user_123");

// Update - partial update, validasi schema, audit log delta
await updateUser("user_123", { role: "ADMIN" });

// Soft delete - set deletedAt, JANGAN hard delete (audit retention 90 hari)
await softDeleteUser("user_123", { actorId: currentUser.id });
```

## Input / Output

- **`createUser(input: CreateUserInput): Promise<User>`**
  - Input: `{ email: string, password: string, role: Role }`
  - Output: `User` (tanpa field `password`)
  - Throws: `ValidationError` kalau email duplicate / format invalid / password lemah

- **`getUserById(id: string): Promise<User | null>`**
  - Input: `id` (string, format `user_<cuid>`)
  - Output: `User` atau `null` (BUKAN throw kalau tidak ada)

- **`updateUser(id: string, patch: Partial<UserPatch>): Promise<User>`**
  - Input: ID + partial patch object
  - Output: User setelah update
  - Throws: `NotFoundError` kalau ID tidak ada, `ValidationError` kalau patch invalid

- **`softDeleteUser(id: string, opts: { actorId: string }): Promise<void>`**
  - Input: ID + actorId untuk audit
  - Output: void
  - Side effect: set `deletedAt = now()`, insert row `audit_log`

## Dependensi

- **Library**:
  - `@prisma/client` - query DB user table
  - `bcrypt` - password hash (cost factor 12)
  - `zod` - schema validation
- **Env**:
  - `BCRYPT_COST` (opsional, default 12) - biaya bcrypt
- **File terkait**:
  - `prisma.ts` - singleton Prisma client
  - `audit.ts` - `logAction()` untuk write ke `audit_log` table
  - `permissions.ts` - `requireRole()` kalau caller perlu RBAC check di luar
  - DB: tabel `users`, `audit_log`

## Catatan

- **Password hashing**: SELALU pakai `bcrypt.hash(password, BCRYPT_COST)` di dalam modul. JANGAN expose raw password compare ke caller - pakai `verifyPassword(plain, hash)` helper. Cegah timing attack: bcrypt sudah constant-time.
- **Soft delete bukan hard delete**: aturan compliance - semua user record retain 90 hari dengan `deletedAt` set. Hard delete cuma di cleanup job khusus (lihat `scripts/cleanup-deleted-users.ts`).
- **Email case-insensitive**: lookup pakai `.toLowerCase()` di query Prisma. Cegah Alice@x.com vs alice@x.com jadi 2 record.
- **Audit log wajib untuk mutation**: create/update/softDelete WAJIB insert ke `audit_log` table dengan `actorId` (siapa lakukan), `targetUserId` (siapa terdampak), `action` (string enum), `delta` (JSON diff).
- **Race condition email duplicate**: pakai DB unique constraint di kolom `email` + catch `PrismaClientKnownRequestError` code `P2002`. Jangan check-then-insert (race).
- Source code: `src/lib/users.ts:1` (entry), `src/lib/users.validation.ts:1` (zod schema).
```

---

## Aturan saat copy contoh ini

1. **Ganti `users.md` jadi nama modul aktual** (mis. `auth.md`, `invoices.md`).
2. **Ganti semua placeholder fiksional** - `users.ts`, `User`, env var, dll.
3. **Update `Versi` + tanggal** sesuai kenyataan.
4. **Source code path WAJIB nyata** - jangan biarkan `src/lib/users.ts:1` kalau file aktual beda.
5. **Pastikan max ~80 baris** (file ini contoh = lebih panjang karena ada explanation, tapi `.md` pendamping aktual cukup ringkas).
6. **Update `architecture_auto.md`** setelah create - tambah 1 baris baru.

---

## Kenapa file ini ada?

Tim profesional = consistent format. Tanpa contoh konkret, tiap dev/AI bikin format beda → docs jadi messy + AI kebingungan saat baca. File `_EXAMPLE.md` ini = anchor format. Saat AI generate `.md` pendamping baru, AI baca file ini dulu sebagai reference.

Boleh dihapus kalau tim sudah hafal format. Default: **biarkan** - biaya 0, value tinggi untuk anggota baru.
