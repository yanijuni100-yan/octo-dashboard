# ADR-003: Migrasi bertahap PowerShell → Node (Strangler Fig) untuk lintasAI

> Mengunci 5 keputusan owner yang menjadi prasyarat rencana migrasi bertahap.
> Rencana eksekusi langkah-demi-langkah ada di `docs/plans/migrasi-powershell-ke-node.md`.

---

## Metadata

- **Tanggal:** 2026-06-21
- **Status:** **Accepted** — owner menyetujui 5 keputusan (a–e) pada **2026-06-21**. Eksekusi boleh mulai dari Fase 0 (pondasi isolasi). Tetap **owner-gated per fase**: commit/rilis = keputusan owner.
- **Author:** Tim lintasAI (rancangan AI-assisted, terverifikasi-di-kit; efek lapangan belum diuji)
- **Reviewer:** owner — commit/rilis tetap owner-gated

---

## Context

- **Problem statement:** ~18 ribu baris PowerShell (64 berkas `.ps1`) + ~544 baris Node membuat lintasAI lambat di jalur panas (hook spawn PS 5.1 ~389 ms startup, terukur di ADR-002) dan terkunci ke Windows. Owner sudah memutuskan **migrasi ke Node, bertahap, pwsh7 boleh dipasang**. Pertanyaan yang belum terkunci: format pengganti `.psd1`, nasib popup WinForms, apakah Node diwajibkan, runner tes, dan peran pwsh7. Tanpa keputusan ini terkunci tertulis, eksekusi lintas-sesi bisa melenceng (bus factor = 1).
- **Constraints:**
  - Mesin owner: **Windows PowerShell 5.1 saja**; **Node v24 ada**; **pwsh7 BELUM terpasang** (owner OK pasang). (FAKTA TERVERIFIKASI sesi inventaris.)
  - Tim pemakai = **staff non-programmer** — tak menyentuh kode internal kit; mereka hanya jalankan perintah (`kit setup`, `kit doctor`) + isi berkas config.
  - Jalur pasang staff **tidak boleh patah** di tengah transisi (tie-breaker §0 #2 benar > cepat).
  - Bahasa non-programmer tetap menang (tie-breaker §0 #3).
- **Asumsi (jujur — sebagian belum diverifikasi ulang sesi ini):**
  - Port Node unicode-safety ~48× lebih cepat & version-detect ~5× — dari pilot sebelumnya (FAKTA TERVERIFIKASI di pilot, **tidak** di-benchmark ulang sesi ini).
  - ECC (folder `affan-ecc` di home user, di luar repo kit) sudah migrasi PS/shell→Node dan jadi cetak-biru — dari laporan dossier, **tidak** diaudit baris-per-baris sesi ini.
  - 2 penghalang benar-benar terikat Windows: popup WinForms (`lib/popup-helpers.ps1:51,204`) + `Unblock-File` MOTW (`lib/git-helpers.ps1`). (Lokasi WinForms TERVERIFIKASI; MOTW dari dossier LIN-2.)

---

## Decision

> **CATATAN (2026-06-22): appetite DIPERLUAS LAGI oleh [ADR-004](ADR-004-konsolidasi-besar-ke-node.md)** — owner memilih **konsolidasi ~98% ke Node** (agresif-tapi-aman, bergelombang). "LINGKUP DIPERSEMPIT" di bawah = appetite ANTARA (sudah diganti); *cara* Strangler Fig **tetap**. Orkestrator + kripto **KINI dimigrasi** (bergelombang, fallback hidup), HANYA **popup-GUI + MOTW** yang tetap PowerShell (~2%). Eksekusi: [`migrasi-besar-node-program.md`](../plans/migrasi-besar-node-program.md).
>
> **LINGKUP DIPERSEMPIT (2026-06-21)** — analisis per-elemen terhadap profil tim ([`keputusan-per-elemen-node-vs-ps.md`](../plans/keputusan-per-elemen-node-vs-ps.md)) menyimpulkan: yang jujur layak migrasi = **SEDIKIT/TERPILIH** (≈9 robot logika-murni grup [A]), bukan mayoritas. **Orkestrator besar + kripto byte-exact + popup GUI = TETAP PowerShell, mungkin PERMANEN** (Windows-lock C2 + security C4 + staff-reliability C3 menahannya; lintas-OS C5 lemah karena kit tak di-deploy Linux). ADR ini tetap berlaku untuk *cara* (Strangler Fig) + grup [A]; JANGAN jadikan dasar memport orkestrator/kripto/GUI tanpa pemicu nyata.

Migrasi memakai pola **Strangler Fig** (bungkus pelan-pelan, tak ada hari-H pecah). 5 keputusan terkunci:

### a. Format pengganti `.psd1` → **dipecah per-jenis** (diperhalus dari kritikus kelengkapan, 2026-06-21)

**Tidak semua `.psd1` sama** — strategi per-jenis:
- `lib/kit-files.psd1` = **SSOT internal kit** (bukan berkas isian staff) → **JSON polos** (komentar non-programmer tak relevan; jalur termurah — hapus pembaca `kit.ps1:235` + `setup-pola-b.ps1:478`).
- `project.lintas.psd1` + `consistency-map.psd1` = **staff-facing** → **JSON5/JSONC** (komentar selamat).
- `PSScriptAnalyzerSettings.psd1` = statis PS-only → **tak dimigrasi**.

Untuk yang staff-facing: pertahankan komentar penjelas non-programmer (`templates/project.lintas.example.psd1` = 29 baris komentar dari 70 = 41%, TERVERIFIKASI) sambil bisa dibaca Node. Konversi dua-arah `.psd1`↔`.jsonc` + periode **dukung-keduanya** (pembaca coba `.jsonc` dulu, fallback `.psd1` lewat shim pwsh). Pencabutan `.psd1` final = naik versi **MAYOR** (semver §11), diumumkan dulu.

Berkas config staff WAJIB tetap **data, bukan kode** (§8.1 #1: file = data). → **DITOLAK** JS-module (`module.exports`).

### b. Pengganti popup WinForms → **hibrida: prompt CLI Node dulu, shim pwsh HANYA untuk window klik**

Pertanyaan teks (nama, ya/tidak) → Node `readline` (tanpa dependency baru). Titik yang memang butuh window mouse-friendly staff → 1 shim pwsh memanggil `Show-Lintas*Popup` yang sudah teruji. `popup-helpers.ps1` **sudah** punya jalur non-GUI bawaan (`Read-Host` + `Test-LintasInteractiveInput`, `:103-161`, TERVERIFIKASI) → migrasi = naikkan fallback jadi setara, bukan tulis dari nol.

> **CATATAN (06-22, DIGANTI [ADR-004](ADR-004-konsolidasi-besar-ke-node.md)):** rencana **hibrida** ini TIDAK jadi dipakai. Di jalur Node, **popup jendela klik DAN tanya-teks `readline` DIBUANG**; pemasang Node berjalan **otomatis-penuh** (semua "pertanyaan" dijawab nilai paling aman), lalu pilihan sebenarnya dipandu **AI lewat chat**. Bukti kode: `lib/popup-shim.mjs:4-13` (popup GUI dibuang + jembatan Node→PS dihapus) + `:64-86` (5 fungsi "tanya" selalu balas-aman). WinForms `popup-helpers.ps1` hanya hidup untuk alat `.ps1` lama sampai Gelombang 7, lalu pensiun bareng PowerShell.

### c. Jalur pasang → **wajibkan Node, Node pintu utama; jalur PS-minimal = cadangan terdokumentasi**

`package.json` sudah `engines node>=18` + `bin lintasai.js`. Node jadi bootstrap; PS dipanggil di belakang layar lewat shim. Jalur zip-extract + `setup-pola-b.ps1` langsung disimpan sebagai fallback untuk mesin terkunci tanpa npm. **DITOLAK** jalur clone-git langsung (bawa `.git/`).

### d. Runner tes → **`node:test` bawaan; Pester hidup berdampingan selama transisi**

Tanpa dependency baru (sejiwa Pester yang juga in-box). Aturan emas: tiap berkas yang dipindah ke Node membawa tesnya ke `node:test`; **assert tak boleh turun**. CI jalankan dua gerbang paralel: `pester-tests` (windows-latest, untuk `.ps1` sisa) + `node-test` (untuk `.js` baru). Keduanya wajib hijau.

### e. Peran pwsh7 → **jembatan opsional + rumah popup, BUKAN fondasi**

Node = otak/dispatcher. pwsh7 dipakai HANYA saat: (i) window popup native, (ii) `Unblock-File` MOTW, (iii) baca `.psd1` lama saat masih dukung-keduanya. Ganti `spawn("powershell.exe")` (saat ini hard-Windows di `bin/lintasai.js:175`, TERVERIFIKASI) jadi deteksi `pwsh` dulu → fallback `powershell.exe`.

> **CATATAN (06-22, DIGANTI [ADR-004](ADR-004-konsolidasi-besar-ke-node.md)):** poin **(i) window popup native = TIDAK berlaku lagi** di jalur Node — popup GUI sudah dibuang dari Node (otomatis-penuh, pilihan via chat). pwsh7 di jalur Node tinggal untuk **(ii) MOTW/`Unblock-File`** + alat `.ps1` yang masih hidup + **(iii) baca `.psd1` lama** saat dukung-keduanya.

---

## Alternatif yang Ditolak

- **a. JSON polos + AJV (tanpa komentar):** ditolak — buang petunjuk non-programmer inline (bertentangan tie-breaker §0 #3).
- **a. JS-module config:** ditolak — file config jadi kode yang bisa dieksekusi (risiko §8.1).
- **b. Buang popup window, full CLI Node:** ditolak sebagai default Windows — turun UX staff non-programmer (boleh sebagai mode fallback yang sudah ada).
- **c. Jalur clone-git langsung:** ditolak — bawa `.git/`, butuh `Remove-GitMetadata`, rapuh.
- **d. Vitest/Jest:** ditolak — dependency + permukaan rantai-suplai lebih besar untuk tool yang dipakai non-programmer; belum ada kebutuhan mocking canggih.
- **e. pwsh7 sebagai fondasi / full-Node tanpa pwsh sama sekali:** ditolak — terlalu agresif untuk tim non-programmer Windows-first; korbankan window popup + butuh solusi MOTW non-PS.

---

## Konsekuensi

### Pros
- Tak ada hari-H pecah: tiap langkah reversible (fallback `.ps1` tetap ada sampai `.js` terbukti).
- Jalur panas (hook) lebih cepat; sebagian besar logika jadi lintas-OS.
- Staff non-programmer tak merasakan perubahan — perintah & berkas config tetap sama.

### Cons
- Periode "dukung-keduanya" menambah beban perawatan sementara (2 jalur hidup).
- pwsh7 wajib dipasang owner untuk shim popup/MOTW/`.psd1`-lama.
- Dua gerbang CI (Pester + Node) = waktu CI lebih lama selama transisi.

### Risk
- **Output kepotong di port Node** (`process.exit()` memutus stdout sebelum flush — sudah kena di pilot risk-gate). Mitigasi: pola `process.exitCode = …; stdout.write(); return`.
- **Drift output PS-vs-Node** pada robot. Mitigasi: uji-banding output-identik WAJIB per robot sebelum pensiun PS.
- **Jalur pasang patah** saat dispatcher dua-jalur salah pilih. Mitigasi: fallback PS1 jadi default sampai `.js` lulus uji-banding + dua gerbang CI hijau.

---

## Catatan kejujuran lingkungan

Rancangan ini **terverifikasi-di-kit** (berkas asli dibaca). Efek nyata ke staff di mesin lain **BELUM terverifikasi-di-lapangan** sampai diuji-jalan. Status "selesai" per fase hanya boleh diklaim setelah Gerbang Pra-Rilis §4.6 lulus + (untuk efek runtime di mesin staff) staff mengonfirmasi melihatnya bekerja (§4.6 "terverifikasi-di-kit ≠ terverifikasi-di-lingkungan-user").
