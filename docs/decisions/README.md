# decisions/ - Architecture Decision Records (ADR)

> Folder ini menyimpan **catatan keputusan teknis non-sepele** yang diambil di proyek.
> Tujuannya: kalau 6 bulan lagi ada yang tanya "kenapa dulu pilih X bukan Y?", jawabannya ada di sini - bukan di kepala satu orang.

---

## Apa itu ADR?

**ADR (Architecture Decision Record)** = dokumen pendek 1-2 halaman yang mencatat:
- **Context** - masalah apa yang dihadapi
- **Decision** - keputusan apa yang diambil
- **Konsekuensi** - trade-off (pros, cons, risk)

Format lengkap ada di [`_TEMPLATE.md`](./_TEMPLATE.md) - copy file itu tiap bikin ADR baru.

---

## Naming convention

Nama file: **`ADR-<NNN>-<slug-kebab-case>.md`**

Contoh nyata:
- `ADR-001-pilih-prisma-vs-drizzle.md`
- `ADR-002-pakai-nextauth-untuk-staff-portal.md`
- `ADR-003-supabase-rls-policy-per-tenant.md`
- `ADR-004-vercel-serverless-vs-self-hosted-vps.md`

Aturan slug:
- huruf kecil semua
- pisah dengan `-` (kebab-case)
- maksimal ~6 kata, ringkas tapi jelas

---

## Numbering rule

- **Sequential:** mulai dari `001`, naik 1 tiap ADR baru (`002`, `003`, ...).
- **Never reuse:** kalau ADR-005 di-deprecate / di-supersede, **jangan** pakai ulang nomor 005 untuk ADR berbeda. Biarkan tetap ada, tambahkan ADR baru di nomor terbaru.
- **Padding 3 digit:** pakai `001` bukan `1`, supaya sort by name tetap urut sampai ADR ke-999.

---

## Kapan bikin ADR? (LAZY-DECISION pattern)

Ikut prinsip **LAZY-DECISION**: jangan bikin ADR untuk tiap keputusan kecil - cuma yang **non-sepele** dan **susah di-rollback**.

AI di kit ini akan **sugest otomatis** "ini decision teknis non-sepele, masuk `decisions/`? y/n" saat mendeteksi salah satu trigger berikut:

### Trigger wajib sugest ADR

1. **Ganti library/framework inti** - mis. ganti ORM (Prisma -> Drizzle), ganti auth provider (NextAuth -> Clerk), ganti UI lib.
2. **Ganti arsitektur** - mis. monolith -> microservice, REST -> tRPC, SSR -> ISR, pindah dari Vercel ke VPS.
3. **Ganti DB schema fundamental** - mis. ubah primary key strategy, denormalisasi tabel besar, tambah multi-tenancy.
4. **Ganti auth strategy** - mis. tambah RLS policy, pindah session-based -> JWT, tambah RBAC layer.
5. **Ganti infrastructure** - mis. ganti hosting, ganti DB provider, tambah message queue, tambah cache layer (Redis).
6. **Trade-off security vs UX** yang signifikan - mis. relax CORS, pakai service-role key di client.

### Bukan trigger ADR (cukup commit message + docs biasa)

- Rename variable / refactor kecil
- Tambah komponen UI baru
- Bug fix
- Tambah env var
- Update dependency minor/patch

---

## Status lifecycle

ADR punya 4 status. Selalu update di file kalau berubah.

| Status        | Artinya                                                                  |
|---------------|--------------------------------------------------------------------------|
| `Proposed`    | Draft, belum disetujui. Masih bisa diubah / dibatalkan.                  |
| `Accepted`    | Disetujui & sedang/sudah diimplementasi. Default state setelah merge.    |
| `Deprecated`  | Tidak dipakai lagi, tapi belum ada penggantinya. Catat alasan.           |
| `Superseded by ADR-YYY` | Digantikan ADR lain. **Wajib** cantumkan nomor ADR pengganti. |

**Aturan:** kalau ADR di-supersede, **jangan hapus file lama** - biarkan sebagai riwayat. Cuma update field `Status` di header.

---

## Contoh alur pakai

1. User minta: "ganti Prisma ke Drizzle".
2. AI deteksi trigger #1 (ganti library inti) -> sugest: "ini decision non-sepele, bikin ADR di `docs/decisions/`? y/n".
3. User: `y`.
4. AI copy `_TEMPLATE.md` -> `ADR-001-pilih-prisma-vs-drizzle.md`.
5. AI isi Context + Decision + Alternatif + Konsekuensi berdasarkan diskusi.
6. Commit bersama PR implementasi.
7. Kalau nanti di-rollback ke Prisma -> bikin `ADR-007-rollback-ke-prisma.md` + update ADR-001 status jadi `Superseded by ADR-007`.

---

## FAQ

**Q: Bedanya ADR vs comment di code vs commit message?**
A: Commit message jelasin "apa yang berubah". Comment di code jelasin "gimana cara kerjanya". **ADR jelasin "kenapa pilih ini, bukan yang lain"** - konteks bisnis + trade-off yang tidak muat di commit.

**Q: ADR harus panjang?**
A: Tidak. 1 halaman cukup. Yang penting **Context + Decision + Konsekuensi** terisi jujur. Lebih baik 1 halaman jujur daripada 5 halaman basa-basi.

**Q: Boleh edit ADR yang sudah `Accepted`?**
A: Boleh, tapi **append-only** di tabel Riwayat. Jangan rewrite history - itu menghilangkan jejak audit.

**Q: ADR ditulis sebelum atau sesudah implementasi?**
A: Idealnya **sebelum** (sebagai proposal). Tapi kalau decision sudah terlanjur diimplementasi, tetap tulis ADR retroaktif - lebih baik telat daripada tidak ada.
