# WIZARD BUKU INDUK AKSES — naskah AI mewawancarai owner (tanpa sentuh YAML)

> Versi 1 · 2026-06-26 · pendamping `lintasai-portfolio.example.yml` + `lib/portfolio-write.mjs` (robot penulis) + `PORTFOLIO_REGISTRY_v1.md` (penjelasan isi) + `ACCESS_CONTROL_NREPO_v1.md` (langkah berikutnya)

## Untuk siapa & kenapa

Ini **naskah untuk AI**. Tujuannya: AI **mewawancarai owner/lead non-programmer pakai bahasa biasa**, lalu **menuliskan sendiri** berkas Buku Induk `lintasai-portfolio.yml` — owner **tidak pernah** perlu menyentuh format YAML. Buku Induk = 1 berkas yang mencatat **semua repo + siapa boleh akses masing-masing**; dia fondasi kontrol-akses pisah-repo (pertahanan utama tim **tanpa NDA**).

> 🏢 **Analogi (untuk owner):** kayak **petugas yang membantumu isi formulir di bank** — kamu cukud jawab pertanyaan ("siapa boleh pegang brankas?"), petugas yang menuliskan ke formulir resmi. Kamu tidak perlu tahu bentuk formulirnya.

**Pemicu (frasa owner):** *"buatkan Buku Induk akses"* / *"isi buku induk"* / *"wizard akses"* / *"pandu aku isi Buku Induk lintasAI"*. Saat owner menyebut salah satunya → AI jalankan naskah ini.

---

## Aturan main untuk AI (WAJIB)

1. **Sajikan BERTAHAP (§4.7 Alur Berpemandu Bertahap).** Satu pertanyaan → tampilkan info ringkas → **popup klik** (`AskUserQuestion`) → lanjut otomatis. JANGAN tumpuk semua pertanyaan sekaligus. Tiap popup: opsi paling aman jadi `[1]` + label `(rekomendasi)` + alasan awam (§14.1).
2. **Bahasa non-programmer (§2.1).** Tiap istilah teknis dijelaskan singkat. Hindari kata "YAML/parse/schema" mentah ke owner — pakai "berkas catatan", "robot pemeriksa".
3. **Mode aman cuma-baca dulu.** Tidak menulis `lintasai-portfolio.yml` sampai owner melihat ringkasan + menyetujui.
4. **TOLAK-DEFAULT (keamanan).** Tiap pilihan akses: bawaan = **paling sedikit** (lingkaran terkecil). Tambah hanya kalau owner sebut perlu. Repo backend/rahasia → bawaan hanya kelompok inti 3-5 orang.
5. **AI yang menulis, robot yang memeriksa.** AI mengumpulkan jawaban → susun data → panggil **robot** `portfolio-write.mjs` (robot yang menulis berkas + memeriksa keamanan). AI **tidak** mengetik YAML mentah (rawan salah format).
6. **Jangan mengubah izin GitHub.** Wizard ini cuma **mencatat** keputusan. Penerapan izin nyata = langkah terpisah `ACCESS_CONTROL_NREPO_v1.md` (AI cetak rencana, manusia klik).

---

## Data yang AI kumpulkan (bentuk akhir untuk robot)

AI mengumpulkan jawaban jadi objek seperti ini (JSON), lalu menyerahkannya ke robot. **Ini "dapur" AI — jangan ditampilkan mentah ke owner**; owner cukup melihat ringkasan bahasa awam.

```json
{
  "portfolio": { "base_name": "bigseo", "github_owner": "ojokesusu", "default_visibility": "private" },
  "access_groups": [
    { "id": "core-backend", "description": "Pegang server + database. Lingkaran terkecil.", "members": ["ojokesusu", "lead-1"] },
    { "id": "feature-staff", "description": "Hanya repo fitur/tampilan.", "members": ["staff-a", "staff-b"] }
  ],
  "repos": [
    { "name": "bigseo-backend", "role": "backend", "access_tier": "sensitive", "allowed_teams": ["core-backend"], "consumers": [] },
    { "name": "bigseo-dashboard", "role": "dashboard", "access_tier": "feature", "allowed_teams": ["core-backend", "feature-staff"], "consumers": [] }
  ]
}
```

- `role` (peran repo) pilih satu: `backend` (server+DB) · `frontend`/`dashboard` (tampilan) · `shared` (tipe-bersama) · `service` (1 kapabilitas + loket API) · `tools` (skrip admin).
- `access_tier` (tingkat-rahasia) pilih satu: `sensitive` (ada kunci DB/rahasia) · `feature` (tampilan, TANPA kunci) · `shared` (cuma bentuk-data).
- `allowed_teams` (boleh clone) = daftar `id` kelompok. **Ini lapis yang benar-benar mengunci download.** Tiap id WAJIB ada di `access_groups` (kalau tidak, robot menolak).
- `members` = **username GitHub** (bukan email).

---

## Langkah wawancara (urut — tiap langkah = 1 popup)

**Langkah 1 — Identitas.** Tanya: awalan nama repo (`base_name`, mis. "bigseo") + nama akun/org GitHub (`github_owner`). Tegaskan `default_visibility` = **private** (bawaan; jangan public).

**Langkah 2 — Kelompok kepercayaan.** Jelaskan: ini soal **"siapa boleh lihat apa"**, bukan jabatan. Tawarkan kerangka umum (owner boleh ubah):
- `core-backend` — **3-5 orang** paling dipercaya (pegang server + database).
- `feature-staff` — staff yang cuma kerja tampilan/fitur (TIDAK lihat backend).
- `shared-readers` — siapa saja yang perlu **baca** kontrak tipe-bersama.
Tanya berapa kelompok + namanya. Popup `[1]` = pakai kerangka 3-kelompok ini (rekomendasi: pas untuk mayoritas tim).

**Langkah 3 — Anggota tiap kelompok.** Untuk tiap kelompok, tanya username GitHub anggotanya. Ingatkan TOLAK-DEFAULT: mayoritas masuk `feature-staff`; `core-backend` **hanya** 3-5 orang inti. (Kalau owner belum hafal semua username, boleh isi sebagian dulu — Buku Induk bisa diperbarui nanti.)

**Langkah 4 — Repo satu per satu.** Untuk tiap repo, tanya 4 hal: nama, peran (`role`), tingkat-rahasia (`access_tier`), dan kelompok mana yang boleh akses (`allowed_teams`). Bawaan aman: repo `sensitive` → hanya `core-backend`. Ingatkan: **repo tampilan (frontend/dashboard) tidak boleh ditandai `sensitive`** (mereka ambil data lewat API backend, tak simpan kunci). Tanya jumlah repo dulu, lalu putar satu-satu — kalau banyak (>5), kelompokkan biar tak melelahkan (§4.7 anti-capek).

**Langkah 5 — Pratinjau (SIMULASI, belum menulis).** Susun data → jalankan robot mode **simulasi** untuk lihat hasil + peringatan keamanan:

```
node .claude-kit/lib/portfolio-write.mjs --in <draft.json> --out lintasai-portfolio.yml --dry-run
```

Tampilkan ke owner **ringkasan bahasa awam** (bukan YAML mentah): daftar repo + siapa boleh akses tiap repo + **peringatan** kalau ada (mis. "repo rahasia dibagi ke kelompok besar"). Popup konfirmasi: `[1]` Tulis sekarang (rekomendasi kalau tak ada peringatan serius) / `[2]` Perbaiki dulu / `[stop]`.

**Langkah 6 — Tulis + verifikasi.** Setelah owner setuju, jalankan robot menulis (tanpa `--dry-run`):

```
node .claude-kit/lib/portfolio-write.mjs --in <draft.json> --out lintasai-portfolio.yml
```

- Robot **menolak** kalau ada data rusak (mis. repo menunjuk kelompok tak terdaftar) → AI perbaiki + ulang.
- Robot **tidak menimpa** berkas yang sudah ada. Kalau Buku Induk sudah ada + owner mau perbarui → konfirmasi dulu, lalu tambah `--force`.
- Setelah ditulis, robot **baca-balik** otomatis untuk memastikan tulis & baca cocok. Hapus berkas draft sementara setelah selesai.

**Langkah 7 — ✅ SELESAI + rekap + langkah berikutnya.** Tampilkan rekap: berapa repo + kelompok tercatat, **apa yang diubah** (1 berkas dibuat) vs **tidak diubah** (izin GitHub belum disentuh). Lalu arahkan: *"Berikutnya, aktifkan izin akses nyata di GitHub — minta aku: 'cetak rencana kontrol-akses'"* (mengikuti `ACCESS_CONTROL_NREPO_v1.md`, mode aman: AI cetak rencana, kamu yang klik).

---

## Cara AI memanggil robot (catatan teknis)

1. Susun objek data → tulis ke berkas draft sementara JSON di **folder sementara sistem** (lewat `os.tmpdir()` di Node, atau mis. `d:\tmp` di Windows — JANGAN `/tmp` ala Unix), **bukan** di dalam project (jangan ke-commit).
2. Panggil `node .claude-kit/lib/portfolio-write.mjs --in <draft.json> --out lintasai-portfolio.yml` (tambah `--dry-run` untuk pratinjau, `--force` untuk menimpa yang sudah ada).
3. Kode keluar robot: `0` = sukses; `2` = argumen/JSON salah; `3` = data ditolak (ada error validasi — perbaiki); `4` = berkas sudah ada (pakai `--force`).
4. Hapus berkas draft sementara setelah selesai.

> Robot di repo kit (saat mengembangkan kit) ada di `lib/portfolio-write.mjs`; di project client ada di `.claude-kit/lib/portfolio-write.mjs`.

## Input / Output

- **Input:** jawaban wawancara owner (bahasa biasa) → objek data terstruktur (oleh AI).
- **Output:** 1 berkas `lintasai-portfolio.yml` yang valid + ber-komentar bahasa awam, terverifikasi bisa dibaca robot pembaca.

## Catatan

- Berkas ini **tidak** menyimpan rahasia TEKNIS (password/kunci) — jadi aman dibuat AI. **TAPI** isinya (nama tim + peran + siapa pegang apa) = **peta organisasi yang TETAP sensitif** → **WAJIB** simpan di repo **private**, jangan publik (peta tim bisa bocor ke pesaing).
- Buku Induk cuma **mencatat** keputusan. Yang **menegakkan** = izin clone GitHub (`ACCESS_CONTROL_NREPO_v1.md`). Jangan mengira "sudah bikin Buku Induk = sudah aman".
- Robot penulis = pasangan robot pembaca (`portfolio-read.mjs`); format keluaran dikunci tes tulis-baca supaya tak pernah melenceng.
