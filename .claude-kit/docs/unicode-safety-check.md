# unicode-safety-check.md — Robot pemindai "huruf-tipuan" Unicode

> Versi 1 · 2026-06-19 · pendamping `lib/unicode-safety-check.ps1`

## Tujuan

Mendeteksi **karakter Unicode tak-kasat-mata** yang dipakai untuk menipu AI / menyembunyikan
maksud: blok **Tag** (U+E0000–E007F, instruksi tersembunyi yang dibaca AI tapi tak terlihat
manusia), pembalik arah teks **bidi** ("Trojan Source"), **spasi-lebar-nol**, dll.

🏢 Analogi: "lampu UV otomatis" yang melihat **tinta tak terlihat** di surat. Aturan §8.1 #5
menyuruh AI mengawasi tinta ini lewat penalaran — tapi tintanya **dirancang menipu AI**, jadi
yang benar = robot yang memang bisa melihatnya (selaras §6.3: pola tak-ambigu → robot, bukan AI;
lolos ADR-001 yang mengesahkan robot "ada/tidak-ada murni").

## Cara Pakai

```powershell
# Pindai seluruh repo (default):
pwsh lib/unicode-safety-check.ps1

# Pindai berkas/folder tertentu (mis. konten tak-tepercaya yang baru di-paste):
pwsh lib/unicode-safety-check.ps1 -Path docs/suspicious.md

# Mode paranoid (ikut tandai penyambung ZWJ/ZWNJ/LRM/RLM):
pwsh lib/unicode-safety-check.ps1 -IncludeJoiners
```

Keluar kode = **jumlah temuan** (0 = bersih). Dipakai juga oleh AI saat runtime (§8.1 #5) untuk
memeriksa konten tak-tepercaya sebelum mempercayainya.

## Input / Output

- **Input:** `-RepoRoot` (default = induk folder `lib/`), `-Path` (berkas/folder spesifik),
  `-IncludeJoiners` (switch), `-Quiet` (switch).
- **Output:** objek `{ Findings; Count }`; tiap temuan = `{ File; Line; Col; CodePoint; Hex; Name }`.

## Dependensi

PowerShell 5.1+ (tanpa modul eksternal, tanpa Node). Berdiri sendiri.

## Catatan

- **Anti alarm-palsu (penting):** default TIDAK menandai penyambung sah ZWJ/ZWNJ (U+200C/200D)
  + LRM/RLM — dipakai legal di aksara Arab/India + rangkaian emoji (mis. emoji profesi memakai ZWJ).
  BOM (U+FEFF) di **awal** berkas dianggap sah; hanya ditandai bila muncul di **tengah** berkas.
- **Baca UTF-8 eksplisit (deterministik lintas-versi):** robot membaca berkas dengan
  `Get-Content -Encoding UTF8`. Tanpa ini, Windows PowerShell 5.1 memakai codepage ANSI (default) →
  byte multi-byte UTF-8 yang **sah** salah-ditafsir (mis. `中` = byte `E4 B8 AD` → byte `AD` keliru
  jadi U+00AD "soft hyphen") → **alarm palsu**, dan hasilnya beda antara PS 5.1 vs pwsh7. Dikunci
  tes regresi "baca UTF-8 deterministik (... CJK ...)". Sumber: `lib/unicode-safety-check.ps1:166`.
- **Bukan jaminan mutlak:** menutup vektor karakter-tersembunyi yang **diketahui** secara
  deterministik — bukan klaim "anti-injeksi sempurna". Jujur soal batas (anti rasa-aman-palsu).
- **Penegakan:** tes `tests/unicode-safety-check.Tests.ps1` menjalankan robot atas repo asli →
  WAJIB 0 temuan (gerbang CI). Karakter astral (>U+FFFF) ditangani via pasangan surrogate.
- **Asal:** adopsi selektif pola "unicode-safety" dari ECC (MIT), ditulis-ulang PowerShell +
  bahasa awam. Sumber: `lib/unicode-safety-check.ps1:1`.
