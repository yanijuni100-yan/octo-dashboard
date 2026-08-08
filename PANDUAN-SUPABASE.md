# Panduan: Simpan Data Octo Dashboard di Supabase

Tujuan: data akun (profil) **tersimpan online di Supabase** dan **sama di semua komputer**.
Aplikasi tetap bisa dibuka tanpa internet (pakai data lokal), dan akan menyinkronkan
otomatis begitu online & login.

> ⚠️ **Keamanan:** data berisi email + password Gmail. Setup ini memakai **login + RLS**,
> jadi hanya akun Supabase yang login yang bisa membaca datanya. Pakai password Supabase
> yang kuat, dan **jangan** sebar anon key ke orang luar.

---

## A. Launch / jalankan aplikasi

**Mode aplikasi desktop (disarankan):**
1. Buka folder ini di terminal.
2. Sekali saja: `npm install`
3. Jalankan: `npm start` (atau klik dua kali `start-app.bat`).

**Buat installer .exe (opsional, untuk dibagikan):** `npm run dist` → hasil di folder `dist/`.

---

## B. Buat proyek & database Supabase (sekali saja)

1. Masuk ke <https://supabase.com> → **Sign in** → **New project**.
   - Beri nama (mis. `octo-dashboard`), pilih region terdekat (mis. Singapore),
     buat **Database Password** (catat, untuk admin DB — bukan untuk login app).
   - Tunggu ±1–2 menit sampai proyek siap.

2. **Buat tabel + keamanan:**
   - Menu kiri → **SQL Editor** → **New query**.
   - Buka file [`supabase-setup.sql`](supabase-setup.sql), salin semua isinya, tempel, klik **Run**.
   - Harus muncul "Success".

3. **Ambil URL & anon key:**
   - Menu kiri → **Project Settings** (ikon gerigi) → **API**.
   - Salin **Project URL** (mis. `https://abcdxyz.supabase.co`).
   - Salin **anon public** key (string panjang diawali `eyJ...`).
   > anon key memang aman dipakai di aplikasi **karena RLS aktif** — tanpa login, key ini
   > tidak bisa membaca data siapa pun.

4. **Buat akun login aplikasi:**
   - Menu kiri → **Authentication** → **Users** → **Add user** → isi email & password.
     (Atau pakai tombol **Daftar akun** langsung dari aplikasi — lihat bagian C.)
   - Tips: kalau tak mau ribet verifikasi email, di **Authentication → Providers → Email**
     matikan **Confirm email** saat masih testing.

---

## C. Sambungkan aplikasi ke Supabase

1. Buka aplikasi → tab **Pengaturan** → kartu **☁️ Sinkron Cloud (Supabase)**.
2. Tempel **Project URL** dan **anon key** → klik **Simpan koneksi**.
3. Isi **Email** + **Password** (akun dari langkah B-4) → klik **Login**.
   - Belum punya akun? Klik **+ Daftar akun** dulu, lalu **Login**.
4. Setelah login: data lokal yang ada akan **otomatis terunggah** ke cloud, dan
   status berubah jadi `✓ Login sebagai ...`.

Mulai sekarang setiap perubahan (tambah/edit/hapus profil) **otomatis dikirim** ke cloud,
dan perubahan dari komputer lain **otomatis masuk** (realtime).

---

## D. Pakai di komputer / orang lain

Agar **berbagi data yang sama**, di komputer lain:
1. Jalankan aplikasi (bagian A).
2. Pengaturan → isi **URL + anon key yang sama** → Simpan koneksi.
3. **Login dengan akun Supabase yang sama** → data langsung tertarik dari cloud.

> Login dengan akun Supabase **berbeda** = data terpisah sendiri-sendiri (tidak tercampur).

Tombol manual bila perlu:
- **⬇ Tarik dari cloud** — ambil versi terbaru dari server.
- **⬆ Kirim ke cloud** — paksa unggah data lokal sekarang.

---

## E. Cara kerja singkat (biar paham)

- Penyimpanan utama saat login = tabel `dashboards` di Supabase (1 baris JSON per akun).
- File lokal (`data/octo-data.json` di mode app, atau localStorage di mode web) tetap
  jadi **cache/cadangan** — aplikasi tetap jalan walau offline.
- Saat sinkron, yang dipakai adalah versi dengan **stempel waktu terbaru**
  (last-write-wins). Jadi kalau 2 orang mengedit di detik yang sama, perubahan yang
  disimpan paling akhir yang menang. Untuk pemakaian normal (giliran), aman.

## F. Masalah umum

| Gejala | Penyebab / solusi |
|---|---|
| Status tetap "belum tersambung" | URL/anon key salah atau kosong → cek lagi, Simpan koneksi. |
| "Invalid login credentials" | Email/password salah, atau akun belum dibuat (klik Daftar). |
| Login OK tapi data tidak muncul | Belum jalankan `supabase-setup.sql`, atau RLS belum dibuat. Jalankan ulang SQL. |
| Perubahan komputer lain tak masuk realtime | Pastikan baris `alter publication supabase_realtime add table public.dashboards;` sudah jalan. |
| Minta verifikasi email terus | Matikan "Confirm email" di Authentication → Providers (saat testing). |
