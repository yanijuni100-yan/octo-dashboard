# Panduan Launch — Octo Dashboard (.exe + Login Supabase)

Dokumen ini menjelaskan cara **menyiapkan login Supabase** dan **membuat installer .exe**
untuk dibagikan ke user.

---

## 1. Siapkan Supabase (sekali saja)

1. Masuk ke <https://supabase.com> → **New project** (gratis cukup untuk awal).
2. Setelah project jadi, buka **Settings → API**:
   - Salin **Project URL**
   - Salin **anon public** key
3. Buka file [`supabase-config.js`](supabase-config.js) dan isi:
   ```js
   window.SUPABASE_CONFIG = {
     url: 'https://xxxx.supabase.co',      // Project URL kamu
     anonKey: 'eyJhbGciOi...',             // anon public key kamu
   };
   ```
   > ⚠️ Pakai **anon** key, JANGAN `service_role`. anon key memang aman ditaruh di app.

4. Aktifkan login email/password: **Authentication → Providers → Email** → pastikan **Enable** ON.
   Supaya user yang kamu buat bisa langsung login tanpa konfirmasi email:
   **Authentication → Providers → Email** → matikan **Confirm email** (opsional, lebih praktis).

---

## 2. Bikin akun user (kamu sebagai admin)

Karena app **tidak punya menu daftar**, semua user dibuat manual oleh kamu:

1. Supabase → **Authentication → Users → Add user → Create new user**
2. Isi **Email** + **Password**, centang **Auto Confirm User**.
3. Kasih email + password itu ke orang yang berhak pakai app.

Mau cabut akses seseorang? Hapus / disable user-nya di halaman yang sama.

---

## 3. Build installer .exe

Di folder project, jalankan:

```powershell
npm install        # sekali saja, kalau belum
npm run dist
```

Hasil installer ada di folder **`dist\`**:
- `Octo Dashboard Setup 1.0.0.exe`  ← ini yang dibagikan ke user.

User tinggal jalankan installer itu → app ter-install + ada shortcut di Desktop & Start Menu.

> Saat pertama jalan, Windows mungkin menampilkan **"Windows protected your PC"**
> (karena belum di-code-sign). User klik **More info → Run anyway**. Ini wajar dan aman.
> Kalau nanti mau hilangkan warning ini, beli sertifikat code signing (lihat bagian 5).

---

## 4. Cara user pakai

1. Buka **Octo Dashboard** dari shortcut.
2. Muncul layar **Masuk** → isi email + password yang kamu kasih → **Masuk**.
3. Sesi tersimpan, jadi besok buka app langsung masuk (sampai klik **Logout** di kanan atas).

---

## 5. (Opsional) Hilangkan warning Windows — code signing

Warning "Windows protected your PC" muncul karena .exe belum ditandatangani.
Untuk produksi:

- Beli **sertifikat code signing** (OV ± Rp3–6 jt/thn, atau EV ± Rp5–10 jt/thn untuk langsung dipercaya).
- Tambahkan ke `package.json` bagian `build.win`:
  ```json
  "win": {
    "target": "nsis",
    "certificateFile": "sertifikat.pfx",
    "certificatePassword": "PASSWORD_PFX"
  }
  ```
- Build ulang `npm run dist`.

---

## 6. (Opsional) Ikon aplikasi

Sekarang installer pakai ikon Electron default. Untuk ikon sendiri:
1. Siapkan `icon.ico` (256×256) di folder project.
2. Tambahkan di `package.json`:
   ```json
   "win": { "target": "nsis", "icon": "icon.ico" }
   ```
3. Build ulang.

---

## Catatan teknis

- File baru yang ditambahkan untuk login:
  `supabase-config.js`, `auth.js`, `auth.css`, `vendor/supabase.js`,
  plus overlay login + urutan `<script>` di `index.html`.
- Login bersifat **gerbang akses** (kontrol siapa yang boleh buka app), bukan proteksi
  anti-bajak yang keras — karena app desktop, semua kode ada di komputer user.
- Data profil tetap tersimpan **lokal** (`localStorage`) seperti sebelumnya; Supabase
  hanya dipakai untuk login.
