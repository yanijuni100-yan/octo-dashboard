# templates/RLS_SETUP_PROMPT.md - Setup Row-Level Security per Schema

> Versi 1 · 2026-06-01
> Untuk staff IT / developer schema-scoped yang akses Supabase pakai role `dev_<dev>.<project-ref>`.

---

## 1. Untuk OWNER - Template pesan announcement ke staff IT

Copy template ini, ganti placeholder `{{DEV}}`, `{{SCHEMA}}`, `{{PASSWORD-KAMU}}`, `{{PROJECT_REF}}`, `{{POOLER_HOST}}`:

```
Halo {{DEV}}, ada update KEAMANAN database. Kita rapikan akses supaya tiap orang HANYA bisa ke
schema-nya sendiri (isolasi antar-tenant).

PERUBAHAN PENTING:
- Mulai sekarang pakai koneksi role KHUSUS kamu: username `dev_{{DEV}}.{{PROJECT_REF}}`.
- JANGAN pakai lagi string yang usernamanya `postgres.` - itu akses penuh ke SEMUA tenant, ditutup demi keamanan.
- Password kamu TIDAK aku ubah: pakai password `dev_{{DEV}}` yang lama. Kalau tidak punya/lupa, balas ini, nanti aku kirim yang baru.

Koneksi kamu (schema: {{SCHEMA}}):
  App/runtime (6543): postgresql://dev_{{DEV}}.{{PROJECT_REF}}:[PASSWORD-KAMU]@{{POOLER_HOST}}:6543/postgres
  DDL/migrasi (5432): postgresql://dev_{{DEV}}.{{PROJECT_REF}}:[PASSWORD-KAMU]@{{POOLER_HOST}}:5432/postgres?sslmode=require

TUGAS (kerjakan via Claude Code kamu, yang sudah buka project app kamu) - paste prompt RLS_SETUP di bawah.

Kalau ragu, tanya aku dulu sebelum REVOKE/ENABLE di tabel yang dipakai app.
```

**Cara pakai**:
1. Ganti placeholder per-dev (mis. `{{DEV}}` → `sandi`, `{{SCHEMA}}` → `pbn`).
2. Kirim via password manager (1Password / Bitwarden Send) atau encrypted DM yang auto-delete.
3. JANGAN kirim password actual di body pesan; kirim password via password manager terpisah.

---

## 2. Untuk STAFF IT - Prompt RLS Setup (paste ke Claude Code)

**Persiapan dulu** (sebelum paste prompt):
- Pastikan Claude Code sudah dibuka di folder project app kamu (mis. `D:\projects\<your-app>\`).
- Pastikan kamu sudah dapat connection string dari owner (jangan paste password ke chat).
- Update `.env.local` proyek dengan connection string baru (port 6543, username `dev_<dev>.<project-ref>`).

**Paste prompt ini ke Claude Code**:

```
Saya developer schema `{{SCHEMA}}` di database Supabase yang dipakai bersama banyak tenant (PRODUCTION).
Tugas: amankan schema `{{SCHEMA}}` dengan Row Level Security (RLS) supaya pemegang anon/publishable key
(PUBLIK) tidak bisa baca/tulis data atau melewati cek role app.

ATURAN WAJIB:
1) Jangan ENABLE RLS tanpa bikin policy dulu (RLS tanpa policy = app error semua query gagal).
2) Tes lewat APP asli (login tiap role), bukan psql - koneksi langsung saya bypass RLS karena saya owner tabel.
3) Jangan pakai USING(true) untuk operasi TULIS; policy tulis harus cek role app yang authoritative.
4) Hanya sentuh schema {{SCHEMA}}. JANGAN touch schema lain.

LANGKAH:
1. Baca kode app saya (folder `src/`, `app/`, `lib/`, dst.) untuk pahami:
   - Role app apa saja yang dipakai (mis. `admin_access`, `pic`, `staff`, `anon`).
   - Tabel mana yang public-readable (mis. landing page data) vs auth-required.
   - JWT claim path yang dipakai app (mis. `request.jwt.claims->>'role'` atau header custom).
2. List semua tabel di schema {{SCHEMA}}:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = '{{SCHEMA}}' AND table_type = 'BASE TABLE'
   ORDER BY table_name;
   ```
3. Untuk SETIAP tabel, urutan eksekusi:
   a. Bikin policy SELECT (read) - cek role yang boleh baca.
   b. Bikin policy INSERT/UPDATE/DELETE (write) - cek role app authoritative.
   c. Verify policy syntax bener (DROP POLICY IF EXISTS sebelum CREATE biar idempotent).
   d. ENABLE RLS: `ALTER TABLE {{SCHEMA}}.<tabel> ENABLE ROW LEVEL SECURITY;`
   e. REVOKE anon: `REVOKE ALL ON {{SCHEMA}}.<tabel> FROM anon;` (kalau app wajib login).
   f. Test via APP asli - login → action → verify behavior.
   g. Test anon access - pakai publishable_key, harus 401/403 atau empty.
4. Setelah SEMUA tabel selesai:
   a. Bikin docs/db-rls.md ringkas: per tabel, role apa yang boleh apa.
   b. Update docs/architecture_auto.md dengan entry [db-rls.md](db-rls.md).
   c. Commit ke git: `chore(db): setup RLS for schema {{SCHEMA}}`.

PENTING:
- Kerjakan tabel per tabel, HATI-HATI, tes setiap selesai sekelompok (3-5 tabel).
- Kalau ragu di salah satu tabel, STOP dan tanya owner sebelum lanjut.
- Kalau test app gagal setelah ENABLE RLS, DISABLE dulu (`ALTER TABLE ... DISABLE ROW LEVEL SECURITY`),
  debug policy, baru ENABLE lagi.
- JANGAN run `DROP POLICY` untuk policy app existing tanpa konfirmasi owner.

Mulai dari langkah 1 (baca kode app) sekarang.
```

---

## 3. Verifikasi setelah RLS aktif

Setelah staff IT selesai, owner verify dengan checklist ini:

- [ ] Semua tabel di schema `{{SCHEMA}}` punya RLS enabled (`SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = '{{SCHEMA}}'::regnamespace AND relkind = 'r';`).
- [ ] Semua tabel punya minimal 1 policy (`SELECT tablename, policyname FROM pg_policies WHERE schemaname = '{{SCHEMA}}';`).
- [ ] Test app dari browser tanpa login → menu / data terkunci.
- [ ] Test curl dengan publishable_key ke endpoint tabel sensitif → 401/403.
- [ ] Test login sebagai role app yang valid → semua fitur jalan.
- [ ] `docs/db-rls.md` ada di repo dengan ringkasan per tabel.

---

## 4. Anti-pattern (LARANGAN)

### 4.1. ENABLE RLS sebelum policy lengkap
```sql
-- SALAH - app langsung 500 error semua query
ALTER TABLE pbn.posts ENABLE ROW LEVEL SECURITY;
-- belum ada policy → default deny → semua query gagal
```
**Yang benar**: bikin policy dulu (SELECT + INSERT + UPDATE + DELETE), baru ENABLE.

### 4.2. Pakai USING(true) untuk write policy
```sql
-- SALAH - semua user (termasuk anon) bisa update apapun
CREATE POLICY posts_update ON pbn.posts FOR UPDATE USING (true);
```
**Yang benar**: cek role app authoritative.
```sql
CREATE POLICY posts_update ON pbn.posts FOR UPDATE
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'admin_access')
  WITH CHECK (current_setting('request.jwt.claims', true)::json->>'role' = 'admin_access');
```

### 4.3. Tes RLS via psql owner
```bash
# SALAH - psql sebagai owner tabel BYPASS RLS otomatis
psql "postgresql://dev_a.ref:pwd@...:6543/postgres"
SELECT * FROM pbn.posts;  -- jalan, padahal RLS aktif
```
**Yang benar**: tes via app asli yang pakai JWT app role. PostgreSQL native role (`dev_a`) BUKAN role app.

### 4.4. Sentuh schema orang lain
```sql
-- SALAH - staff IT touch schema yang bukan miliknya
ALTER TABLE rtp.bets ENABLE ROW LEVEL SECURITY;
```
**Yang benar**: hanya sentuh schema sendiri (`pbn` kalau kamu dev_a di tim PBN).

---

## 5. Troubleshooting

### "permission denied for table X" setelah ENABLE RLS
- Cek `SELECT * FROM pg_policies WHERE tablename = 'X';` - ada policy belum?
- Cek JWT claim app - apakah role-nya match dengan policy `USING` clause?
- Cek apakah connection string app pakai role yang BUKAN tabel owner (RLS skip owner).

### App jalan tapi data kosong setelah RLS
- Policy SELECT terlalu strict (mis. cek role yang tidak ada di JWT user current).
- DISABLE sementara untuk debug: `ALTER TABLE X DISABLE ROW LEVEL SECURITY;`
- Cek query asli yang app jalankan vs claim JWT yang dikirim.

### Migration Prisma gagal setelah RLS
- Prisma migrate jalan sebagai owner tabel = bypass RLS, tapi pakai DDL connection (port 5432).
- Pastikan connection string DDL pakai `?sslmode=require`.
- Kalau masih gagal, owner perlu `GRANT ALL ON SCHEMA <schema> TO postgres;` sementara untuk migrate.

---

## Referensi
- Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- PostgreSQL CREATE POLICY: https://www.postgresql.org/docs/current/sql-createpolicy.html
- JWT claim helper Supabase: https://supabase.com/docs/guides/auth/server-side/creating-a-client
