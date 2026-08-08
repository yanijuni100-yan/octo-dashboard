# docs/glossary.md - Kamus Istilah <NAMA_PROYEK>

> Versi 1 · <YYYY-MM-DD>

<!--
PENGANTAR SINGKAT (baca dulu sebelum edit):

- **Apa ini?** Kamus istilah domain proyek <NAMA_PROYEK>. Tempat rujukan tunggal
  untuk vocabulary bisnis + konvensi penamaan kode (dijaga konsisten secara disiplin
  AI/manusia — belum ada robot yang mengecek nama di kode benar-benar cocok dengan kamus ini).
- **Kapan dibaca?** Tiap kali kamu (atau AI) ragu istilah/penamaan. Baca SEBELUM
  bikin tabel DB, route, atau komponen baru.
- **Kapan di-update?** Tiap kenalin istilah domain baru, ubah nama
  tabel/route/komponen, atau ubah alur status objek bisnis. Jangan dibiarkan basi.
- **Hubungan dengan dokumen lain?** Lihat `docs/architecture.md` untuk peta proyek
  keseluruhan. Istilah UMUM (edge case, reuse, least privilege) ada di CLAUDE.md
  global - JANGAN diduplikasi di sini. File ini khusus istilah SPESIFIK proyek.
- **Bahasa:** Bahasa Indonesia, junior-friendly (konsisten dengan CLAUDE.md global).
-->

## Tujuan & Cara Pakai

Glossary ini mencegah salah-paham istilah domain (mis. "user" vs "client" vs "tenant") antar AI, junior dev, dan stakeholder bisnis. Update tiap ada istilah baru atau rename. Baca sekali di awal onboarding, lalu rujuk tiap ragu - identifier kode (variabel, tabel, route, komponen) WAJIB konsisten dengan entri di sini. Lihat juga `docs/architecture.md` untuk peta makro proyek.

## Aturan Penamaan

Default Postgres-style + JS/TS. Sesuaikan kalau pakai DB/bahasa lain (mis. MongoDB biasanya `camelCase`).

- **Tabel DB** - `snake_case` jamak. Contoh: `users`, `invoices`, `invoice_items`.
- **Kolom DB** - `snake_case` tunggal. Contoh: `created_at`, `user_id`, `is_active`.
- **Model / Class** - `PascalCase` tunggal. Contoh: `User`, `Invoice`, `InvoiceItem`.
- **Route HTTP** - `kebab-case` jamak. Contoh: `/api/invoices`, `/api/invoice-items`.
- **Komponen UI** - `PascalCase`. Contoh: `UserCard`, `InvoiceTable`.
- **File kode** - komponen `PascalCase.tsx`, util/route `kebab-case.ts`. [TBD: <sesuaikan stack>].
- **Folder fitur** - `kebab-case` jamak. Contoh: `features/invoices/`, `features/clients/`.
- **Branch git** - `<tipe>/<ringkas>` dengan tipe `feat`, `fix`, `chore`, `docs`, `refactor`. Contoh: `feat/invoice-export`.
- **Variabel boolean** - prefix `is` / `has` / `can`. Contoh: `isActive`, `hasPaid`, `canEdit`.
- **Env var** - `SCREAMING_SNAKE_CASE`. Contoh: `DATABASE_URL`, `SUPABASE_ANON_KEY`.

## Domain Bisnis

Format WAJIB tiap entri (selalu rujuk identifier kode supaya link domain↔kode jelas):
`**istilah** - definisi 1-2 kalimat singkat. *(kode: tabel / model / route terkait)*`

- **invoice** - tagihan ke klien yang menunggu pembayaran, dibuat dari satu atau lebih item. *(kode: tabel `invoices`, model `Invoice`, route `/api/invoices`)*
- **client** - pihak eksternal yang menerima tagihan (bukan user yang login). *(kode: tabel `clients`, model `Client`, route `/api/clients`)*
- **[TBD: <istilah-3>]** - [TBD: definisi]. *(kode: `<tabel>` / `<Model>` / `<route>`)*
- **[TBD: <istilah-4>]** - [TBD]. *(kode: [TBD])*
- **[TBD: <istilah-5>]** - [TBD]. *(kode: [TBD])*
<!-- ISI: tambah 5-15 istilah domain utama proyek -->

## Role & Permission

<!-- ISI tabel role aktual proyek. Hapus seluruh section ini kalau proyek tanpa
     RBAC (mis. landing page, single-user tool) atau pakai sistem berbeda
     (tenant-based, ACL per-resource). -->

| Role | Bisa apa | Tidak bisa apa |
|------|----------|----------------|
| **[TBD: <ROLE-1>]** | [TBD] | [TBD] |
| **[TBD: <ROLE-2>]** | [TBD] | [TBD] |

Catatan: enforcement role ada di `[TBD: <file/middleware>]` - pastikan tiap route memanggilnya.

## Status & State Penting

<!-- Hapus section ini kalau proyek tidak punya objek dengan status workflow
     (mis. blog statis, landing page). -->

Alur state objek bisnis utama. Tambah satu blok per objek yang punya lifecycle. Tabel transisi lebih disarankan daripada diagram ASCII karena lebih mudah dibaca & diedit junior.

**Invoice** (contoh) - tabel transisi:

| Dari | Aksi | Ke | Catatan |
|------|------|-----|--------|
| draft | submit | pending | Setelah submit tidak bisa diedit |
| draft | cancel | cancelled | Audit trail tetap disimpan |
| pending | pay | paid | Final, tidak bisa diubah |
| pending | cancel | cancelled | Hanya SUPERVISOR yang boleh |

Penjelasan tiap state:
- **draft** - masih bisa diedit, belum dikirim ke klien.
- **pending** - sudah dikirim, menunggu pembayaran. Tidak bisa diedit.
- **paid** - lunas. Final, tidak bisa diubah.
- **cancelled** - dibatalkan. Tidak boleh dihapus (audit trail).

**[TBD: <Objek-2>]**: <!-- ISI: tabel transisi objek bisnis kedua -->

## Singkatan & Jargon Teknis Proyek

Hanya istilah SPESIFIK proyek ini. Istilah umum (RLS, ORM, dll.) sudah ada di CLAUDE.md global.

- **[TBD: <SINGKATAN-1>]** - [TBD: kepanjangan + arti spesifik di proyek ini].
- **[TBD: <SINGKATAN-2>]** - [TBD].
- **[TBD: <SINGKATAN-3>]** - [TBD].

## Istilah yang Mudah Tertukar

Pasangan rancu yang sering bikin bug. Klarifikasi singkat.

- **user vs client** - `user` = orang yang login ke app (punya password). `client` = pihak eksternal yang ditagih (tidak login).
- **role vs permission** - `role` = label peran (mis. `ADMIN`). `permission` = aksi konkret yang diizinkan (mis. `invoice.delete`). Satu role bisa punya banyak permission.
- **created_at vs published_at** - `created_at` = waktu row dibuat di DB. `published_at` = waktu konten resmi tampil ke publik (bisa lebih lambat).
- **[TBD: <pasangan-4>]** - [TBD: mis. tenant vs workspace vs organization].

## Riwayat Perubahan

| Versi | Tanggal | Author | Ringkasan |
|-------|---------|--------|-----------|
| 1 | <YYYY-MM-DD> | [TBD: <nama>] | Inisialisasi template glossary. |
<!-- ISI: tambah baris baru tiap update. -->
