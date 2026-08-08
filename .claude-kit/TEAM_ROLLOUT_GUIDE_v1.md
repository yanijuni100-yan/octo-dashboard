# TEAM_ROLLOUT_GUIDE_v1.md - Cara Bikin Kit Ini Jadi Standar Tim
> v1.1 · 2026-06-17 · untuk pemimpin tim IT (3-10 orang)

> ⚡ **Cara pasang & update termudah (lintasAI sudah di npm):** staff cukup jalankan **`npm create lintasai`** di folder project untuk memasang kit (1 perintah, otomatis versi terbaru). Untuk update, staff cukup **minta AI di chat: "tolong update kit"**. Panduan di bawah (repo standar tim + tata kelola) tetap berlaku untuk hal yang TIDAK ada di kit npm (aturan khusus tim, exception, proposal). Untuk distribusi kit-nya sendiri, **utamakan `npm create lintasai`** dibanding clone manual / `install-windows.ps1`.

## Tujuan & Filosofi
Kit aturan AI ini jadi **sumber kebenaran tunggal** untuk gaya kerja AI-assisted di tim. Tujuan: konsisten lintas-anggota & lintas-proyek, perbaikan bertahap (bukan paksa rewrite), fokus pada workflow yang AI bisa enforce sendiri (DoD, docs, naming, commit). Standar ini **bukan alat control**, tapi **alat hemat energi** - biar tim gak debat ulang aturan yang sama tiap proyek.

## Prasyarat tim
- Semua anggota punya **Claude Code** ter-install dan login Anthropic.
- Semua anggota pakai **Windows** (kit ini Windows-only).
- Satu **bahasa kerja** disepakati: **Bahasa Indonesia** (default kit ini).
- Ada **channel komunikasi** aktif (Slack/Discord/WhatsApp group `#it-standard` atau sejenisnya).
- Ada **1 owner standar** (mis. kamu) yang approve perubahan aturan.

---

## Step 1: Setup sumber kebenaran tunggal
**Rekomendasi:** Git repo private di GitHub/GitLab dengan tag versi. Contoh nama: `<orgmu>/claude-team-standard`.

Struktur folder repo:
```
claude-team-standard/
├── README.md                              ← onboarding teman/staff
├── CLAUDE_universal_v1.md                 ← aturan utama
├── PROJECT_LIFECYCLE_PROMPT_v1.md         ← unified: Stage 1 Kickoff / 2 Bootstrap / 3 Update / 4 Migration
├── TEAM_ROLLOUT_GUIDE_v1.md               ← file ini, baca owner standar
├── install-windows.ps1
├── templates/
│   ├── architecture.md
│   └── glossary.md
├── exceptions.md                          ← lihat "Exception management" di bawah
└── CHANGELOG.md                           ← log perubahan per versi
```

Tag rilis: `v1`, `v1.1`, `v2`. Anggota tim clone/download per tag.

**JANGAN simpan di Google Drive folder bebas** - versi gampang nyasar, anggota gak tahu mana yang terbaru.

## Step 2: Rilis v1 ke tim
Checklist owner standar:
1. **Upload kit ke repo internal** + tag `v1.1` (atau versi saat ini).
2. **Jadwalkan "install party" 30 menit** (live di Meet/Zoom): semua anggota install bareng, biar bisa tanya langsung kalau stuck.
3. **Tiap anggota verifikasi** dengan brief Claude: *"Halo, aku staff baru. Tolong cek install kit + briefing aturan dasar."* AI auto-apply Guided Step-by-Step Workflow (CLAUDE_universal_v1.md section 4.3). Screenshot hasil verifikasi, share ke channel.
4. **Owner cek-list** di channel: semua anggota ✅ → rollout sukses.
5. **Update `CHANGELOG.md`** di repo: tanggal rilis, ringkasan apa yang baru.

## Step 3: Adopsi per-proyek
Tiap proyek pilih 1 dari 3 jalur:

| Kondisi proyek | Pakai prompt |
|---|---|
| Proyek **BARU** dari nol | `PROJECT_LIFECYCLE_PROMPT_v1.md` (Stage 1 (Proyek Baru): Kickoff) - AI bikin struktur sesuai standar dari awal |
| Proyek **LAMA** tanpa `docs/` sama sekali | `PROJECT_LIFECYCLE_PROMPT_v1.md` (Stage 2 (Bikin Catatan Proyek): Bootstrap Docs) - AI auto-fill docs/ dari codebase |
| Proyek **SETENGAH JADI** (ada code + mungkin docs + konvensi sendiri) | `PROJECT_LIFECYCLE_PROMPT_v1.md` (Stage 4 (Rapikan ke Standar Tim): Migration) - AI audit gap, bikin plan bertahap |

Filosofi adopsi di proyek setengah jadi: **bentrok OK, perbaikan bertahap**. Lihat detail di `PROJECT_LIFECYCLE_PROMPT_v1.md` (Stage 4 (Rapikan ke Standar Tim): Migration).

## Step 4: Governance ringan
5 keputusan owner standar:

1. **Owner = kamu** (atau orang yang ditunjuk). Owner satu-satunya yang merge ke `main` di repo standar.
2. **Versioning:**
   - **Patch** (mis. `v1.1`): perubahan kecil non-breaking (typo fix, klarifikasi, tambah aturan opsional).
   - **Minor** (mis. `v1.2`): tambah file/prompt baru, tambah seksi.
   - **Major** (mis. `v2`): breaking - aturan lama ganti, struktur folder ubah. Wajib announce 1 minggu sebelum rilis.
3. **Channel diskusi:** `#it-standard` (atau sejenisnya). Semua usulan + announce update lewat sini.
4. **Format usulan perubahan aturan** (template di bawah). Anggota tim buka issue di repo, owner review + approve.
5. **Cadence review:** akhir bulan - owner review usulan & exception, rilis update kalau ada.

### Template usulan perubahan aturan
File baru di repo: `proposals/<tanggal>-<judul-singkat>.md`
```markdown
# Usulan: <judul>
> Pengusul: <nama> · Tanggal: <YYYY-MM-DD>

## Aturan yang diusulkan
<1-2 kalimat aturan baru atau perubahan>

## Alasan
<kenapa perlu, masalah apa yang diselesaikan>

## Dampak
- Proyek yang terdampak: <semua/sebagian/spesifik>
- Besar usaha penyesuaian (effort migrasi): <ringan/sedang/besar>
- Bikin cara lama tidak jalan lagi (breaking)? <ya/tidak - kalau ya, masuk kelompok Quick Wins/Bertahap/Strategi Besar>

## Alternatif yang dipertimbangkan
<alternatif yang ditolak + alasan>
```

## Step 5: Distribusi update
Saat owner rilis `v1.2`:
1. **Tag rilis** di repo dengan changelog detail.
2. **Announce di channel** - 1 paragraf: apa yang baru, dampak ke proyek existing, kapan deadline anggota update.
3. **Anggota update** - cara termudah: **minta AI di chat "tolong update kit"** (AI yang jalankan, backup otomatis). Untuk aturan khusus tim di repo standar terpisah: `git pull` versi terbaru.
4. **Ceklis di channel** - anggota react ✅ di pesan announce kalau sudah update.
5. **Owner follow-up** anggota yang belum update setelah deadline.

## Step 6: Tracking progres tim (metric ringan, BUKAN dashboard)
Update manual di Google Sheet `it-standard-progress`:

| Proyek | Owner | docs/architecture | docs/glossary | % pesan catatan-perubahan format standar (Conv Commits) | Quick Wins selesai |
|---|---|---|---|---|---|
| project-alpha | dev-1 | ✅ | ✅ | 90% | 4/4 |
| inventory-app | dev-2 | ✅ | ⚠️ | 60% | 2/4 |
| landing-page | dev-3 | ❌ | ❌ | 30% | 0/4 |

Target tim:
- **3 bulan:** 100% proyek punya `docs/architecture.md`.
- **2 bulan:** 80% PR ikut Conventional Commits.
- **Per quarter:** review proyek yang masih banyak gap, alokasi sprint khusus migrasi.

Review metric tiap akhir bulan (10 menit di standup).

---

## Exception management
Beberapa proyek pasti punya alasan kuat opt-out dari aturan tertentu. **Catat di `exceptions.md`** supaya gak jadi "norma diam-diam".

### Template exception
File: `exceptions.md` di repo standar.
```markdown
# Catatan Pengecualian (Exception Log) - Standar Tim IT

| Proyek | Aturan di-skip | Alasan | Berlaku sampai (sunset date) | Pemberi izin | Reviewer |
|---|---|---|---|---|---|
| client-x-portal | Bahasa docs ID → EN | Klien minta EN | 2026-12-31 | owner | jane |
| legacy-erp | Conv Commits | Proyek (repo = tempat simpan kode) sudah 5 tahun pakai format bebas, penyesuaian masuk Strategi Besar | belum ditentukan | owner | bob |
```

Review tiap bulan: sunset date sudah lewat? Reviewer ganti? Alasan masih valid?

---

## Anti-pattern tim yang dihindari
- **Owner standar pegang semua, jadi bottleneck.** Tunjuk 1 deputy yang bisa approve usulan kecil.
- **Rilis update tanpa announce → ada yang tertinggal.** Selalu lewat channel + cek-list eksplisit.
- **Exception jadi norma karena gak pernah di-review.** Kalender bulanan untuk review `exceptions.md`.
- **Junior takut bertanya jadi pura-pura paham.** Owner: tanyain langsung di standup, biasakan budaya "gak paham itu wajar".
- **Standar dipakai jadi alat blame senior ke junior.** Owner tegur: kit ini untuk hemat energi, bukan untuk nyalahin. Code review fokus pada code, bukan ke orangnya.
- **"Senior gak ikut standar, jadi junior gak perlu juga."** Owner enforce di code review - pelanggaran standar di PR baru = revisi.

---

## FAQ tim

**Q: Aku gak setuju aturan X, gimana?**
A: Buka usulan di repo (tempat simpan berkas standar tim — template di Step 4). Owner review di akhir bulan. Sementara itu, tetap ikut aturan yang berlaku sekarang - debat di channel `#it-standard`, jangan diam-diam langgar.

**Q: Klien minta pakai standar mereka, harus gimana?**
A: Catat di `exceptions.md` dengan tanggal batas berlaku pengecualian (sunset date). Standar tim cuma berlaku untuk proyek internal/tim sendiri. Klien external = aturan klien menang.

**Q: Senior di proyek X gak ikut standar, aku junior bingung mau ikut yang mana.**
A: Lapor ke owner standar (kamu/atau channel). Owner yang tegur ke senior. Junior: tetap ikut standar, jangan ikut kebiasaan jelek.

**Q: Standar update v1.2 tapi proyek aku sudah running 6 bulan dengan v1, pusing harus migrasi semua?**
A: TIDAK perlu migrasi semua. Cuma item Quick Wins yang wajib dalam 1 minggu. Item Bertahap & Strategi Besar = nyusul. Detail di `PROJECT_LIFECYCLE_PROMPT_v1.md` (Stage 4 (Rapikan ke Standar Tim): Migration).

**Q: Aku onboard freelance/kontrak cuma 2 minggu, perlu install kit?**
A: Tergantung. Kalau cuma utak-atik 1-2 file, gak perlu - cukup brief verbal. Kalau full bagian tim 2+ minggu, install supaya output konsisten.

**Q: Aturan global vs aturan proyek (`./AGENTS.md`) - yang mana baca duluan?**
A: Dua-duanya. Aturan proyek **menimpa sebagian** aturan global untuk proyek itu. Mis. global bilang "pesan catatan perubahan (commit) wajib format Conventional Commits", proyek bilang "kami pakai format bebas karena sistem lama warisan (legacy)" → di proyek itu, format bebas menang.

**Q: Aturan tim ini akan diapain kalau aku resign / pindah role?**
A: Owner harus tunjuk pengganti minimal 1 bulan sebelum keluar. Serah-terima pengetahuan (knowledge transfer): bedah bareng isi `TEAM_ROLLOUT_GUIDE_v1.md` dengan pengganti + serah-terima hak menyetujui perubahan (approval) di repo standar (tempat simpan berkas standar tim).

---

## Penutup
Standar bukan untuk control, tapi untuk **hemat energi tim** & **cegah salah-paham**. Anggota tim yang patuh standar → AI mereka konsisten → output proyek konsisten → onboarding anggota baru lebih cepat. Itu untungnya.

Kalau ada pertanyaan, ke channel `#it-standard`. Selamat ngeshipping bareng tim yang patuh standar!
