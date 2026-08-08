# ACCESS_CONTROL_NREPO — Atur "Siapa Boleh Akses Repo Mana" (banyak repo)

> Versi 1 · 2026-06-13 · untuk owner/lead non-programmer · membaca `lintasai-portfolio.yml` (Buku Induk)

## Untuk siapa & kenapa

Ini panduan **menegakkan kontrol-akses** lintas banyak repo: supaya **cuma 3-5 orang** bisa men-download (clone) repo backend + database, dan **~40 staff** cuma bisa repo fitur mereka. Ini **perlindungan utama** kalau tim **tidak punya jalur hukum (NDA/kontrak)** — pintu terkunci di GitHub adalah pertahanan nyatamu.

> 🏢 **Analogi:** kayak **kartu akses gedung**. Karyawan biasa cuma bisa buka lantai kerjanya; ruang server + brankas cuma untuk 3-5 orang berkartu khusus. Yang tak berkartu, pintunya **tidak terbuka** — bukan "diingatkan jangan masuk", tapi benar-benar terkunci.

> ⚠️ Sumber datanya = **Buku Induk** (`lintasai-portfolio.yml`). Isi dulu Buku Induk sebelum jalankan panduan ini — paling mudah lewat **wizard**: ketik *"buatkan Buku Induk akses"* (AI mewawancarai + menulis untukmu, lihat `WIZARD_BUKU_INDUK_v1.md`), atau isi manual ikut `PORTFOLIO_REGISTRY_v1.md`.

---

## Pertahanan berlapis — siapa yang BENAR-BENAR mengunci

Ada beberapa lapis, tapi **cuma satu yang benar-benar memblokir penyalinan kode**. Penting tahu bedanya supaya tidak salah merasa aman:

| Lapis | Fungsi | Benar-benar memblokir clone? |
|---|---|---|
| 🔒 **Izin clone GitHub** (`allowed_teams` di Buku Induk) | Yang tak diundang dapat **403** saat download | ✅ **YA — ini lapis utama** |
| 🔑 **Rahasia cuma di backend** (.env aman per tingkat) | Repo fitur tak punya kunci DB → walau dilihat, tak ada kunci | ✅ Pendukung kuat |
| 📦 **Token paket-bersama baca-saja** | Repo fitur boleh BACA tipe, tak boleh ubah | ✅ Pendukung |
| 📝 **CODEOWNERS + proteksi branch** | Siapa **wajib me-review** + cegah salah-gabung | ❌ **BUKAN izin clone** — tetap bisa download |

> 🚨 **Jangan tertukar:** CODEOWNERS itu soal "siapa ACC perubahan", **bukan** "siapa boleh download". Kalau kamu cuma pasang CODEOWNERS dan mengira IP aman → keliru. Yang mengunci download = **izin clone GitHub** (baris pertama tabel).

---

## Cara kerja: AI CETAK RENCANA dulu, kamu yang eksekusi (mode SIMULASI)

**Aturan keras:** AI **TIDAK** mengubah izin GitHub sendiri. AI cuma **membaca Buku Induk** lalu **mencetak rencana** "repo ini → undang tim ini, JANGAN undang tim itu". **Kamu (manusia)** yang menekan tombolnya. Kenapa: salah-set izin bisa (a) memberi staff biasa akses backend tanpa sadar, atau (b) mengunci orang inti dari kerjanya. Keputusan akses = keputusan manusia.

> 📱 **Analogi:** kayak GoFood menampilkan **ringkasan pesanan** sebelum kamu tekan "Bayar" — kamu lihat dulu, baru konfirmasi. Bukan langsung kepotong.

### Langkah pakai

**1. Minta AI cetak rencana akses.** Buka Claude Code, ketik:
> *"Baca `lintasai-portfolio.yml`, cetak RENCANA kontrol-akses (mode simulasi): untuk tiap repo, tim mana yang diundang + perannya, dan tim mana yang JANGAN diundang. Jangan ubah apa pun, cuma cetak."*

**2. AI menghasilkan MATRIKS AKSES** seperti ini (contoh):

```
RENCANA AKSES (SIMULASI — belum ada yang diubah)

Repo: bigseo-backend   [sensitive]
  ✅ Undang  : core-backend (3 orang) — Peran: Write
  🚫 JANGAN  : feature-staff, shared-readers
  Catatan    : lingkaran terkecil. Cek tak ada orang luar yang ke-undang.

Repo: bigseo-dashboard [feature]
  ✅ Undang  : core-backend (Write), feature-staff (Write)
  🚫 JANGAN  : —
  Catatan    : tampilan. Pastikan TIDAK ada kunci DB di repo ini.

Repo: bigseo-shared    [shared]
  ✅ Undang  : shared-readers — Peran: Read (baca-saja)
  🚫 JANGAN  : —
```

**3. Kamu eksekusi** lewat **klik di GitHub** (cara paling aman untuk non-programmer) — lihat langkah klik di bawah. (Kalau kamu/lead lebih cepat pakai baris-perintah, ada di Lampiran.)

---

## Cara klik di GitHub (paling aman, tanpa baris-perintah)

Lakukan **per repo**, ikuti matriks yang AI cetak:

**Bikin "tim" sekali (kalau belum ada):**
1. Buka `github.com/orgs/<github_owner>/teams` → **New team**.
2. Bikin tim sesuai `access_groups` di Buku Induk: `core-backend`, `feature-staff`, `shared-readers`.
3. Masukkan anggota (username GitHub) ke tim masing-masing.

**Beri akses repo ke tim (per repo, ikuti matriks):**
1. Buka `github.com/<github_owner>/<nama-repo>` → **Settings** → **Collaborators and teams**.
2. **Add teams** → pilih tim yang ada tanda ✅ di matriks.
3. Set **Role**:
   - Repo `sensitive`/`feature` yang dikerjakan → **Write**.
   - Repo `shared` (cuma dibaca) → **Read**.
4. **Pastikan tim ber-tanda 🚫 TIDAK ada** di daftar. Kalau ada → **Remove** (mereka tak seharusnya bisa download repo ini).

> 🏢 **Analogi:** kayak **isi daftar siapa boleh masuk ruangan** di buku satpam, lalu satpam yang menerapkan. AI bikin daftarnya; kamu yang menyerahkan ke "satpam GitHub".

---

## Saat ada STAFF BARU — checklist tolak-default

Prinsip: orang baru mulai **TANPA akses apa pun**, ditambah **hanya** repo yang dia kerjakan.

- [ ] Tentukan: staff ini masuk kelompok mana? (`feature-staff` untuk mayoritas; `core-backend` **hanya** untuk lingkaran inti 3-5 orang.)
- [ ] Tambahkan username-nya ke `members` kelompok itu di Buku Induk.
- [ ] Undang ke repo yang dia butuh **saja** (ikuti matriks). **JANGAN** undang ke repo `sensitive` kecuali dia memang `core-backend`.
- [ ] Catat di Buku Induk (biar peta akses tetap akurat).

> Lawannya (salah): "undang ke semua repo biar gampang". Itu membocorkan backend ke orang yang tak perlu. **Default = tolak**, tambah seperlunya.

## Saat staff KELUAR / pindah tim

- [ ] **Catat DULU** repo + tim apa saja yang dia punya (SEBELUM dicabut) — itu daftar realistis yang bisa dia salin. Kalau langsung cabut, kamu kehilangan petanya.
- [ ] Hapus dari `members` kelompok di Buku Induk.
- [ ] **Cabut akses** repo sensitif **segera** (GitHub → Settings → Collaborators and teams → Remove).
- [ ] **Rotate (ganti) kunci** yang dia mungkin tahu (DB password, token) -- buat baru, yang lama dimatikan -- kalau dia anggota `core-backend`.
- [ ] Jalankan **Cek-akses** di bawah untuk memastikan tak ada akses yang tertinggal.

> 🚪 **Kalau keluarnya tidak baik-baik** (resign mendadak / dipecat) → ikuti langkah **forensik READ-ONLY** di `SECURITY_INCIDENT_PLAYBOOK.md` bagian "Forensik saat staf KELUAR": catat akses → lihat jejak → BARU cabut + rotate. Tujuan = intel + tutup pintu ke depan, **bukan** menghukum (lihat juga `THREAT_MODEL_NON_LEGAL.md`).

---

## Cek-akses BULANAN (audit READ-ONLY — cuma membaca)

Akses gampang "set sekali lalu lupa". Cek **tiap bulan** memastikan kenyataan di GitHub masih cocok dengan Buku Induk. Supaya tidak lupa, kit memasang **robot pengingat** (`audit-access.yml`) yang otomatis membuka satu "Issue" tiap awal bulan: *"waktunya cek-akses"*. Robot itu cuma **mengingatkan** — pemeriksaannya tetap kamu jalankan (lewat AI, baca-saja). Sengaja TIDAK ada pencabutan otomatis, supaya tak ada akses yang ke-cabut keliru.

**Cara cepat (robot):** jalankan `npx lintasai access-verify` (atau `node .claude-kit/lib/access-verify.mjs`) — robot otomatis baca Buku Induk + tanya GitHub (read-only) + cetak SELISIH tim per repo + catat ke `.audit-log`. Butuh `gh` login + **organisasi** GitHub (bukan akun pribadi). Kalau `gh` tak tersedia/gagal, robot **BERHENTI + lapor** (tak pernah diam-diam bilang "aman"). Tetap READ-ONLY — pencabutan akses = kamu klik manual.

**Atau minta AI** (manual):
> *"Bandingkan siapa yang SEKARANG punya akses tiap repo (baca dari GitHub) dengan `lintasai-portfolio.yml`. Cetak SELISIH-nya: siapa punya akses yang TIDAK ada di Buku Induk, atau sebaliknya. Mode baca-saja, jangan ubah apa pun."*

AI akan menandai mis. *"⚠️ staff-X masih punya akses `bigseo-backend` padahal sudah pindah ke feature-staff"* → kamu cabut manual. Membaca daftar akses = aman (tidak mengubah apa pun).

---

## Lampiran (untuk lead teknis — baris perintah `gh`, OPSIONAL)

> Untuk yang nyaman baris-perintah. Non-programmer **lewati** — pakai cara klik di atas.
> ⚠️ AI: sebelum mencetak perintah ini ke owner, **konfirmasi sintaks persis** untuk versi `gh` yang terpasang (`gh --help`) — sintaks bisa beda antar-versi. Tetap **mode cetak/SIMULASI** (owner yang jalankan), JANGAN auto-eksekusi.

Pola standar (GitHub REST lewat `gh api`):
- Bikin tim: `gh api --method POST /orgs/<owner>/teams -f name=core-backend -f privacy=closed`
- Beri repo ke tim (read/write): `gh api --method PUT /orgs/<owner>/teams/core-backend/repos/<owner>/<repo> -f permission=push` (`pull` = read, `push` = write)
- Tambah anggota tim: `gh api --method PUT /orgs/<owner>/teams/core-backend/memberships/<username> -f role=member`
- **Cek akses (baca-saja)**: `gh api /repos/<owner>/<repo>/collaborators` + `gh api /repos/<owner>/<repo>/teams`

---

## Input / Output

- **Input:** `lintasai-portfolio.yml` (Buku Induk yang sudah diisi).
- **Output:** rencana akses tercetak (matriks) + langkah klik/perintah untuk **kamu** eksekusi. AI **tidak** mengubah izin sendiri.

## Dependensi

- `PORTFOLIO_REGISTRY_v1.md` (cara isi Buku Induk).
- `SPLIT_REPO_PREPROVISION_v1.md` (pengaman .env per tingkat — lapis pendukung).

## Catatan

- Gampang salah: mengandalkan CODEOWNERS sebagai "pengaman IP". Itu **bukan** izin clone. Yang mengunci download = `allowed_teams` (izin clone GitHub).
- Gampang salah: AI auto-mengubah izin. **Dilarang** — selalu cetak-rencana dulu, manusia yang eksekusi.
- Kejujuran: izin clone membatasi **berapa orang** bisa menyalin (3-5), bukan menghilangkan kemungkinan bagi yang **punya** akses. Tanpa jalur hukum sama sekali, seleksi ketat 3-5 orang inti + cek-akses berkala tetap penting.
