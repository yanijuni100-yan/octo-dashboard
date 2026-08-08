# project-manifest.md — Kartu Identitas Project (`project.lintas.jsonc` / `project.lintas.psd1`)

> Versi 2 · 2026-06-24 · Pendamping `lib/project-manifest.ps1` + `lib/project-manifest.mjs` + catatan keputusan desain.
> v2: tambah bagian **"Cara Isi untuk staff non-programmer"** (panduan 3-lapis analogi — supaya kartu jadi pengetahuan bersama AI + staff, bukan artefak AI-saja).

## Tujuan

Memberi tiap project client **satu sumber kebenaran mesin-baca** untuk identitas + strukturnya,
supaya **AI baca 1 tempat** (tak meraba-raba struktur tiap sesi = cepat + hemat token) dan
ubah/baca project terpusat di 1 berkas. 🏢 Analogi: **"kartu identitas" project** — AI lihat
kartunya dulu sebelum kerja, bukan menebak dari banyak petunjuk.

Berbeda dari `docs/architecture.md` (narasi **prosa** untuk manusia, gampang basi): kartu ini
**terstruktur + dibaca mesin** + **dijaga robot anti-basi**. Keduanya saling melengkapi
(kartu menunjuk ke `architecture.md` lewat `refs.architecture`).

> Project kecil/solo tanpa banyak modul **boleh tanpa kartu ini** — `architecture.md` prosa sudah cukup.

> **Transisi PowerShell→Node (ADR-003a):** pemasang **Node** (kini default, `npx lintasai init`) menulis
> kartu ini sebagai **`project.lintas.jsonc`** (JSONC = JSON + komentar) yang dibaca robot
> `lib/project-manifest.mjs`. Pemasang **PowerShell** lama menulis **`project.lintas.psd1`** yang dibaca
> `lib/project-manifest.ps1`. Selama transisi keduanya berlaku; **1 project = 1 format** (sesuai jalur
> pasangnya). Dokumen ini menjelaskan format `.psd1`; **isi & maksud field identik** di `.jsonc`.

## Cara Pakai

- **AI baca DULU** `project.lintas.psd1` saat mulai kerja (aturan `CLAUDE_universal_v1.md` §7.9).
- **Lahir otomatis saat pasang**: pemasang menulis kartu ini (`setup-pola-b.mjs` → `.jsonc`, atau `setup-pola-b.ps1` lama → `.psd1`) — kolom `stack` diisi
  otomatis dari `package.json`; `intent` ditandai `'pending'`. **Idempoten**: kalau sudah ada, tak ditimpa.
- **AI isi `intent` di sesi pertama** (ganti `'pending'`) + **AUTO-SYNC `modules`** tiap struktur berubah.
- **Robot pemeriksa** (di Gerbang Pra-Rilis §4.6, atau manual):
  `pwsh .claude-kit/lib/project-manifest.ps1 -RepoRoot .`

## Field (skema v1)

| Field | Jenis sumber | Arti |
|---|---|---|
| `schema_version` | declared | Versi skema kartu (mulai 1). |
| `intent.purpose` / `intent.domain` | **declared** | Tujuan project + domain bisnis. Non-derivable → AI isi sesi pertama. |
| `stack.{type,package_manager,frameworks}` | **derive** | Diturunkan dari `package.json` + lockfile. **Jangan salin daftar dependency** — ringkasan saja. Robot cek cocok (DeriveMatch). |
| `environment.{recorded_node,recorded_node_major,recorded_os}` | **derive** | "Cap lingkungan" runtime saat pasang (versi Node + platform). Pembanding dev vs client — dibaca `kit doctor --env` ([env-check.md](env-check.md)). Bebas-rahasia (versi saja, bukan hostname/user). |
| `refs.kit_version` | **reference** | Pointer `.claude-kit/.install-manifest.json#metadata.kit_version` — **jangan salin nomornya**. |
| `refs.{architecture,glossary,registry}` | reference | Pointer ke dokumen prosa pendamping. Robot cek path ada. |
| `modules[]` `{name,path,purpose,role}` | **declared** | Peta modul→lokasi (inti nilai kartu). `path` **wajib nyata** (robot PathExists). |
| `conventions[]` `{rule,applies_to}` | declared | Konvensi mesin-relevan singkat. |
| `split.{role,access_tier,base_name,portfolio_ref}` | declared | (Multi-repo) **CATATAN niat, BUKAN keamanan** — akses nyata di GitHub repo + CODEOWNERS (§8.1 #4). |

## Cara Isi untuk staff non-programmer (3-lapis analogi)

Kartu ini terstruktur supaya AI cepat paham, tapi **kamu (staff) juga bisa membaca + ikut mengisinya** — supaya kartu jadi pengetahuan bersama, bukan milik AI saja. Tiap kolom diibaratkan begini:

- **`intent.purpose`** = ringkasan proyek. 🏢 kayak "tentang toko ini" / 📱 deskripsi toko di **Tokopedia** (jual apa + buat siapa). 🎯 Isi **2-3 kalimat**: (1) untuk siapa / berapa pengguna, (2) masalah apa yang dipecahkan, (3) fokus utamanya. Jangan terlalu pendek (jadi kabur) atau terlalu panjang (boros dibaca tiap sesi).
  - ✅ Baik: *"Dashboard tagihan internal untuk tim finance (5-20 staff). Mengganti rekap Excel yang sering salah hitung. Fokus: cepat input invoice + jejak siapa-ubah-apa."*
  - ❌ Terlalu kabur: *"Project untuk finance."*
  - ❌ Terlalu panjang: 5 paragraf sejarah project (AI harus baca ulang tiap sesi → boros).
- **`intent.domain`** = jenis bisnis singkat (mis. `invoice-finance`, `toko-online`, `seo-portfolio`). 🏢 kayak kategori di marketplace.
- **`modules`** = peta isi project. 🏢 kayak **denah lantai gedung** (lantai 2 = akuntansi, lantai 3 = gudang) / 📱 kayak menu kategori di aplikasi. Tiap modul punya `name` (nama), `path` (foldernya di mana), `purpose` (buat apa). **Inilah yang bikin AI langsung tahu** "fitur invoice ada di folder mana" tanpa meraba seluruh project = cepat + hemat token.
- **`stack`** = daftar alat yang dipakai project (mis. Next.js, Prisma). 🏢 kayak daftar peralatan di dapur. **Diisi otomatis** + dijaga robot — biasanya tak perlu kamu sentuh.
- **`refs`** = pintasan ke dokumen lain (peta arsitektur, glossary). 🏢 kayak daftar "lihat juga" di buku.

**Mau menambah modul baru** (mis. muncul folder fitur baru)? Cukup tambah **1 baris** di `modules`, contoh:
`{ "name": "laporan", "path": "src/features/laporan", "purpose": "ekspor laporan PDF", "role": "feature" }`.
Robot pemeriksa otomatis mengecek `path`-nya **benar-benar ada** di disk; kalau salah ketik, dia memberi tahu — kamu tak akan diam-diam salah. 🏢 kayak **Google Maps** yang langsung bilang "alamat tidak ditemukan" saat kamu salah tulis.

> Ragu? **Minta AI yang mengisi/mengubah**, kamu cukup mengecek hasilnya masuk akal. Robot anti-basi (bagian berikut) jadi jaring pengamannya — jadi aman bereksperimen.

## Robot anti-basi (kenapa kartu ini ≠ catatan mati)

`lib/project-manifest.ps1` memeriksa kartu vs **kenyataan**, deterministik (~detik, ~0 token):
- **PARSE-OK** — berkas bisa dibaca (tidak rusak) + punya `schema_version`.
- **PathExists** — tiap `modules[].path` + `refs[]` yang dideklarasikan **ada di disk**.
- **DeriveMatch** — `stack.frameworks` ada di `package.json`; `stack.package_manager` cocok lockfile.
- **Konservatif** (anti alarm-palsu, §8.2): hanya MISMATCH bila bukti jelas; SKIP kalau tak bisa verifikasi.

Tanpa robot ini, kartu cuma "niat" yang akan basi diam-diam — persis nasib `portfolio.yml`
(lihat [PETA_SUMBER_KEBENARAN.md](PETA_SUMBER_KEBENARAN.md)).

## Keputusan desain (ringkas — kenapa begini)

- **Kenapa berkas `.psd1` (bukan JSON/YAML)?** PowerShell 5.1 membaca `.psd1` **native**
  (`Import-PowerShellDataFile`) + bisa **komentar `#`** per baris (ramah non-programmer). YAML
  **tak** punya parser native di PS 5.1 → itu yang membuat `portfolio.yml` gagal jadi sumber.
  *(JSON dipertimbangkan; dipilih `.psd1` karena pembaca utama = AI + PowerShell. Kalau kelak
  perlu dibaca Node/JavaScript juga, JSON jadi kandidat.)* **Update (ADR-003a):** "kelak" itu sudah
  tiba — pemasang Node (kini default) menulis varian **`.jsonc`** (JSON + komentar) yang dibaca
  `lib/project-manifest.mjs`; `.psd1` tetap untuk jalur PowerShell lama.
- **Kenapa berkas terpisah (bukan menempel di `architecture.md`)?** Batas kepemilikan jelas:
  prosa = manusia, kartu = mesin/AI. Mencegah staff tak sengaja merusak blok mesin → kartu mati senyap.
- **Kenapa derive/reference, bukan salin?** Menyalin fakta yang sudah ada (versi kit, dependency)
  = menciptakan duplikasi baru — justru lawan dari tujuan. Maka derive + robot-verifikasi.

## Dependensi

- `lib/project-manifest.ps1` — pembaca + robot + penulis bootstrap. Sumber: `lib/project-manifest.ps1:1`.
- `setup-pola-b.ps1` — menulis kartu saat pasang (blok sebelum `Save-Manifest`). Sumber: `setup-pola-b.ps1` (`Write-LintasProjectManifestIfMissing`).
- Contoh terisi: `templates/project.lintas.example.psd1`.
- Tes: `tests/project-manifest.Tests.ps1`.

## Catatan

- **Edge case**: project tanpa `package.json` → `stack.type='unknown'`, `package_manager=$null`,
  `frameworks=@()` → robot tetap BERSIH (cek stack di-SKIP, bukan alarm-palsu).
- **Uninstall**: kartu dilacak via hash — kalau sudah diisi (AI/user), uninstall **tidak** menghapus
  (knowledge aman); stub murni boleh dibersihkan.
- **Robot registry docs** (`Invoke-LintasRegistryCheck`, read-only): memastikan tiap `docs/*.md`
  **terdaftar** di `architecture_auto.md` (MISSING) + entri/link tak menunjuk berkas hilang (ORPHAN) —
  anti registry-basi (drift yang diakui di [PETA_SUMBER_KEBENARAN.md](PETA_SUMBER_KEBENARAN.md)).
- **Auto-daftar entri hilang** (`Add-LintasMissingRegistryEntry`): **APPEND** entri `docs/*.md` yang
  belum tercatat ke registry (ringkasan placeholder, AI lengkapi) — append-only, tak pernah menimpa;
  **bukan read-only** → TIDAK dipanggil di gerbang verifikasi, dipanggil eksplisit saat merapikan.
- **Ditunda (backlog)**: migrasi `.split-state` ke `split` (multi-repo); buat registry awal dari nol
  bila belum ada + tulis ringkasan otomatis (bukan cuma placeholder). Belum dikerjakan (keputusan terpisah).
