# mail-reader — Pembaca Verifikasi (IMAP)

> v1 · 2026-08-03

## Tujuan
Baca email verifikasi (Cloudflare, OTP, dll) **di dalam dashboard** tanpa membuka browser Gmail —
sehingga tidak kena blokir Google "This browser or app may not be secure". Memakai kanal resmi
Google: **IMAP + App Password**.

Kenapa perlu: Google memblokir LOGIN di browser-tertanam (webview) aplikasi. Membaca email lewat
IMAP bukan lewat halaman login browser, jadi lolos blokir. Detail riset: lihat keputusan sesi
2026-08-03.

## Cara Pakai (staf)
1. Buka akun → klik tombol **📧 Kode** (di deret tombol atas, sebelah ✉ Gmail).
2. Kali pertama: klik **🔑 Buka halaman App Password** → buat sandi (pilih "Mail") → salin 16 huruf.
   Prasyarat: akun sudah punya **Verifikasi 2 Langkah** aktif (App Password hanya muncul kalau 2FA on).
3. Tempel App Password → **Simpan**. (Disimpan TERENKRIPSI via `safeStorage`, bukan polos.)
4. Klik **🔄 Ambil email verifikasi** → 20 email terbaru tampil; kode bisa diklik-salin, link
   verifikasi bisa dibuka di browser default.

**App Password TIDAK minta OTP** saat dipakai — itu keunggulan utamanya.

## Input–Output
- **Renderer → main (IPC):**
  - `mail-cred-set(uuid, appPassword)` → `{ok, error?}` (simpan terenkripsi; spasi dibuang)
  - `mail-cred-has(uuid)` → `{ok, has}`
  - `mail-cred-clear(uuid)` → `{ok}`
  - `mail-fetch-verification({uuid, email})` → `{ok, emails?: VerificationEmail[], error?}`
  - `open-external(url)` → buka link di browser default (`shell.openExternal`)
- **VerificationEmail:** `{ from, subject, date, codes[], links[], snippet }` (lihat `preload/index.d.ts`).
- Ekstraksi: `codes` = angka 4–8 digit; `links` = URL yang mengandung verif/confirm/activate/validate.

## Dependensi
- `imapflow` (klien IMAP), `mailparser` + `@types/mailparser` (pengurai email).
- `safeStorage` (enkripsi kredensial, DPAPI di Windows), `shell.openExternal`.
- Kredensial disimpan di `<dataDir>/mail-creds.json` (base64 hasil enkripsi) — folder `data/` sudah `.gitignore`.
- Kode: `src/main/index.ts` (handler IMAP + kredensial), `src/renderer/src/components/MailReader.tsx` (panel),
  dipanggil dari `src/renderer/src/components/FrameView.tsx` (tombol 📧 Kode).

## Catatan / edge case
- Belum diuji runtime dengan App Password asli (perlu uji staf) — build/typecheck lulus.
- Butuh 2FA aktif per akun; akun Advanced Protection tidak menyediakan App Password.
- 100 akun konek dari 1 IP bisa memicu peringatan Google → pertimbangkan proxy per akun (belum diwire ke IMAP).
- Hanya BACA (tidak kirim/hapus). Link verifikasi (mis. Cloudflare) dibuka di browser default sistem.
- Proof-of-concept: ambil 20 email terbaru INBOX; belum ada auto-refresh / filter pengirim.
