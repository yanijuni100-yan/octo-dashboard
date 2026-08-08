# Glossary untuk Staff IT Non-Programmer

> Dokumen wajib baca **DULU** sebelum Day 0 onboarding.
>
> Tujuannya: kasih kamu peta istilah teknis dengan **bahasa awam + analogi sehari-hari** supaya kamu tidak panik baca dokumentasi tim.
>
> Cara baca: scroll sampai habis sambil bayangin analogi. Tidak perlu hafal - bookmark file ini, balik baca tiap ketemu istilah asing.

---

## 🗂️ Bagian 1 - Soal Kode & GitHub

### **Repo (Repository)**
Folder kode proyek di GitHub. Berisi semua file source code + history perubahan.
- **Analogi**: kayak Google Drive folder shared, tapi khusus kode + ada catatan "siapa ubah apa kapan".

### **Clone**
Aksi download repo dari GitHub ke laptop kamu.
- **Analogi**: download folder Google Drive ke laptop biar bisa edit offline.

### **Branch**
Versi alternatif dari kode utama (`main`) yang kamu pakai buat kerja task tertentu.
- **Analogi A (Word)**: copy file Word yang kamu rename jadi "draft - versi Bagus" sebelum edit. Master file (`main`) tetap aman, kamu kerja di copy.
- **Analogi B (Notion)**: kayak duplicate page di Notion. Page asli (`main`) tetap, kamu edit page duplikat sampai siap publish.
- **Analogi C (Canva)**: duplicate design di Canva sebelum bereksperimen. Design asli aman, kamu edit copy-nya.

### **Commit**
Save point di kode. Tiap commit = snapshot perubahan + pesan "apa yang berubah".
- **Analogi**: tekan **Ctrl+S** di Word, plus tulis 1 kalimat "save apa": *"Tambah kolom email di form registrasi"*.

### **Push**
Upload commit dari laptop ke GitHub (cloud).
- **Analogi**: setelah save Word ke laptop, **upload ke Google Drive** supaya teman bisa lihat.

### **Pull / Sync**
Download perubahan terbaru dari GitHub ke laptop kamu.
- **Analogi**: download versi terbaru file dari Google Drive yang teman kamu sudah edit.

### **PR (Pull Request)**
Request resmi supaya kerja kamu (di branch) **digabung** ke kode utama (`main`). Tempat owner review sebelum approve.
- **Analogi A (atasan)**: kirim laporan ke atasan: *"Pak, ini draft saya, mohon review. Kalau OK boleh saya publish?"*. Atasan baca, kasih komentar, approve atau minta revisi.
- **Analogi B (Google Form)**: submit Google Form ke atasan untuk approval. Atasan terima notifikasi, baca isi, klik "Approve" atau balas dengan catatan.
- **Analogi C (Notion share)**: share Notion page ke teammates dengan permission "Can comment". Mereka kasih comment di tiap blok, kamu fix, mereka approve.

### **Merge**
Aksi gabungin branch kamu ke `main` setelah PR di-approve owner.
- **Analogi**: dari status "draft" di Google Docs jadi "final". Tidak bisa diubah lagi gampang.

### **Squash Merge**
Cara khusus merge yang gabungin semua commit di branch jadi 1 commit bersih di `main`.
- **Analogi**: kamu nulis 10 draft sebelum jadi laporan final. Saat publish, atasan cuma simpan **1 versi final** - bukan semua 10 draft.

### **Conflict (Merge Conflict)**
Saat git tidak bisa otomatis gabungin perubahan kamu sama main, karena 2 orang edit baris yang sama.
- **Analogi**: kamu sama teman sama-sama edit baris pertama di Google Docs barengan, sistem bingung mau ambil punya siapa. **Solusi**: minta tolong Claude resolve.

### **Revert**
Aksi membatalkan commit dengan bikin **commit baru** yang mengembalikan kode ke state sebelumnya.
- **Analogi**: Ctrl+Z di Word, tapi setelah save. Versi sebelum-rusak kembali, tapi history "pernah rusak" tetap kelihatan.

### **`.gitignore`**
File khusus yang kasih tau git: "file/folder ini JANGAN di-upload ke GitHub" (mis. password, node_modules).
- **Analogi**: daftar "rahasia keluarga" yang tidak boleh kamu post di Instagram.

---

## 🚀 Bagian 2 - Soal Deploy & Server

### **Deploy**
Aksi naikin kode ke server supaya bisa diakses user via internet.
- **Analogi A (Google Drive)**: upload file ke Google Drive yang **di-share publik** - semua orang bisa buka link-nya.
- **Analogi B (Instagram)**: publish post di Instagram. Sebelum publish, post cuma "draft" di laptop kamu. Setelah publish, semua follower bisa lihat.
- **Analogi C (Tokopedia)**: upload produk baru di Tokopedia. Sebelum di-publish: cuma kamu yang lihat di "draft". Setelah klik "Aktifkan": muncul di katalog publik.

### **Production / Prod**
Versi **live** yang user beneran pakai. URL utama proyek (mis. `<project>.app`).
- **Analogi**: website live di internet, kebalikan dari "draft di laptop".

### **Staging**
Versi **test** sebelum naik ke production. URL terpisah, biasanya cuma owner + tim yang akses.
- **Analogi**: showroom prototype mobil. Pelanggan belum bisa beli, tapi tim sudah bisa test drive.

### **Preview URL (Vercel Preview)**
URL khusus yang auto-generate per PR. Setiap branch dapat URL sendiri untuk test sebelum merge.
- **Contoh**: `<project>-git-feat-export-excel.vercel.app`
- **Analogi**: link "Preview" di Google Docs - cuma kamu + owner yang lihat, hasil belum publish ke publik.

### **Env Var (Environment Variable)**
Setting rahasia (password DB, API key, URL) yang **dipisah dari kode**. Tidak boleh masuk Git.
- **Analogi A (Wi-Fi)**: password Wi-Fi rumah - disimpan di router, tidak ditulis di buku tamu yang bisa dilihat tamu.
- **Analogi B (Discord)**: settings rahasia di server Discord kamu (tokens bot, webhook URL). Disimpan di "Server Settings", bukan di pesan publik.
- **Analogi C (password manager)**: kayak entry di 1Password / Bitwarden - disimpan terpisah dari aplikasi yang pakai, dengan kunci master.

### **`.env.local`**
File teks isi env vars buat development di laptop kamu (jangan upload ke Git!).
- **Analogi**: kertas catatan password yang kamu simpan di laci pribadi.

### **CI/CD (Continuous Integration / Continuous Deployment)**
Robot di GitHub yang otomatis test + deploy tiap kamu push kode.
- **Analogi A (tukang pos)**: tukang pos otomatis. Kamu kirim surat (push), dia cek alamat (test), kalau benar dia antar ke tujuan (deploy).
- **Analogi B (Zapier/IFTTT)**: kayak workflow di Zapier atau IFTTT - kalau X terjadi, otomatis lakukan Y. Push kode → otomatis test → otomatis deploy.
- **Analogi C (Tokopedia)**: kayak auto-fulfillment Tokopedia - kalau ada pesanan masuk, sistem otomatis cek stok + kirim notifikasi kurir + update status.

### **AI Reviewer (.github/workflows/ai-review.yml)**
Robot Claude yang otomatis review PR kamu, kasih komentar di GitHub.
- **Analogi**: editor digital di redaksi koran - baca tulisan kamu, kasih komentar typo/inkonsistensi sebelum editor manusia review.

### **Rollback**
Aksi balikin production ke versi sebelumnya saat ada bug.
- **Analogi**: editor koran ketauan salah cetak, segera tarik edisi yang sudah disebar, ganti dengan edisi lama.

---

## 💻 Bagian 3 - Soal Stack Teknis

### **Next.js**
Framework JavaScript untuk bikin website + API. Stack utama proyek tim.
- **Analogi**: WordPress = framework website pakai PHP. Next.js = framework website pakai JavaScript modern.

### **React**
Library buat bikin UI di browser (tombol, form, modal, dst.). Next.js pakai React di belakang.
- **Analogi**: LEGO. Tiap "component" = 1 brick yang bisa dipakai ulang.

### **Tailwind CSS**
Cara nulis styling (warna, ukuran, spacing) langsung di HTML pakai class pendek.
- **Contoh**: `<button class="bg-blue-500 px-4 py-2">Klik</button>` = tombol biru padding 4 horizontal 2 vertikal.
- **Analogi**: stiker pre-cut di toko stationary - tinggal tempel, tidak perlu gunting sendiri.

### **shadcn/ui**
Library siap-pakai untuk component umum (Button, Modal, Form, dst.) berbasis React + Tailwind.
- **Analogi**: IKEA furniture - kerangka jadi, kamu tinggal rakit + cat sesuai selera. Tidak harus mulai dari kayu mentah.

### **Prisma**
ORM (Object-Relational Mapping) - library yang nyambungin kode Next.js ke database PostgreSQL.
- **Analogi**: penerjemah antar bahasa. Kamu ngomong JavaScript ("ambil user dengan email X"), Prisma terjemah jadi SQL ("SELECT * FROM users WHERE email='X'").

### **PostgreSQL / Postgres**
Database SQL yang banyak dipakai industri. Tempat data permanen disimpan.
- **Analogi**: Excel super-power dengan miliaran baris dan relasi antar tabel.

### **Supabase**
Layanan cloud yang nyediain PostgreSQL + Auth + Storage. Tim pakai ini untuk database.
- **Analogi**: AWS-lite - bundle database + auth + storage dalam 1 dashboard sederhana.

### **NextAuth**
Library untuk handle login (Google, GitHub, email/password) di Next.js.
- **Analogi**: aplikasi Bank yang handle login fingerprint + OTP, kamu tidak perlu coding dari nol.

### **API (Application Programming Interface)**
"Jalan masuk" ke layanan. Browser kirim request → server jawab data.
- **Analogi A (restoran)**: menu restoran. Customer pesan (request), waitress bawa makanan (response).
- **Analogi B (Gojek)**: aplikasi Gojek punya API yang ngasih daftar driver terdekat. Aplikasi-aplikasi lain bisa "tanya Gojek" via API ini.
- **Analogi C (Spotify)**: Spotify API kasih playlist + metadata lagu ke aplikasi 3rd party. Aplikasi minta data, Spotify kasih.

### **Endpoint**
1 alamat URL spesifik di API. Mis. `/api/users` = endpoint dapetin list user.
- **Analogi**: 1 nomor meja di restoran. Pelayan tahu meja 5 pesan apa.

### **Schema (Database Schema)**
"Cetak biru" struktur database - daftar tabel, kolom, tipe data, relasi antar tabel.
- **Analogi A (Excel)**: kayak template Excel kosong yang sudah didesain - kolom mana isinya teks, kolom mana isinya tanggal, mana yang wajib diisi.
- **Analogi B (formulir)**: kayak formulir cetak yang nentuin "kolom 1 = nama, kolom 2 = NIK, kolom 3 = tanggal lahir". Schema = blueprint formulir, data = isian formulir.

### **`prisma migrate`**
Perintah Prisma yang **ubah struktur database real** (tambah tabel, hapus kolom, rename field). Dijalankan saat schema kamu ubah.
- **Analogi**: arsitek kasih perintah ke kuli buat **bongkar tembok + bikin kamar baru** di rumah. Bukan cuma rencana di kertas - beneran ngebongkar.
- **⚠️ HATI-HATI**: `prisma migrate` di production = ubah database LIVE yang dipakai user. Salah migrate = data bisa hilang. WAJIB konfirmasi owner sebelum eksekusi di prod.

---

## 🛠️ Bagian 4 - Soal Tools

### **Claude Code**
AI coding assistant (Anthropic). Kamu chat, dia eksekusi.
- **Analogi**: asisten pribadi yang bisa baca/tulis kode, tapi kamu yang putuskan & approve.

### **VS Code (Visual Studio Code)**
Editor kode populer. Tim default pakai ini.
- **Analogi**: Microsoft Word, tapi khusus untuk file kode.

### **Terminal / Command Line / PowerShell**
Layar hitam yang kamu ketik perintah (mis. `git pull`, `pnpm dev`).
- **Analogi**: cara komunikasi sama komputer langsung tanpa klik mouse, hanya ketik perintah.

### **Node.js / Node**
Runtime untuk jalankan JavaScript di laptop kamu (bukan di browser).
- **Analogi**: mesin yang nyala-in mobil JavaScript. Tanpa mesin, kode JS cuma bensin yang tidak jalan.

### **pnpm**
Package manager - tool buat install dependency (library) project.
- **Analogi**: kayak `apt-get` di Linux atau App Store di iPhone - kamu ketik "install nama-package", dia download dari internet.

### **gh CLI (GitHub CLI)**
Tool command-line untuk interaksi sama GitHub tanpa buka browser (mis. `gh pr create`).
- **Analogi**: kontrol GitHub via remote TV, bukan tombol di TV-nya langsung.

### **MCP (Model Context Protocol)**
Cara Claude Code terhubung ke layanan luar (GitHub, Supabase, dst.).
- **Analogi A (USB)**: USB connector. Tanpa MCP, Claude "buta" ke GitHub. Dengan MCP, Claude bisa baca-tulis ke GitHub.
- **Analogi B (Zoom share screen)**: kayak share screen di Zoom - AI bisa "lihat" tools kamu (GitHub, Supabase) dan operate sambil presentasi ke kamu.
- **Analogi C (Zapier)**: kayak Zapier yang nyambungin Notion ke Slack ke Gmail. MCP nyambungin Claude ke tool-tool yang kamu pakai.

---

## 📋 Bagian 5 - Soal Workflow

### **Task**
Pekerjaan yang harus kamu kerjain. Datang dari owner via chat channel.

### **Acceptance Criteria (AC)**
Daftar syarat yang harus terpenuhi supaya task dianggap "selesai". Bukan opini - testable.
- **Contoh**: "Tombol Export muncul di kanan atas. Klik = download .xlsx. Loading state aktif." ← jelas, bisa di-cek satu-satu.

### **Risk Level (Low/Medium/High)**
Klasifikasi tingkat risiko task:
- 🟢 **Low** = UI minor, tidak sentuh data sensitif (mis. tombol Export, fix typo)
- 🟡 **Medium** = fitur baru self-contained (mis. endpoint API baru, form baru)
- 🔴 **High** = sentuh auth/login/billing/destruktif → owner WAJIB extra hati-hati

### **Conventional Commits**
Format standar untuk commit message: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, dst.
- **Contoh**: `feat(inbox): tambah filter status di tabel`
- **Analogi**: format subject email yang formal: `[URGENT] [PT.ABC] Permohonan Cuti` - orang langsung tau topik.

### **Squash & Merge**
Cara owner approve PR yang gabung semua commit branch jadi 1 commit bersih di main.

### **Pin / Unpin Pesan**
Aksi di chat channel untuk "tempel" pesan task aktif di atas supaya gampang dilihat.

### **Emoji Status Task**
Tim pakai emoji untuk status:
- 🟦 TODO (belum ada yang ambil)
- 🟧 WIP (lagi dikerjain)
- 👁️ REVIEW (PR siap)
- ✅ DONE (sudah merged)
- ⛔ BLOCKED (stuck)

### **LAZY-GENERATE**
Aturan tim: AI tidak generate semua docs di awal. Hanya generate `.md` saat staff sentuh file CRITICAL pertama kali.
- **Analogi**: penerjemah buku - terjemahin halaman 1 dulu pas kamu baca halaman 1, tidak terjemahin seluruh buku duluan.

### **AUTO-SYNC**
Aturan: kalau kode berubah, `.md` pendamping WAJIB ikut update di sesi yang sama.
- **Analogi**: kalau kamu rename produk di Excel, label di brosur HARUS ikut diubah - tidak boleh inkonsisten.

---

## 🎯 Bagian 6 - Soal Tim

### **Owner**
Pemilik proyek + maintainer kit `lintasAI`. Yang approve PR final + setup infra.

### **Staff IT (kamu)**
Anggota tim non-programmer yang kerja lewat Claude Code AI. Fokus: paham konteks, eksekusi task, lapor progress.

### **Senior Dev**
Anggota tim yang lebih pengalaman, biasanya programmer. Bantu staff IT kalau stuck >30 menit.

### **PIC (Person In Charge)**
Orang yang lagi pegang task tertentu. Ditandai di emoji status: `🟧 WIP - @bagus`.

### **AI-First Team**
Pola tim yang AI (Claude) jadi co-pilot utama, manusia jadi decision maker + reviewer. Kebalikan dari "tim developer biasa yang kebetulan pakai AI".

### **Standar Tim (`./.claude-kit/`)**
Folder berisi aturan + template + script tim. Bukan code proyek - ini cara kerja tim.

---

## 🔒 Bagian 7 - Soal Security

### **Token / API Key**
Password panjang random untuk akses layanan (mis. token Vercel, token Anthropic).
- **Analogi A (kunci kos)**: kayak kunci kamar kos kamu - buka pintu khusus, jangan diduplikasi.
- **Analogi B (1Password)**: kayak entry di 1Password / Bitwarden yang otomatis fill saat login - random 24+ karakter, kamu tidak perlu hafal.
- **Aturan**: token = personal, jangan share. Simpan di password manager (1Password, Bitwarden).

### **PII (Personally Identifiable Information)**
Data yang bisa identifikasi orang (nama, email, NPWP, foto). Wajib dihandle hati-hati.
- **Aturan**: jangan log PII di console mentah. Jangan simpan di repo.

### **RLS (Row-Level Security)**
Aturan di PostgreSQL yang batasin "user X cuma boleh akses baris yang dia punya".
- **Analogi**: di kantor, tiap karyawan cuma boleh buka laci namanya sendiri, tidak boleh buka laci kolega.

### **Service Role Key (Supabase)**
Key super-power yang BYPASS RLS. Cuma owner punya. Jangan share ke staff.
- **Analogi A (master key)**: master key gedung. Cuma manager yang boleh pegang.
- **Analogi B (Discord admin)**: kayak role "Administrator" di server Discord - bisa hapus channel, ban user, akses semua. Owner only.
- **Analogi C (Tokopedia merchant)**: kayak akun "Owner Merchant" di Tokopedia yang bisa lihat semua transaksi + atur permission staff toko.

---

## ⚠️ Bagian 8 - Anti-Pattern yang Harus Dihindari

### **"Vibe Code Accept"**
Claude generate 200 baris, kamu accept tanpa baca. Bug aneh muncul besoknya.
- **Solusi**: baca pelan-pelan. Kalau capek, minta Claude jelaskan baris per baris.

### **"Auto-Yes Everything"**
Setting auto-approve aktif tanpa baca apa yang di-approve. AI hapus file penting.
- **Solusi**: auto-approve OK untuk read-only. Untuk delete/push/migrate → manual approve.

### **"Skip Docs"**
Merge PR tanpa update `.md`. 2 minggu kemudian tidak ada yang tau fitur cara kerjanya.
- **Solusi**: docs = deliverable. PR tanpa docs = request changes.

### **"Mega Prompt"**
Nulis prompt 2000 kata mencakup 5 task. AI bingung prioritas.
- **Solusi**: 1 task = 1 sesi Claude. Pecah jadi sesi terpisah.

### **"Branch Panjang Umur"**
Branch jalan 3 minggu, banyak conflict.
- **Solusi**: branch max 3 hari. Kalau task besar, pecah jadi sub-task.

---

## 🚨 Bagian 9 - Destructive Ops (WAJIB Konfirmasi Owner)

> "Destructive ops" = perintah yang **tidak bisa di-undo gampang**. Kalau AI minta konfirmasi salah satu di bawah ini - **STOP**. Screenshot. Tanya owner Discord dulu sebelum klik Yes.

### **Destructive Ops (umum)**
Istilah payung untuk semua perintah yang **menghapus / merusak data permanen**.
- **Analogi**: kayak tombol "Hapus Permanen" di Recycle Bin Windows - bukan "Pindah ke Recycle Bin". Sekali klik, file hilang tanpa bisa dikembalikan dari sampah.
- **Aturan tim**: AI auto-confirm OK untuk read-only (baca file, list folder). Destructive ops = WAJIB 1x konfirmasi manual walau auto-confirm aktif.

### **`force-push` (git push --force)**
Perintah git yang **menimpa history GitHub** dengan history laptop kamu - termasuk hapus commit orang lain.
- **Analogi A (Google Docs)**: kayak "Replace All" di Google Docs yang ngehapus semua edit teman kamu, ganti pake versi kamu doang. Edit teman hilang permanen.
- **Analogi B (overwrite Drive)**: kayak upload file ke Google Drive dengan opsi "Replace existing" - versi lama hilang, ganti versi kamu. Kalau versi lama ada edit teman, edit-nya hilang.
- **⚠️ BAHAYA**: `force-push` ke `main` = bisa hilangin kerja seluruh tim. Hampir tidak pernah benar untuk staff IT - kalau Claude minta force-push, STOP & tanya owner.

### **`rm -rf` (atau `Remove-Item -Recurse -Force`)**
Perintah terminal yang **hapus folder + semua isinya tanpa nanya konfirmasi + tanpa Recycle Bin**.
- **Analogi A (shredder)**: kayak mesin shredder kantor - masukin folder full of dokumen, keluarnya potongan kertas. Tidak bisa direkat balik.
- **Analogi B (delete Tokopedia)**: kayak hapus toko Tokopedia kamu + semua produk + semua review + semua chat customer sekaligus. Tidak ada tombol restore.
- **⚠️ BAHAYA**: `rm -rf /` atau `rm -rf C:\` = hapus seluruh isi laptop. Real story: orang pernah hapus production server pakai 1 baris ini. WAJIB triple-check path sebelum jalankan.

### **`DROP TABLE` (SQL)**
Perintah SQL yang **hapus seluruh tabel database + semua datanya** permanen.
- **Analogi A (sheet Excel)**: kayak klik kanan tab sheet di Excel → "Delete Sheet" → confirm. Semua baris hilang, sheet hilang, tidak ada Ctrl+Z.
- **Analogi B (Tokopedia)**: kayak hapus seluruh data pelanggan + transaksi 5 tahun terakhir di Tokopedia kamu, dengan 1 klik. Customer support kamu bisa di-PHK karena tidak ada data untuk dilayani.
- **⚠️ BAHAYA**: di production = data customer + transaksi hilang. Kalau Claude generate SQL berisi `DROP TABLE` di prod, STOP TOTAL - tanya owner. Solusi yang benar biasanya pakai `prisma migrate` dengan backup dulu.

### **`prisma migrate` di production**
(Sudah dijelasin di Bagian 3 - Soal Stack Teknis. Recap singkat: ubah struktur database LIVE = berisiko data hilang. WAJIB konfirmasi owner.)

---

## 📖 Lanjutan

Setelah baca glossary ini, lanjut ke:
1. `ONBOARDING.md` - jadwal 14 hari pertama
2. `CLAUDE_TEAM_GUIDE.md` - workflow harian + aturan tim
3. `PROMPT_LIBRARY.md` - template prompt siap-pakai

Kalau ketemu istilah baru yang tidak ada di sini → tanya Claude (sesi terpisah, tanpa konteks proyek):
> *"Jelasin istilah `<istilah>` dengan bahasa awam + analogi sehari-hari. Saya non-programmer."*

Hasil dialog bisa kamu PR ke kit `lintasAI` supaya glossary makin lengkap untuk tim.
