# PORTFOLIO_REGISTRY — Buku Induk Repo (cara isi, bahasa non-programmer)

> Versi 1 · 2026-06-13 · untuk owner/lead non-programmer · pendamping `lintasai-portfolio.example.yml`

## Untuk siapa & kenapa

Ini panduan mengisi **Buku Induk repo** (`lintasai-portfolio.yml`) — 1 berkas yang mencatat **semua repo proyekmu + siapa boleh akses masing-masing**. Dipakai saat kamu mengelola **banyak repo terpisah** (mis. 1 backend + 1 dashboard + beberapa repo fitur) dan ingin **atur akses per-repo** supaya cuma sebagian kecil orang yang bisa melihat backend + database.

> 🏢 **Analogi:** kayak **buku tamu + denah ruangan** di resepsionis kantor. Ditulis resmi siapa boleh masuk ruang mana — bukan "etika" yang gampang dilanggar. Semua langkah lain (atur izin, pasang kit, dst) tinggal **baca buku ini**, jadi kamu cukup mengisi **1 tempat**.

> 💡 **Tak mau isi manual?** Buka Claude Code, ketik *"buatkan Buku Induk akses"* (atau *"pandu aku isi Buku Induk lintasAI"*) — AI **mewawancaraimu pakai bahasa biasa lalu menuliskan sendiri** berkasnya, kamu tak perlu menyentuh format teknis. Naskah yang AI ikuti: `WIZARD_BUKU_INDUK_v1.md`.

---

## Kapan kamu butuh Buku Induk ini

- ✅ **Butuh** kalau: kamu punya **>3 repo terpisah** ATAU mau **mengatur akses berbeda per repo** (mis. cuma 3-5 orang boleh lihat backend, ~40 orang cuma repo fitur).
- ⏭️ **Belum butuh** kalau: masih 1 repo (monorepo), atau baru pecah jadi 3 repo standar (backend/frontend/shared) tanpa kebutuhan akses khusus. Untuk itu, `SPLIT_REPO_MIGRATION_PROMPT_v1.md` sudah cukup.

> ⚠️ **Aturan emas:** **jumlah repo ikut jumlah BATAS-AKSES nyata, bukan angka target.** Punya 6-10 repo itu **sah** HANYA kalau memang ada 6-10 kelompok yang tak boleh saling lihat. Kalau cuma ada 2 kelompok (mis. "inti" vs "fitur"), 2-3 repo sudah cukup — repo ekstra cuma menambah ongkos koordinasi, **bukan** keamanan.

---

## Langkah isi (5 langkah)

**1. Salin berkas contoh** `lintasai-portfolio.example.yml` → ganti nama jadi `lintasai-portfolio.yml` (buang `.example`). Simpan di **satu tempat pusat**: repo "induk"/meta milik owner, atau folder di laptop owner. Cukup **1 buku induk** untuk seluruh portfolio.

**2. Isi bagian `portfolio`** (identitas):
- `base_name` — awalan nama repo kamu (mis. `bigseo` → repo-nya `bigseo-backend`, `bigseo-dashboard`).
- `github_owner` — nama akun/organisasi GitHub-mu.
- `default_visibility: private` — **biarkan `private`**. Repo bisnis jangan publik.

**3. Isi `access_groups`** (kelompok staff = "GitHub Team"): ini soal **tingkat kepercayaan**, bukan jabatan.
- `core-backend` — **3-5 orang** paling dipercaya yang boleh pegang server + database.
- `feature-staff` — **~40 orang** yang cuma kerja tampilan/fitur. **Tidak** lihat backend.
- `shared-readers` — siapa saja yang perlu **baca** kontrak tipe-bersama.
- Isi `members` dengan **username GitHub** (bukan email). Mulai dari **TOLAK-DEFAULT**: orang baru masuk grup paling kecil dulu, ditambah cuma kalau task-nya menuntut.

**4. Isi `repos`** (daftar tiap repo). Untuk tiap repo, 4 hal kunci:

| Kolom | Artinya (bahasa awam) |
|---|---|
| `name` | nama repo di GitHub |
| `role` | perannya: `backend` (server+DB), `frontend`/`dashboard` (tampilan), `shared` (tipe-bersama), `service` (1 kapabilitas + loket API), `tools` (skrip admin) |
| `access_tier` | tingkat-rahasia: **`sensitive`** (ada kunci DB/rahasia), **`feature`** (tampilan, TANPA kunci), **`shared`** (cuma bentuk-data) |
| `allowed_teams` | **kelompok yang boleh download (clone) repo ini** — INI yang benar-benar mengunci pintu |

**5. Cek ulang 2 hal:**
- Apakah tiap repo `sensitive` cuma diberi ke `core-backend` (lingkaran kecil)?
- Apakah tiap repo `feature` **tidak** diberi ke orang yang tak perlu? (tolak-default)

---

## 3 hal yang paling sering disalahpahami

1. **`allowed_teams` (izin clone) = SATU-SATUNYA yang benar-benar memblokir penyalinan kode.** 🏢 Kayak **pintu terkunci**: yang tak diundang dapat "403 — akses ditolak" saat coba download. Ini perlindungan IP (kekayaan intelektual = resep rahasia bisnis) yang **nyata**.

2. **CODEOWNERS itu BEDA — bukan izin clone.** CODEOWNERS cuma menentukan **"siapa wajib me-review"** sebuah perubahan. Berguna untuk mencegah salah-gabung, **tapi tidak mencegah orang men-download** repo. 📱 Bedanya kayak: "siapa yang ACC pengajuan" (CODEOWNERS) vs "siapa yang punya kunci pintu gudang" (izin clone). Jangan tertukar.

3. **Repo `feature`/`frontend`/`dashboard` DILARANG menyimpan kunci rahasia.** Mereka ambil data lewat **API backend** (kayak HP-mu nanya ke server GoFood — HP tidak menyimpan database resto). Pengaman ini dipaksa otomatis saat pasang (lihat `SPLIT_REPO_PREPROVISION_v1.md`): kalau ada kunci DB nyasar ke repo fitur → proses **berhenti**, bukan lanjut.

---

## Input / Output

- **Input:** daftar repo kamu + kelompok staff (siapa boleh lihat apa).
- **Output:** 1 berkas `lintasai-portfolio.yml` yang jadi sumber untuk: (a) atur izin akses GitHub (`ACCESS_CONTROL_NREPO_v1.md`), (b) pasang/update kit di tiap repo, (c) kirim tipe-bersama ke banyak repo (nanti).

## Dependensi

- `lintasai-portfolio.example.yml` (kerangka untuk disalin).
- `ACCESS_CONTROL_NREPO_v1.md` (langkah berikutnya: ubah Buku Induk jadi izin GitHub nyata).

## Catatan

- Gampang salah: mengira "banyak repo = aman". Bukan. Yang mengamankan = **izin clone** + **rahasia cuma di backend**. Buku Induk ini cuma **mencatat** keputusan akses; yang menegakkan = langkah `ACCESS_CONTROL_NREPO_v1.md`.
- Gampang salah: menaruh username yang salah di `members` → orang yang seharusnya tidak boleh malah diundang. Cek ulang sebelum eksekusi izin.
- Berkas ini **tidak** berisi kunci rahasia — aman dibaca AI. Tetap simpan di repo **private**.
