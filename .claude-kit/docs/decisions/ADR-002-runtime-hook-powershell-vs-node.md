# ADR-002: Runtime untuk hook/robot lintasAI — PowerShell 5.1 (opt-in), tinjau pwsh7→Node bila default-nyala

---

## Metadata

- **Tanggal:** 2026-06-20
- **Status:** Accepted — lalu keputusan #1 **di-override owner** (Node.js). Lihat **Addendum** di bawah. Runtime final = **Node.js** (`lib/risk-gate.js`).
- **Author:** Tim lintasAI (analisa AI-assisted + benchmark, keputusan didelegasikan owner)
- **Reviewer:** owner — commit/rilis tetap owner-gated

---

## Context

**Problem statement:** Palang Rem Otomatis (`lib/risk-gate.ps1`, v1.54.0) dibangun sebagai hook
`PreToolUse` Claude Code memakai **PowerShell 5.1** (bawaan Windows). Owner menantang dengan benar:
"Windows kan bisa pasang Node.js — RDP-ku sudah ada Node. Baiknya pakai apa?" Pertanyaan ini berlaku
untuk **semua** hook/robot kit, bukan cuma palang rem.

**Penyelidikan (ukur, jangan berasumsi — §6.3 #4):** dijalankan benchmark nyata di RDP owner, 40
panggilan/skenario, input netral `npm install` (menjalankan jalur regex penuh = ukuran terberat/adil):

| Mesin | Waktu nyala (kosong) | Hook penuh (per panggilan) |
|---|---|---|
| **PowerShell 5.1** (terpakai sekarang) | ~389 ms | **~509 ms** |
| **Node.js** (port setara) | ~60 ms | **~66 ms** |
| PowerShell 7 (pwsh) | belum terpasang di RDP | tak terukur |

**Temuan kunci:** Node **~7,7× lebih cepat** (~443 ms lebih hemat/panggilan). Biaya dominan =
**startup per-spawn** (PS 5.1 ~389 ms); logika regex hanya ~120 ms (PS) / ~6 ms (Node). Model hook =
spawn-proses-baru tiap panggilan, jadi startup tak bisa "dihangatkan" mudah di PowerShell.

**Catatan jujur dari tes (menyeimbangkan):**
- Port Node cepat-buatan punya **gotcha "output kepotong"**: `process.exit()` memutus tulisan stdout
  sebelum ter-flush pada pipa (sanity "ask" Node keluar kosong). PowerShell (`[Console]::Out.Write`)
  sinkron → bebas masalah ini. Artinya pindah ke Node **bukan "tinggal terjemahkan"** — ada jebakan
  sendiri yang wajib ditangani. (Timing benchmark tetap valid: jalur ukur = allow-path, tak kena flush.)
- Klaim AI sebelumnya "latensi ~200ms, nyaris tak terasa" **TERBUKTI SALAH** (asli ~443ms). Dikoreksi
  terbuka (§8.2 humble mode).

**Constraints:**
- Memasang via **npm** (`npm create lintasai`) → Node ≥18 PASTI ada (`bin/lintasai.js` `#!/usr/bin/env node`,
  `package.json` `engines node>=18`). Memasang via **clone** (`setup-pola-b.ps1`) → Node **tidak dijamin**.
  Saat dipakai harian, kit jalan di PowerShell; Node cuma "pintu masuk" npm.
- Seluruh **18 robot lintasAI = PowerShell** + 1 kerangka tes (Pester). Menambah 1 berkas Node =
  **bahasa kedua** → perawat tunggal (bus factor ~1) harus pegang 2 bahasa + 2 alat tes.
- DNA kit: **insiden/pemicu-driven** (jangan ubah yang sudah jalan tanpa pemicu kuat — selaras ADR-001).
- Palang rem = **OPT-IN** (default mati, §4.12) + matcher sempit (cuma Bash/Edit/Write, BUKAN Read/Grep)
  + `-NoProfile`. Jadi hook tak menyala di mayoritas tool-call.

---

## Decision

1. **Sekarang (palang rem OPT-IN) → tetap PowerShell 5.1.** Bukan karena sudah terlanjur dibangun, tapi
   karena: jalan di **semua** jalur pasang (termasuk clone tanpa Node), **satu bahasa** (hemat rawat +
   bus factor), sudah teruji (26 tes + E2E). Latensi ~509ms dapat diterima untuk pemakaian opt-in: hook
   hanya nyala di aksi berisiko; untuk kasus "ask" (user mengklik) 509ms tak terasa.

2. **Pemicu peninjauan ulang = bila palang rem dijadikan DEFAULT-NYALA untuk semua staff.** Saat itu
   ~443ms × tiap-edit (mayoritas jalur "lolos" = overhead murni) jadi pajak nyata. **Urutan tinjau:
   ukur pwsh7 dulu** (tetap PowerShell = 1 bahasa, lebih cepat dari 5.1) → **baru Node** bila pwsh7
   kurang. Node tercepat tapi +bahasa-kedua +gotcha-flush.

3. **Node SEKARANG = ditolak** (prematur): manfaat kecepatan baru penting di pemakaian default-nyala yang
   belum diputuskan, sementara biayanya (bahasa kedua + bus factor + gotcha) nyata + terbukti.

Keputusan diambil AI atas delegasi owner; commit/rilis tetap owner-gated.

---

## Alternatif yang dipertimbangkan + ditolak

- **Rewrite ke Node sekarang** — ditolak: cepat (~66ms) TAPI memecah kodebasis jadi 2 bahasa (beban
  rawat perawat-tunggal), butuh Node saat runtime (jalur clone tak dijamin), + gotcha flush terbukti.
  Layak hanya jika hook jadi default-nyala-intensif (lihat pemicu #2).
- **Pasang pwsh7 sekarang** — ditolak untuk saat ini: butuh komitmen pasang runtime (belum terpasang di
  RDP) tanpa pemicu (palang masih opt-in). Tapi **inilah kandidat pertama** bila pemicu #2 tercapai
  (1 bahasa + lebih cepat dari 5.1).
- **Optimasi PS 5.1 lebih jauh** — terbatas: biaya dominan = startup .NET per-spawn (~389ms), tak bisa
  dipangkas banyak selama model = spawn-per-call (`-NoProfile` sudah dipakai).

---

## Consequences

**Positif:** kodebasis tetap 1 bahasa (mudah dirawat solo); palang jalan di semua jalur pasang; nol
perubahan/risiko sekarang; keputusan terdokumentasi dengan **angka terukur** (tak diperdebatkan ulang
tiap ada staff yang punya Node).

**Negatif / utang yang disadari:** latensi ~509ms/panggilan saat hook aktif — diterima untuk opt-in,
TAPI jadi penghalang bila kelak default-nyala. Pemicu #2 + urutan pwsh7→Node sudah dicatat supaya
peninjauan ulang terarah, bukan dari nol.

**Tinjau ulang bila:** (a) palang rem diputuskan default-nyala untuk semua staff; ATAU (b) lintasAI v2.0
lintas-OS (PowerShell 5.1 Windows-only → wajib pindah ke pwsh7/Node, lintas-OS jadi pemicunya).

> Bukti benchmark dihasilkan dari berkas Node setara sementara (di folder temp, bukan bagian kit) +
> `lib/risk-gate.ps1`. Angka spesifik mesin (RDP owner) — rentang bisa beda di mesin lain, tapi rasio
> (Node jauh lebih cepat nyala) berlaku umum.

---

## Addendum (2026-06-20) — Owner memilih Node.js (override keputusan #1)

Setelah membaca analisa + angka benchmark di atas, **owner memutuskan: pakai Node.js sekarang.** Alasan
owner yang valid: (a) palang rem akan **dirilis + dipakai AKTIF oleh semua staff** (bukan lagi sekadar
opt-in jarang) — ini memenuhi "pemicu #2" (default/heavy-use) yang ADR sebut sebagai syarat pindah
runtime; (b) Node sudah pasti ada (pasang via npm); (c) kecepatan 7,7× nyata. Owner menerima konsekuensi
bahasa-kedua (beban rawat) secara sadar setelah diberi gambaran jujur.

**Yang berubah:** `lib/risk-gate.ps1` (PowerShell) → **`lib/risk-gate.js` (Node.js)**, v1.57.0. Hook
PowerShell lama dihapus (Node-only, sesuai arahan owner "nodejs saja"). Logika identik (fungsi `decide()`
di-export untuk diuji). Tes ditulis-ulang (`tests/risk-gate.Tests.ps1` spawn `node`, skip jika Node absen).

**Bug ditemukan + diperbaiki saat konversi (penting):** pipa Windows kadang menambah **BOM** di awal
stdin → `JSON.parse` gagal → hook **fail-open diam-diam** (keamanan yang tak bekerja). Ditangani: buang
BOM + `process.exitCode` (bukan `process.exit()` yang memotong tulisan async pada pipa). Ketahuan via tes
end-to-end, bukan di tangan staff — bukti pentingnya gerbang QA.

**Konsekuensi baru disadari:** kit kini punya **2 bahasa** (PowerShell 18 robot + 1 hook Node) — beban
rawat naik untuk perawat tunggal (bus factor). Mitigasi: hook Node = 1 berkas terisolasi + logika
sederhana + tes lengkap + `decide()` exported. Lintas-OS jadi bonus (Node jalan di Mac/Linux juga).

**Yang TIDAK berubah:** robot lain (`ai-config-check`/`consistency-check`/`repo-board`/`stack-check`/
`unicode-safety`) tetap PowerShell — pindah-runtime per-onderdil hanya bila ada pemicu nyata (ADR-001).
