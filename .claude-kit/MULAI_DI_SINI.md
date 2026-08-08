# Halo Staff Baru! Mulai dari Sini

> **File ini buat KAMU baca, BUKAN buat AI.**
>
> Kalau kamu **bukan programmer** dan baru gabung tim - selamat datang. Habiskan ~10 menit baca file ini pelan-pelan. Setelah selesai, kamu sudah punya gambaran besar cara kerja tim.
>
> Jangan copy-paste isi file ini ke AI. Ini bukan instruksi buat AI, ini "buku panduan saku" buat kamu.

---

## Apa Itu lintasAI?

Bayangin tim ini kayak toko online di Tokopedia.

- **Proyeknya** = toko kamu (misal jualan baju).
- **Kode** = stok barang + sistem kasir + desain etalase.
- **lintasAI** = template Notion siap-pakai + plugin Tokopedia Seller. Sudah ada layout, sudah ada aturan kerja, sudah ada checklist. Kamu tinggal pakai, tidak perlu bikin dari nol.

Tanpa lintasAI, tiap orang kerja dengan cara sendiri-sendiri - pusing waktu mau gabungin hasil. Dengan lintasAI, semua orang di tim ngikut **1 cara kerja yang sama**, dibantu AI biar lebih cepat.

**Singkatnya**: lintasAI = standar kerja tim + asisten AI yang sudah tau aturan tim.

---

## Yang DIJAMIN otomatis vs yang DITAWARKAN (penting dibaca!)

Ada **2 hal yang otomatis kamu dapat tiap kali minta sesuatu ke AI** - tanpa kamu ketik apa pun:

1. **8 ahli IT selalu menemani.** Tiap kamu minta sesuatu, ada 8 "ahli tetap" yang ikut menjaga mutu pekerjaan: ahli **backend** (mesin di belakang layar), **frontend** (tampilan), **database** (penyimpanan data), **webdesain**, **kenyamanan-pakai**, **pengiriman ke server**, **keamanan**, dan **biar-ketemu-di-Google** (SEO). 🏢 Seperti 8 satpam tetap di tiap cabang toko - selalu ada, tak bisa dipecat, dan kamu boleh nambah ahli baru sesuai kebutuhan.
2. **Pagar keselamatan selalu nyala:** AI tak akan membocorkan rahasia, tak akan mengarang fakta, dan selalu pakai bahasa yang kamu mengerti.

**Selebihnya cuma DITAWARKAN, bukan wajib.** Hal-hal lain (audit, rapikan kode, aturan gaya penulisan, checklist, dll) = AI cuma **menyarankan** - kamu yang pilih mau pakai atau tidak. Jadi jangan merasa "harus ikut semua aturan"; ambil yang kamu butuh, sisanya bisa bertumbuh pelan-pelan di project kamu.

**Kamu akan makin paham sendiri.** Tiap jawaban AI ditulis **2 versi**: satu untuk yang sedang **belajar koding** (👨‍🎓), satu **bahasa sehari-hari** (🙂). Ini sengaja - supaya dari waktu ke waktu kamu makin ngerti, dari "sama sekali bukan programmer" pelan-pelan jadi "ngerti dasar koding". Bukan biar kamu selamanya bergantung ke AI.

---

## 4 Hal yang Kamu Perlu Tau

### 1. AI Claude Code = "Asisten Kerja" Kamu

Bayangin kamu punya asisten yang bisa kerja 24 jam, tidak pernah ngeluh, dan ngerti coding. Itu **Claude Code**.

- Kamu **chat dia kayak WhatsApp** - ketik permintaan dalam bahasa biasa.
- Dia eksekusi (buka file, ubah teks, upload ke server).
- **Kamu yang putuskan** sebelum dia kerja: setuju, revisi, atau batal.

Contoh chat:
> *"Tolong tambahin tombol Export di halaman daftar pelanggan, hasilnya file Excel."*

Claude akan kerjain - tapi **selalu nanya kamu dulu** sebelum hal-hal berbahaya (hapus file, kirim ke server publik).

> **Aturan emas**: AI itu pintar, tapi tidak tau konteks bisnis kamu. Kamu yang tau apa yang benar buat tim - AI cuma bantu eksekusi.

### 2. Butuh 3 Tools Aja

| Tool | Fungsi | Analogi |
|---|---|---|
| **VS Code** | Tempat buka file proyek | Microsoft Word, tapi khusus file kode |
| **Claude Code extension** | AI asisten di dalam VS Code | Kayak WhatsApp Web yang nempel di VS Code |
| **Discord** | Tempat tim ngobrol + ambil tugas | Grup WhatsApp tim, tapi lebih rapi |

Owner sudah install semua di laptop kamu pas onboarding (hari-hari pertama kamu masuk tim). Kalau ada yang error, lapor di Discord channel `#help`.

### 3. Cara Mulai Kerja Tiap Hari (6 Step)

1. **Buka VS Code** (icon biru kotak di desktop).
2. **Buka folder proyek** - File → Open Folder → pilih folder yang owner kasih.
3. **Buka Claude Code** - klik icon Claude di panel sisi kiri VS Code — deretan icon di pinggir kiri layar (atau tekan `Ctrl+L`).
4. **Cek Discord channel `#tugas-hari-ini`** - lihat ada task baru yang di-pin?
5. **Copy task dari Discord, paste ke Claude Code chat** - kasih konteks "tolong kerjakan ini, ikut aturan tim di AGENTS.md".
6. **Review hasil Claude** - baca pelan-pelan, kalau OK klik Accept. Kalau ada yang aneh, balas chat: *"Bagian X belum sesuai, tolong revisi."*

Selesai 1 task = lapor ke Discord `#progress` dengan emoji status. Sudah, gitu aja.

### 4. Cara Prompt yang Benar

**Prompt** = permintaan kamu ke AI. Kualitas hasil AI = kualitas prompt kamu.

#### Contoh BAGUS:
> *"Tolong buatin halaman daftar pelanggan dengan kolom: Nama, Email, No HP, Tanggal Daftar. Datanya ambil dari database tabel `customers`. Pakai komponen Table (blok tabel siap-pakai) yang sudah ada di proyek. Ikut style halaman daftar produk yang sudah ada."*

Kenapa bagus: **jelas detail, kasih konteks, sebut yang sudah ada**.

#### JANGAN seperti ini:
> *"Bikin halaman pelanggan."*

Kenapa jelek: AI bingung - kolom apa? Data dari mana? Style gimana? Hasilnya pasti tidak sesuai.

#### Tips Prompt Awam:
- **Tulis kayak nulis WA ke kolega baru** - anggap dia pintar tapi belum tau proyek kamu.
- **1 chat = 1 task**. Jangan campur 5 permintaan sekaligus.
- **Kasih contoh**: *"Mirip halaman X yang sudah ada"*.
- **Sebutin "ikut aturan tim di AGENTS.md"** di awal sesi baru - biar AI baca ulang aturan.

---

## Tabel "Saat Bingung"

| Situasi | Tindakan |
|---|---|
| AI minta konfirmasi hapus/delete file | **STOP**. Screenshot. Tanya owner di Discord dulu sebelum klik Yes. |
| Hasil AI aneh / tidak sesuai permintaan | Balas chat: *"Bagian X tidak sesuai, tolong revisi jadi Y"*. Jangan disetujui dulu. |
| Mentok >30 menit di 1 tugas | Lapor Discord `#help` - kasih screenshot + ceritain udah coba apa. |
| Tidak ngerti istilah teknis di chat AI | Buka `docs/GLOSSARY_NON_PROGRAMMER.md`. Atau tanya Claude: *"Jelasin istilah X dengan bahasa awam"*. |

---

## Glossary Singkat (8 Istilah Wajib)

| Istilah | Bahasa Awam |
|---|---|
| **Repo** | Folder proyek di GitHub (kayak Google Drive folder shared khusus kode). |
| **Commit** | Save point + catatan "apa yang berubah" (kayak Ctrl+S di Word + tulis 1 kalimat). |
| **Push** | Upload save-an kamu ke server tim (kayak upload Word ke Google Drive). |
| **Pull** | Download versi terbaru dari server tim (kayak download Word terbaru dari Google Drive). |
| **PR (Pull Request)** | Lapor ke atasan: *"Pak, draft saya selesai, mohon review"*. Owner approve atau minta revisi. |
| **Branch** | Copy file Word yang kamu rename jadi "draft - versi Bagus" sebelum edit. Master file aman. |
| **Staging** | Showroom prototype. Tim sudah bisa lihat hasil kamu, tapi publik belum bisa. |
| **Production** | Versi LIVE yang user beneran pakai. URL utama proyek (kayak akun Tokopedia kamu yang sudah aktif). |

> Mau lebih lengkap? Buka `docs/GLOSSARY_NON_PROGRAMMER.md` - ada 50+ istilah dengan analogi.

---

## FAQ

### Q1. Saya bukan programmer, beneran bisa kerja di tim ini?
**A**: Bisa. Tim ini didesain untuk **non-programmer + AI**. Kamu tidak perlu hafal coding - yang penting kamu **paham konteks bisnis**, **bisa nulis prompt jelas**, dan **mau baca hasil AI pelan-pelan**. AI yang ngetik kode, kamu yang putuskan benar/salah.

### Q2. Kalau saya salah prompt, bahaya tidak?
**A**: 90% aman. AI selalu nanya konfirmasi sebelum hal berbahaya (hapus file, kirim ke production, ubah database). Yang berbahaya: kamu klik "Yes" tanpa baca. **Aturan**: kalau muncul popup konfirmasi dan kamu ragu - STOP, tanya owner Discord dulu.

> **Popup di kit ada 2 tipe**: **Tipe A** = pertanyaan dari AI di chat — biasanya muncul **kotak pilihan yang bisa kamu KLIK**; kalau yang muncul justru teks `[1]/[2]/[3]`, balas dengan ketik angka (itu mode cadangan). **Tipe B** = jendela Windows terpisah yang muncul di layar (mirip kotak "Save As" di Word) — klik tombolnya pakai mouse. Bingung bedanya? Tanya AI di chat: *"jelaskan 2 tipe popup"*. Ragu = STOP, tanya owner Discord.

### Q3. Saya stuck, tanya siapa?
**A**: Urutan:
1. **Tanya Claude dulu**: *"Saya bingung di X, tolong jelasin dengan bahasa awam."*
2. **Cek glossary** `docs/GLOSSARY_NON_PROGRAMMER.md`.
3. **Discord `#help`** - sebutin task + screenshot + udah coba apa.
4. **Owner DM** - kalau mendesak dan kerjaanmu macet total gara-gara ini (ada deadline).

### Q4. Berapa lama sampai saya produktif?
**A**: Realistis:
- **Hari 1-3**: orientasi - baca glossary, lihat tim kerja, kerjain task kecil (benerin salah ketik, rapikan kalimat).
- **Minggu 1**: bisa kerjain task risiko-rendah sendiri (tombol di tampilan layar, ubah teks halaman).
- **Minggu 2-4**: bisa kerjain task tingkat sedang (fitur baru kecil, ambil data dari database).
- **Bulan 2+**: jadi co-pilot owner - bisa handle task sendiri, owner cuma review.

Tidak perlu buru-buru. Lebih baik kerja **pelan tapi hati-hati** daripada cepat tapi rusakin production.

---

## Hal yang Bisa Kamu Minta ke AI

Kamu **tidak perlu hafal nama file apa pun**. Cukup chat maksudmu pakai bahasa biasa, AI otomatis tahu harus pakai panduan yang mana:

| Kamu mau... | Tinggal bilang ke AI... |
|---|---|
| Mulai task baru | *"Tolong tambah/perbaiki X di halaman Y"* |
| Minta AI fokus 1 divisi | *"pakai skill backend"* / *"skill seo"* (8 divisi tetap: backend, frontend, database, webdesign, ui/ux, devops, keamanan, seo — selalu ada, boleh kamu tambah) |
| Cek kesehatan proyek | *"Tolong audit proyek ini, cari yang bisa diperbaiki"* |
| Bikin/rapikan dokumentasi | *"Tolong buatkan/perbarui dokumentasi untuk file X"* |
| Update kit ke versi baru | *"Ada versi baru kit? Tolong update"* |
| Bingung istilah teknis | *"Jelasin istilah X dengan bahasa awam"* |
| Ada masalah keamanan | *"Sepertinya ada insiden keamanan, tolong pandu langkahnya"* |

> Owner punya daftar lengkap "file mana untuk apa" di `README.md` (Peta Keputusan). Kamu sebagai staf cukup chat natural — itu memang cara kerja yang dirancang untuk kamu.

---

## Selamat Bergabung

Tim ini tidak menuntut kamu jadi programmer. Tim ini butuh kamu jadi **partner mikir** yang paham konteks bisnis + bisa kerja sama AI dengan rapi.

Kalau bingung - tanya. Kalau ragu - STOP dulu. Kalau capek - istirahat, kerja besok. Tidak ada yang sebegitu mendesaknya sampai harus rusakin versi live (production).

Langkah berikutnya: baca `docs/ONBOARDING.md` (jadwal 14 hari pertama) dan `docs/TEAM_FLOW_SKETCH_v1.md` (panduan alur kerja tim: siapa ngapain, dari showroom uji-coba/staging sampai versi live/production). Sampai ketemu di Discord.
