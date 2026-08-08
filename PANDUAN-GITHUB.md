# Panduan: Buat Repo GitHub & Kirim Kode (push)

Tujuan: kamu bisa **sendiri** menyimpan pekerjaan ke GitHub, tanpa perlu minta tolong siapa pun.

> 💡 **Kenapa perlu GitHub?** Kalau laptop rusak, kena virus, atau hilang — kode yang cuma ada di
> komputer ikut hilang selamanya. GitHub = brankas online yang menyimpan **semua versi** kodemu,
> lengkap dengan catatan "kapan diubah" dan "kenapa diubah".

---

## A. Konsep dasar — 4 tempat, bukan 1

Ini bagian yang paling sering bikin bingung pemula. Kode kamu melewati **4 tempat**, bukan
langsung dari komputer ke GitHub. Analogi paling gampang: **mengirim paket**.

| # | Nama tempat | Analogi paket | Perintahnya |
|---|---|---|---|
| 1 | **Folder kerja** | Barang berserakan di meja | *(kamu ngetik/ngedit di sini)* |
| 2 | **Ruang tunggu** (*staging*) | Barang dimasukkan ke kardus | `git add` |
| 3 | **Riwayat lokal** | Kardus disegel + ditempeli label | `git commit` |
| 4 | **GitHub** | Kardus dikirim ke gudang | `git push` |

**Poin penting:** kalau kamu cuma `git add` lalu berhenti, **belum ada yang tersimpan**.
Kalau cuma `git commit` lalu berhenti, tersimpan tapi **masih di komputermu saja**.
Baru setelah `git push`, barangnya sampai di gudang GitHub.

> 🔍 **Bedanya dengan Google Drive:** Google Drive cuma simpan versi **terakhir**.
> GitHub simpan **semua versi** — kamu bisa balik ke kondisi 3 minggu lalu kapan pun,
> dan bisa lihat siapa mengubah apa.

---

## B. Persiapan (sekali saja, seumur hidup)

### 1. Pastikan alatnya sudah ada

Buka terminal (di VS Code: menu **Terminal → New Terminal**), ketik satu per satu:

```bash
git --version
gh --version
```

Kalau keluar nomor versi = sudah terpasang. Kalau keluar `command not found`:
- `git` belum ada → unduh di <https://git-scm.com/download/win>
- `gh` belum ada → unduh di <https://cli.github.com>

> `gh` = **GitHub CLI**, alat resmi GitHub untuk mengetik perintah, bukan klik-klik di web.
> Ini yang bikin bisa membuat repo cukup 1 baris perintah.

### 2. Login ke GitHub (sekali saja)

```bash
gh auth login
```

Ikuti pertanyaannya: pilih **GitHub.com** → **HTTPS** → **Login with a web browser** →
salin kode yang muncul → tekan Enter → browser terbuka → tempel kodenya → **Authorize**.

Cek berhasil atau belum:

```bash
gh auth status
```

Harus muncul `✓ Logged in to github.com account <namamu>`.

### 3. Kenalkan namamu ke Git (sekali saja)

Ini yang jadi tanda tangan di tiap catatan pekerjaanmu:

```bash
git config --global user.name "Nama Kamu"
git config --global user.email "email-github-kamu@gmail.com"
```

---

## C. Buat repo GitHub (sekali per proyek)

Ada **2 cara**. Pilih yang kamu suka — hasilnya sama persis.

### Cara 1: Lewat perintah (paling cepat, 1 baris) ⭐

Pastikan kamu sudah berada di folder proyek, lalu:

```bash
gh repo create nama-proyek --private --source=. --remote=origin --push
```

Arti tiap potongannya:

| Potongan | Artinya |
|---|---|
| `gh repo create` | "Buatkan repo baru di GitHub" |
| `nama-proyek` | Nama repo-nya (mis. `octo-dashboard`) |
| `--private` | **Tertutup** — hanya kamu yang bisa lihat. Ganti `--public` kalau mau terbuka |
| `--source=.` | "Isinya ambil dari folder tempat aku berdiri sekarang" (titik = folder ini) |
| `--remote=origin` | Beri nama panggilan `origin` untuk alamat GitHub itu |
| `--push` | Sekalian kirim isinya sekarang juga |

Satu baris ini melakukan 3 hal sekaligus: bikin repo, sambungkan, dan kirim.

### Cara 2: Lewat website (kalau lebih nyaman klik-klik)

1. Buka <https://github.com/new>
2. **Repository name**: isi nama proyek
3. Pilih **Private** (tertutup) atau **Public** (terbuka)
4. ⚠️ **JANGAN** centang "Add a README file" / `.gitignore` / license — biarkan **kosong semua**.
   Kalau dicentang, nanti tabrakan dengan kode yang sudah ada di komputermu.
5. Klik **Create repository**
6. Balik ke terminal, sambungkan manual:

```bash
git remote add origin https://github.com/NAMA-AKUNMU/nama-proyek.git
git branch -M main
git push -u origin main
```

> `origin` itu cuma **nama panggilan** untuk alamat GitHub-mu — supaya tidak perlu mengetik
> alamat panjang tiap kali. Mirip menyimpan nomor HP dengan nama "Mama" di kontak.

---

## D. Kerja sehari-hari (yang akan kamu pakai terus)

Setelah repo ada, **tidak perlu bikin lagi**. Tiap kali selesai mengerjakan sesuatu,
cukup **4 langkah** ini:

```bash
# 1. Lihat apa saja yang berubah
git status

# 2. Masukkan semua perubahan ke kardus
git add .

# 3. Segel kardus + tempel label penjelasan
git commit -m "feat: tambah tombol ekspor data ke Excel"

# 4. Kirim ke GitHub
git push
```

Sudah. Itu saja, seterusnya.

### Cara menulis label (pesan commit) yang benar

Formatnya: `jenis: apa yang berubah`

| Jenis | Dipakai kapan | Contoh |
|---|---|---|
| `feat` | Menambah fitur baru | `feat: tambah tombol hapus akun` |
| `fix` | Memperbaiki yang rusak | `fix: tombol simpan tidak jalan di Windows 11` |
| `docs` | Ubah tulisan/panduan saja | `docs: perjelas cara pasang Supabase` |
| `refactor` | Rapikan kode, hasil tetap sama | `refactor: pecah file besar jadi 3 bagian` |
| `chore` | Urusan teknis lain | `chore: perbarui daftar berkas yang diabaikan` |

❌ **Jangan** tulis: `update`, `fix bug`, `wip`, `asdf` — 3 bulan lagi kamu sendiri tidak akan
paham itu commit apa.

✅ **Tulis** kalimat yang bisa dipahami orang lain (dan dirimu di masa depan).

---

## E. Cara memastikan berhasil

```bash
# Cek sudah tersambung ke mana
git remote -v

# Cek cabang mana yang sudah sampai di GitHub
git ls-remote --heads origin

# Cek repo-nya tertutup atau terbuka
gh repo view --json nameWithOwner,visibility
```

Atau paling gampang: buka repo-nya di browser.

```bash
gh repo view --web
```

> ⚠️ **Jangan cuma percaya "perintahnya tidak error".** Perintah yang jalan lancar belum tentu
> hasilnya benar. Selalu **cek ke servernya** seperti di atas. Analoginya: timbangan yang mati
> menunjuk "0 kg" — bukan berarti barangmu memang nol beratnya.

---

## F. Masalah yang sering muncul

| Pesan error | Artinya | Solusinya |
|---|---|---|
| `fatal: not a git repository` | Folder ini belum jadi proyek git | Ketik `git init` dulu |
| `remote origin already exists` | Sudah pernah disambungkan | Ganti alamatnya: `git remote set-url origin <alamat-baru>` |
| `Updates were rejected` | Ada perubahan di GitHub yang belum kamu punya | Ambil dulu: `git pull --rebase`, baru `git push` lagi |
| `Authentication failed` | Login-nya kedaluwarsa | Ulangi `gh auth login` |
| `nothing to commit` | Tidak ada yang berubah sejak commit terakhir | Normal — memang belum ada yang perlu disimpan |
| `[penjaga-rahasia] TOLAK` | Detektor menemukan yang mirip kunci rahasia | **Baca bagian G di bawah** |

---

## G. ⚠️ Penjaga rahasia — jangan asal ditembus

Proyek ini punya **detektor otomatis** di `.git/hooks/pre-commit` — seperti detektor logam
di bandara. Tiap kali kamu `git commit`, ia mengendus dulu: *"ada kunci rahasia yang ikut
kebawa?"* Kalau berbunyi, penyimpanan **dibatalkan otomatis**.

**Kalau ia berbunyi, jangan panik dan jangan langsung ditembus.** Lakukan ini:

1. **Baca daftar berkas** yang ia sebutkan.
2. **Buka berkas itu** dan lihat baris yang dimaksud.
3. **Putuskan dengan jujur:**

   - 🚨 **Kalau itu kunci ASLI** (kunci Supabase, token, password sungguhan) →
     **JANGAN dikirim.** Hapus dari berkas, lalu **ganti kunci itu** di layanannya
     (kunci yang pernah bocor harus dianggap sudah bocor selamanya).

   - ✅ **Kalau itu cuma tulisan contoh** di panduan (mis. `ghp_xxxxxx`,
     `postgresql://user:password@`, `AKIAIOSFODNN7EXAMPLE`) → itu **alarm palsu**,
     dan kamu boleh melewatinya sekali ini:

     ```bash
     git commit --no-verify -m "pesanmu"
     ```

> 🔒 **Kenapa harus kamu yang memutuskan, bukan AI?** Karena pagar keamanan yang bisa dilewati
> otomatis = bukan pagar. Asisten AI (termasuk Claude) **tidak boleh** menembus penjaga ini atas
> inisiatif sendiri — ia hanya boleh menunjukkan bukti, lalu **manusia** yang memutuskan.
> Analoginya: kalau palang e-toll error, petugas yang benar tidak membuka palang sendiri
> karena "yakin mobilnya benar" — dia lapor dulu.

---

## H. Yang TIDAK boleh ikut terkirim

Berkas berikut sudah dikunci di [`.gitignore`](.gitignore) — biarkan tetap terkunci:

- `data/` — berisi **email + password** akun (paling sensitif!)
- `.env` — berisi kunci-kunci rahasia
- `octo-backup-*.json` dan `adspower-import-*.csv` — cadangan berisi akun
- `*.pfx`, `*.p12` — sertifikat penanda tangan aplikasi
- `node_modules/` — bukan rahasia, tapi ukurannya besar dan bisa diunduh ulang kapan saja

Cek apakah sebuah berkas benar-benar terkunci:

```bash
git check-ignore -v data/akun.json
```

Kalau keluar barisnya = **aman, terkunci**. Kalau tidak keluar apa-apa = **belum terkunci, bahaya**.

> 🚨 **Ingat asimetri ini:** repo **tertutup → terbuka** itu 1 klik dan gampang.
> **Terbuka → tertutup TIDAK memulihkan apa pun** — begitu terbit, isinya bisa sudah tersalin,
> ter-cache mesin pencari, atau ter-fork orang lain. Mirip mengunggah foto ke media sosial:
> dihapus pun bisa sudah terlanjur disimpan orang. **Kalau ragu, pilih Private dulu.**

---

## I. Contoh nyata: perintah yang dipakai di proyek ini

Ini persis yang dijalankan saat `octo-dashboard` diunggah pertama kali (8 Agustus 2026):

```bash
# 1. Cek dulu belum tersambung ke mana pun
git remote -v                      # hasilnya: kosong

# 2. Buat repo tertutup + sambungkan + kirim, sekali jalan
gh repo create octo-dashboard --private --source=. --remote=origin --push

# 3. Kirim juga cabang kedua
git push origin feat/react-migration

# 4. Buktikan berhasil dengan bertanya ke server GitHub
gh repo view --json nameWithOwner,visibility
git ls-remote --heads origin
```

Hasil: <https://github.com/yanijuni100-yan/octo-dashboard> (Private, 2 cabang).

---

## J. Contekan cepat 📌

```bash
git status                      # apa saja yang berubah?
git add .                       # masukkan semua ke kardus
git commit -m "feat: ..."       # segel + beri label
git push                        # kirim ke GitHub

git log --oneline -5            # lihat 5 catatan terakhir
git pull                        # ambil perubahan terbaru dari GitHub
gh repo view --web              # buka repo di browser
```

**Urutan yang wajib diingat:** `add` → `commit` → `push`.
Lupa salah satu = barangnya belum sampai gudang.
