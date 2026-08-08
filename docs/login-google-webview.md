# login-google-webview.md — Kenapa login Google sempat ditolak di dalam aplikasi, dan bagaimana diperbaiki

> Versi 1 · 2026-08-03 · Pendamping `src/main/index.ts` (blok "IDENTITAS BROWSER"),
> `src/renderer/src/lib/util.ts` (`isGoogleBlockedUrl`), `src/renderer/src/components/FrameView.tsx`

---

## Tujuan

Menjelaskan sebab layar penolakan Google **"Couldn't sign you in — This browser or app may not be secure"**
(artinya: *"tidak bisa masuk — browser atau aplikasi ini mungkin tidak aman"*) yang muncul saat login akun
di jendela dalam aplikasi, plus perbaikan yang sudah dipasang dan batasnya.

---

## Sebab (terbukti dari uji, bukan tebakan)

Uji dilakukan 2026-08-03: aplikasi diarahkan ke server uji lokal, lalu **header** (keterangan yang selalu
ikut tiap kali browser meminta halaman — semacam identitas pengirim di amplop surat) yang benar-benar
terkirim dicatat apa adanya.

Hasil **sebelum** perbaikan:

| Yang diperiksa | Nilai sebelum perbaikan | Chrome asli |
|---|---|---|
| `User-Agent` (nama & versi browser) | `Chrome/128.0.6613.186` (rilis Agustus 2024) | `Chrome/150.x` (terpasang di komputer ini) |
| `sec-ch-ua` (kartu identitas browser) | **TIDAK DIKIRIM SAMA SEKALI** | selalu dikirim |
| `sec-ch-ua-mobile` / `sec-ch-ua-platform` | **TIDAK DIKIRIM** | selalu dikirim |

Dua hal yang membuat Google menolak:

1. **Mesin browser di dalam aplikasi ketinggalan ~2 tahun.** Aplikasi memakai Electron 32 yang mesinnya
   Chrome 128; Chrome asli di komputer ini sudah versi 150. Browser terlalu tua ditolak di halaman login.
2. **Mengaku Chrome tapi tidak membawa kartu identitasnya.** Chrome asli SELALU mengirim `sec-ch-ua`.
   Aplikasi ini tidak mengirimnya sama sekali → ketahuan bukan Chrome asli.

Kode lama sudah membuang tulisan "Electron" dari `User-Agent` (`src/main/index.ts`), tapi itu **hanya**
menutup satu jejak — dua sebab di atas tetap terbuka.

---

## Cara Pakai (apa yang berubah untuk pemakai)

1. **Otomatis, tanpa mengatur apa pun** — saat aplikasi dibuka, identitas jendela akun disamakan dengan
   versi Chrome yang benar-benar terpasang di komputer itu.
2. **Panel bantuan login** muncul otomatis kalau Google menolak, atau bisa dibuka kapan saja lewat tombol
   **🔑 Sesi Chrome** di baris tombol atas. Isinya 2 langkah:
   - **🌐 Langkah 1 — Login di Chrome asli** — Chrome asli terbuka dengan folder profil khusus akun itu.
     Login seperti biasa di sana (Google pasti menerima, karena itu browser resmi).
   - **⬇ Langkah 2 — Ambil sesinya ke sini** — sesi hasil login itu dipindahkan ke jendela akun di
     dashboard. **Sesudah ini, klik akun langsung masuk** tanpa halaman login lagi.
   - Ditambah **🔄 Coba lagi di sini** dan **✕ Tutup**.

---

## Jembatan sesi (Langkah 2) — cara kerjanya

Login terjadi di **Chrome asli** (yang pasti diterima Google), lalu "kunci sesi" (cookie — tanda pengenal
yang membuat situs ingat kamu sudah masuk, seperti gelang masuk konser) dipindahkan ke dashboard.

Pengambilannya lewat **pintu kendali resmi milik Chrome sendiri** (DevTools Protocol — pintu yang sama
yang dipakai alat uji otomatis seperti Puppeteer). Jadi bukan membongkar berkas Chrome: aplikasi
**sopan meminta** ke Chrome-nya, dan Chrome yang menyerahkan.

Pengaman yang dipasang:

- Pintu kendali **hanya dibuka saat tombol Langkah 1 ditekan** (`withDebug`), bukan tiap kali Chrome dibuka
  lewat tombol "Buka di Chrome" biasa.
- Nomor pintunya **dipilih acak oleh Chrome** (`--remote-debugging-port=0`) dan hanya bisa dihubungi dari
  komputer itu sendiri (127.0.0.1) — tidak dari internet.
- Cookie yang diambil hanya ditanam ke sesi akun yang bersangkutan (`persist:profile-<uuid>`).

**Penting — kenapa sesi langsung disimpan ke cloud setelah dipindahkan:** saat akun dibuka, aplikasi
memulihkan cookie dari cloud lebih dulu (`restoreSession`). Kalau cloud masih menyimpan sesi LAMA, sesi
baru dari Chrome akan tertimpa dan login hilang lagi. Karena itu `ambilSesiDariChrome()` memanggil
`saveSession()` segera setelah berhasil.

**Kalau Chrome akun itu sudah telanjur terbuka tanpa pintu kendali:** tutup dulu jendela Chrome akun
tersebut, baru tekan Langkah 1 lagi — pesan ini juga muncul otomatis di aplikasi.

---

## Input–Output (untuk yang membaca kode)

- `detectChromeVersion()` — membaca nama folder versi di `.../Google/Chrome/Application`.
  **Keluaran:** versi Chrome terpasang (mis. `150.0.7871.187`), atau `null` kalau Chrome tidak ada.
  Kalau `null` → jatuh ke `process.versions.chrome` (versi mesin bawaan aplikasi, apa adanya).
- `samakanIdentitasBrowser(ses)` — memasang `User-Agent` + header `sec-ch-ua`, `sec-ch-ua-mobile`,
  `sec-ch-ua-platform` ke sebuah sesi. Dipanggil dari `app.on('session-created')` supaya sudah aktif
  **sebelum** halaman pertama dimuat (tidak balapan dengan pemuatan halaman), plus sekali lagi di
  `web-contents-created` sebagai pengaman kedua.
- `isGoogleBlockedUrl(url)` — `true` untuk alamat penolakan Google
  (`accounts.google.com/v3/signin/rejected`, `signin/oauth/deniedsigninrejected`, `disallowed_useragent`).
- `bacaPortDevTools(userDataDir)` — membaca nomor pintu kendali dari baris pertama berkas
  `DevToolsActivePort` di folder profil Chrome akun itu. **Keluaran:** nomor pintu, atau `null`.
- `ambilCookieDariChrome(userDataDir)` — meminta cookie ke Chrome lewat `Storage.getCookies`
  (perintah tingkat-browser). Kalau perintah itu tidak dikenal, dicoba `Network.getAllCookies`
  sebagai cadangan. **Catatan:** `Network.getAllCookies` **tidak ada** di pintu tingkat-browser —
  ini ditemukan saat pengujian, jangan dibalik urutannya.
- `tanamCookieKeSesi(partition, cookies)` — menanam cookie ke sesi akun. **Keluaran:** jumlah yang berhasil.
- IPC `chrome-session-pull` → `{ ok, total, set, error? }`.

---

## Dependensi

- Electron `session.setUserAgent` + `session.webRequest.onBeforeSendHeaders` + event `app.on('session-created')`
  (ketiganya sudah ada di Electron 32 — diverifikasi di `node_modules/electron/electron.d.ts`).
- Google Chrome terpasang di komputer pemakai (untuk mendeteksi nomor versi + tombol "Buka di Chrome").
- Paket **`ws`** (^8.21) — untuk berbicara ke pintu kendali Chrome. Dipilih daripada menulis protokolnya
  sendiri karena paket ini murni JavaScript (tanpa kompilasi), sangat teruji, dan menangani pesan besar
  (daftar cookie bisa ratusan KB). Proses utama Electron 32 belum punya `WebSocket` bawaan — sudah dicek.

---

## Catatan penting

- **Satu pendengar per sesi.** `onBeforeSendHeaders` hanya boleh dipasang sekali per sesi (pemasangan kedua
  menimpa yang pertama), karena itu ada penjaga `sesiSudahDisamakan` (WeakSet).
- **Ini menaikkan peluang, BUKAN jaminan selamanya.** Google memang membatasi login di jendela dalam
  aplikasi, dan aturannya bisa diperketat kapan saja. Jalur yang paling tahan lama tetap
  **login lewat Chrome asli** — sudah tersedia lewat tombol "Buka di Chrome" dan panel penolakan.
- **Masih ada satu ketidakcocokan yang belum tertutup:** `navigator.userAgentData` (identitas yang dibaca
  program di dalam halaman) masih menyebut Chromium versi bawaan Electron (128), bukan 150. Menutupnya
  butuh mematikan pemisahan konteks di jendela akun = **menurunkan keamanan**, jadi sengaja TIDAK dilakukan.
  Cara bersihnya = menaikkan versi Electron (lihat di bawah).
- **Akar masalah yang belum dikerjakan: Electron 32 sudah usang** (terbaru 43.x, mesin Chrome jauh lebih
  baru). Menaikkan versi Electron memperbaiki sebab nomor 1 secara mendasar + membawa tambalan keamanan,
  tapi perlu uji ulang menyeluruh karena menyentuh seluruh aplikasi.

---

## Riwayat

| Tanggal | Perubahan |
|---|---|
| 2026-08-03 | Versi 1 — identitas browser disamakan dengan Chrome terpasang + panel panduan penolakan. |
| 2026-08-03 | Versi 2 — jembatan sesi: login di Chrome asli lalu sesinya dipindahkan ke dashboard. |

---

## Bukti pengujian (2026-08-03)

- **Identitas browser** — aplikasi hasil build diarahkan ke server uji lokal. Terkirim:
  `Chrome/150.0.7871.187` + `sec-ch-ua: "Not;A=Brand";v="24", "Chromium";v="150", "Google Chrome";v="150"`
  + `sec-ch-ua-mobile: ?0` + `sec-ch-ua-platform: "Windows"`. Sebelumnya: Chrome/128 tanpa `sec-ch-ua` sama sekali.
- **Jembatan sesi (ujung ke ujung, tanpa akun Google)** — Chrome asli membuka situs uji lokal yang
  menitipkan 3 cookie termasuk kasus tersulit (`__Host-` dan `SameSite=None; Secure; HttpOnly`).
  Hasil: `{ ok: true, total: 3, set: 3 }`, dan ketiganya terbukti ada di sesi dashboard.
  Dipanggil lewat jalur tampilan asli (`window.electronAPI.pullChromeSession`).
- **BELUM diuji:** reaksi server Google yang sesungguhnya — perlu login dengan akun nyata.
