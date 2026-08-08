# KERJA_KELOMPOK.md — Cara kerja bareng tim di project ini (untuk non-programmer)

> Versi 1 · 2026-06-15 · Panduan singkat "pintu masuk" kerja kelompok lintasAI

Ini **halaman pertama** yang dibuka kalau project ini dikerjakan **lebih dari 1 orang**. Isinya ringkas + menunjuk ke panduan detail yang sudah ada — supaya kamu tidak bingung harus baca yang mana dulu.

🏢 **Analogi:** ini seperti **papan petunjuk di pintu masuk kantor** — bukan menjelaskan semua ruangan, tapi menunjukkan "ruang rapat ke kiri, dapur ke kanan". Detailnya ada di ruangannya masing-masing.

---

## 1. Aturan inti (3 kalimat)

1. **`main` itu versi resmi tim — TIDAK boleh diubah langsung.** Semua perubahan lewat **salinan kerja terpisah** (branch) → **minta diperiksa** (Pull Request / PR) → baru **digabung**.
2. **Minimal 1 orang lain memeriksa** sebelum digabung (lewat CODEOWNERS — "approver wajib").
3. **`main` dikunci** di GitHub supaya aturan #1 dan #2 tidak bisa dilanggar walau tidak sengaja.

🏢 Analogi: `main` = **laporan keuangan resmi** yang sudah di-cap. Tidak ada yang boleh coret-coret langsung di situ — kamu buat **fotokopi** (branch), coret-coret di fotokopi, ajukan ke atasan untuk diperiksa (PR + review), baru hasilnya disalin ke laporan resmi (gabung ke `main`).

---

## 2. Alur harian (tidak perlu hafal — AI yang urus)

Kamu cukup bilang ke AI: *"aku mau perbaiki X"* / *"tambah fitur Y"*. AI yang mengurus salinan-kerja + catatan + PR. Tapi gambaran besarnya:

```
salinan kerja baru (branch)  →  kerjakan + catat (commit)  →  minta diperiksa (PR)
   →  rekan/AI periksa + cek otomatis lulus  →  disetujui  →  digabung ke main  →  salinan dihapus
```

**Detail lengkap alur harian + cara menyelesaikan tabrakan 2 versi (merge conflict)** ada di:
- 📘 `CLAUDE_TEAM_GUIDE.md` §5 (alur branch → PR → gabung), §8 (AI bantu periksa kode), §10 (tabrakan 2 versi)
- 📘 `TEAM_FLOW_SKETCH_v1.md` (pipa kerja ujung-ke-ujung + 5 peran + serah-terima)

Jangan dijelaskan ulang di sini — buka dua berkas itu kalau mau detail.

---

## 3. 🔒 LANGKAH MENGUNCI `main` DI GITHUB (klik-demi-klik) — WAJIB, dilakukan OWNER

Ini bagian yang **hanya bisa kamu (owner/pemilik repo) lakukan** lewat browser — AI **tidak bisa** dan **tidak boleh** mengubah setelan GitHub-mu. Cuma sekali pasang.

1. Buka repo di GitHub → klik tab **Settings** (Pengaturan).
2. Menu kiri → **Branches** (atau **Rules → Rulesets** di tampilan baru).
3. Klik **Add branch protection rule** (atau **New ruleset**).
4. Di **Branch name pattern**, ketik: `main`
5. **Centang** kotak-kotak ini (ini "4 kunci" pengamannya):
   - ☑️ **Require a pull request before merging** — tidak ada yang bisa ubah `main` langsung; wajib lewat PR.
     - ☑️ sub-opsi **Require approvals** → set **1** (minimal 1 orang menyetujui).
     - ☑️ sub-opsi **Require review from Code Owners** — yang menyetujui harus dari daftar `CODEOWNERS`.
   - ☑️ **Require status checks to pass before merging** — cek otomatis (test/build) harus hijau dulu. (Pilih cek yang relevan kalau muncul.)
   - ☑️ **Do not allow bypassing the above settings** — supaya owner pun ikut aturan (mencegah "kepleset").
   - Pastikan **Allow force pushes** dan **Allow deletions** **TIDAK** dicentang (biar `main` tidak bisa ditimpa paksa / dihapus).
6. Klik **Create** / **Save changes**.

🏢 Analogi: ini seperti **memasang kunci + buku tamu di pintu brankas**. Setelah dikunci, siapa pun (termasuk kamu) yang mau masuk wajib lewat prosedur: isi buku tamu (PR), minta tanda tangan penjaga (review CODEOWNERS), alarm aman (cek otomatis hijau). 📱 Mirip **transfer BCA di atas limit** yang wajib OTP — sengaja dibikin tidak bisa "asal klik".

> **Cara cepat alternatif (kalau kamu nyaman jalankan skrip):** ada skrip siap-pakai `.github/scripts/setup-branch-protection.ps1`. Jalankan dulu **mode SIMULASI** (lihat-lihat, tidak mengubah apa pun), baru tambah `-Apply` kalau sudah yakin. Tapi cara klik di atas tetap paling aman untuk non-programmer karena kamu lihat sendiri tiap centang.

---

## 4. Siapa jadi "approver wajib" (CODEOWNERS) — diisi OWNER

Berkas `.github/CODEOWNERS` menentukan **siapa wajib memeriksa bagian mana**. Saat baru dipasang, isinya masih contoh — **ganti dengan username GitHub asli** tim kamu.

- Ambil daftar orang + perannya dari `.github/staff-roster.yml`.
- Bagian sensitif (login/pembayaran/database) → reviewer-nya **senior/architect**, jangan junior.
- **JANGAN 1 owner saja (anti-bottleneck).** Tulis **2-3 owner per area** (mis. `@andi @budi @citra`) — GitHub cukup approval dari **salah satu** (kalau 1 cuti, yang lain bisa ACC). Kalau pakai **organisasi**, pakai **team** sebagai owner (`@org/backend-reviewers`) + nyalakan "code review assignment" biar beban dibagi rata. **Gate area sensitif saja**; area umum cukup "Require approvals: 1" dari siapa saja (lebih cepat).
- Detail format + contoh: buka `.github/CODEOWNERS` (sudah ada komentar penjelasan di dalamnya).

> 🚨 **PENTING jangan keliru:** CODEOWNERS itu **siapa yang WAJIB memeriksa**, **BUKAN** siapa yang boleh meng-clone/mengunduh kode. Melindungi kode dari "dicuri/disalin" itu urusan **izin akses repo** (siapa yang kamu undang sebagai collaborator), bukan CODEOWNERS. Penjelasan lengkap + cara atur akses berjenjang: `ACCESS_CONTROL_NREPO_v1.md`.

---

## 5. Formulir minta-review (PR template)

Saat seseorang membuka PR, GitHub otomatis menampilkan isian dari `.github/pull_request_template.md` (Ringkasan / Kenapa / Apa berubah / Cara verifikasi / Risiko + cara membalikkan). Isi apa adanya — itu yang dibaca pemeriksa. Tidak perlu diatur, sudah otomatis.

---

## 6. Kalau ada masalah / mau membatalkan

- **Tabrakan 2 versi (merge conflict):** `CLAUDE_TEAM_GUIDE.md` §10.
- **Balik ke versi sebelumnya (rollback) / insiden:** `CLAUDE_TEAM_GUIDE.md` §13b + `SECURITY_INCIDENT_PLAYBOOK.md`.
- **Mau usul ubah ATURAN tim (bukan kode):** itu beda — lihat `CONTRIBUTING.md` + `TEAM_ROLLOUT_GUIDE_v1.md`.

---

## 7. Checklist sekali-pasang untuk OWNER

- [ ] Kunci `main` di GitHub (Bagian 3 di atas).
- [ ] Isi `.github/CODEOWNERS` dengan username GitHub asli (Bagian 4).
- [ ] Isi `.github/staff-roster.yml` (daftar tim + peran).
- [ ] Undang anggota tim sebagai collaborator di GitHub (sesuai akses berjenjang `ACCESS_CONTROL_NREPO_v1.md`).
- [ ] Beri tahu tim: buka `KERJA_KELOMPOK.md` ini dulu sebelum mulai.

> 💡 Mau menyiapkan/menyegarkan berkas kerja-kelompok kapan saja? Jalankan di dalam folder project ini: `.\.claude-kit\kit.ps1 team-setup`
