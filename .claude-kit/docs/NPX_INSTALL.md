# Panduan Install lintasAI Kit (lewat npm)

## Untuk Siapa

Panduan ini ditujukan untuk **staff IT non-programmer** yang mau memasang lintasAI Kit ke project pakai **npm** (lebih cepat dari `git clone`, tidak perlu paham git, dan otomatis dapat versi terbaru).

> **Satu cara saja:** kit ini distandarkan ke **satu** perintah pasang — `npm create lintasai`. Tidak perlu memilih antara `npm` atau `npx` lagi. Setelah terpasang, semua hal lain (cek, update, balikin versi) cukup **minta ke AI di chat** atau jalankan lewat `.\.claude-kit\kit.ps1`.

Kalau kamu sudah familiar dengan terminal & PowerShell, cukup 1 perintah, kit langsung terpasang di folder project.

---

## Cara Install

### Cara utama (disarankan): biar AI yang jalankan di chat

1. Buka **Claude Code chat** di folder project kamu.
2. Ketik/paste 1 baris ini ke chat:
   ```
   npm create lintasai
   ```
3. Biarkan **AI yang menjalankan**. Pemasang versi Node berjalan **otomatis penuh** (tanpa popup jendela Windows) — kamu **langsung** masuk ke popup pemandu di dalam chat (Fase B).

Setelah selesai, folder `.claude-kit/` + `AGENTS.md` otomatis dibuat di project root, dan AI lanjut memandu langkah demi langkah di chat.

> 💡 **Kalau AI menanyakan izin** untuk menjalankan `npm create lintasai` (muncul kotak pilihan mirip *"Cara jalan"* / *"diblokir auto-mode"* — Claude Code memang ekstra hati-hati dengan perintah `npm`; ini **NORMAL**, **bukan** error lintasAI): pilih **"Izinkan di repo ini"**. Dengan begitu AI memasang di project-mu lalu **langsung lanjut memandu** (Fase B). Hindari opsi *"jalankan sendiri di terminal"* kalau ingin AI tetap auto-lanjut memandu di chat.

### Cara manual (lewat PowerShell sendiri)

Kalau kamu memang mau jalankan sendiri di terminal:

1. Buka **PowerShell** (bukan CMD).
2. Pindah ke folder project tempat kit mau dipasang:
   ```powershell
   cd D:\projek\nama-project
   ```
3. Jalankan perintah install:
   ```powershell
   npm create lintasai
   ```
4. Tunggu sampai install selesai. Biasanya 30 detik - 2 menit tergantung koneksi.

> **Catatan:** sejak pemasang versi Node, pemasangan **otomatis penuh** — **tidak ada popup jendela Windows** yang perlu diklik, baik dijalankan AI di chat maupun kamu sendiri di terminal. Pilihan (AGENTS.md, email, buka VS Code) **diatur lewat AI di chat** sesudah pemasangan. Jadi kalau jalankan sendiri di terminal, **jangan menunggu kotak Windows muncul** — langsung lanjut ke pemandu di chat.

> **Catatan:** `npm create lintasai` selalu memasang versi lintasAI **terbaru** (tidak perlu menyebut nomor versi). Di belakang layar npm mengurus pengunduhan; kamu cukup mengetik 1 baris di atas.

---

## Mode Pemasangan (Claude Code-First UX)

Sejak **pemasang versi Node**, pemasangan **otomatis penuh** — **tidak ada popup jendela Windows** yang perlu diklik, **siapa pun** yang menjalankan (`npm create lintasai` lewat AI di chat **maupun** kamu sendiri di terminal). Semua "pertanyaan" saat pasang dijawab otomatis pakai **nilai paling aman**; pilihan sebenarnya (cara pasang, audit, ukuran tim, AGENTS.md, buka VS Code) kamu lakukan lewat **popup yang DIKLIK DI CHAT** (Fase B) sesudah pemasangan.

### Yang terjadi saat pasang (sama untuk semua orang)

1. Jalankan `npm create lintasai` (lewat AI di chat **atau** di terminal sendiri).
2. Pemasang berjalan otomatis: folder `.claude-kit/` + `AGENTS.md` dibuat di project root, catatan-pasang ditulis, daftar izin & file tim disiapkan — **tanpa kotak Windows, tanpa menggantung**.
3. Kamu **langsung** masuk ke popup pemandu **DI DALAM chat** (Fase B): #1 cara pasang → #2 audit menyeluruh (kalau project sudah ada kodenya) → #3 ukuran tim + bentuk kode (tetap 1 tempat & rapikan / pecah 3 repo / microservice shared-DB) → catatan kode 2-versi di akhir. Ini popup yang **diklik di chat**, bukan jendela Windows.
4. Untuk staff baru, AI lanjut ke pemanduan 6-tahap (onboarding).

Yang kamu lakukan: **1x ketik chat + beberapa klik popup di chat**. Tidak ada jendela Windows yang perlu diklik.

> **Catatan jalur lama:** versi kit lebih lama memakai pemasang **PowerShell** yang memunculkan beberapa popup jendela Windows saat dijalankan manual. Sejak pemasang **Node**, popup jendela itu **dihilangkan** (diganti pemanduan di chat). Pemasang PowerShell lama **tetap disertakan** sebagai cadangan (lihat Troubleshooting "Pemasang versi Node gagal").

### Headless / Server Core / SSH / otomatis (AI/CI)

Tidak perlu flag khusus: saat sesi **tidak punya layar/keyboard** (headless) **atau dijalankan otomatis oleh AI/CI**, installer **auto-deteksi** lalu beralih ke mode console dengan nilai default aman. Jadi `npm create lintasai` yang sama tetap jalan di server tanpa layar maupun saat AI yang menjalankan.

---

## Verify Install Berhasil

Cek status kit (jalankan **di dalam folder project**):
```powershell
.\.claude-kit\kit.ps1 status
```

Output yang **benar** harus menampilkan:
- `Kit version: v1.x.x`
- `AGENTS.md present: yes`
- `Manifest signed: yes`
- `Files: <jumlah> / <jumlah> OK`

Kalau ada `MISSING` atau `MODIFIED` di output, lihat section Troubleshooting di bawah.

> Cara paling gampang buat staff non-programmer: **tanya AI** — "tolong cek kesehatan kit" — AI yang jalankan + jelaskan hasilnya.

---

## Troubleshooting

### Error: "node tidak ditemukan" / "'npm' is not recognized"

**Penyebab**: Node.js belum terinstall di PC (npm datang sepaket dengan Node.js).

**Fix**:
1. Download Node.js LTS dari https://nodejs.org/ (versi LTS, BUKAN Current).
2. Install dengan opsi default. Pastikan checkbox `Add to PATH` aktif.
3. Tutup & buka ulang PowerShell.
4. Cek versi: `node --version` (harus muncul `v20.x.x` atau lebih baru).
5. Ulangi perintah `npm create lintasai`.

### Error: "EACCES" atau "EPERM" di Windows

**Penyebab**: Permission ditolak. Biasanya karena Node.js terinstall di `Program Files` (perlu admin), atau folder project read-only.

**Fix (pilih salah satu)**:
- **Opsi A (cepat)**: Klik kanan PowerShell -> `Run as Administrator`, lalu ulangi perintah install.
- **Opsi B (rekomendasi)**: Uninstall Node.js dari Program Files, install ulang di user folder (`C:\Users\<username>\nodejs\`). Ini menghindari masalah permission permanen.
- **Opsi C**: Pastikan folder project tidak read-only. Klik kanan folder -> Properties -> uncheck `Read-only`.

### Error: "ExecutionPolicy" PowerShell block

**Penyebab**: Windows default block menjalankan script PowerShell yang tidak signed.

**Fix**:
1. Buka PowerShell sebagai user biasa (tidak perlu admin).
2. Jalankan:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```
3. Pilih `Y` saat ditanya konfirmasi.
4. Ulangi perintah install.

Catatan: `RemoteSigned` aman - hanya allow local script + script remote yang ber-signature. Tidak membuka full security risk.

### Error: Behind corporate proxy / firewall

**Penyebab**: Kantor pakai proxy yang block koneksi npm registry langsung.

**Fix**:
1. Tanya admin IT kantor untuk URL proxy (biasanya `http://proxy.company.local:8080`).
2. Set npm config:
   ```powershell
   npm config set proxy http://proxy.company.local:8080
   npm config set https-proxy http://proxy.company.local:8080
   ```
3. Kalau proxy butuh auth, format jadi: `http://username:password@proxy.company.local:8080`.
4. Ulangi perintah install.

Kalau masih gagal, coba registry mirror: `npm config set registry https://registry.npmmirror.com/`.

### Error: "Kit tidak lengkap" / "File hilang"

**Penyebab**: Download terputus di tengah jalan, atau cache npm corrupt.

**Fix**:
1. Clear cache npm:
   ```powershell
   npm cache clean --force
   ```
2. Hapus folder `.claude-kit/` yang sudah ada (kalau sebagian terinstall):
   ```powershell
   Remove-Item -Recurse -Force .\.claude-kit\
   ```
3. Retry:
   ```powershell
   npm create lintasai
   ```

### Pemasang versi Node gagal / crash saat `npm create lintasai`

**Penyebab**: pemasang versi **Node** (jalur baku sejak `init` pindah ke Node) bermasalah di mesin tertentu (jarang).

**Jalan cadangan (pemasang PowerShell)**: pemasang versi PowerShell tetap disertakan di kit. Kalau folder `.claude-kit\` sudah terbentuk, jalankan dari **dalam project**:
```powershell
powershell -ExecutionPolicy Bypass -File .\.claude-kit\setup-pola-b.ps1
```
Atau cukup minta AI di chat: *"pasang manual pakai setup-pola-b.ps1"* — AI yang jalankan + jelaskan hasilnya. (Kalau `.claude-kit\` belum terbentuk sama sekali, ulangi dulu `npm create lintasai`.)

### Error: "Root proyek" salah deteksi (npm cache path)

**Penyebab**: Bug di versi kit **lama** - kit salah deteksi root project ke folder npm cache, bukan ke folder project user.

**Tanda**: Folder `.claude-kit/` muncul di `C:\Users\<username>\AppData\Roaming\npm-cache\...` bukan di project folder.

**Fix**:
1. Hapus install yang salah (dari dalam project):
   ```powershell
   .\.claude-kit\kit.ps1 uninstall
   ```
2. Pasang ulang versi terbaru:
   ```powershell
   npm create lintasai
   ```
3. Versi terbaru sudah fix deteksi root via `process.cwd()` (folder PowerShell aktif).

---

## Balikin ke Versi Sebelumnya (Rollback)

Kalau update terbaru bermasalah, paling mudah **minta AI**: "rollback dong" (AI yang jalankan + pilihkan cara yang benar).

Manual, dari dalam project:
```powershell
.\.claude-kit\kit.ps1 rollback
```

> Catatan: untuk balik **seluruh folder kit** ke versi sebelum update (mis. update baru bikin kit rusak), AI akan mengembalikan folder cadangan `.claude-kit.backup-<tanggal>` yang dibuat otomatis saat update. Tinggal bilang "rollback dong".

---

## Uninstall

Hapus kit dari project secara aman (sambil keep file user-custom), jalankan dari dalam project:

```powershell
.\.claude-kit\kit.ps1 uninstall
```

Perintah ini akan:
- Hapus folder `.claude-kit/`.
- Hapus `AGENTS.md` (kalau belum dimodifikasi user).
- **TIDAK** hapus `docs/`, `src/`, atau file project user lain.

Kalau `AGENTS.md` sudah dimodifikasi, kit akan tanya konfirmasi sebelum hapus.

---

## Cara Update Kit

Cara termudah untuk staff non-programmer: **minta AI di chat** — "tolong update kit" — AI yang cek versi, jelaskan apa yang berubah pakai analogi, minta izin sekali, lalu jalankan.

Manual, dari dalam project:
```powershell
.\.claude-kit\kit.ps1 update
```

Perintah ini akan:
1. Buat cadangan dari versi current.
2. Download versi terbaru.
3. Pertahankan file yang dimodifikasi user (kalau ada).
4. Update manifest signature.

---

## Cara Cek Apakah Kit Saya Up-to-date

Cek status + versi (dari dalam project):
```powershell
.\.claude-kit\kit.ps1 status
```

Lihat file yang berubah dari versi original:
```powershell
.\.claude-kit\kit.ps1 diff
```

Output `diff` akan tampilkan:
- File yang **MODIFIED** (diubah user setelah install).
- File yang **MISSING** (terhapus).
- File yang **ADDED** (file baru di luar manifest).

Untuk lihat versi terbaru yang tersedia:
```powershell
npm view lintasai version
```

Bandingkan dengan `Kit version` di output `status`. Kalau beda, minta AI "tolong update kit" (atau jalankan `update` manual di atas).

---

## Kontak Support

- **Discord channel**: `#lintasai-support` (link invite di internal docs tim).
- **Owner**: testing@gmail.com - gunakan Signal/Telegram untuk hal sensitif (kredensial, API key bocor, security incident).
- **Bug report**: buka issue di GitHub repo `lintasai` (link di npm page).

Untuk error yang **tidak** ada di troubleshooting di atas:
1. Jalankan `.\.claude-kit\kit.ps1 status` (output status kit).
2. Screenshot output + share di Discord channel.
3. Jangan paste output yang berisi password / API key - mask dulu.
