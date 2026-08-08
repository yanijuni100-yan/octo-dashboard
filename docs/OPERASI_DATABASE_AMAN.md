# templates/OPERASI_DATABASE_AMAN.md - Ubah Struktur Database TANPA Bikin App Mati / Data Hilang

> Versi 1 · 2026-06-27 · Untuk Supabase/PostgreSQL (cocok juga Prisma). Gaya non-programmer + SQL konkret.
> Pelengkap, BUKAN pengganti: akses berjenjang & promote schema = `MCP_SETUP.md` §2.6b/§2.10 · Row-Level Security = `RLS_SETUP_PROMPT.md` · backup harian otomatis = `templates/github/workflows/backup-schemas.yml`. File ini fokus ke **2 hal yang belum dicakup**: (1) ubah struktur tanpa-downtime (*expand-then-contract*), (2) cara balik kalau migrasi gagal (*rollback runbook*).

## Tujuan & kapan dipakai

Dipakai tiap kali ada permintaan **mengubah STRUKTUR data** (bukan isi data): tambah/hapus/rename kolom, ubah tipe, tambah aturan wajib (`NOT NULL`/`UNIQUE`), pecah/gabung tabel. AI **otomatis** memuat pola ini saat staff minta hal seperti *"tambah kolom nomor HP di tabel pelanggan"* atau *"ubah kolom harga jadi wajib diisi"*.

- 👨‍🎓 **Junior:** perubahan skema (struktur tabel) = operasi paling rawan *breaking* + *data loss*. Aturan inti `CLAUDE_universal_v1.md` §9 sudah mewajibkan migrasi *idempotent* + *expand-then-contract* + *reversible* — file ini menjadikannya **langkah konkret siap-jalan**.
- 🙂 **Non-programmer:** mengubah bentuk "lemari data" saat toko masih buka itu bahaya — bisa bikin kasir error atau barang hilang. Panduan ini cara menggantinya **pelan-pelan tanpa menutup toko**, plus cara cepat membatalkan kalau ada yang salah.

---

## 0. 4 Aturan Emas (WAJIB, jangan dilanggar)

1. **JANGAN ubah-lalu-hapus dalam satu langkah.** Pakai *expand-then-contract*: **tambah yang baru → pindahkan data → baru buang yang lama** (Bagian 2). Hapus/rename langsung saat app jalan = query lama langsung error.
2. **Backup/snapshot DULU sebelum yang merusak** (DROP/hapus kolom/ubah tipe). Supabase: *Database → Backups* atau `pg_dump` schema target. *(Aksi merusak tetap konfirmasi verbatim — `CLAUDE_universal_v1.md` §8.2 Aturan 5.)*
3. **Migrasi = file terversion di repo** (Prisma migration / file `.sql` ber-nomor), **BUKAN** ketik manual di SQL Editor. Supaya bisa di-review, diulang, dan dibalik.
4. **SIMULASI di staging dulu** (schema mirip prod), baru produksi. Tabel besar (>100rb baris) → *backfill* dibatch, jangan sekali jalan (kunci tabel lama → app hang).

---

## 1. Prompt siap-paste untuk STAFF (paste ke Claude Code)

```
Saya mau mengubah STRUKTUR tabel di database Supabase project ini: {{JELASKAN, mis: "tambah kolom phone (nomor HP) wajib-isi di tabel customers"}}.

Patuhi OPERASI_DATABASE_AMAN.md:
1. Baca dulu kode asli yang memakai tabel/kolom ini (model, query, API) + cek apakah ada RLS aktif.
2. Tentukan ini operasi AMAN (additive) atau BERISIKO (destruktif/wajib-isi/rename/ubah-tipe) — pakai tabel keputusan Bagian 3.
3. Kalau BERISIKO → rancang langkah EXPAND-THEN-CONTRACT (Bagian 2), JANGAN ubah-lalu-hapus sekaligus.
4. Tulis sebagai MIGRASI TERVERSION (Prisma migration atau file .sql ber-nomor), idempotent (IF NOT EXISTS / IF EXISTS).
5. Sertakan ROLLBACK tertulis (Bagian 4) + ingatkan saya backup sebelum langkah merusak.
6. Tandai langkah mana yang SIMULASI di staging dulu vs produksi.
Tunjukkan rencananya ke saya DULU (bahasa awam) sebelum jalankan apa pun.
```

> AI akan menampilkan **rencana bertahap** (Alur Berpemandu §4.7) + minta persetujuan sebelum menyentuh data. Aksi merusak butuh konfirmasi ketik-frasa.

---

## 2. Pola EXPAND-THEN-CONTRACT (ubah struktur tanpa app mati)

Inti: app versi lama **dan** baru harus sama-sama jalan selama transisi. Caranya, dipecah jadi rilis-rilis kecil yang masing-masing *backward-compatible* (tidak merusak versi sebelumnya).

**Contoh: bikin kolom `phone` jadi WAJIB diisi (`NOT NULL`) di tabel `customers` — tanpa downtime.**

```sql
-- FASE 1 — EXPAND: tambah kolom BARU yang boleh kosong dulu (aman, additive)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone text;   -- nullable: query & insert lama tetap jalan

-- FASE 2 — BACKFILL: isi data lama, DIBATCH (jangan sekali UPDATE semua = kunci tabel)
--   ulangi sampai 0 baris kosong; untuk tabel besar pakai job/loop, jeda antar batch.
UPDATE customers SET phone = '-' 
WHERE phone IS NULL AND id IN (SELECT id FROM customers WHERE phone IS NULL LIMIT 5000);

-- FASE 3 — CONSTRAINT: pasang aturan wajib TANPA kunci-lama-panjang
--   NOT VALID = cek hanya baris baru dulu (cepat, tak scan seluruh tabel) → VALIDATE terpisah (tak blokir tulis)
ALTER TABLE customers ADD CONSTRAINT customers_phone_not_null CHECK (phone IS NOT NULL) NOT VALID;
ALTER TABLE customers VALIDATE CONSTRAINT customers_phone_not_null;
--   (opsional, setelah semua app baru: ubah ke NOT NULL beneran lalu buang CHECK)
-- ALTER TABLE customers ALTER COLUMN phone SET NOT NULL;
-- ALTER TABLE customers DROP CONSTRAINT customers_phone_not_null;

-- FASE 4 — CONTRACT: buang yang lama (HANYA setelah TIDAK ada lagi yang memakainya) — langkah merusak → backup dulu
-- (mis. drop kolom lama yang digantikan) ALTER TABLE customers DROP COLUMN IF EXISTS phone_old;
```

**Rename kolom yang benar** (rename langsung = breaking): FASE1 tambah kolom baru → FASE2 *backfill* dari kolom lama → app tulis ke **dua-duanya** sementara → app baca dari yang baru → FASE4 buang yang lama. **Ganti tipe data** = pola sama (kolom baru tipe baru, *backfill* + konversi, alihkan, buang lama).

- 🙂 **Non-programmer:** seperti **ganti rak toko saat masih buka** — pasang rak baru di sebelahnya dulu (kosong), pindahkan barang pelan-pelan, baru bongkar rak lama setelah kosong. Bukan langsung bongkar rak penuh (barang berantakan + pembeli bingung).

---

## 3. Tabel keputusan: AMAN vs BERISIKO

| Operasi | Risiko | Cara aman |
|---|---|---|
| Tambah kolom *nullable* / tabel baru / index `CONCURRENTLY` | 🟢 Aman (additive) | Langsung, tetap migrasi terversion |
| Tambah `NOT NULL` / `UNIQUE` / `FK` ke tabel berisi data | 🟡 Berisiko | Expand-then-contract + `NOT VALID` lalu `VALIDATE` (Bagian 2) |
| Rename / ubah tipe kolom | 🟡 Berisiko | Kolom baru + backfill + alihkan + buang lama (Bagian 2) |
| DROP kolom / DROP tabel / TRUNCATE | 🔴 Merusak | Backup DULU + konfirmasi verbatim + pastikan 0 pemakai (`Grep` kode) |
| `UPDATE`/`DELETE` tanpa `WHERE` | 🔴 Merusak | Hampir selalu salah — Palang Rem (`risk-gate.js`) menahan |
| Index pada tabel besar | 🟡 | `CREATE INDEX CONCURRENTLY` (tak kunci tabel) |

---

## 4. ROLLBACK RUNBOOK (kalau migrasi gagal — cara balik)

Pilih jalur sesuai jenis kegagalan (dari yang paling ringan):

1. **Migrasi belum sempat jalan / gagal di tengah, struktur saja (belum hapus data):**
   - **Prisma:** buat migrasi *down* / `prisma migrate resolve --rolled-back <nama>` lalu deploy migrasi pembalik. Jangan edit file migrasi yang sudah jalan (error `P3006`) — bikin migrasi BARU yang membalik.
   - **SQL manual:** jalankan pasangan-balik tiap perintah (mis. `ALTER TABLE ... DROP COLUMN IF EXISTS phone`). Karena pakai *expand-then-contract*, FASE 1-3 aman dibalik (belum ada data dibuang).
2. **Sudah terlanjur buang data (FASE 4 / DROP):** TIDAK bisa di-`ALTER` balik — **restore dari backup/snapshot** (Supabase *Backups* / PITR / `pg_restore` schema). Inilah kenapa Aturan Emas #2 (backup dulu) wajib.
3. **App rusak tapi DB masih utuh:** balikkan **kode app** ke versi sebelumnya (`git revert` + redeploy) — karena tiap fase *backward-compatible*, DB tak perlu diapa-apakan.

> **Tulis rollback SEBELUM jalankan migrasi**, bukan saat sudah panik. 1 baris cukup: *"kalau gagal: jalankan migrasi pembalik X; kalau data hilang: restore snapshot {{tanggal}}"*.

---

## 5. Checklist pra-migrasi (centang sebelum sentuh produksi)

- [ ] Kode pemakai tabel/kolom sudah dibaca (model + query + API) — `Grep` nama tabel/kolom.
- [ ] Operasi diklasifikasi 🟢/🟡/🔴 (Bagian 3); 🟡/🔴 pakai expand-then-contract.
- [ ] Migrasi ditulis sebagai file terversion + idempotent (`IF NOT EXISTS`/`IF EXISTS`).
- [ ] Rollback tertulis (Bagian 4).
- [ ] 🔴 merusak → backup/snapshot + konfirmasi verbatim.
- [ ] Diuji di **staging** (schema mirip prod) dulu; tabel besar → backfill dibatch.
- [ ] RLS tetap utuh setelah migrasi (kalau tabel ber-RLS — cek `RLS_SETUP_PROMPT.md`).

---

## 🙂 Untuk non-programmer (ringkas)

Berkas ini = **panduan ganti bentuk lemari data tanpa menutup toko**. Aturannya: pasang yang baru dulu di sebelah (jangan bongkar yang lama langsung), pindahkan isi pelan-pelan, foto-copy dulu sebelum buang apa pun (backup), dan siapkan "tombol undo" (rollback) sebelum mulai. Mirip **pindahan rumah bertahap**: barang baru masuk dulu, barang lama keluar belakangan — bukan kosongkan rumah sekaligus lalu bingung.
