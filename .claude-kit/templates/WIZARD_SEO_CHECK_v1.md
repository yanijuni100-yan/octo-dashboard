# WIZARD SEO-CHECK — naskah AI audit SEO dasar (paham framework, bukan robot regex)

> Versi 1 · 2026-06-26 · pendamping §10 (Frontend/UX/SEO) + `docs/perf-budget.md` (sisi performa)

## Untuk siapa & kenapa

Ini **naskah untuk AI**. Tujuannya: saat owner minta *"cek SEO"*, AI **mengaudit SEO dasar dengan memahami framework yang dipakai** (Next.js App Router / Pages Router / Astro / HTML polos / dll) — lalu melapor temuan + saran.

> 🚨 **Kenapa naskah AI, BUKAN robot regex** (keputusan desain, sejalan #3 pencegah-drift): SEO ditulis beda di tiap framework (Next App Router pakai `export const metadata` di `layout`/`page`; Pages Router pakai `<Head>`; HTML polos pakai `<title>`). Robot regex deterministik **rawan alarm palsu** — mis. bilang "halaman X tak punya title" padahal title-nya diwarisi dari `layout`. AI yang paham konteks framework jauh lebih akurat. (Sisi yang BISA diukur deterministik — ukuran halaman — sudah ditangani robot `perf-budget`.)

**Pemicu (frasa owner):** *"cek SEO"* / *"audit SEO"* / *"cek SEO halaman X"* / *"SEO halaman ini sudah benar?"*.

## Aturan main untuk AI (WAJIB)

1. **Deteksi framework + cara metadata-nya DULU** — baca `package.json` (next/astro/dll) + struktur folder (`app/` vs `pages/` vs `public/*.html`). Audit sesuai cara framework itu menulis SEO, jangan asumsi 1 pola.
2. **Mode aman cuma-baca** — audit = baca + lapor; jangan ubah berkas tanpa owner setuju per-item.
3. **Bukti `berkas:baris`** tiap temuan (§8.2). "Halaman X belum punya meta description" WAJIB tunjuk berkasnya. Kalau metadata diwarisi dari `layout`/template → itu BUKAN temuan (cegah alarm palsu, §8.2 Aturan 3b daftar "jangan asal di-flag").
4. **Bahasa non-programmer** + tingkat **RAPIKAN/PENTING** (SEO jarang GENTING). Sajikan bertahap (§4.7) kalau temuan banyak.

## Yang diaudit (sesuaikan ke framework)

| Aspek SEO (§10) | Cek apa | Catatan lintas-framework |
|---|---|---|
| **Title unik** | tiap halaman publik punya `<title>` / `metadata.title` yang unik + deskriptif | Next App: `export const metadata`/`generateMetadata` di `page`/`layout`; Pages: `<Head><title>`; cek warisan dari layout. |
| **Meta description** | ada + ringkas + relevan per halaman | idem. Kosong/duplikat = RAPIKAN. |
| **Preview share (OG/Twitter)** | halaman shareable punya `og:title`/`og:image`/`twitter:card` | Next: `metadata.openGraph`/`twitter`. |
| **Heading semantik** | 1 judul utama unik per halaman + sub-heading berurut (bukan dipilih dari ukuran font) | cek `h1` tunggal per halaman. |
| **URL slug** | pendek, huruf-kecil, dash, deskriptif; URL publik tak diubah tanpa redirect 301 | |
| **`lang` + sitemap/robots** | `<html lang>` diisi; ada `sitemap`/`robots` (kalau relevan) | Next: `app/sitemap.ts`/`robots.ts`. |
| **Gambar** | `alt` ada; ukuran wajar (lihat juga `perf-budget`) | |

## Langkah

1. **Deteksi framework** + daftar halaman publik (mode cuma-baca).
2. **Audit per aspek** (tabel di atas), sesuai cara framework menulis metadata. Pisahkan "benar-benar hilang" dari "diwarisi dari layout/template".
3. **Lapor temuan** diurut RAPIKAN→PENTING, tiap satu `berkas:baris` + saran konkret + bahasa awam.
4. **Tawarkan perbaikan** per-item (owner setuju dulu) — jangan ubah massal.
5. **Sisi performa**: ingatkan jalankan `npx lintasai perf-budget` (setelah `npm run build`) untuk cek ukuran halaman (`docs/perf-budget.md`).

## Catatan

- "Nol temuan itu sah" (§8.2 Aturan 3b) — kalau SEO sudah benar, lapor "sudah benar, sudah dicek A/B/C", jangan mengarang temuan.
- Audit = READ-ONLY; perubahan = persetujuan owner per-item.
- Untuk strategi SEO lanjutan (backlink, kelola banyak domain), owner bisa bikin skill kustom (§4.9, `docs/SKILLS_LOCAL.md`).
