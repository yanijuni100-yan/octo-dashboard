# BUKU_PELAJARAN.md — Catatan Pelajaran (tiap bug yang lolos → jadi pengaman tetap)

> Versi 1 · CONTOH untuk project kamu · LAPIS 3 pertahanan anti-bug-berulang lintasAI.
>
> **Cara pakai:** salin berkas ini jadi `docs/BUKU_PELAJARAN.md`, hapus entri CONTOH di bawah,
> lalu isi tiap kali ada bug yang lolos. Atau cukup minta AI: *"catat pelajaran ini di Buku Pelajaran"* —
> AI akan menambah entri lewat alur "AI usul → kamu setujui" di bawah.

## Untuk apa berkas ini

👨‍💻 **Programmer:** ledger pelajaran — tiap bug yang lolos (ketahuan terlambat) dicatat lalu **diubah jadi
penjaga permanen**: tes regresi / langkah `preflight` / aturan, supaya kelas-bug yang sama otomatis
ketahuan kalau muncul lagi. Yang "mengingat" = mesin (penjaga otomatis), bukan ingatan orang.

🙂 **Non-programmer:** kayak **buku catatan insiden di maskapai** — tiap nyaris-celaka jadi **butir
checklist baru yang permanen** untuk semua penerbangan berikutnya. Itu sebabnya terbang makin aman dari
tahun ke tahun: bukan karena pilot makin pintar misterius, tapi karena buku checklist makin lengkap.
📱 Mirip fitur "Laporkan masalah" di Gojek yang jadi perbaikan tetap, bukan keluhan yang menguap.

> Target jujur: **BUKAN** "nol bug selamanya" (mustahil). Tapi: bug yang **pernah** terjadi → **tak
> terulang** (sudah ada penjaganya), dan ketahuan **lebih awal + lebih murah**.

---

## Alur WAJIB — AI mengusulkan, KAMU (owner) menyetujui, baru AI memasang

Ini aturan inti (juga ada di aturan lintasAI `§6.4` yang otomatis dibaca AI tiap sesi):

1. **AI USULKAN** — saat sebuah bug ketahuan terlambat (atau AI menemukan kelas-bug yang belum ada
   penjaganya), AI menambah entri di sini berstatus **USULAN** + mengusulkan **pengaman konkret** (tes /
   langkah pemeriksa / aturan + nama berkasnya), lewat popup pilihan.
2. **KAMU MENYETUJUI** — kamu putuskan ya / tidak / ubah. Status jadi **DISETUJUI**.
3. **AI PASANG pengaman** — AI menulis tes/pemeriksa/aturan itu, jalankan gerbang pra-rilis
   (`npx lintasai preflight`), lalu set status **TERPASANG** + isi baris **Penjaga (berkas)** dengan
   nama berkas pengaman yang **nyata ada**.

### Yang DILARANG (pembeda "catatan aman" vs "AI belajar diam-diam yang berbahaya")

- 🚨 AI mengubah aturan/perilakunya sendiri **tanpa persetujuan kamu** (belajar + ubah diri diam-diam).
  Buku ini "auto-TAWARKAN, manual-SETUJUI" — bukan AI yang berevolusi sendiri.
- 🚨 Skor-keyakinan ber-angka / "naluri" AI yang diam-diam menyetir keputusan.
- 🚨 Apa pun yang membuat kamu **tak bisa melihat** "AI lagi belajar apa". Semua pelajaran terlihat di
  berkas ini sebagai teks biasa.

---

## Format entri (supaya pengaman otomatis bisa membacanya)

Tiap entri diawali heading `### LP-NNN — <judul> · <STATUS>` lalu baris-baris berlabel. (Ganti `NNN`
dengan nomor urut: `LP-001`, `LP-002`, dst.)

```text
### LP-NNN — <judul singkat> · <USULAN|DISETUJUI|TERPASANG>

- **Tanggal:** YYYY-MM-DD
- **Apa yang bobol:** <1-2 kalimat, bahasa awam>
- **Kenapa lolos (pengaman yang absen):** <kelas-bug ini dulu tak ada yang menjaga karena ...>
- **Penjaga (berkas):** `path/berkas-penjaga`   (WAJIB diisi saat TERPASANG)
- **Jenis penjaga:** <tes regresi | langkah preflight | aturan | robot kecocokan>
- **Status:** <USULAN | DISETUJUI | TERPASANG>
- **Disetujui owner:** <ya (tanggal) | belum>
```

| Status | Arti |
|---|---|
| **USULAN** | AI baru mengusulkan; kamu belum memutuskan. Belum wajib ada penjaga. |
| **DISETUJUI** | Kamu setuju; AI sedang/akan memasang penjaga. |
| **TERPASANG** | Pengaman tetap sudah ada + gerbang pra-rilis lulus. WAJIB isi baris **Penjaga (berkas)**. |

---

## Catatan (ledger)

> Hapus entri CONTOH di bawah saat kamu mulai mengisi yang asli.

### LP-001 — (CONTOH) Harga di halaman keranjang beda dengan harga di struk · USULAN

- **Tanggal:** 2026-01-15
- **Apa yang bobol:** Diskon dihitung 2 tempat (halaman keranjang & saat bayar) dengan rumus beda → total di struk tak sama dengan yang dilihat pembeli.
- **Kenapa lolos (pengaman yang absen):** Tak ada tes yang membandingkan "total keranjang" vs "total struk" untuk pesanan yang sama. Cuma dicek manual sesekali.
- **Penjaga (berkas):** _(diisi saat sudah TERPASANG, mis. `tests/checkout-total.test.js`)_
- **Jenis penjaga:** tes regresi
- **Status:** USULAN
- **Disetujui owner:** belum

---

## Terkait

- Gerbang pra-rilis 1-perintah: `npx lintasai preflight` (jalankan sebelum menyatakan "selesai"; pakai
  `npx lintasai preflight --strict` saat mau rilis).
- Pencegah drift "ubah A lupa B": `docs/consistency-map.jsonc` (salin dari `docs/consistency-map.example.jsonc`).
- Aturan alur lengkap ada di aturan lintasAI `§6.4` + `§4.6` (otomatis dibaca AI tiap sesi).
