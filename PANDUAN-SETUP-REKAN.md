# Panduan Setup Dashboard untuk Rekan Kerja

> Panduan ini untuk **rekan kerja Anda** supaya bisa pakai dashboard pengelola akun Gmail dari laptop mereka sendiri.
>
> **Terakhir dicek ulang:** 8 Agustus 2026 — angka & langkah di bawah sudah dicocokkan dengan kondisi nyata.
>
> **Estimasi waktu:** ~10 menit pasang + 2-4 jam login ulang akun
> **Tingkat kesulitan:** Pemula (tidak perlu skill koding)
> **Perlu:** Laptop Windows, koneksi internet, 2 berkas dari pemilik dashboard

---

## 📦 Yang Harus Disiapkan Pemilik Dashboard (Anda)

Sebelum mengirim ke rekan, siapkan **2 berkas**. Totalnya hanya sekitar **76 MB**.

### A. Berkas pemasang aplikasi (installer)

Buka terminal di folder proyek, lalu:

```bash
npm run dist
```

Tunggu beberapa menit. Hasilnya muncul di folder `dist\`:

**`Octo Dashboard Setup 2.0.0.exe`** — sekitar **76 MB**

> 💡 **Kenapa pakai installer, bukan ZIP seluruh folder?** Karena folder proyek lengkap
> beratnya **~7 GB** (sebagian besar isinya profil Chrome yang **toh tidak bisa dipakai** di
> komputer lain — lihat Langkah 4). Installer 76 MB sudah memuat semua yang diperlukan, dan
> rekan Anda **tidak perlu memasang Node.js** sama sekali.
>
> 🏢 Analoginya: mengirim **mobilnya**, bukan mengangkut seluruh isi garasi.

### B. Berkas cadangan data akun

1. Buka dashboard Anda → tab **Pengaturan**
2. Scroll ke kartu **"Ekspor & Pindah Data"**
3. Klik **📦 Ekspor backup penuh (JSON)**
4. Hasil: **`octo-backup-YYYY-MM-DD.json`** — kecil saja, sekitar **28 KB**

### C. Kirim kedua berkas ke rekan

| Berkas | Ukuran | Cara kirim |
|---|---|---|
| `Octo Dashboard Setup 2.0.0.exe` | ~76 MB | Google Drive / WeTransfer — **aman**, tidak memuat data akun |
| `octo-backup-YYYY-MM-DD.json` | ~28 KB | 🔒 **Jalur pribadi**: Drive yang dibagikan khusus ke akun rekan, atau USB fisik |

> ⚠️ **PERINGATAN:** Berkas cadangan JSON berisi email + password **dalam bentuk teks polos**.
> JANGAN kirim lewat WhatsApp grup, Telegram publik, atau email biasa. Pakai tautan Google Drive
> yang **hanya bisa diakses rekan tertentu**, atau USB fisik — dan minta rekan **menghapusnya**
> setelah selesai diimpor.

---

### 📁 Cara lama: kirim seluruh folder (hanya kalau rekan mau ikut mengubah kode)

Kalau rekan Anda akan **mengembangkan kodenya**, bukan sekadar memakai, dia bisa mengambil
kode sumbernya dari GitHub — jauh lebih ringan daripada mengirim ZIP 7 GB:

```bash
git clone https://github.com/yanijuni100-yan/octo-dashboard.git
cd octo-dashboard
npm install
npm run dev
```

⚠️ Cara ini **membutuhkan Node.js** terpasang di komputer rekan (unduh di <https://nodejs.org>).
Data akun tetap dikirim terpisah lewat berkas cadangan JSON — data **tidak pernah** ikut di GitHub.

---

## 🖥️ Langkah-Langkah untuk Rekan Kerja

### Langkah 1 — Pasang aplikasinya

1. Terima berkas **`Octo Dashboard Setup 2.0.0.exe`** dari pemilik
2. **Klik dua kali** berkas itu
3. Kalau Windows menampilkan peringatan **"Windows protected your PC"**:
   - Klik **More info** → lalu klik **Run anyway**
   - Ini wajar: aplikasinya belum bersertifikat Microsoft (berbayar dan tidak wajib)
4. Ikuti jendela pemasangan → pilih lokasi pemasangan (biarkan bawaan kalau ragu) → **Install**
5. Setelah selesai, akan muncul **pintasan "Octo Dashboard"** di Desktop dan Start Menu

> 💡 Ikon aplikasinya masih ikon bawaan Electron (bola atom abu-abu) — itu **normal**,
> bukan tanda aplikasi rusak atau virus.

### Langkah 2 — Buka dashboard pertama kali

1. Klik dua kali pintasan **Octo Dashboard** di Desktop
2. Dashboard terbuka dalam jendela aplikasi tersendiri

> ✅ Kalau dashboard sudah muncul dengan logo **"octo browser"** di pojok kiri, **pemasangan berhasil!**
> Tabel profilnya akan **kosong** dulu — itu benar, datanya diisi di Langkah 3.

### Langkah 3 — Impor data 100 akun dari pemilik
1. Di dashboard yang sudah terbuka, klik tab **Pengaturan** (sidebar kiri)
2. Scroll ke kartu **"Ekspor & Pindah Data"**
3. Klik tombol **📥 Impor backup (JSON)**
4. Pilih file `octo-backup-YYYY-MM-DD.json` yang dikirim pemilik
5. Akan muncul popup tanya:
   - **OK** = Gabung dengan akun yang sudah ada (kalau ada)
   - **Cancel** = Replace total → karena baru pertama kali, klik **Cancel** (atau OK juga sama saja)
6. Tunggu sebentar → tab **Profil** akan langsung menampilkan **100 akun** ✓

> 📌 Angka **100** ini per **8 Agustus 2026**. Kalau yang muncul beda sedikit, kemungkinan
> pemilik menambah/menghapus akun setelah tanggal itu — bukan tanda gagal. Yang penting:
> tabelnya terisi, bukan kosong.

### Langkah 4 — Login setiap akun (paling memakan waktu)

> ⚠️ **Penting:** Setiap akun **HARUS login ulang manual** karena sesi login pemilik tidak ikut terbawa. Ini normal, Google sengaja merancang begitu.

**Cara login satu akun:**
1. Di tab **Profil**, cari akun di tabel
2. Klik tombol **Login** ungu di kolom AKSI
3. Akan terbuka halaman Google
4. **Masukkan password** akun itu (lihat di tabel atau di tombol ✎ Edit untuk dapat password)
5. Kalau Google minta **verifikasi OTP** (kode SMS / email pemulihan):
   - Pemilik harus kasih kode OTP-nya ke Anda
   - Atau pemilik yang login sekali untuk membuat sesi "trusted device"
6. Setelah berhasil masuk, akan auto-redirect ke **Search Console**
7. Klik **✕ Tutup** di pojok kanan atas → kembali ke tabel

**Cara cepat:** centang **5-10 akun sekaligus** di tabel → klik **"↗ Buka semua"** di bulkbar mengambang → akun-akun terbuka berdampingan, login satu per satu di tampilan grid.

---

## 🚨 Pertanyaan yang Sering Muncul

### Tampil halaman putih saat klik Login?
Itu Google memblokir embedded browser. Solusi:
- Klik tombol **"↗ Buka di tab terpisah"** di pojok kanan atas iframe
- Akan terbuka di Chrome biasa Anda → di sana Google tidak blokir
- Login di sana, lalu kembali ke dashboard → biasanya berikutnya bisa langsung

### Google minta verifikasi "Apakah ini Anda?"
- Wajar karena login dari device baru (laptop Anda, bukan pemilik)
- Klik **"Ya, ini saya"** kalau pemilik sudah konfirmasi
- Atau lewati OTP dengan hubungi pemilik untuk dapat kode

### Beberapa akun terkunci?
- Google mendeteksi pola login mencurigakan (banyak akun beda + IP baru)
- Solusi: pakai **proxy yang sama untuk semua akun** (atau VPN yang sama)
- Login akun bertahap (jangan 50 sekaligus dalam 1 jam)

### Aplikasi tidak mau jalan?

**Kalau memasang lewat installer (cara utama):**
1. Klik kanan pintasan **Octo Dashboard** → **Run as administrator**
2. Kalau antivirus memblokir, tambahkan folder pemasangannya ke daftar aman (whitelist)
3. Kalau pemasangan gagal di tengah: hapus dulu lewat **Settings → Apps → Octo Dashboard → Uninstall**, lalu pasang ulang
4. Kalau tetap gagal, minta pemilik membuat ulang installer-nya (`npm run dist`) lalu kirim ulang

**Kalau memakai kode sumber dari GitHub (cara lanjutan):**
1. Pastikan **Node.js sudah terpasang** — cek dengan mengetik `node --version` di terminal
2. Jalankan `npm install` dulu sebelum `npm run dev`
3. Kalau muncul pesan soal `node_modules`, hapus foldernya lalu ulangi `npm install`

### Saya bisa buat profil baru sendiri?
Bisa. Klik **+ Profil Baru** di toolbar atau **Bulk Add Gmail** kartu merah. Tapi:
- Akun baru yang Anda buat **TIDAK** otomatis muncul di dashboard pemilik
- Untuk sinkronisasi balik, Anda harus ekspor backup lagi dan kirim ke pemilik

---

## 🔒 Etika & Tanggung Jawab

Karena Anda memegang **email + password** akun-akun pemilik:

1. **Jangan share file backup ke orang lain** — pemilik mempercayakan Anda
2. **Jangan login dari laptop publik / warnet** — bisa kebocoran
3. **Jangan ubah password** akun pemilik tanpa izin
4. **Hapus file backup** setelah selesai impor (jangan biarkan di Downloads)
5. **Logout dari dashboard** kalau laptop akan dipakai orang lain

---

## 📞 Kalau Mentok

Hubungi pemilik dashboard kalau:
- File ZIP tidak bisa di-ekstrak
- Dashboard tidak mau jalan setelah klik `start-app.bat`
- Banyak akun minta OTP — minta pemilik yang setup pertama
- Bingung pakai fitur tertentu — minta screenshot pemilik

---

**Selamat bekerja! 🚀**

> Dashboard ini adalah alat bantu visual, bukan pengganti Octo Browser asli. Untuk hasil terbaik (terutama menghindari deteksi Google), kerjakan akun-akun secara bertahap dan gunakan koneksi internet yang stabil.
