# ADR-004: Konsolidasi BESAR ke Node (~98%) — pensiunkan PowerShell kecuali shim Windows-asli mungil

> Menguatkan & MEMPERLUAS *appetite* ADR-003. ADR-003 mengunci **cara** (Strangler Fig) + 5 keputusan,
> lalu [`keputusan-per-elemen-node-vs-ps.md`](../plans/keputusan-per-elemen-node-vs-ps.md) mempersempit
> jadi "migrasi SEDIKIT/terpilih". ADR ini **menaikkan appetite** (keputusan owner 2026-06-22):
> konsolidasi **agresif tapi aman** ke Node sebagai bahasa utama. **Cara eksekusi:**
> [`docs/plans/migrasi-besar-node-program.md`](../plans/migrasi-besar-node-program.md).

---

## Metadata

- **Tanggal:** 2026-06-22
- **Status:** **Accepted** — owner memutuskan 2026-06-22. Dua pilihan owner: (1) cara = **"Agresif tapi aman / dituntaskan"** (program bergelombang, BUKAN big-bang, BUKAN satu-per-satu mengambang); (2) target = **"~98% Node, sisakan 1 shim PowerShell mungil"** (untuk hal Windows-asli seperti popup). Tetap **owner-gated per gelombang**: commit/rilis = keputusan owner.
- **Author:** Tim lintasAI (rancangan AI-assisted, terverifikasi-di-kit; efek lapangan belum diuji)
- **Reviewer:** owner

---

## Context

- **ADR-003** mengunci *cara* migrasi (Strangler Fig — bungkus pelan, tak ada hari-H pecah) + 5 keputusan. Lalu analisis per-elemen mempersempit *appetite* jadi "mayoritas tetap PowerShell" atas dasar **risiko byte-exact (C4) + kemampuan Windows-asli (C2) + staff-tak-bisa-benerin (C3)**.
- **Owner menaikkan appetite secara SADAR (2026-06-22):** seluruh stack tim = JavaScript (Next.js/React), Node **dijamin ada** di tiap mesin, dan **satu bahasa = perawatan lebih mudah jangka panjang** (lebih sedikit "ganti-otak", bus factor lebih sehat). Owner memilih **konsolidasi besar** — tapi **menolak big-bang** (sadar bahaya ke staff non-programmer yang tak bisa memperbaiki regresi sendiri).
- **Fakta teknis dari analisis sebelumnya TETAP berlaku** (tidak dibatalkan): Node tak bisa NATIVE 2 hal Windows — (a) popup jendela klik (WinForms `lib/popup-helpers.ps1:51,204`), (b) strip MOTW "kunci dari-internet" (`Unblock-File`). Yang BERUBAH = **appetite** (owner terima ongkos rewrite + degradasi kecil demi 1-bahasa), **bukan** fakta teknis.
- **Verifikasi pendukung (sesi 2026-06-22):** Node sanggup ~semua kebutuhan kit (kripto/git/GPG = panggil alat luar, sama seperti PS); 2 gap Windows-asli bisa dihindari (tanya-teks + npm-only) → "Node ~semua" memang feasible. Detail di [program](../plans/migrasi-besar-node-program.md).

---

## Decision

> **PEMBARUAN 06-22 (sore, keputusan owner berikutnya — MENGUBAH #1(a) & #4):** popup jendela klik **DIBUANG JUGA** dari pemasang versi **Node** — pemasang Node kini **otomatis penuh**, pilihan dilakukan lewat **AI di chat** (bukan jendela Windows). WinForms `popup-helpers.ps1` **BUKAN shim permanen**: ia hanya bertahan untuk **alat PowerShell lama** sampai Gelombang 7, lalu **pensiun bareng PowerShell**. Akibatnya plafon Node naik mendekati **~99%**; sisa shim PowerShell permanen tinggal **MOTW/`Unblock-File`** saja. Bukti kode: `lib/popup-shim.mjs` (popup GUI dibuang dari Node) + cutover Gelombang 4 (`init` → pemasang Node `setup-pola-b.mjs`). Detail: [`migrasi-besar-node-program.md`](../plans/migrasi-besar-node-program.md). Teks #1(a)/#4 di bawah dipertahankan sebagai rekam keputusan SAAT ITU (jangan dibaca sebagai keadaan akhir).

### 1. Target end-state: **~98% Node**
PowerShell **dipensiunkan untuk SEMUA yang bisa pindah dengan aman** (robot, parser, kripto, orkestrator, tes→`node:test`, lint→ESLint). **DISISAKAN HANYA shim mungil** untuk hal Windows-asli yang genuinely perlu:
- (a) **popup jendela klik** — bagian WinForms `popup-helpers.ps1` (dipakai hanya di install MANUAL; alur AI/Claude Code sudah otomatis pakai teks);
- (b) **`Unblock-File`/MOTW** — strip "kunci dari-internet". **⚠️ DISUPERSEDE [ADR-005](ADR-005-jalur-tim-100-persen-node.md) (2026-06-25):** MOTW ternyata BISA Node murni (`fs.rmSync('<file>:Zone.Identifier')`, terbukti uji) → **bukan** shim PS permanen lagi. PowerShell kini cuma cadangan.

Shim ini dipakai HANYA saat 2 hal itu diperlukan. Ini batas "~98%, bukan 100%" yang owner pilih (pertahankan UX klik di install manual).

### 2. Cara: **agresif-tapi-aman (committed program)** — BUKAN big-bang, BUKAN ad-hoc
Dikerjakan dalam **gelombang besar per-subsistem**. Tiap subsistem ikut **pola wajib** (tulis Node → uji-banding output-identik vs PS → benchmark → **berdampingan dengan fallback PS hidup** → baru pensiun PS). Owner-gated tiap gelombang. **Tujuan akhir SAMA dengan big-bang (Node ~semua), tanpa risiko mem-brick** pemasangan staff yang tak bisa mereka perbaiki sendiri. Bedanya dengan laju lama = **komitmen + rencana selesai**, bukan migrasi-saat-sempat.

### 3. SYARAT KERAS — bahasa SEMUA output (Node DAN PowerShell)
**SEMUA yang muncul ke user saat memakai lintasAI di Claude Code** — popup, prompt, narasi antar-langkah, pesan error, status, **APA PUN outputnya** — WAJIB bahasa **junior-programmer + non-programmer** yang mudah dimengerti (§2.1). Berlaku untuk:
- kode **Node baru** (port), DAN
- **shim PowerShell** yang disisakan (popup/MOTW), DAN
- output **PowerShell apa pun** yang masih hidup selama transisi.

Tiap port WAJIB **menjaga/memperbaiki** keramahan-awam output-nya — DILARANG turun ke Inggris/jargon mentah. Ini **gate per-port** (lihat program §"Gate bahasa"). Diusulkan robot pemeriksa-output deterministik (scan string user-facing untuk pola Inggris/jargon) dibangun lebih awal.

### 4. Distribusi npm-primary tetap; popup shim dipertahankan
Sesuai pilihan ~98% (bukan 100%). Tidak menutup jalur npm-only untuk MOTW.

### 5. MEMPERLUAS (bukan membatalkan) ADR-003 + keputusan-per-elemen
- *Cara* Strangler Fig + 5 keputusan ADR-003 **tetap berlaku**.
- *Appetite* "SEDIKIT/mostly-keep" di keputusan-per-elemen **DIGANTI** appetite ADR ini.
- **Fakta teknis** di kedua dokumen tetap jadi rujukan (justru itu alasan menyisakan shim ~2%).

---

## Alternatif yang Ditolak

- **Big-bang sekaligus** (tulis ulang serentak + pensiun PS segera): ditolak — kalau pemasang/penghapus baru ada bug, staff non-programmer **mentok tanpa cadangan** (blast radius maksimum + tak bisa mereka perbaiki). Bertentangan tie-breaker §0 #2 (benar > cepat) + profil tim.
- **100% Node (0 PowerShell):** ditolak owner (pilih ~98%) — pertahankan popup jendela klik untuk install manual. Tetap ~1-bahasa.
- **Status-quo "mostly keep PowerShell":** ditolak — tak mencapai tujuan 1-bahasa + alignment stack jangka panjang.
- **Laju ad-hoc satu-per-satu:** ditolak — lambat + tanpa komitmen selesai (keluhan owner yang memicu ADR ini).

---

## Konsekuensi

### Pros
- End-state ~1-bahasa → perawatan lebih mudah + bus factor lebih sehat + searah stack tim (semua JS).
- Tiap gelombang reversibel (fallback PS hidup sampai Node terbukti) → tak ada hari-H pecah.
- Output makin ramah-awam (gate bahasa diperketat ke Node DAN PS).

### Cons
- **Ongkos besar:** port ~26 berkas + ~647 tes Pester → `node:test` (berminggu, multi-sesi, owner-gated per gelombang).
- Periode "dukung-keduanya" per-subsistem menambah beban perawatan sementara.
- 1 shim PowerShell kecil tetap dirawat (itu sebabnya bukan "100%"). **Pembaruan 06-22 (sore):** tinggal **MOTW/`Unblock-File`** yang permanen — popup klik sudah dibuang dari Node (lihat catatan di "## Decision").

### Risk
- **Drift byte-exact kripto** (manifest sign/verify). Mitigasi: gate byte-identik + uji SENDIRIAN dulu (§6.3 #2). K-1: JANGAN sort kunci JSON manifest.
- **Output kepotong** (`process.exit()` memutus stdout). Mitigasi: `process.exitCode=…; stdout.write(); return`.
- **Jalur pasang patah** saat orkestrator dipindah. Mitigasi: fallback PS DEFAULT sampai uji-jalan Node lulus berkali-kali.
- **REGRESI BAHASA output** (port baru keluar Inggris/jargon). Mitigasi: gate bahasa non-programmer per-port (§3) + usul robot pemeriksa-output.

---

## Catatan kejujuran lingkungan

Rancangan ini **terverifikasi-di-kit**. Efek nyata ke staff di mesin lain **BELUM terverifikasi-di-lapangan** sampai diuji-jalan + staff mengonfirmasi (§4.6 "terverifikasi-di-kit ≠ terverifikasi-di-lingkungan-user"). Status "selesai" per gelombang hanya setelah Gerbang Pra-Rilis §4.6 lulus.
