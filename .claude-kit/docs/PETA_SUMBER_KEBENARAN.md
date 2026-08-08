# PETA_SUMBER_KEBENARAN.md — Di mana tiap fakta "tinggal" + apakah benar 1-sumber

> Versi 4 · 2026-06-25 · Untuk maintainer + AI yang kerja DI repo kit lintasAI

## Untuk apa berkas ini

Pertanyaan yang dijawab: **"Fakta X (nomor versi, jumlah file, daftar repo, dll) sumber
aslinya di berkas mana? Dan kalau aku mengubahnya, cukup 1 tempat atau harus banyak?"**

Tujuannya: AI/maintainer **langsung tahu** lokasi sumber + cara amannya mengubah, **tanpa
menelusuri ulang seluruh repo** (cepat + hemat token), DAN tahu **mana yang rawan basi**.

🏢 Analogi (cara pikir "deklarasi 1 sumber" — `$variable` PHP / `const` React):
- **Pola ideal** = **1 sel Excel yang ditarik rumus ke 100 tempat** — ubah 1 sel, semua ikut. Mustahil basi.
- **Sebagian fakta di kit ini** = **angka yang sama ditulis di 6 dokumen Word terpisah**, lalu ada
  **robot yang teriak kalau ada 1 dokumen beda**. Aman-ish, tapi tetap 6 salinan fisik — bukan 1 sel.

Peta ini jujur menandai mana yang sudah "1 sel Excel" dan mana yang masih "6 dokumen Word + robot".

> Berkas saudara: [RESEP_PERUBAHAN.md](RESEP_PERUBAHAN.md) menjawab "berkas mana yang **ikut bergerak**
> per jenis perubahan" (checklist). Peta ini menjawab "fakta itu **sumbernya di mana** + jenis sumbernya".

---

## Legenda jenis sumber

| Tanda | Jenis | Arti | Saat mengubah |
|---|---|---|---|
| ✅ | **SUMBER-TUNGGAL SEJATI** | Dideklarasi 1x, lalu **dibaca/di-generate otomatis** oleh mesin (mis. `Import-PowerShellDataFile`, `@import`). | Ubah **1 tempat** → ikut semua. |
| ⚠️ | **DUPLIKAT + PENGECEK** | Fakta **disalin** ke banyak berkas; dijaga cocok oleh robot / `bump` / tes. | Ubah **banyak tempat**, TAPI ada jaring pengaman yang menolak rilis kalau ada yang basi. |
| 📝 | **PROSA-KONVENSI** | "1 tempat per topik" hanya karena **disepakati**; **tak ada mesin** yang membaca/menegakkan. | Ubah banyak tempat; **tidak ada jaring pengaman** → paling rawan basi. |

---

## Tabel A — Fakta INTERNAL kit

| Fakta | Sumber sebenarnya | Jenis | Dijaga oleh | Catatan jujur |
|---|---|---|---|---|
| **Nomor versi kit** (mis. 1.44.0) | `package.json` field `version` (= acuan) | ⚠️ | `node kit.mjs bump` (penulis Node `lib/consistency-check.mjs`, migrasi 2026-06-25; cadangan PS `kit.ps1 bump` → `consistency-check.ps1`) menulis 6 berkas + robot `consistency-check.*` (`KIT_VERSION_CHECKS`/`$KitVersionChecks`) + tes `consistency-check.test.mjs` & `.Tests.ps1` | Disalin ke 6 berkas: `package.json`, `CHANGELOG.md`, judul `CLAUDE_universal_v1.md`, `README.md`, `KEUNGGULAN_LINTASAI.md`, `templates/INDEX.md`. Komentar kode mengakui pernah drift ("README nyangkut 5 rilis"). |
| **Daftar berkas kit** (file apa saja yang ADA di dalam kit) | `lib/kit-files.psd1` | ✅ | Dibaca runtime via `Import-PowerShellDataFile` oleh `setup-pola-b.ps1`, `kit.ps1 doctor`, `uninstall.ps1` | Ini contoh 1-sumber sejati yang benar. **TAPI** 3 daftar berkas lain di bawah TIDAK diturunkan darinya. |
| **Daftar berkas yang DI-DEPLOY ke project client** ("file tim") | blok `$teamFiles` di `setup-pola-b.ps1` | ⚠️ | robot tes (penjaga UMUM) | **Terpisah** dari `kit-files.psd1` (masih 2 daftar), TAPI sejak penjaga umum di `tests/install-mapping-sync.Tests.ps1`, tiap template di `$teamFiles` WAJIB ada di disk + terdaftar di `kit-files.psd1` → kelupaan nama kini **ketahuan tes**. Hapus-total duplikasi (turunkan dari `kit-files.psd1`) = backlog. `docs/SIGNED_RELEASE.md` disalin di luar array. |
| **Jumlah file tim** (total + rincian per-folder `.github`/`docs`) | dihitung otomatis dari `$teamFiles` | ⚠️ | robot `consistency-check.ps1` (`$KitFacts` / `$KitTeamFilesSource`) | Nilai aktual ditulis di `README.md` + `JALANKAN_KIT.md` lalu **dicek robot**. JANGAN tulis angka di sini supaya tak ikut basi (de-fragilize §6.3) — lihat angka terkini di kedua berkas itu. Pernah drift berkali-kali (17→28→30→32→33). |
| **Daftar berkas yang terbit ke npm** | `package.json` `files[]` (pola glob) | ⚠️ | `tests/package-bundle.Tests.ps1` (npm pack --dry-run) | Terpisah dari `kit-files.psd1`; dijaga tes, bukan diturunkan. |
| **Daftar berkas aturan global `~/.claude`** | `$mapping` di `install-windows.ps1` (9 berkas, daftar tangan) | ⚠️ | `tests/install-mapping-sync.Tests.ps1` | Terpisah dari `kit-files.psd1`; dijaga tes anti-drift. |
| **Isi aturan AI** (teks tiap seksi) | `CLAUDE_universal_v1.md` (inti) + `LINTASAI_WORKFLOWS_v1.md` (detail on-demand) | ✅ | dimuat via `@import` di `CLAUDE.md` (repo) & `CLAUDE.md.template` (client) | Pemuatannya 1-sumber sejati: project client **tidak menyimpan salinan** aturan, ditarik otomatis tiap sesi. Tiap potongan punya 1 rumah (inti vs detail). Sebagian pointer sengaja **digemakan** (mis. §7.3a di §3+§4) — gema itu dikunci `tests/modify-workflow-rule.Tests.ps1`. |
| **Versi kit TERPASANG** (dibaca saat runtime) | `.install-manifest.json` field `metadata.kit_version` (di-generate live) | ✅ | dibuat `lib/manifest.ps1` (sha256 dihitung live) | Engine baca versi dari manifest/CHANGELOG, **bukan** dari `package.json`. |
| **Logika BACA versi** (parser CHANGELOG/manifest) | `lib/version-detect.ps1` | ✅ (sebagian) | — | Library ini "1 sumber" untuk CARA membaca versi. **TAPI** `kit.ps1` punya **salinan inline** parser (`Get-KitVersion`) yang tak memanggil library ini → ⚠️ untuk parser itu. |
| **Helper kecil baca/tulis berkas** (`stripBom`, `readTextSafe`, `readTemplate`, `isFile`, `isDir`, `pathExists`, `writeUtf8NoBom`, `eqCI`, `backupStamp`, `isSymlinkLike`) | `lib/fs-text.mjs` | ✅ | dibaca via `import` oleh ~15 berkas + dijaga `tests/fs-text.test.mjs` (penjaga anti-rot **memindai semua berkas** .mjs, termasuk nama-lama yang dipensiun `formatStamp`/`timestampSuffix`/`defaultBackupSuffix`) | Dulu tiap helper disalin 2-6x byte-identik di lib/ + alat inti (mis. cap-waktu cadangan `backupStamp` punya 6 salinan); disatukan bertahap (audit fungsi-kembar 2026-06-25). Penjaga menolak rilis kalau ada yang mendefinisikan ulang `function <helper>` di luar berkas ini. ⚠️ **Jebakan — JANGAN satukan:** `getFileSha256` ada di `manifest.mjs` (hex HURUF-BESAR + `null` kalau hilang) **dan** `safety.mjs` (hex huruf-kecil + **melempar**) — SENGAJA beda kontrak (cermin 2 perintah PS berbeda). `writeJsonAtomic` (manifest.mjs vs rollback.mjs) juga sengaja tak di-impor lintas-modul demi batas lapisan. |

---

## Tabel B — Artefak untuk PROJECT CLIENT (saat client baca/buat/kelola project)

| Fakta/artefak | Sumber | Jenis | Catatan jujur |
|---|---|---|---|
| **Identitas + struktur project** (terstruktur, mesin-baca) | `project.lintas.jsonc` (jalur Node, default) / `project.lintas.psd1` (jalur PowerShell lama) | ✅ | **BARU**: deklarasi intent/modules→path/conventions; `stack` di-derive dari `package.json`; di-bootstrap saat pasang + dijaga robot `lib/project-manifest.mjs` (jalur `.jsonc`) / `lib/project-manifest.ps1` (jalur `.psd1`) (PathExists/DeriveMatch/PARSE-OK) di Gerbang §4.6. Inilah "kartu identitas mesin-baca" yang dulu tertulis BELUM ADA. Detail: [project-manifest.md](project-manifest.md). |
| **Narasi panjang project** (prosa untuk manusia) | `templates/architecture.md` (peta makro, user-edited) | 📝 | Peta makro prosa user-edited (dikirim `[TBD]`); kini **pelengkap** kartu mesin (kartu merujuknya lewat `refs.architecture`). Robot kartu identitas (`project-manifest`) cek `refs.architecture` **file-ADA** (MISSING kalau berkasnya hilang), tapi **ISI prosa TIDAK ditegakkan** (by design — peta makro tulisan-tangan tak bisa/tak boleh dirobotkan). Label 📝 = soal isi. |
| **Registry semua docs project** (TOC `.md`) | `templates/architecture_auto.md` | ✅ | AI **mengetik manual** tiap tambah/hapus `.md` (bukan di-generate dari isi `docs/`), TAPI **dijaga robot registry** di KEDUA jalur: `lib/project-manifest.mjs` (Node, default) + `lib/project-manifest.ps1` (PowerShell, cadangan) — `getLintasRegistryFinding`: MISSING = `.md` belum terdaftar, ORPHAN = entri yatim; jalan otomatis di Gerbang §4.6 (`runRegistryCheck`, level RAPIKAN = saran, tak memblokir). Diuji `tests/project-manifest-registry.test.mjs` (Node, 8 kasus) + `tests/project-manifest.Tests.ps1` (PS); paritas Node↔PS terverifikasi. **Label template sudah dijujurkan (v2)**: "auto" = auto-DICEK, bukan auto-DIISI. ✅ **Backlog port Node SELESAI** (2026-06-28) → client Node-only (tanpa `pwsh`) kini ikut terjaga. |
| **Kamus istilah + penamaan** | `templates/glossary.md` | 📝 | Template menyebut dirinya **rujukan tunggal** istilah + **sudah jujur** ("belum ada robot yang mengecek nama di kode cocok kamus"). Penegakan = disiplin AI/manusia. Robot kartu identitas cek `refs.glossary` **file-ADA**, tapi **ISI** (nama tabel/route cocok kode) tetap **tak ditegakkan** — by design: nama bisnis/definisi prosa gagal 2 syarat robot (bukan angka-bisa-dihitung + pola ambigu → alarm palsu). |
| **Versi stack framework** (Next/React/Prisma/dll) | `templates/STACK_VERSIONS.md` | 📝 | Label sudah dijujurkan ("rujukan TUNGGAL, bukan ditarik otomatis"). Konsumen (banyak template) merujuk lewat **kalimat** ("lihat STACK_VERSIONS.md") — **tak menyalin angka** → pola "hapus-duplikasi→rujuk" yang sudah benar. **Checklist saat mengubah: [RESEP_PERUBAHAN.md](RESEP_PERUBAHAN.md) §8.** TIDAK dijaga robot **(by design)**: versi stak gagal 2 syarat robot (bukan angka-bisa-dihitung + pola "16.x"/"5+" ambigu → alarm palsu). |
| **Robot pengecek untuk client** | `templates/consistency-map.example.psd1` | ⚠️ (opt-in) | Memberi client pola **duplikat+pengecek** yang sama (1 `Source` acuan + daftar `Checks`). Default tidak aktif — client harus salin→`docs/consistency-map.psd1` + isi sendiri. |
| **Versi kit aktif di project** | baris teratas `.claude-kit/CHANGELOG.md` (sumber hidup; `AGENTS.md` kini **merujuk**, tak menyalin) | ✅ | **De-fragilized (2026-06-25):** dulu nomor versi disalin **beku** ke field `<VERSI_KIT>` di `AGENTS.md` saat install, lalu basi karena `update-kit` tak memperbaruinya (cuma cetak instruksi manual, `update-kit.mjs:862`). Kini baris "Versi kit aktif" di `AGENTS.md.template` **merujuk** CHANGELOG hidup (tak menyimpan angka) → tak bisa basi. Yang masih memakai `<VERSI_KIT>` = tabel **Riwayat update** (snapshot "versi saat setup awal" — **sah beku**, historis). `update-kit` tetap mencetak instruksi MANUAL untuk **menambah baris riwayat** baru. |

---

## Tabel C — MULTI-REPO (kelola banyak project)

| Fakta | Sumber | Jenis | Catatan jujur |
|---|---|---|---|
| **Model + jumlah repo topologi** (berapa repo per mode split: "2-3" / microservice per-wilayah) | `docs/plans/POLA_REPO_AMAN.md` | 📝 | **SUMBER TUNGGAL topologi** — `SPLIT_REPO_MIGRATION_PROMPT_v1.md` / `JALANKAN_KIT.md` / `KEUNGGULAN_LINTASAI.md` / `README.md` WAJIB **merujuk**, JANGAN salin angka. **TIDAK dijaga robot** (angka repo tak punya 1-sumber bisa-dihitung + pola "3 repo" ambigu → jaga lewat rujukan, JANGAN dipaksa robot = alarm palsu). Pernah drift "2 vs 3 repo" + "6-10 vs 5/6/7" (caught 2026-06-24 lewat scan owner, bukan robot). |
| **Daftar repo + tier akses + tim** ("Buku Induk") | `templates/lintasai-portfolio.example.yml` | 📝 | Berkas YAML terstruktur yang dulu mengaku "SATU SUMBER KEBENARAN". **ADA pembaca read-only** (`lib/portfolio-read.mjs` + `lib/portfolio-read.ps1`, parser baris-per-baris untuk `portfolio`/`access_groups`/`repos`, diuji `tests/portfolio-read.test.mjs` + `tests/portfolio-registry.Tests.ps1`) yang mem-parse + **MERINGKAS** Buku Induk untuk ditampilkan (dipakai juga `lib/repo-board.ps1`). **TAPI** pembaca itu cuma menampilkan — **tidak** menerapkan izin GitHub. Izin GitHub diset **manual**; `access_tier` malah **disalin lagi** ke `.split-state` tiap repo, dan satu-satunya robot yang baca tier (`secret-guard.yml`) membacanya dari `.split-state`/env **lokal tiap repo**, bukan dari Buku Induk pusat. Jadi Buku Induk = **catatan yang DIBACA mesin untuk ringkasan**, bukan sumber yang **menggerakkan** izin. (Label 📝 = soal **penegakan**: "tak menegakkan/tak ada pengecek anti-basi" ≠ "tak dibaca" — pembaca ringkasan ADA.) |

---

## ⚠️ Berkas yang MENGAKU "sumber tunggal" padahal sebenarnya 📝 prosa-konvensi

Jangan tertipu label di judul berkas. Yang **benar-benar** dibaca mesin hanya `lib/kit-files.psd1`.
Berikut DULU menulis "sumber tunggal / single source of truth" padahal penegakannya manual —
**kini sudah dijujurkan** (label diubah jadi "rujukan/registry/catatan" + diberi caveat eksplisit):

- `templates/lintasai-portfolio.example.yml` — dulu "SATU SUMBER KEBENARAN"; kini "CATATAN PUSAT (registry)" + caveat: **ADA pembaca read-only** (`lib/portfolio-read.*`) yang cuma **meringkas** isinya, tapi **penegakan izin GitHub tetap manual** (tak ada skrip yang membaca lalu mengeset izin otomatis).
- `templates/STACK_VERSIONS.md` — kini "tempat rujukan TUNGGAL (bukan ditarik otomatis oleh kode)".
- `templates/glossary.md` — kini "tempat rujukan tunggal (dijaga disiplin AI/manusia; belum ada robot pengecek)".
- `templates/_PATTERNS.md` — kini "rujukan tunggal (konvensi); ditegakkan disiplin, hooks/CI lint default mati".

> Pelajaran: **niat 1-sumber sudah benar di mana-mana; penegakannya yang baru sebagian.**
> Kalau menulis "sumber tunggal" di sebuah berkas, idealnya **bikin minimal 1 konsumen mesin
> yang benar-benar membacanya** — kalau tidak, itu cuma harapan, bukan jaminan.

---

## Aturan saat MENAMBAH fakta/angka baru (biar tak menambah duplikasi)

Sebelum menulis fakta/angka yang sama di >1 berkas, tanya berurut:

1. **Bisa cukup 1 tempat?** Kalau ya → tulis 1 tempat, sisanya rujuk (jangan salin). Paling ideal.
2. **Angka bisa dihitung dari kode?** (mis. "jumlah X") → jadikan **kode** sumbernya, lalu daftarkan
   ke robot (`$script:KitFacts` di `lib/consistency-check.ps1`) supaya angka di dokumen dicek cocok.
3. **Terpaksa disalin teks?** → daftarkan ke robot (`$script:KitVersionChecks` untuk versi, atau pola
   `$KitFacts` untuk angka) **supaya drift ketahuan**. Jangan biarkan salinan **tanpa pengecek**.
4. **Syarat fakta layak dijaga robot:** punya **1 sumber yang bisa dihitung** + pola tulisan **tidak
   ambigu** (jangan jaga frasa bermakna ganda → alarm palsu). Lihat catatan di `consistency-check.ps1`.

🏢 Analogi: setiap kali mau menulis angka yang sama di tempat kedua, ingat — kamu baru saja
membuat **peluang untuk lupa**. Entah hilangkan salinannya, atau pasang robot penjaganya.

---

## Audit duplikasi PROSA (blok tulisan/aturan, bukan angka) — status

Peta di atas menjaga **fakta/angka** (versi, jumlah file, daftar repo). Ini menjawab pertanyaan
**berbeda**: *"Apakah ada BLOK TULISAN/ATURAN yang ditulis-ulang sama persis (verbatim) di banyak
berkas?"* — itu sumber drift seperti kasus istilah "Multi-Divisi" (sudah dibereskan `c60976d` +
dijaga robot istilah-pensiun `8d3dcc9`).

**Status per 2026-06-25: BERSIH — sudah disisir, tidak ada blok prosa yang perlu/aman dirapikan.**

- **Cara cek (deterministik, ~0 token AI):** skrip pembanding teks — (a) baris-identik-berurutan,
  (b) kalimat-ciri yang muncul di ≥3 berkas, (c) *shingle* (potongan 12-kata berurutan) antar-pasangan
  berkas. Cakupan: berkas instruksi hidup (root `*.md` kecuali `CHANGELOG`/`AUDIT_*`, `templates/*.md`,
  `split-agents/*.md`, `docs/*.md`). Lalu cek-silang skeptis 4 area (mode aman cuma-baca).
- **Hasil:** `CLAUDE_universal_v1.md` ↔ `LINTASAI_WORKFLOWS_v1.md` = **0 kalimat identik penuh** (pola
  "inti ringkas always-load + rujuk detail on-demand" sudah konsisten, cross-reference dua arah). Sisa
  kemiripan SEMUANYA **DISENGAJA** (template klien yang sengaja berdiri-sendiri tanpa akses aturan
  penuh — mis. `_PATTERNS.md`, `STACK_GUIDE.md` yang malah **sudah merujuk** sumbernya; 2 versi
  `RESEP_PERUBAHAN.md` untuk audiens/repo berbeda) atau **RISIKO manfaat-rendah** (memangkas analogi/
  ringkasan 1-3 baris di stub aturan inti hanya hemat sedikit token sambil merusak sifat self-contained).
- **Implikasi — JANGAN ulang scan ini tiap sesi.** Duplikasi **PROSA** sudah tuntas; yang tersisa sengaja.
  Penjagaan lanjutan sudah otomatis pada lapisan yang tepat: **istilah/heading kanonik yang dipensiunkan**
  (mis. "Multi-Divisi") dijaga `KIT_RETIRED_TERMS` di `lib/consistency-check.*`; **angka-konsep** (15 divisi,
  18 kriteria) dijaga **tes struktural**, bukan robot (pola ambigu → alarm palsu — lihat `RESEP_PERUBAHAN.md` §"Pemeriksa otomatis").
- **Kalau perlu cek ulang nanti** (mis. setelah banyak berkas `.md` baru ditambah): pola pemeriksaan =
  bandingkan *shingle* 12-kata antar berkas `.md`, tinjau pasangan ber-overlap tinggi, klasifikasi tiap
  blok jadi **AMAN-dirujuk / RISIKO / DISENGAJA** (template klien self-contained + robot kembar PS↔Node +
  `CHANGELOG` = selalu DISENGAJA, jangan diutak-atik).
