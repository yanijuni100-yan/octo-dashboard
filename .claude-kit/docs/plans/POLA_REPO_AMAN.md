# POLA_REPO_AMAN.md — Panduan struktur repo + database aman untuk tim non-programmer

> Versi 1 · 2026-06-22 · panduan (bahasa awam) · hasil rangkuman sesi desain

## Tujuan & untuk siapa
Acuan tetap cara menyusun **repo + database** supaya: **(a) database tidak bocor, (b) code/algoritma rahasia tak gampang dicuri/diduplikat, (c) staff cukup prompt** (tim non-programmer). Dirangkum supaya tak perlu mengulang analisa tiap sesi.

> 📌 **Catatan:** angka jumlah orang & nama engine/kapabilitas di panduan ini = **contoh ilustratif** dari satu kasus nyata — **sesuaikan dengan tim, stack, dan domain-mu sendiri**. Prinsipnya (pisah-repo, frontend nol-DB, schema-per-engine) yang penting, bukan angkanya.

> 🎯 **SUMBER TUNGGAL topologi repo (SSOT — Single Source of Truth = satu tempat kebenaran).** Keputusan **"berapa repo + model split mana"** tinggal DI SINI. Berkas lain (`SPLIT_REPO_MIGRATION_PROMPT_v1.md`, `JALANKAN_KIT.md`, `KEUNGGULAN_LINTASAI.md`, `README.md`) WAJIB **merujuk** prinsip ini — **JANGAN menyalin angka tetap** (mis. "3 repo", "6-10"). 🏢 Analogi: ini satu sel Excel yang ditarik rumus ke banyak tempat — ubah di sini, yang lain ikut paham; bukan angka yang diketik ulang di 6 dokumen Word (rawan basi).
>
> **⭐ ATURAN EMAS jumlah repo: jumlah IKUT (a) berapa _wilayah rahasia_ (engine) + (b) berapa _kelompok-akses tim_ — BUKAN angka target.** Mulai sekecil mungkin (2 repo: backend + frontend, `shared` opsional), naik **hanya** saat ada pemicu nyata (wilayah rahasia baru / kelompok-akses baru). "6-10 repo" hanya sah kalau memang ada 6-10 wilayah/kelompok terpisah — kalau cuma 2 kelompok, 2-3 repo cukup.

**Contoh profil tim (5 peran):** Backend Architect, Backend Developer, Frontend Architect, Frontend Developer, UI Developer. Pembagian akses: **lingkaran kecil tepercaya** (boleh dekat ke backend/engine) vs **mayoritas staff tampilan** (frontend/UI saja, tak boleh sentuh hal rahasia). Contoh stack: Next.js · Python · Supabase · deploy Vercel/Railway/Render · Claude Code.

---

## 2 model yang didukung

### Model 1 — `backend → frontend` (2 repo)
```
[project]-backend  ──►  [project]-frontend
```
- **Cukup 2 repo. TIDAK butuh repo `shared`.** Frontend cuma memanggil API backend; "kontrak" = API itu sendiri (bukan repo ke-3). Repo `shared` (tipe data) = OPSIONAL, boleh di-skip (AI yang sambungkan).
- **Tidak ada database bersama** antara keduanya — frontend nol-DB, backend yang punya.
- Cocok untuk project tanpa algoritma rahasia.

### Model 2 — `microservice (varian shared-database)`
> Dulu disebut "multi-repo per-layanan". **Istilah baru: microservice — TAPI varian shared-database** (1 database bersama, bukan database-per-service). Bukan microservice murni; lihat bagian "Istilah".

```
engine-data-domain ──────┐
engine-anti-plagiarisme ─┼──► backend ──► dashboard/frontend
engine-seo-analysis ─────┘
(engine lain...)
```
- Banyak **engine** (algoritma rahasia) → **1 backend** (perantara/aggregator) → **1 dashboard**.
- **1 database bersama**, dibagi **schema-per-engine** (lihat bagian Database).
- Cocok untuk project dengan **beberapa algoritma rahasia** (kasus tim ini).

---

## Aturan alur (3 sambungan — 2 boleh, 1 dilarang)
```
✅ frontend  ↔  backend     → BOLEH (jalur normal mayoritas task)
✅ backend   ↔  engine      → BOLEH (untuk hitungan rahasia)
❌ frontend  ↔  engine      → DILARANG (rahasia bocor + 40-50 orang dapat akses)
```
Data SELALU mengalir `engine → backend → frontend`. Frontend tak pernah menyentuh engine/DB langsung — selalu lewat backend.

---

## Engine vs Backend: apa yang LAYAK jadi "engine"?
> "Engine" = repo KHUSUS **algoritma RAHASIA**. Jangan tiap fitur dijadikan engine.

| Kondisi | Tindakan |
|---|---|
| Algoritma rahasia, **wilayah baru** + mungkin **orang berbeda** | **engine repo BARU** (mis. `engine-pricing`) |
| Algoritma rahasia, **masih satu wilayah** (mis. skor SEO + plagiat, dipegang orang sama) | **TAMBAH FILE** ke engine yang ada — jangan repo baru |
| **Bukan** algoritma rahasia (pemutar video, tabel, form, login) | **TIDAK usah engine** — cukup frontend/backend |
| Algoritma rahasia tapi **tak terlalu rahasia** (10 orang boleh tahu) | boleh ditaruh di **backend** (lebih simpel), bukan engine |

Aturan emas: **bagi per WILAYAH RAHASIA, bukan per algoritma.** Nambah algoritma = nambah file di engine, **bukan** repo baru.

---

## Database — 1 database, beda schema (pilihan worth-it)
```
1 DATABASE (milik backend):
├── engine_data_domain   ← data mentah domain (umur, backlink, toko) — RAHASIA
├── engine_plagiarisme   ← sidik jari konten / hasil crawl — RAHASIA
├── engine_seo           ← metrik SEO (DR/UR/DA/PA) — RAHASIA
└── operasional          ← users, login, antrian + HASIL MATANG (skor/ringkasan)
```

**Kenapa 1 database + schema (bukan database-per-engine):**
- Data antar-engine **berkaitan** → harus bisa **digabung langsung** (JOIN) → wajib 1 database.
- Schema = "lemari berlabel" gratis: rapi + bisa dikunci sendiri (izin per-schema) + 1 backup/migrasi.
- Database terpisah HANYA kalau: 1 engine dipegang partner/kontraktor beda, atau wajib beda region/compliance, atau data 1 engine raksasa & tak pernah digabung.

**1-schema-campur vs schema-per-engine?** → **schema-per-engine menang.** Biaya ease/waktu/token nyaris sama (AI yang atur), tapi kualitas + keamanan jauh lebih tinggi. 1-schema-campur cuma untuk prototipe buang.

### Cara repo terhubung ke database ("kartu bank")
- Database = layanan terpisah (Supabase, di server), **bukan di dalam repo mana pun**. Repo **terhubung** ke sana via jaringan.
- Tiap repo punya **"kartu akses" = connection string + role terbatas**, disimpan di **pengaturan rahasia repo (server)** — bukan di kode, bukan di laptop staff.
- **Lead/owner setup database + schema + kartu SEKALI** (template `MCP_SETUP.md` Option D). Setelah itu staff cukup prompt; AI pakai kartu yang sudah terpasang. Staff tak pernah memegang password DB.

| Repo | Kartu boleh buka | Untuk |
|---|---|---|
| engine-data-domain | tulis `engine_data_domain` | simpan data mentah |
| engine-seo-analysis | tulis `engine_seo` + baca `engine_data_domain` | hitung skor |
| engine-anti-plagiarisme | tulis `engine_plagiarisme` | simpan hasil |
| backend | baca semua schema engine + baca/tulis `operasional` | gabung + sajikan + login |
| frontend/dashboard | **TAK ADA kartu** | telepon backend saja |

### Backend = aggregator (1 query/VIEW, BUKAN 3 API)
Karena semua di 1 database, untuk dashboard **backend baca beberapa schema sekaligus dalam 1 query** (atau 1 VIEW = "laporan-jadi"). **TIDAK perlu tiap engine bikin API lalu dikumpulkan** — itu pola database-TERPISAH (microservice murni) yang tak Anda pakai.
```
backend: AMBIL aged,toko (engine_data_domain) + DR,UR,DA,PA (engine_seo) + status (engine_plagiarisme)
         GABUNG per domain → 1 jawaban ke dashboard
```

---

## Cara kerja: siapa prompt, kapan engine kerja dulu vs backend saja

### Dua momen: MEMBANGUN vs BERJALAN
- **MEMBANGUN** (sekali): tiap orang prompt di repo-nya → AI tulis kode. **Ya, tiap orang prompt di repo masing-masing.**
- **BERJALAN** (otomatis, setelah jadi): kode jalan sendiri (scraper isi laci, penghitung baca+isi, backend gabung+sajikan). Tak ada yang prompt.

### Aturan: kapan engine kerja dulu vs cukup backend
- **Memproduksi data/kemampuan BARU** → pemegang repo engine kerja **dulu**.
- **Data sudah ADA di database bersama** → cukup **backend** baca + gabung.
- **Pakai-ulang kode** (mis. crawler) antar engine → **angkat jadi library bersama** (jangan duplikat).

### Contoh real: "Laporan Domain" (gabung plagiat + data toko)
**🔨 FASE 1 — tiap pemegang repo kerja SENDIRI dulu** (produksi data baru):
- siA-plagiarisme: *"buat crawler ambil konten tiap domain + cek plagiarisme, simpan status ke schema `engine_plagiarisme`."*
- siA-domain: *"pastikan data toko-beli + aged tersimpan ke schema `engine_data_domain`."*

**🤝 FASE 2 — cukup BACKEND saja** (2 mesin sudah jadi):
- siC-backend (1 prompt): *"buat VIEW/API yang gabungkan status plagiat + toko beli + aged per domain, untuk dashboard, wajib login."*
- → engine people TIDAK kerja apa-apa lagi.

**Variasi — engine-data-domain mau pakai crawler plagiarisme:**
- Butuh **HASIL crawl** saja → baca dari database bersama (cuma data-domain prompt; tak rebuild, tak API).
- Butuh **menjalankan crawler** sendiri → angkat crawler jadi **library bersama** (lead memutuskan).

### Prompt Berantai (copy-paste antar-tim)
Tambahkan kalimat ini di **akhir tiap prompt** supaya AI bikinkan prompt tim berikutnya:
> *"Setelah selesai, tuliskan untuk saya 1 prompt siap-pakai untuk tim [BERIKUTNYA] berisi: cara panggil (alamat), input, dan output (bentuknya)."*

Tim berikutnya tinggal **copy-paste** prompt yang dihasilkan AI → konteks mengalir sendiri. Staff tak pernah menulis serah-terima.

---

## Keamanan anti-bocor (urut paling berpengaruh — fokuskan energi di sini)
1. **Frontend (40-50) NOL akses DB & engine** — pelindung TERBESAR (menutup 40-50 dari ±52 orang).
2. **Repo private + izin clone per-orang** (GitHub + CODEOWNERS) — pertahanan code-dicuri NYATA. *(Label "tier" di file lokal = catatan niat, BUKAN pengaman.)*
3. **Backend satu-satunya pegang kunci DB**, cuma di server (env/secret manager).
4. **Data asli tak pernah di laptop staff** — staff pakai data palsu/staging + cuma dapat SCHEMA kosong.
5. **Role terbatas per-schema + RLS** (1 login = 1 orang) — `MCP_SETUP.md` Option D.
6. **Backend cuma kirim hasil matang** (skor/ringkasan) — data mentah & rumus tak pernah keluar.
7. **Audit log** aksi sensitif.

> 🚨 Yang TIDAK menambah keamanan (jangan terjebak): menambah jumlah database/schema/collector "biar aman" = naik ongkos tanpa naik anti-bocor.

---

## Istilah (jujur)
Yang Anda pakai = **microservice VARIAN SHARED-DATABASE** — BUKAN microservice murni.
- **Microservice murni** = tiap layanan punya **database SENDIRI** (database-per-service) — itu ciri penentunya.
- **Punya Anda** = banyak layanan/repo **berbagi 1 database** (schema-per-service). Lebih sederhana + cocok tim kecil.
- Backend berperan sebagai **API Gateway / Aggregator / Backend-for-Frontend (BFF)**.
- ⚠️ Kalau layanan jadi sangat saling-bergantung sampai harus deploy bareng → risiko **"distributed monolith"**. Hindari dengan menjaga tiap engine cukup mandiri (engine isi lacinya; backend yang gabung).

---

## Kapan naik kelas (owner-gated, jangan buru-buru)
- **Mulai sederhana**: Model 1 (2 repo) ATAU Model 2 dengan **1 database + schema**.
- **Pisah schema → database fisik terpisah** HANYA saat: partner/kontraktor beda, region/compliance, atau data raksasa tak-pernah-digabung.
- **Pisah collector jadi layanan sendiri** HANYA saat pengumpulan jadi batch berat terjadwal yang ganggu dashboard.
- Memisah gampang (schema sudah terpisah); menggabung balik susah → **mulai kecil = arah aman.**

---

## Catatan jujur
1. Ini rancangan dari konteks — **uji di staging berdata-palsu dulu** sebelum produksi.
2. **1 keputusan milik owner:** 3 engine dipegang lingkaran **sama** (→ tetap 1 DB) atau **beda** (→ pertimbangkan pisah)?
3. Semua "naik kelas" + perubahan kit = **owner-gated** + lewat Gerbang Pra-Rilis §4.6.

## Terkait
- Onderdil ECC layak-pinjam: `docs/plans/ECC_BORROW_LIST.md`
- Setup DB + role: `templates/MCP_SETUP.md` Option D
- Topologi + 8 divisi: `LINTASAI_WORKFLOWS_v1.md` §4.13
