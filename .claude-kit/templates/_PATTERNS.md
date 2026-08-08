# docs/_PATTERNS.md - Standar Dokumentasi Tim Profesional

> Versi 1 · 2026-05-31 · generic untuk semua proyek tim
> File ini SISTEM (prefix `_`) - auto-disertakan saat setup. Jangan dihapus, edit hati-hati.

## Tujuan
File ini = **rujukan tunggal (konvensi)** untuk cara tim ini menulis & me-maintain dokumentasi `.md` di folder `docs/`. Berlaku untuk SEMUA proyek (Next.js, Vue, Python, Go, dll). AI baca file ini di awal kerja docs untuk patuh ke konvensi tim, bukan pakai gaya improvisasi. (Ditegakkan oleh disiplin AI/manusia — hooks/CI lint opsional & default mati.)

Untuk **format konkret per file `.md`** lihat `_EXAMPLE.md` (1 file contoh siap-pakai).

---

## 1. Kapan WAJIB ada file `.md` pendamping?

File kode dengan kondisi DI BAWAH ini WAJIB punya `docs/<basename>.md`:

| Kategori | Pattern (case-insensitive, glob) |
|---|---|
| **Auth** | `auth.*`, `*-auth.*`, `session.*`, `login.*`, `oauth.*`, `jwt.*` |
| **DB / Persistence** | `db.*`, `prisma.*`, `repository.*`, `schema.*`, `models/*` |
| **Security / Crypto** | `crypto.*`, `encrypt.*`, `permissions.*`, `*-guard.*`, `rate-limit.*` |
| **API / Router root** | `routes.*`, `controllers/*`, `handlers/*`, `api/*/route.*` |
| **Entry points** | `main.*`, `index.*`, `app.*`, `server.*`, `layout.*` |
| **Feature domain** | file kode di folder `features/<nama>/` atau `modules/<nama>/` dengan >1 fungsi publik |

**Tidak wajib** (boleh ada `.md` kalau mau, tapi tidak required):
- File util kecil 1-fungsi (`format-date.ts`, `pluralize.ts`).
- File component UI sederhana tanpa state kompleks.
- Test file (`*.test.ts`, `*.spec.ts`).
- Type-only file (`types.ts`, `*.d.ts`).

---

## 2. Lokasi & Naming

**Default**: semua `.md` flat di `docs/` (1 level).
- File pendamping: nama persis = basename file kode → `src/lib/auth.ts` → `docs/auth.md`.
- File sistem (kit-managed): prefix `_` → `_PATTERNS.md`, `_EXAMPLE.md`.
- File peta proyek (user-managed): `architecture.md` + `glossary.md`.
- Registry TOC (AI-managed): `architecture_auto.md`.

**Scaling rule (kalau `docs/` > 30 file)**: pakai subfolder grouping.
```
docs/
├── architecture.md          (peta makro proyek, user-edit)
├── architecture_auto.md     (registry TOC, AI auto-maintain)
├── glossary.md              (kamus istilah)
├── _PATTERNS.md             (file ini)
├── _EXAMPLE.md              (contoh format `.md` pendamping)
├── security/
│   ├── auth.md
│   ├── encryption.md
│   └── rate-limit.md
├── api/
│   ├── routes.md
│   └── handlers.md
└── features/
    ├── invoices.md
    └── reports.md
```
- AI baca `architecture_auto.md` dulu (lihat aturan READ-MINIMAL di seksi 4), tahu lokasi subfolder, baru cherry-pick file relevan.

---

## 3. Format wajib tiap file `.md` pendamping

```markdown
# <basename>.md - <deskripsi singkat 1 baris>

> Versi 1 · <YYYY-MM-DD> · auto-generated (atau "user-written")

## Tujuan
Untuk siapa & masalah apa yang diselesaikan. 1-3 kalimat. Bahasa Indonesia, junior-friendly.

## Cara Pakai
Contoh pemanggilan singkat (code block kalau ada). Sebut "Dipakai di `<file>:<line>`" kalau diketahui.

## Input / Output
- Input: parameter, tipe data.
- Output: return value, side effects, error yang bisa di-throw.

## Dependensi
- Library: import signifikan.
- Env: env var yang dibaca.
- File terkait: file lain yang depend / dipakai.

## Catatan
- Edge case dari source code.
- Keputusan penting / non-obvious behavior.
- Gotcha umum.
- Source code: `<path>:<line>`.

## 🙂 Untuk non-programmer (bahasa sehari-hari)
1 blok ringkas "berkas ini apa + gunanya apa" TANPA jargon + 1 analogi (sehari-hari + tools digital populer). Supaya owner/staff awam paham fungsi berkas tanpa baca kode.
Contoh: "Berkas ini = satpam yang cek tiket sebelum kamu masuk. Kayak petugas pintu mall yang periksa karcis parkir dulu sebelum boleh keluar."
```

> **WAJIB 2 versi (v1.43.0):** section di atas berisi 👨‍💻 bagian teknis (Tujuan/Cara Pakai/Input-Output/Dependensi/Catatan) UNTUK programmer **DAN** blok 🙂 **Untuk non-programmer** UNTUK owner/staff awam. Keduanya ada di 1 berkas. Selaras `CLAUDE_universal_v1.md` §7.8 (dokumen 2-POV) + §4.1. Berkas ini = **sumber kebenaran format** yang dirujuk `JALANKAN_KIT.md` Bagian 6 step 22.

**Aturan format:**
- Max ~80 baris per file (kalau lebih, pecah ke `<basename>-<subtopic>.md`).
- Bahasa Indonesia, definisikan jargon di pemunculan pertama.
- Jangan karang - `[TBD: <pertanyaan>]` kalau gak yakin.
- Selalu sertakan source path + line di "Catatan".
- Tidak boleh ada secret/credential plain di docs (mask: `DATABASE_URL=postgresql://***`).

Contoh konkret 1 file `.md` siap-pakai ada di `_EXAMPLE.md`.

---

## 4. Aturan AI behavior (4 aturan inti dari CLAUDE_universal_v1.md seksi 7)

**4.1 AUTO-SYNC** (seksi 7.1)
- Tiap edit code yang sudah ada `docs/<basename>.md` → AI WAJIB update `.md` di sesi yang sama (kalau perubahan substansial: signature publik, behavior, dependency, edge case baru).
- Update `architecture_auto.md` kalau ada `.md` baru/rename/hapus.

**4.2 LAZY-GENERATE** (seksi 7.2)
- Tiap buat/edit file kode CRITICAL (sesuai pattern di seksi 1 di atas) yang BELUM ada `.md` → AI **sugest** generate per-file, **tanya user dulu**. JANGAN bulk-auto.
- Default: per-file approval. Bulk-generate manual = paste `PROJECT_LIFECYCLE_PROMPT_v1.md` (Stage 2 (Bikin Catatan Proyek): Bootstrap Docs) (on-demand tool).

**4.3 READ-MINIMAL** (seksi 7.3)
- Saat AI menerima task, baca `docs/architecture.md` DULU (peta makro), lalu `docs/architecture_auto.md` (registry TOC), baru cherry-pick `.md` relevan task.
- LARANGAN: jangan baca semua `docs/*.md` di awal sesi (boros token kalau folder besar).

**4.4 ARCHITECTURE REGISTRY** (seksi 7.4)
- `docs/architecture.md` = peta makro proyek, user-edited.
- `docs/architecture_auto.md` = registry TOC semua `.md` pendamping, AI auto-maintain (1 baris per file).
- Pisah supaya user-edit tidak konflik dengan AI auto-maintain.

---

## 5. Workflow update docs

**Saat AI edit code:**
1. Cek apakah ada `docs/<basename>.md` → kalau ada DAN perubahan substansial → update.
2. Commit code + `.md` bareng-bareng (1 commit boleh include keduanya).
3. Update `docs/architecture_auto.md` kalau ada perubahan struktur (file baru, rename, hapus).

**Saat AI buat file kode CRITICAL baru:**
1. Tanya user: "File `<basename>` kena pattern CRITICAL + belum ada `docs/<basename>.md` - generate sekarang? (y/n)"
2. Kalau "y" → generate pakai format seksi 3.
3. Kalau "n" → opsional catat di `architecture_auto.md` section "Pending docs".

**Saat user paste `PROJECT_LIFECYCLE_PROMPT_v1.md` (Stage 3 (Perbarui Catatan): Update Docs):**
- Bulk audit semua `.md` vs git log → lapor mana yang outdated → user pilih per-file refresh.

**Saat user paste `PROJECT_LIFECYCLE_PROMPT_v1.md` (Stage 2 (Bikin Catatan Proyek): Bootstrap Docs):**
- On-demand bulk-generate untuk proyek lama yang banyak file CRITICAL tanpa `.md`. Interactive - wajib konfirmasi sebelum write.

---

## 6. Anti-pattern (HINDARI)

- ❌ Bulk auto-generate banyak `.md` sekaligus tanpa per-file approval (kecuali user paste BOOTSTRAP prompt).
- ❌ Baca semua `docs/*.md` di awal sesi tanpa filter.
- ❌ Overwrite `.md` existing tanpa user explicit minta.
- ❌ Skip update `architecture_auto.md` saat tambah/hapus `.md`.
- ❌ Karang isi `.md` tanpa baca source code (selalu traceable ke `<path>:<line>`).
- ❌ Tulis `.md` dalam Bahasa Inggris (kecuali override khusus proyek di `AGENTS.md`).
- ❌ Embed secret/credential plain di `.md` (selalu mask).

---

## 7. Opt-in hooks (opsional, per proyek)

Aktifkan di `AGENTS.md` proyek section "Override khusus proyek":

- **Pre-commit hook** - git hook yang block commit kalau edit `src/lib/*.ts` tanpa edit `docs/*.md` pendamping. Tool: husky, pre-commit, lefthook. Tambah di `package.json` scripts.
- **CI lint** - workflow GitHub Actions yang fail kalau `architecture_auto.md` outdated vs `docs/` actual files.
- **Auto-versioning header** - script `docs:bump` yang naikkan `Versi X · <tanggal>` di header `.md` saat update.

Default kit: **tidak aktif** - friction setup tinggi untuk solo/junior. Aktifkan kalau tim sudah disiplin.

---

## 8. Riwayat update aturan
| Versi | Tanggal | Ringkasan |
|---|---|---|
| 1 | 2026-05-31 | Inisialisasi standar dokumentasi tim. |
