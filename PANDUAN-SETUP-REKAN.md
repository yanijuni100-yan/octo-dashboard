# Panduan Setup Dashboard untuk Rekan Kerja

> Panduan ini untuk **rekan kerja Anda** supaya bisa pakai dashboard pengelola akun Gmail dari laptop mereka sendiri.
>
> **Estimasi waktu:** ~15 menit setup + 2-4 jam login ulang akun
> **Tingkat kesulitan:** Pemula (tidak perlu skill coding)
> **Perlu:** Laptop Windows, koneksi internet, file backup dari pemilik dashboard

---

## 📦 Yang Harus Disiapkan Pemilik Dashboard (Anda)

Sebelum mengirim ke rekan, Anda perlu siapkan **2 hal**:

### A. ZIP folder dashboard
1. Buka File Explorer → masuk ke folder `C:\Users\owner\octo-dashboard`
2. Klik kanan folder `octo-dashboard` → **Send to** → **Compressed (zipped) folder**
3. Hasil: file **`octo-dashboard.zip`** (sekitar 500MB–1GB)

### B. File backup data akun
1. Buka dashboard Anda → tab **Pengaturan**
2. Klik **📦 Ekspor backup penuh (JSON)**
3. Akan terdownload file **`octo-backup-YYYY-MM-DD.json`**

### C. Kirim kedua file ke rekan
Pakai salah satu cara berikut:
- **Google Drive** (upload dua-duanya, kasih link)
- **WeTransfer** (free hingga 2GB, expire 7 hari)
- **Hard disk eksternal / USB** (paling aman untuk file sensitif)

> ⚠️ **PERINGATAN:** File backup JSON berisi email + password **dalam bentuk teks polos**. JANGAN kirim lewat WhatsApp grup, Telegram public, atau email tidak terenkripsi. Pakai link Google Drive yang **hanya bisa diakses rekan tertentu**, atau USB fisik.

---

## 🖥️ Langkah-Langkah untuk Rekan Kerja

### Langkah 1 — Ekstrak ZIP
1. Terima file `octo-dashboard.zip` dari pemilik
2. Klik kanan file ZIP → **Extract All...** → pilih lokasi (misal: `D:\`)
3. Tunggu sampai selesai (~2 menit)
4. Hasilnya akan ada folder **`D:\octo-dashboard`** (atau di lokasi lain yang Anda pilih)

### Langkah 2 — Jalankan dashboard pertama kali
1. Buka folder `octo-dashboard` yang baru di-ekstrak
2. **Cari file `start-app.bat`** (ikon roda gigi atau berkas teks)
3. **Klik dua kali** `start-app.bat`
4. Akan muncul jendela hitam (CMD) sebentar, lalu **dashboard terbuka di jendela baru**
5. Kalau Windows menampilkan peringatan "Windows protected your PC":
   - Klik **More info** → klik **Run anyway**
   - Ini wajar karena aplikasi belum di-sign Microsoft

> ✅ Kalau dashboard sudah muncul dengan logo **"octo browser"** di pojok kiri, **setup berhasil!**

### Langkah 3 — Impor data 129 akun dari pemilik
1. Di dashboard yang sudah terbuka, klik tab **Pengaturan** (sidebar kiri)
2. Scroll ke kartu **"Ekspor & Pindah Data"**
3. Klik tombol **📥 Impor backup (JSON)**
4. Pilih file `octo-backup-YYYY-MM-DD.json` yang dikirim pemilik
5. Akan muncul popup tanya:
   - **OK** = Gabung dengan akun yang sudah ada (kalau ada)
   - **Cancel** = Replace total → karena baru pertama kali, klik **Cancel** (atau OK juga sama saja)
6. Tunggu sebentar → tab **Profil** akan langsung menampilkan **129 akun** ✓

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
1. Pastikan jalankan `start-app.bat` (bukan file lain)
2. Coba klik kanan `start-app.bat` → **Run as administrator**
3. Kalau muncul error tentang `node_modules`, hubungi pemilik untuk re-zip folder (mungkin ada file tertinggal)
4. Kalau Windows blokir karena antivirus, tambahkan folder ke whitelist

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
