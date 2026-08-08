# ADR-005: Jalur eksekusi tim 100% Node — 3 jembatan terakhir (MOTW, penjaga junction, penulis versi) diport; PowerShell jadi cadangan

> Melanjutkan & **menuntaskan** ADR-004 (~98% Node). ADR-004 menyebut **MOTW/`Unblock-File`** sebagai
> "shim PowerShell permanen". ADR ini **MENGGANTI klaim itu** (supersede ADR-004 #1(b)): MOTW ternyata
> BISA dikerjakan Node murni (terbukti uji empiris). Hasil: **jalur yang dijalankan tim saat memakai kit
> kini 100% Node** — tak ada lagi PowerShell yang dipanggil di alur normal.

---

## Metadata

- **Tanggal:** 2026-06-25
- **Status:** **Accepted** — owner memutuskan 2026-06-25 (lewat 2 popup pilihan). Pilihan owner: (1) berkas
  PowerShell lama = **SIMPAN sebagai cadangan** (jangan hapus dulu — reversible, jaring pengaman); (2)
  penjaga junction = **Node dulu, PowerShell jadi cadangan** (keamanan tidak boleh berkurang).
- **Author:** Tim lintasAI (rancangan AI-assisted, terverifikasi-di-kit + uji empiris; efek lapangan klien belum diuji)
- **Reviewer:** owner

---

## Context

- **ADR-004** memutuskan konsolidasi ~98% ke Node, **menyisakan** 1 shim PowerShell permanen: **MOTW
  (`Unblock-File`)** untuk membuka "kunci dari-internet" (NTFS Alternate Data Stream `Zone.Identifier`).
  Alasan saat itu: Node dianggap tak bisa mengelola ADS Windows secara native.
- **Owner (2026-06-25)** minta migrasi dituntaskan supaya cocok "profil tim" yang tak mau lagi pakai
  PowerShell — dengan syarat: **yang benar-benar tak bisa diganti Node → biarkan dulu**, dan **pastikan
  tidak ada perilaku yang berubah** (scan 1-2x).
- **Pemetaan terverifikasi:** dispatcher (`bin/lintasai.js`) sudah 100% Node untuk perintah tim; yang masih
  memanggil PowerShell di jalur Node tinggal **3 jembatan**: (1) MOTW saat pasang, (2) penjaga reparse-point
  (junction/symlink) saat copot/balikin, (3) penulis versi `bump` (maintainer).
- **Uji empiris (Node v24, sesi 2026-06-25):**
  - MOTW: `fs.rmSync('<file>:Zone.Identifier', { force: true })` **berhasil menghapus** stream ADS →
    Node BISA buka-blokir MOTW murni (klaim "tak bisa native" di ADR-004 #1(b) **tidak akurat**).
  - Reparse: `fs.lstatSync().isSymbolicLink()` **mendeteksi junction (`mklink /J`) DAN symlink** = `true`.
  - `bump`: penulis cap-versi hanya menulis berkas teks → trivial untuk Node.

---

## Decision

1. **Port 3 jembatan ke Node** (berdampingan, PS tetap hidup sebagai cadangan):
   - **MOTW** (`lib/git-helpers.mjs removeMotwBlock`) → **Node murni** (hapus stream `:Zone.Identifier`
     rekursif, best-effort, idempoten). Tak lagi spawn PowerShell di jalur Node.
   - **Penjaga junction** (`lib/reparse-guard.mjs testPathsHaveReparsePoint`) → **Node jadi jalur utama**
     (lstat ancestor-walk, fail-secure), **PowerShell `safety.ps1` jadi cadangan** yang dipakai HANYA bila
     jalur Node gagal fatal tak terduga (sesuai pilihan owner "Node dulu, PS cadangan").
   - **Penulis versi `bump`** (`lib/consistency-check.mjs invokeLintasVersionBump` dkk) → **Node**,
     dipanggil `kit.mjs case 'bump'`. Cadangan: `kit.ps1 bump` → `consistency-check.ps1`.

2. **Berkas PowerShell lama DISIMPAN** (bukan dihapus): semua `*.ps1` + tes Pester (`*.Tests.ps1`) tetap
   ada sebagai cadangan + jaring pengaman + jalur `PS_FALLBACK`. Penghapusan = keputusan owner terpisah
   nanti, setelah versi Node terbukti di lapangan (reversibility tinggi sekarang).

3. **Batas jujur (paritas keamanan reparse):** `lstat().isSymbolicLink()` menangkap symlink + junction =
   **vektor serangan "junction ke luar root"** (yang jadi tujuan pengaman ini). Jenis reparse SANGAT
   langka (mis. placeholder cloud OneDrive) yang versi PowerShell tandai lewat attribute-bit BISA tidak
   ditandai Node — itu **bukan** vektor serangan junction, jadi keamanan anti-serangan tetap utuh. Owner
   memilih trade-off ini secara sadar (opsi "Node dulu, PS cadangan", bukan "biarkan PS").

## Yang TIDAK berubah (anti-regresi)

- Tanda tangan fungsi + nilai kembalian ketiga jembatan **identik** → pemanggil (`setup-pola-b.mjs`,
  `uninstall.mjs`, `rollback.mjs`, `kit.mjs`) tak perlu diubah perilakunya.
- Tes lama tetap hijau (MOTW end-to-end membuktikan ADS benar-benar terhapus; junction asli terbukti
  ditandai berbahaya; bump unit-test membuktikan cap versi + tolak downgrade/format-salah/bukan-repo-kit).
- `KIT_VERSION_CHECKS` / `$KitVersionChecks` (data) tidak berubah → paritas robot PS↔Node tetap.

## Consequences

- **Positif:** alur normal tim (`npx lintasai init/update/uninstall/...` + `bump` maintainer) tak lagi
  memanggil PowerShell → cocok "profil tim" 1-bahasa; lebih sedikit ketergantungan runtime.
- **Biaya:** ada duplikasi sementara (Node utama + PS cadangan) sampai owner memutuskan menghapus `.ps1`.
- **Reversibility:** tinggi — semua lewat commit di branch; PS cadangan masih lengkap.

## Alternatif yang ditolak

- **Hapus `.ps1` sekalian:** ditolak owner sekarang (aksi besar + sulit dibalik + hilang jaring pengaman) —
  ditunda sampai versi Node terbukti di lapangan.
- **Reparse: port penuh Node tanpa cadangan PS:** ditolak (risiko paritas attribute-bit jenis langka).
- **Reparse: biarkan PowerShell:** ditolak owner (memilih Node-utama agar jalur tim bebas PowerShell).
