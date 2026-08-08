# Octo Browser Dashboard

Dashboard untuk mengelola profil anti-deteksi **Octo Browser** — melihat daftar profil,
menjalankan/menghentikan profil, mengatur proxy, dan menjalankan otomatisasi massal.

Tersedia dalam **dua bentuk** yang hidup berdampingan di repo ini:

| Bentuk | Untuk siapa | Teknologi |
|---|---|---|
| **Aplikasi desktop** (utama, v2) | Pemakaian sehari-hari | Electron + React + TypeScript + Vite |
| **Versi browser** (ringan, v1) | Coba cepat tanpa instalasi | HTML + CSS + JavaScript polos |

---

## Menjalankan

### A. Aplikasi desktop (disarankan)

```bash
npm install       # sekali saja
npm run dev       # mode pengembangan
npm start         # menjalankan hasil build
```

Membuat installer `.exe` untuk Windows:

```bash
npm run dist      # hasilnya di folder dist/
```

Pintasan tanpa mengetik: klik dua kali `start-app.bat`.

### B. Versi browser (ringan)

Klik dua kali `index.html`, atau jalankan server lokal supaya mode Live API berfungsi
tanpa kendala:

```bash
node server.js    # lalu buka http://localhost:8080
```

Pintasan: klik dua kali `start-web.bat`.

---

## Fitur

- **Ringkasan** — total profil, profil aktif, proxy unik, jumlah tag, grafik distribusi OS,
  dan aktivitas terbaru.
- **Profil** — daftar profil dengan pencarian, filter tag & status, start/stop, edit, hapus,
  dan aksi massal (pilih banyak lalu start/stop/hapus).
- **Proxy** — daftar proxy dan berapa profil yang memakainya.
- **Otomatisasi** — start sejumlah profil sekaligus (opsional difilter tag), stop semua,
  lengkap dengan log.
- **Pengaturan** — atur Local API URL & token, tes koneksi, reset data dummy.
- **Sinkronisasi cloud** (opsional) — data tersimpan di Supabase supaya sama di semua
  komputer. Lihat [PANDUAN-SUPABASE.md](PANDUAN-SUPABASE.md).

## Mode data

| Mode | Sumber data |
|------|-------------|
| **Dummy** (default) | Data contoh tersimpan lokal. Semua perubahan tersimpan otomatis. |
| **Live API** | Daftar profil dari Cloud API Octo (butuh token); start/stop lewat Local API (`localhost:58888`). |

Aktifkan mode Live lewat tombol **Live API** di kanan atas.

### Catatan mode Live

- Aplikasi **Octo Browser harus berjalan** agar Local API (start/stop) aktif.
- Daftar profil diambil dari `https://app.octobrowser.net/api/v2/automation/profiles`
  dengan header `X-Octo-Api-Token`. Token diisi di menu **Pengaturan**.
- Pada versi browser, panggilan langsung ke Cloud API sering diblokir **CORS**
  (aturan keamanan browser yang melarang halaman memanggil server lain). Bila itu terjadi,
  dashboard otomatis kembali ke data dummy dan menampilkan peringatan. Versi desktop
  tidak terkena batasan ini.
- Pembuatan profil baru di akun Octo asli tetap dilakukan lewat aplikasi Octo Browser.

---

## Struktur proyek

```
octo-dashboard/
├── src/                     — aplikasi desktop (v2)
│   ├── main/                — proses utama Electron
│   ├── preload/             — jembatan aman antara aplikasi & tampilan
│   └── renderer/src/        — tampilan React (components, views, lib)
├── index.html, app.js       — versi browser (v1)
├── styles.css               — tema gelap
├── server.js                — server statis untuk versi browser
├── docs/                    — dokumentasi teknis per modul
└── *.bat                    — pintasan menjalankan di Windows
```

## Dokumentasi

| Berkas | Isi |
|---|---|
| [PANDUAN-SUPABASE.md](PANDUAN-SUPABASE.md) | Menyalakan sinkronisasi data lewat Supabase |
| [PANDUAN-ADSPOWER.md](PANDUAN-ADSPOWER.md) | Impor/ekspor data dari AdsPower |
| [PANDUAN-SETUP-REKAN.md](PANDUAN-SETUP-REKAN.md) | Menyiapkan dashboard di komputer rekan kerja |
| [PANDUAN-GITHUB.md](PANDUAN-GITHUB.md) | Cara membuat repo GitHub & mengirim kode |
| [docs/](docs/) | Catatan teknis per modul |

---

## Keamanan

Data akun (email, sandi, profil browser) **tidak pernah ikut terunggah** — folder `data/`,
berkas `.env*`, cadangan, dan sertifikat sudah dikunci di [.gitignore](.gitignore).
Repo ini juga punya pemeriksa otomatis di `.git/hooks/pre-commit` yang membatalkan
penyimpanan bila mendeteksi ada yang mirip kunci rahasia.

Jangan pernah menuliskan token Octo, kunci Supabase, atau sandi langsung di dalam kode —
isi lewat menu **Pengaturan** saat aplikasi berjalan.
