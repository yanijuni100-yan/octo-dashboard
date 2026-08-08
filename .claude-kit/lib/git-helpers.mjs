#!/usr/bin/env node
// lib/git-helpers.mjs - Helper bersih-bersih metadata git (versi Node). Padanan SEBAGIAN lib/git-helpers.ps1.
//
// DI-PORT (logika murni & lintas-OS, perilaku identik dgn PS):
//   - removeGitMetadata : hapus folder .git/ DI DALAM sebuah path. Penting saat kit di-CLONE
//                         (bukan zip-extract) -> .git/ kit-dev ikut ke project user (bloat +
//                         bocorkan riwayat internal + bikin user salah `git log`). Idempoten:
//                         no-op kalau .git/ tak ada. Best-effort: gagal hapus -> return false
//                         (TIDAK lempar), persis Remove-GitMetadata di PS. Cermin -Force PS:
//                         file read-only (mis. packed object git) tetap terhapus (lihat retry).
//
// NODE MURNI (migrasi PS->Node 2026-06-25): removeMotwBlock - buka-blokir Mark-of-the-Web.
//   "Mark-of-the-Web" (MOTW) = penanda "berkas ini dari internet" yang Windows tempel sebagai
//   NTFS Alternate Data Stream `Zone.Identifier`. DULU shim ke `Unblock-File` PowerShell; KINI
//   dilakukan Node murni: hapus stream `<file>:Zone.Identifier` lewat fs.rmSync (Node di Windows
//   bisa membuka/menghapus ADS via path `path:streamname` - terbukti uji empiris Node v24). Hasil
//   IDENTIK dengan Unblock-File rekursif: file tanpa MOTW di-skip diam-diam (cermin -ErrorAction
//   SilentlyContinue), gagal fatal tak terduga -> false (tak lempar), cermin Remove-MotwBlock PS.
//   Cadangan PowerShell: Remove-MotwBlock di lib/git-helpers.ps1 TETAP ada (jalur PS_FALLBACK).
//   (Di jalur npm-only, berkas tak ber-MOTW jadi ini umumnya no-op.)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Bersihkan atribut read-only (recursive) supaya bisa dihapus. Cermin `Remove-Item -Force` PS
// yang menghapus berkas read-only. fs.rmSync({force}) Node 18+ sudah meng-chmod saat EPERM,
// tapi ini pengaman tambahan supaya kebal lintas-versi Node untuk berkas .git read-only.
function clearReadOnlyRecursive(target) {
  let stat
  try { stat = fs.lstatSync(target) } catch { return }
  try { fs.chmodSync(target, 0o666) } catch { /* best-effort */ }
  if (stat.isDirectory()) {
    let entries = []
    try { entries = fs.readdirSync(target) } catch { return }
    for (const name of entries) clearReadOnlyRecursive(path.join(target, name))
  }
}

// Hapus folder .git/ di dalam targetPath. Idempoten (skip kalau tak ada). Best-effort (tak lempar).
// Return: true kalau sukses ATAU .git/ tak ada (no-op success); false kalau gagal hapus.
// opts.verbose=true -> cetak langkah (cermin -Verbose PS; senyap secara default).
export function removeGitMetadata(targetPath, opts = {}) {
  const verbose = opts.verbose === true
  const say = (msg) => { if (verbose) console.error(msg) }

  if (targetPath == null || String(targetPath).trim() === '') {
    say('removeGitMetadata: path kosong, dilewati.')
    return true
  }
  if (!fs.existsSync(targetPath)) {
    say(`removeGitMetadata: path tidak ada, dilewati: ${targetPath}`)
    return true
  }

  const gitDir = path.join(String(targetPath), '.git')
  if (!fs.existsSync(gitDir)) {
    say(`removeGitMetadata: .git/ tidak ada di ${targetPath}, no-op.`)
    return true
  }

  try {
    fs.rmSync(gitDir, { recursive: true, force: true, maxRetries: 2 })
    say(`removeGitMetadata: .git/ dihapus dari ${targetPath}`)
    return true
  } catch (e1) {
    // Coba lagi setelah bersihkan atribut read-only (mirror -Force PS untuk packed object git).
    try {
      clearReadOnlyRecursive(gitDir)
      fs.rmSync(gitDir, { recursive: true, force: true, maxRetries: 2 })
      say(`removeGitMetadata: .git/ dihapus (setelah bersihkan read-only) dari ${targetPath}`)
      return true
    } catch (e2) {
      console.warn(`PERINGATAN removeGitMetadata: gagal hapus ${gitDir}: ${e2.message}`)
      console.warn(`  Perbaiki manual: hapus folder '${gitDir}' lewat File Explorer atau perintah hapus.`)
      return false
    }
  }
}

// Buka-blokir MOTW (Zone.Identifier ADS) untuk semua FILE di targetPath (rekursif). NODE MURNI:
// hapus stream `<file>:Zone.Identifier` via fs.rmSync({force}) - force:true berarti file TANPA MOTW
// (ENOENT pada stream) diabaikan tanpa lempar = idempoten (cermin Unblock-File no-op). Gagal per-file
// (mis. EBUSY/EPERM) = senyap (cermin -ErrorAction SilentlyContinue PS) -> TIDAK mengubah hasil.
// Return true kalau enumerasi sukses (walau ada file individual gagal); false HANYA kalau ada error
// fatal tak terduga di enumerasi (cermin catch Remove-MotwBlock PS). Idempoten: path kosong/tak ada
// -> true. opts.kitDir/opts.timeout DITERIMA tapi diabaikan (kompatibilitas pemanggil shim lama).
export function removeMotwBlock(targetPath, opts = {}) {
  const verbose = opts.verbose === true
  const say = (msg) => { if (verbose) console.error(msg) }

  if (targetPath == null || String(targetPath).trim() === '') { say('removeMotwBlock: path kosong, dilewati.'); return true }
  if (!fs.existsSync(targetPath)) { say(`removeMotwBlock: path tidak ada, dilewati: ${targetPath}`); return true }

  // Hapus 1 stream Zone.Identifier (best-effort, senyap). force:true -> ENOENT (file tanpa MOTW)
  // diabaikan tanpa lempar; error lain per-file ditelan (cermin -ErrorAction SilentlyContinue PS).
  const unblockOne = (file) => {
    try { fs.rmSync(`${file}:Zone.Identifier`, { force: true }) } catch (e) {
      say(`removeMotwBlock: lewati (gagal hapus MOTW) ${file}: ${e.message}`)
    }
  }
  // Walk rekursif: unblock tiap FILE biasa. Junction/symlink di-skip (tidak diikuti) demi keamanan
  // - selaras default Get-ChildItem -Recurse Windows PowerShell 5.1 yang tak menelusuri reparse-point.
  const walk = (dir) => {
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch (e) { say(`removeMotwBlock: gagal baca folder ${dir}: ${e.message}`); return }
    for (const ent of entries) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) walk(full)
      else if (ent.isFile()) unblockOne(full)
    }
  }

  try {
    const st = fs.statSync(targetPath)
    if (st.isDirectory()) walk(targetPath)
    else if (st.isFile()) unblockOne(String(targetPath))
    say(`removeMotwBlock: MOTW di-unblock untuk semua berkas di ${targetPath}`)
    return true
  } catch (e) {
    console.warn(`PERINGATAN removeMotwBlock: gagal buka-blokir MOTW di ${targetPath}: ${e.message}`)
    console.warn('  Script tetap bisa lanjut (mungkin perlu Unblock-File manual).')
    return false
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  // CLI tipis untuk uji-banding: `node lib/git-helpers.mjs remove-git-metadata|remove-motw <path>`.
  const [cmd, target] = process.argv.slice(2)
  if (cmd === 'remove-git-metadata' && target != null) {
    console.log(removeGitMetadata(target) ? 'OK' : 'FAIL')
  } else if (cmd === 'remove-motw' && target != null) {
    console.log(removeMotwBlock(target) ? 'OK' : 'FAIL')
  } else {
    console.error('Pakai: node lib/git-helpers.mjs remove-git-metadata|remove-motw <path>')
    process.exit(2)
  }
}
