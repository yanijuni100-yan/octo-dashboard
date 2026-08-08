# Panduan: Akun tidak login ulang antar komputer

Ada **dua cara**. Pakai keduanya untuk hasil terbaik.

---

## Cara 1 — Sinkron cookie bawaan app (sudah dibangun)

Mulai versi ini, app menyimpan **cookie sesi login** tiap akun ke Supabase, lalu
memulihkannya di komputer lain. Jadi sering kali akun **langsung terbuka tanpa login**.

### Cara pakai
1. **Jalankan SQL tambahan** sekali di Supabase: buka [supabase-setup.sql](supabase-setup.sql) →
   bagian **"SINKRON SESI (COOKIE)"** (tabel `sessions`) → jalankan di SQL Editor.
   (Boleh jalankan ulang seluruh file, aman.)
2. Di **komputer A**: buka akun → login + OTP seperti biasa → setelah masuk, app otomatis
   menyimpan sesi (muncul toast **💾 Sesi disimpan ke cloud**). Bisa juga tekan tombol
   **💾 Simpan sesi** di header.
3. Di **komputer B**: buka akun yang sama → app memulihkan cookie dari cloud dulu
   (status sebentar "memulihkan sesi…") → akun idealnya langsung terbuka tanpa login.

### Penting (kejujuran teknis)
- Ini **mengurangi** login ulang, **bukan menghilangkan 100%**. App ini memakai
  fingerprint asli komputer (tidak dipalsukan), jadi di komputer fisik berbeda Google
  **kadang masih** minta OTP karena perangkat terlihat beda.
- Supaya makin jarang OTP: **pakai proxy yang sama per akun** (isi proxy di tiap profil),
  agar IP-nya konsisten di semua komputer.
- Keamanan: cookie sesi disimpan di tabel `sessions` Supabase, dilindungi RLS (hanya akun
  login-mu yang bisa baca). Jangan bagikan anon key ke pihak luar.

---

## Cara 2 — AdsPower / Octo Browser (paling andal)

Kalau syaratnya **benar-benar tidak boleh login ulang di mana pun**, tool antidetect
seperti **AdsPower** (atau **Octo Browser**) memang dibuat khusus untuk ini: mereka
menyinkronkan **cookie + fingerprint + proxy** ke cloud, jadi tiap profil terlihat 100%
identik di komputer mana pun.

### Alur memakai akun dari app ini di AdsPower
1. Di app → **Pengaturan → Ekspor & Pindah Data → 📤 Ekspor untuk AdsPower (CSV)**.
   File `adspower-import-YYYY-MM-DD.csv` berisi semua akun Gmail (email, password, group).
2. Buka **AdsPower** → menu **Browser Profile** → **Import** → pilih file CSV tadi.
3. (Disarankan) Pasang **proxy per profil** di AdsPower agar IP tiap akun konsisten.
4. Login akun sekali di AdsPower → sesinya tersimpan di **cloud AdsPower** → buka di
   komputer lain (login akun AdsPower yang sama) → profil + sesi langsung tersedia,
   **tanpa login ulang Gmail**.

### Pembagian peran yang rapi
- **App Octo Dashboard** = pusat catatan akun (daftar, group, brand, GSC) + sinkron data
  antar komputer via Supabase.
- **AdsPower/Octo** = tempat membuka/menjalankan browser akun dengan sesi cloud yang
  tahan pindah komputer.

> Ringkasnya: untuk jaminan "tidak login ulang", andalkan **AdsPower/Octo**. Sinkron
> cookie bawaan app cocok untuk pemakaian ringan / sebagai pelengkap.
