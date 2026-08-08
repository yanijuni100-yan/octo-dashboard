# ADR-XXX: <Judul Singkat Decision>

> Ganti `XXX` dengan nomor urut (001, 002, ...). Judul ringkas, gaya kalimat aktif.
> Contoh nama file: `ADR-001-pilih-prisma-vs-drizzle.md`

---

## Metadata

- **Tanggal:** YYYY-MM-DD <!-- tanggal decision diambil, bukan tanggal draft -->
- **Status:** Proposed <!-- Proposed | Accepted | Deprecated | Superseded by ADR-YYY -->
- **Author:** <nama / handle / email> <!-- siapa yang mengusulkan -->
- **Reviewer:** <opsional - siapa yang ikut menyetujui> <!-- kosongkan kalau solo -->

---

## Context

> Jelaskan **kenapa** decision ini diperlukan. Tulis seperti cerita singkat ke developer baru.

- **Problem statement:** masalah konkret yang sedang dihadapi (1-3 kalimat).
- **Constraints:** batasan yang memaksa decision ini (budget, deadline, stack existing, skill tim, regulasi).
- **Asumsi:** hal yang dianggap benar saat decision diambil (penting buat audit di masa depan kalau asumsi berubah).

---

## Decision

> Keputusan **apa** yang diambil. Tulis tegas - bukan "mungkin akan pakai X", tapi "pakai X".

Contoh: "Pakai Prisma sebagai ORM untuk semua akses DB di sisi server."

Kalau perlu, sertakan diagram singkat / pseudo-flow / contoh konfigurasi.

---

## Alternatif yang Ditolak

> List opsi lain yang sempat dipertimbangkan + **alasan ditolak**. Bukan untuk gengsi-gengsian, tapi supaya developer di masa depan tahu "ini sudah pernah dipikirkan".

- **Alternatif A - <nama>:** ditolak karena <reason singkat>.
- **Alternatif B - <nama>:** ditolak karena <reason singkat>.
- **Alternatif C - <nama>:** ditolak karena <reason singkat>.

---

## Konsekuensi

> Trade-off real dari decision ini. **Jujur** - kalau ada cons, tulis. Jangan jualan.

### Pros
- <keuntungan 1>
- <keuntungan 2>

### Cons
- <kerugian 1>
- <kerugian 2>

### Risk
- <risiko teknis / bisnis / operasional yang harus dipantau ke depan>
- <mitigasi singkat kalau ada>

---

## Implementation Notes

> Opsional. Isi kalau decision ini sudah / sedang diimplementasi.

- **PR terkait:** <link PR / commit hash>
- **File yang berubah:** <path utama, mis. `prisma/schema.prisma`, `lib/db.ts`>
- **Migration plan:** <kalau breaking - langkah migrasi data / kode lama>
- **Rollback plan:** <kalau decision gagal - cara balik ke state sebelumnya>

---

## Riwayat

> Diisi **hanya kalau ADR ini direvisi** setelah Accepted. Append-only, jangan hapus entry lama.

| Tanggal     | Status            | Oleh         | Catatan                                                       |
|-------------|-------------------|--------------|---------------------------------------------------------------|
| YYYY-MM-DD  | Proposed          | <author>     | Draft awal                                                    |
| YYYY-MM-DD  | Accepted          | <reviewer>   | Disetujui setelah diskusi tim                                 |
| YYYY-MM-DD  | Superseded        | <author>     | Digantikan ADR-YYY karena <reason>                            |
