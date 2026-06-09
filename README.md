# Octo Browser Dashboard

Dashboard untuk mengelola profil anti-deteksi Octo Browser. Berjalan sepenuhnya
di browser tanpa instalasi — cukup buka `index.html`.

## Menjalankan

Klik dua kali `index.html`, atau jalankan server lokal supaya mode Live API
berfungsi tanpa kendala:

```powershell
cd C:\Users\owner\octo-dashboard
python -m http.server 8080
# lalu buka http://localhost:8080
```

## Fitur

- **Ringkasan** — total profil, profil aktif, proxy unik, jumlah tag, grafik
  distribusi OS, dan aktivitas terbaru.
- **Profil** — daftar profil dengan pencarian, filter tag & status, start/stop,
  edit, hapus, dan aksi massal (pilih banyak lalu start/stop/hapus).
- **Proxy** — daftar proxy dan berapa profil yang memakainya.
- **Otomatisasi** — start sejumlah profil sekaligus (opsional difilter tag),
  stop semua, lengkap dengan log.
- **Pengaturan** — atur Local API URL & token, tes koneksi, reset data dummy.

## Mode data

| Mode | Sumber data |
|------|-------------|
| **Dummy** (default) | Data contoh tersimpan di `localStorage` browser. Semua perubahan tersimpan otomatis. |
| **Live API** | Daftar profil dari Cloud API Octo (butuh token); start/stop lewat Local API (`localhost:58888`). |

Aktifkan mode Live lewat tombol **Live API** di kanan atas.

## Catatan mode Live

- Aplikasi **Octo Browser harus berjalan** agar Local API (start/stop) aktif.
- Daftar profil diambil dari `https://app.octobrowser.net/api/v2/automation/profiles`
  dengan header `X-Octo-Api-Token`. Token diisi di menu **Pengaturan**.
- Panggilan langsung ke Cloud API dari browser sering diblokir **CORS**. Bila
  itu terjadi, dashboard otomatis kembali ke data dummy dan menampilkan
  peringatan. Untuk produksi, tambahkan backend kecil sebagai proxy API.
- Pembuatan profil baru di akun Octo asli tetap dilakukan lewat aplikasi Octo
  Browser; tombol "Profil Baru" di dashboard menyimpan ke data dummy.

## Struktur file

```
octo-dashboard/
├── index.html   — markup & layout
├── styles.css   — tema gelap
├── app.js       — logika, lapisan API, render
└── README.md
```
