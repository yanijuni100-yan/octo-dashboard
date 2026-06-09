# Tutorial: Upload ke GitHub → lalu Setup Supabase

Project ini sudah jadi git repo lokal dan sudah di-commit.
Tinggal: (A) push ke GitHub, lalu (B) setup Supabase.

> 📍 Catatan box ini: koneksi internet hanya lewat proxy `127.0.0.1:8802`.
> Jadi sebelum perintah yang butuh internet (gh / git push), jalankan dulu:
> ```powershell
> $env:HTTPS_PROXY="http://127.0.0.1:8802"; $env:HTTP_PROXY="http://127.0.0.1:8802"
> ```
> (Kalau nanti kamu kerjakan dari laptop biasa yang internetnya normal, baris ini tidak perlu.)

---

## A. Upload ke GitHub

### Cara 1 — Pakai GitHub CLI (paling gampang)

```powershell
cd D:\owner\octo-dashboard

# 1) Login GitHub (sekali saja) — pilih: GitHub.com → HTTPS → Login with a web browser
gh auth login

# 2) Buat repo + push sekaligus. PRIVATE sangat disarankan (ada data akun).
gh repo create octo-dashboard --private --source . --remote origin --push
```

Selesai. Repo langsung muncul di `https://github.com/USERNAME/octo-dashboard`.

### Cara 2 — Manual lewat web github.com

1. Buka <https://github.com/new>
   - **Repository name:** `octo-dashboard`
   - Pilih **Private** ✅
   - **JANGAN** centang "Add a README / .gitignore / license" (biar tidak bentrok)
   - Klik **Create repository**
2. Sambungkan & push (ganti `USERNAME`):
   ```powershell
   cd D:\owner\octo-dashboard
   git remote add origin https://github.com/USERNAME/octo-dashboard.git
   git push -u origin main
   ```
3. Saat diminta **Username** + **Password**:
   - Username = username GitHub-mu
   - Password = **Personal Access Token** (BUKAN password akun).
     Bikin token di: <https://github.com/settings/tokens> → *Generate new token (classic)* →
     centang scope **repo** → copy token-nya.

### Update berikutnya (tiap ada perubahan kode)

```powershell
git add -A
git commit -m "perubahan apa"
git push
```

> ✅ Yang **TIDAK** ikut ke GitHub (sudah diatur `.gitignore`): `node_modules/`, `dist/`
> (installer .exe), file backup akun, dan sertifikat. Aman.

---

## B. Setup Supabase

### 1. Buat project
1. Buka <https://supabase.com> → **Sign in** (bisa pakai akun GitHub) → **New project**.
2. Isi **Name** (mis. `octo-dashboard`), **Database Password** (simpan), pilih **Region**
   terdekat (mis. Singapore) → **Create new project**. Tunggu ±2 menit.

### 2. Ambil kunci & isi ke app
1. Di project → **Settings** (gerigi) → **API**.
2. Salin:
   - **Project URL** → contoh `https://abcd1234.supabase.co`
   - **Project API keys → anon public** → contoh `eyJhbGciOiJIUzI1...`
3. Buka file `supabase-config.js`, isi:
   ```js
   window.SUPABASE_CONFIG = {
     url: 'https://abcd1234.supabase.co',
     anonKey: 'eyJhbGciOiJIUzI1...',
   };
   ```
   > Pakai **anon** key, JANGAN `service_role`.

### 3. Aktifkan login email/password
1. **Authentication** → **Sign In / Providers** (atau **Providers**) → **Email** → pastikan **Enabled**.
2. (Opsional, biar praktis) matikan **Confirm email** supaya user yang kamu buat bisa langsung login.

### 4. Buat akun user (kamu = admin)
App tidak punya menu daftar, jadi user dibuat manual:
1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Isi **Email** + **Password**, centang **Auto Confirm User** → **Create**.
3. Kasih email + password itu ke orang yang berhak. Cabut akses = hapus user-nya.

### 5. Build ulang installer (PENTING)
Installer `.exe` membungkus isi `supabase-config.js`. Karena tadi baru diisi,
**build ulang** supaya installer membawa konfigurasi yang benar:
```powershell
$env:ELECTRON_RUN_AS_NODE=""; npm run dist
```
Installer baru ada di `dist\Octo Dashboard Setup 1.0.0.exe` → ini yang dibagikan.

### 6. Tes
Jalankan app (`npm start` atau install dari .exe) → muncul layar **Masuk** →
login pakai email/password yang kamu buat di langkah 4 → dashboard terbuka. ✅

---

## Ringkasan alur

```
Kode di laptop ──push──► GitHub (private)        ← penyimpanan kode / backup / versi
       │
       └── supabase-config.js diisi URL+anon key
                     │
                     ▼
               Supabase (Auth)                    ← login user (kamu yang bikin akun)
                     │
              npm run dist → .exe                 ← installer yang dibagikan ke user
```
