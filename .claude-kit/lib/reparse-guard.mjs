#!/usr/bin/env node
// lib/reparse-guard.mjs - Penjaga reparse-point (junction/symlink) BERSAMA untuk uninstall + rollback.
//
// WHY (DRY + keamanan): fungsi ini dulu DISALIN byte-identik (beda HANYA prefix berkas-sementara) di
// uninstall.mjs + lib/rollback.mjs (~35 baris kode keamanan; rollback berkomentar "CERMIN uninstall").
// Disatukan ke 1 sumber (audit fungsi-kembar 2026-06-25) supaya kalau LOGIKA keamanannya perlu berubah,
// cukup 1 tempat -> tak ada salinan yang ketinggalan. uninstall.mjs + rollback.mjs kini MENG-IMPOR +
// me-RE-EXPORT dari sini (tanda tangan + perilaku TIDAK berubah). Prefix nama berkas-sementara disatukan
// jadi 'lintas-reparse' (dulu rollback pakai 'lintas-rb-reparse') - berkas sementara ini ephemeral
// (dibuat -> dibaca -> dihapus di finally) + process.pid sudah unik per-proses, jadi BUKAN perilaku.
//
// MIGRASI PS->Node 2026-06-25 (owner-gated): JALUR UTAMA kini NODE MURNI - deteksi reparse-point
// (symlink/junction) pakai fs.lstatSync().isSymbolicLink() + ancestor-walk (cek target + tiap folder
// induk sampai projectRoot), cermin Test-PathHasReparsePoint di lib/safety.ps1. CADANGAN PowerShell
// (safety.ps1) TETAP ada + dipakai HANYA kalau jalur Node gagal fatal tak terduga (owner pilih
// "Node dulu, PowerShell cadangan"). -ExecutionPolicy Bypass WAJIB di jalur PS cadangan itu (dijaga
// tes "shim WAJIB pakai Bypass" di tests/uninstall.test.mjs + tests/rollback.test.mjs yang membaca
// SUMBER berkas INI). Fail-secure DUA-LAPIS: per-path error (lstat gagal) -> tandai true (anggap
// berbahaya); jalur Node fatal -> fallback PS; PS gagal -> LEMPAR (pemanggil membatalkan; lebih baik
// tak menghapus daripada salah ikut junction yang menunjuk ke luar root).
// CATATAN PARITAS JUJUR: lstat menangkap symlink + junction (vektor serangan "junction ke luar root").
// Jenis reparse SANGAT langka (mis. placeholder cloud OneDrive) yang PS tandai lewat attribute-bit bisa
// TIDAK ditandai Node - itu BUKAN vektor "junction ke luar root", jadi keamanan anti-serangan tetap.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { resolvePowerShellExe } from './popup-shim.mjs'

let _reparseTmpCounter = 0

// --- Jalur utama: NODE MURNI ---
// Untuk 1 path: apakah ia ATAU salah satu folder induknya (sampai projectRoot) = reparse-point
// (symlink/junction)? Cermin struktur ancestor-walk Test-PathHasReparsePoint (safety.ps1):
//   - path ADA + symlink/junction -> true; lalu walk dari folder-nya (folder: dirinya; file: induknya).
//   - path TIDAK ADA -> walk dari folder induk (induk bisa reparse-point).
//   - lstat gagal di mana pun -> true (defensive, cermin `catch { return $true }` PS).
//   - berhenti naik saat mencapai root drive ATAU saat keluar projectRoot (cermin Length -lt rootClean.Length).
function pathHasReparseNode(fullPath, rootCanonical) {
  const rootClean = String(rootCanonical || '').replace(/[\\/]+$/, '')
  const abs = path.resolve(String(fullPath))
  let current
  if (fs.existsSync(abs)) {
    let st
    try { st = fs.lstatSync(abs) } catch { return true }
    if (st.isSymbolicLink()) return true
    current = st.isDirectory() ? abs : path.dirname(abs)
  } else {
    current = path.dirname(abs)
  }
  while (current) {
    const driveRoot = path.parse(current).root
    if (current === driveRoot) break // mencapai root drive (cermin current.FullName -eq Root.FullName)
    let st
    try { st = fs.lstatSync(current) } catch { return true }
    if (st.isSymbolicLink()) return true
    const parent = path.dirname(current)
    if (!parent || parent === current) break
    // Berhenti kalau parent lebih pendek dari projectRoot (keluar root) - cermin Length -lt rootClean.Length.
    if (parent.length < rootClean.length) break
    current = parent
  }
  return false
}

// Jalur utama Node: petakan tiap path -> reparse? tanpa spawn PowerShell.
// EXPORT supaya alat banding (lib/parity-check.mjs) bisa membandingkan hasil Node vs PowerShell.
export function testReparseNode(paths, projectRoot) {
  const result = new Map()
  for (const p of paths) result.set(p, pathHasReparseNode(p, projectRoot))
  return result
}

// --- Cadangan: PowerShell (safety.ps1) ---
// Dipakai HANYA saat jalur Node gagal fatal (owner: "Node dulu, PowerShell cadangan"). Memanggil
// Test-PathHasReparsePoint di <kitDir>/lib/safety.ps1 (logika attribute-bit penuh). Daftar path
// dilewatkan via berkas sementara (hindari neraka tanda-kutip + batas panjang perintah).
// EXPORT supaya alat banding (lib/parity-check.mjs) bisa membandingkan hasil PowerShell vs Node.
export function testReparsePowerShell(paths, projectRoot, kitDir) {
  const result = new Map()
  const psExe = resolvePowerShellExe()
  const safetyPs = path.join(kitDir, 'lib', 'safety.ps1')
  if (!fs.existsSync(safetyPs)) {
    throw new Error(`Tidak bisa cek junction/symlink: lib/safety.ps1 tak ditemukan di ${kitDir}. Batal demi keamanan.`)
  }
  const tmpFile = path.join(os.tmpdir(), `lintas-reparse-${process.pid}-${++_reparseTmpCounter}.txt`)
  fs.writeFileSync(tmpFile, paths.join('\n'), 'utf8')
  try {
    const sp = safetyPs.replace(/'/g, "''")
    const root = String(projectRoot).replace(/'/g, "''")
    const tf = tmpFile.replace(/'/g, "''")
    // Dot-source safety.ps1, set akar canonical, lalu untuk tiap baris cetak '1' (reparse) / '0' (aman).
    const cmd =
      `. '${sp}'; Initialize-SafeProjectPath -ProjectRoot '${root}'; ` +
      `foreach ($line in [System.IO.File]::ReadAllLines('${tf}')) { ` +
      `if (Test-PathHasReparsePoint -FullPath $line) { Write-Output '1' } else { Write-Output '0' } }`
    // -ExecutionPolicy Bypass = WAJIB (cermin shim MOTW + update-kit.mjs). Tanpa ini, di mesin
    // ber-kebijakan 'Restricted'/'AllSigned' dot-source safety.ps1 DITOLAK -> PowerShell keluar !=0
    // -> kita LEMPAR (fail-secure). Bypass bikin pengecek bisa DIMUAT; LOGIKA keamanan tak berubah.
    const r = spawnSync(psExe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { encoding: 'utf8', timeout: 120000 })
    if (r.error) throw new Error(`gagal jalankan PowerShell: ${r.error.message}`)
    if (r.status !== 0) throw new Error(`PowerShell keluar dengan kode ${r.status}. stderr: ${(r.stderr || '').trim().slice(0, 200)}`)
    const out = String(r.stdout || '').split(/\r\n|\r|\n/).map((s) => s.trim()).filter((s) => s === '0' || s === '1')
    if (out.length !== paths.length) {
      throw new Error(`hasil cek junction tak lengkap (${out.length} dari ${paths.length}). Batal demi keamanan.`)
    }
    for (let i = 0; i < paths.length; i++) result.set(paths[i], out[i] === '1')
    return result
  } finally {
    try { fs.rmSync(tmpFile, { force: true }) } catch { /* best-effort */ }
  }
}

// testPathsHaveReparsePoint: untuk tiap path absolut, apakah ia junction/symlink (reparse-point)?
// Return Map<absPath, boolean>. Input kosong -> Map kosong (tanpa spawn). JALUR UTAMA = Node murni
// (tak panggil PowerShell); kalau jalur Node gagal fatal tak terduga -> CADANGAN PowerShell (safety.ps1).
export function testPathsHaveReparsePoint(absPaths, projectRoot, kitDir) {
  const result = new Map()
  const paths = (absPaths || []).filter((p) => p != null && String(p).trim() !== '')
  if (paths.length === 0) return result

  try {
    return testReparseNode(paths, projectRoot)
  } catch (eNode) {
    // Jalur Node gagal fatal tak terduga -> cadangan PowerShell (lebih teliti attribute-bit).
    // Kalau PS juga gagal, biarkan error PS naik (fail-secure: pemanggil membatalkan).
    return testReparsePowerShell(paths, projectRoot, kitDir)
  }
}
