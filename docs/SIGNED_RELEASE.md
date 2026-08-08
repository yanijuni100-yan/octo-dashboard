# Signed Release lintasAI - GPG Verification

Dokumen ini menjelaskan bagaimana rilis lintasAI **bisa** ditandatangani dengan GPG, dan bagaimana owner serta staff memakainya supaya yakin tag yang di-clone benar-benar dari pemilik repo, bukan hasil tampering.

> ⚠️ **STATUS SAAT INI (2026-06-17): penandatanganan tag GPG BELUM aktif.** Penanda versi rilis (mis. `v1.33.0`) saat ini **belum** ditandatangani, dan berkas kunci publik `.github/owner-pubkey.asc` **belum** ada di repo. Jadi dokumen ini = **panduan MENGAKTIFKAN** (rencana), bukan deskripsi keadaan sekarang. Untuk repo resmi `ojokesusu/lintasAI`, keaslian saat ini bersandar pada **HTTPS + proteksi branch GitHub**. (Catatan: alur rilis kini memakai **OIDC Trusted Publishing** — terbit ke npm **tanpa token** yang bisa dicuri. **provenance npm** TETAP **dimatikan** (`publishConfig.provenance: false`) karena npm hanya mendukungnya untuk repo **PUBLIK**, sedangkan repo ini **private**; bisa dinyalakan kalau repo dijadikan publik.) Alat update (`update-kit.ps1`) memang **melewati** cek GPG untuk repo resmi (daftar `TrustedRepos`), jadi tag-belum-ditandatangani TIDAK memblokir update staff. **Untuk benar-benar mengaktifkan tanda tangan**, owner ikuti langkah di bawah (butuh kunci GPG milik owner) lalu hapus catatan STATUS ini.

## Kenapa perlu? (3-layer analogi)

- **Sehari-hari:** kayak tanda tangan + stempel notaris di akta - mustahil dipalsukan tanpa cap & tanda tangan asli. Kalau ada akta tanpa stempel notaris, kita langsung curiga, kan?
- **Tools digital populer:** kayak ikon gembok HTTPS di Tokopedia/BCA mobile - browser cek sertifikat valid, kalau invalid muncul warning merah gede. User awam pun langsung waspada.
- **Konkret di lintasAI:** staff yakin tag `v1.x.y` yang di-clone benar dari owner asli `ojokesusu`, bukan attacker yang compromise akun GitHub. Tanpa signature, siapa pun yang punya akses push ke repo bisa bikin tag palsu yang kelihatan sah.

## Setup GPG (owner - sekali saja)

Ini langkah satu kali di mesin owner. Setelah selesai, semua tag berikutnya tinggal sign pakai key yang sama.

1. Install GPG:
   ```powershell
   scoop install gnupg
   # ATAU
   choco install gnupg
   ```
2. Generate key:
   ```powershell
   gpg --full-generate-key
   ```
   Pilih `RSA and RSA`, ukuran `4096`, expiry `0` (no expiry) untuk simplicity. Isi nama & email yang sama dengan akun GitHub.
3. List & catat KEY_ID:
   ```powershell
   gpg --list-secret-keys --keyid-format LONG
   ```
   Output ada baris `sec rsa4096/ABCD1234EFGH5678 ...` - bagian `ABCD1234EFGH5678` itu KEY_ID-nya.
4. Daftarkan ke git:
   ```powershell
   git config --global user.signingkey ABCD1234EFGH5678
   ```
5. (Opsional) Auto-sign semua commit, bukan cuma tag:
   ```powershell
   git config --global commit.gpgsign true
   ```
6. Export public key:
   ```powershell
   gpg --armor --export ABCD1234EFGH5678 > .github/owner-pubkey.asc
   ```
7. Commit pubkey ke repo:
   ```powershell
   git add .github/owner-pubkey.asc
   git commit -m "add owner gpg pubkey for tag verification"
   ```

## Workflow saat release (owner)

Setiap rilis baru, tag dibuat dengan flag `-s` (signed):

```powershell
git tag -s v1.x.y -m "lintasAI v1.x.y - <ringkasan changes>"
git push origin v1.x.y
```

Catatan:
- `git tag -s` = signed tag (pakai GPG key yang sudah didaftarkan).
- `git tag` tanpa `-s` = unsigned, staff tidak akan bisa verify.
- Kalau owner lupa pakai `-s`, hapus tag (`git tag -d` + `git push --delete`) lalu bikin ulang dengan `-s`.

## Workflow saat staff first-time (sekali saja)

Sekali saja per mesin staff, import pubkey owner supaya GPG tahu key mana yang trusted.

1. Download pubkey dari repo:
   ```powershell
   curl -O https://raw.githubusercontent.com/ojokesusu/lintasAI/main/.github/owner-pubkey.asc
   ```
2. Import ke keychain lokal:
   ```powershell
   gpg --import owner-pubkey.asc
   ```
3. Tandai sebagai trusted:
   ```powershell
   gpg --edit-key ABCD1234EFGH5678
   ```
   Lalu di prompt GPG: ketik `trust`, pilih `4` (I trust fully), ketik `quit`.

## Workflow saat staff clone/update (tiap kali)

Setiap kali pull tag baru, lakukan verify sebelum jalankan kit:

```powershell
git clone -b v1.x.y https://github.com/ojokesusu/lintasAI.git
cd lintasAI
git tag --verify v1.x.y
```

Interpretasi output:
- `Good signature from "Owner Name <email>"` -> aman, lanjut install.
- `BAD signature` -> tag sudah dimodifikasi setelah signing. STOP.
- `No public key` -> pubkey owner belum di-import. Balik ke step first-time dulu.
- `gpg: WARNING: This key is not certified...` -> pubkey ter-import tapi belum di-trust. Balik ke step `trust` di first-time.

Kalau muncul BAD signature atau anomaly lain: **STOP, jangan install**, lapor owner via Telegram/Signal (jalur out-of-band, bukan via GitHub issue karena issue-nya bisa juga dipalsu).

## Integrasi dengan kit.ps1 (opsional)

`update-kit.ps1` bisa auto-verify tag sebelum apply update:

```powershell
git fetch --tags
git tag --verify v1.x.y
if ($LASTEXITCODE -ne 0) {
    throw "Tag signature invalid, aborting update"
}
git checkout v1.x.y
```

Manfaat: staff tidak perlu inget jalankan verify manual, kit sendiri yang enforce.

## Fallback: kalau GPG belum disetup

Belum sempat setup GPG? Bisa pakai alternatif manual sementara:

1. Owner publish SHA256 commit hash tiap tag di `README.md`:
   ```
   v1.0.0 -> commit a1b2c3d4e5f6...
   v1.0.1 -> commit f6e5d4c3b2a1...
   ```
2. Staff verify manual:
   ```powershell
   git rev-parse v1.x.y
   # bandingkan output dengan yang owner publish
   ```
3. Migrate ke GPG begitu sempat - SHA256 manual rentan kalau attacker juga modifikasi README.

## Troubleshooting

- **`gpg: signing failed: Inappropriate ioctl for device`** -> environment GPG tidak detect TTY. Set:
  ```powershell
  $env:GPG_TTY = $(tty)
  ```
  Di Linux/Mac: `export GPG_TTY=$(tty)`. Lalu retry `git tag -s ...`.
- **Windows: gpg-agent macet** -> restart agent:
  ```powershell
  gpgconf --kill gpg-agent
  ```
  Lalu retry. Kalau masih, restart shell/PowerShell.
- **`gpg: skipped "KEY_ID": No secret key`** -> KEY_ID salah ketik atau key belum di-generate. Cek ulang `gpg --list-secret-keys --keyid-format LONG`.
- **Tag sudah dibuat tanpa `-s`** -> hapus & ulang:
  ```powershell
  git tag -d v1.x.y
  git push origin :refs/tags/v1.x.y
  git tag -s v1.x.y -m "..."
  git push origin v1.x.y
  ```

## Threat model singkat

- **ATTACK:** akun GitHub owner di-compromise (password leak, session token curian, dst), attacker push tag `v1.x.y` berisi backdoor.
- **DEFENSE:** tag tidak signed (attacker tidak punya private key GPG owner), atau signed dengan key beda -> `git tag --verify` fail -> staff tidak install.
- **LIMITATION:** kalau attacker juga curi private key GPG owner (misal laptop owner kena RAT) = game over, signature sah dari sisi GPG.
- **HARDENING:** owner pakai hardware key (YubiKey/Nitrokey) - private key tidak pernah keluar dari device, attacker yang remote-compromise laptop tetap tidak bisa sign tanpa colok device fisik + tap.

## Catatan operasional

- Pubkey di `.github/owner-pubkey.asc` aman untuk publik, memang harus bisa diakses semua staff.
- **Private key TIDAK PERNAH** masuk repo, tidak pernah di-share, tidak pernah dibackup ke cloud tanpa enkripsi tambahan.
- Kalau owner curiga private key bocor: revoke segera (`gpg --gen-revoke`), publish revocation certificate, bikin key baru, update `.github/owner-pubkey.asc`, announce ke semua staff via jalur out-of-band.
