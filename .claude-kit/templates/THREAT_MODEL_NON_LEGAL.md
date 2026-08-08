# THREAT_MODEL_NON_LEGAL — Peta Ancaman untuk Tim Tanpa Jalur Hukum

> Versi 1 · 2026-06-14 · untuk owner/lead non-programmer · 1 halaman, baca sekali

## Tujuan

Tim ini **belum punya jalur hukum** (NDA/kontrak kerahasiaan yang bisa dituntut). Artinya: kalau ada yang menyalin kode rahasiamu, kamu **tidak bisa mengandalkan pengacara** untuk menghukum. Maka **pintu yang terkunci di GitHub + pemisahan rahasia = pertahanan nyatamu** — bukan surat perjanjian.

Dokumen ini menjawab 3 pertanyaan singkat (gaya "peta ancaman"): **apa yang dilindungi**, **dari siapa**, **dengan apa**. Tujuannya bukan menakut-nakuti — tapi supaya kamu tahu **di mana harus ketat** dan **di mana boleh longgar**, jadi energi keamanan tidak terbuang ke tempat yang salah.

> 🏢 **Analogi:** kayak **denah pengamanan toko emas**. Kamu tidak pasang brankas di kasir dan etalase kaca di gudang emas — kamu taruh yang paling berharga di ruang paling terkunci. Peta ini bantu kamu tahu mana "gudang emas"-mu.

---

## 1) Apa yang dilindungi (aset — urut dari paling berharga)

| Aset | Kenapa berharga | "Gudang emas" atau "etalase"? |
|---|---|---|
| 🥇 **Resep rahasia bisnis** (logika backend, algoritma, cara kerja tiap kapabilitas) | Ini yang bikin produkmu beda. Kalau bocor → pesaing tinggal jiplak. | 🔒 Gudang emas — **lingkaran terkecil 3-5 orang** |
| 🥇 **Kunci database + kredensial** (`DATABASE_URL`, kunci layanan, token API berbayar) | Pegang ini = bisa baca/hapus SEMUA data pelanggan + tagih biaya ke kartu kreditmu. | 🔒 Gudang emas — **jangan pernah** ke repo fitur |
| 🥈 **Data pelanggan** (PII = data pribadi: nama, email, transaksi) | Bocor = kepercayaan hancur + bisa kena UU PDP. | 🔒 Terkunci di backend |
| 🥉 **Kode tampilan/fitur** (frontend, dashboard) | Kalau dijiplak, kerugian kecil — tampilan mudah ditiru siapa saja, tak ada resep rahasia. | 🪟 Etalase — boleh ~40 staf |

> 🎯 **Inti:** yang wajib dijaga ketat = **resep rahasia + kunci**. Tampilan boleh longgar. Jangan habiskan energi mengunci etalase sambil gudang emas terbuka.

---

## 2) Dari siapa (model penyerang yang realistis)

Untuk tim seperti ini, ancaman terbesar **BUKAN** peretas asing di film. Yang realistis:

| Penyerang | Skenario nyata | Seberapa mungkin |
|---|---|---|
| 🚪 **Staf yang keluar tidak baik-baik** | Resign/dipecat lalu bawa salinan kode repo yang dia bisa akses — untuk pesaing atau bikin tiruan. | **Paling mungkin** |
| 😐 **Staf aktif yang iseng/khilaf** | Tidak sengaja commit file `.env` berisi kunci asli, atau paste kunci di chat grup. | Sering (tak sengaja) |
| 🕵️ **Orang luar via akses berlebih** | Staf diundang ke repo yang tak perlu → makin banyak orang pegang kunci = makin besar peluang bocor. | Naik kalau "undang ke semua biar gampang" |
| 🌐 **Peretas acak dari internet** | Coba tebak kredensial / pakai kunci yang ter-publish tak sengaja. | Ada, tapi GitHub Secret Scanning + repo private sudah menahan sebagian besar |

> 🚨 **Sadar diri yang penting:** karena tanpa jalur hukum, kamu **tidak bisa** menghentikan orang yang **sekarang punya akses sah** untuk menyalin. Yang bisa kamu lakukan = **batasi SIAPA yang punya akses** (sesedikit mungkin) + **siap menelusuri jejak** kalau terjadi. Itu sebabnya "gudang emas" cuma 3-5 orang.

---

## 3) Dengan apa (mitigasi berlapis — yang sudah/akan dipasang kit)

| Lapis | Apa | Status di kit |
|---|---|---|
| 🔒 **Izin clone GitHub** (`allowed_teams` di Buku Induk) | Yang tak diundang **tidak bisa download** repo (dapat 403). Lapis utama. | `ACCESS_CONTROL_NREPO_v1.md` |
| 🔑 **Pemisahan rahasia per tingkat** | Repo fitur **tidak punya** kunci DB → walau dilihat, tak ada yang berharga. | `SPLIT_REPO_PREPROVISION_v1.md` (tier-driven) |
| 🚫 **Tolak-default saat onboarding** | Staf baru mulai **tanpa akses**, ditambah hanya repo yang dia kerjakan. | checklist `ACCESS_CONTROL_NREPO_v1.md` |
| 📅 **Cek-akses bulanan** | Pastikan tak ada akses "ketinggalan" (mis. staf sudah pindah tapi masih bisa backend). | robot pengingat `audit-access.yml` |
| 🔎 **Penjaga kebocoran otomatis** | Robot menolak commit yang berisi file `.env` asli / kunci asli. | robot `secret-guard.yml` |
| 🧭 **Siap forensik** | Kalau ada staf keluar tidak baik-baik → bisa telusuri "siapa pegang apa, kapan". | `SECURITY_INCIDENT_PLAYBOOK.md` bagian forensik |

---

## Yang TIDAK bisa dilakukan peta ini (kejujuran)

- ❌ **Tidak** menghentikan orang yang **punya akses sah** untuk menyalin. Itu di luar kendali teknis — yang bisa = perkecil jumlahnya jadi 3-5 orang inti yang paling dipercaya.
- ❌ **Tidak** menggantikan jalur hukum. Kalau bisnis tumbuh, **NDA/kontrak tetap layak dikejar** — ini pertahanan teknis sebagai lapis pertama, bukan satu-satunya.
- ❌ **Tidak** mendeteksi 100% kebocoran. Penjaga otomatis menahan yang **kasar & jelas** (file `.env`, kunci asli); yang canggih bisa lolos. Karena itu **seleksi orang** tetap nomor satu.

> 🎯 **Garis bawah:** untuk tim tanpa jalur hukum, urutan kekuatan pertahanan = **(1) sedikitkan orang yang pegang gudang emas → (2) pisahkan rahasia dari etalase → (3) siap telusuri jejak.** Peta ini bantu kamu fokus ke ketiga itu, bukan sibuk di hal yang dampaknya kecil.

---

## Input / Output

- **Input:** kondisi tim (tanpa jalur hukum, ~40 staf, 3-5 inti) + Buku Induk (`lintasai-portfolio.yml`).
- **Output:** kejelasan **di mana ketat, di mana longgar** + rujukan ke lapis-lapis mitigasi konkret.

## Dependensi

- `ACCESS_CONTROL_NREPO_v1.md` (izin clone — lapis utama).
- `SPLIT_REPO_PREPROVISION_v1.md` (pemisahan rahasia per tingkat).
- `SECURITY_INCIDENT_PLAYBOOK.md` (langkah saat ada insiden + forensik staf-keluar).

## Catatan

- Gampang salah: mengira ancaman utama = peretas asing. Untuk tim ini, yang realistis = **staf keluar bawa akses**. Fokus ke kontrol-akses, bukan cuma firewall.
- Gampang salah: mengunci semua repo sama ketatnya. Itu boros + bikin kerja staf fitur lambat. **Bedakan gudang emas vs etalase.**
- Perbarui peta ini kalau kondisi berubah (mis. nanti ada NDA, atau jumlah orang inti bertambah).
