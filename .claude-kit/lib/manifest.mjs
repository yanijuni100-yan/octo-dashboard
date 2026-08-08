#!/usr/bin/env node
// lib/manifest.mjs - Pembuat "daftar resmi berkas terpasang" (.install-manifest.json), versi Node.
//
// Padanan lib/manifest.ps1. Dipakai uninstall/rollback untuk hapus-aman (deteksi berkas masih asli
// via sidik-jari SHA-256). GANDENG dgn lib/manifest-signing.mjs (segel anti-utak-atik).
//
// CATATAN byte-identik: SIDIK-JARI (SHA-256) WAJIB byte-identik dgn PowerShell Get-FileHash
// (hex HURUF-BESAR). Tanda-tangan/segel pakai canonical baku (urut-abjad) dari manifest-signing.mjs,
// jadi format JSON tersimpan (rapi/pretty) TIDAK perlu sama persis dgn PS -- verifikasi menghitung
// ulang canonical dari nilai tersimpan, bukan dari tata-letak berkas. (ADR-004 / Gelombang 1.)
//
// Status migrasi: pembuat (saveManifest) = lem-pemasang yang dipanggil orkestrator (setup/update);
// dipakai-penuh saat orkestrator pindah ke Node (Gelombang 4). getFileSha256 = primitif murni, siap.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { newManifestSignature } from './manifest-signing.mjs'
// stripBom (sumber bersama lib/fs-text.mjs): tanpa buang-BOM, manifest ber-BOM (editor Windows) bikin
// merge daftar-berkas-lama HILANG diam-diam (entri lama tak terlacak saat uninstall = sampah tertinggal).
import { stripBom } from './fs-text.mjs'

// Buat wadah state baru untuk melacak manifest pemasangan.
export function initializeManifest(projectRoot) {
  if (!projectRoot) throw new Error('initializeManifest: projectRoot wajib diisi.')
  return { projectRoot, files: [], directories: [] }
}

// Hitung SHA-256 berkas (hex HURUF-BESAR, tanpa pemisah). null kalau berkas tak ada.
// Cermin PowerShell Get-FileHash -Algorithm SHA256 (yang mengembalikan hex huruf-besar).
export function getFileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null
  const buf = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase()
}

// Ubah path absolut -> path relatif (garis-miring-depan, tanpa garis-miring awal).
export function toManifestRelativePath(absolutePath, projectRoot) {
  let rel = String(absolutePath).split(projectRoot).join('') // cermin .NET String.Replace (semua kemunculan)
  rel = rel.replace(/^[\\/]+/, '')
  return rel.replace(/\\/g, '/')
}

// Lacak berkas ke state manifest dgn sidik-jari SHA-256.
export function addToManifest(state, filePath, kind, from) {
  if (!fs.existsSync(filePath)) return
  const sha = getFileSha256(filePath)
  const relPath = toManifestRelativePath(filePath, state.projectRoot)
  const entry = { path: relPath, kind, sha256: sha }
  if (from) entry.from = from
  state.files.push(entry)
}

// Cermin PowerShell -contains / -notcontains: keanggotaan string CASE-INSENSITIVE
// (PS -eq string default tak peka huruf-besar-kecil). Tanpa ini, path/folder yang
// beda HANYA huruf-besar-kecil (mis. rename 'Foo.md' -> 'foo.md' antar-versi) lolos
// dedup di Node tapi TIDAK di PS -> manifest Node dapat entri GANDA = divergensi dari
// sumber kebenaran (manifest.ps1 pakai -contains/-notcontains). Path manifest = ASCII;
// toLowerCase() cukup + selaras fix case-insensitivity sebelumnya (consistency-check).
function includesCI(arr, value) {
  const v = String(value).toLowerCase()
  for (const x of arr) { if (String(x).toLowerCase() === v) return true }
  return false
}

// Lacak folder ke state manifest (dedup CASE-INSENSITIVE, cermin PS -notcontains).
export function addDirToManifest(state, dirPath) {
  if (!fs.existsSync(dirPath)) return
  const relPath = toManifestRelativePath(dirPath, state.projectRoot)
  if (!includesCI(state.directories, relPath)) state.directories.push(relPath)
}

// Format waktu lokal 'yyyy-MM-ddTHH:mm:ss' (cermin Get-Date -Format).
function formatLocalTimestamp(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

// Tulis JSON ke disk secara ATOMIK: tulis ke berkas sementara (.tmp) lebih dulu, lalu ganti-nama
// (rename) ke tujuan. rename di filesystem yang sama bersifat atomik (libuv pakai MoveFileEx
// MOVEFILE_REPLACE_EXISTING di Windows -> timpa berkas lama dgn aman). Tanpa ini, listrik mati /
// proses ditebas di TENGAH penulisan bisa meninggalkan .install-manifest.json setengah-jadi (JSON
// rusak) -> rollback (rollback.mjs:readManifestJson) DAN uninstall (uninstall.mjs) dua-duanya
// lumpuh persis saat dibutuhkan. Cermin idiom writeManifestJson di rollback.mjs:100-104 (sumber
// idiom sama; sengaja TAK di-impor lintas-modul demi jaga batas lapisan installer<-manifest ringan).
function writeJsonAtomic(targetPath, obj) {
  const tmp = targetPath + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8')
  fs.renameSync(tmp, targetPath)
}

// Merge dgn manifest sebelumnya (kalau ada), segel HMAC, tulis JSON ke disk.
// opts: { kitDir, kitVersion, projectName, installerName, noPreserve=false, skipSigning=false, now? }
// `now` opsional (Date) untuk uji deterministik; default = sekarang.
// `installerName` = nama pemasang yang menulis catatan ini (metadata.installer). Default
// 'setup-pola-b.ps1' (jaga kompat PS + jalur yang belum cutover). Pemasang Node mengoper
// 'setup-pola-b.mjs' supaya catatan JUJUR soal "siapa yang masang" saat jalur Node aktif.
export function saveManifest(state, { kitDir, kitVersion, projectName, installerName = 'setup-pola-b.ps1', noPreserve = false, skipSigning = false, now = null } = {}) {
  if (!kitDir) throw new Error('saveManifest: kitDir wajib diisi.')
  const manifestPath = path.join(kitDir, '.install-manifest.json')
  let merged = false

  // Baca manifest sebelumnya (kalau ada) untuk merge.
  let previous = null
  if (!noPreserve && fs.existsSync(manifestPath)) {
    try { previous = JSON.parse(stripBom(fs.readFileSync(manifestPath, 'utf8'))) } catch (e) {
      console.warn('Catatan: daftar berkas lama rusak/tak terbaca, akan ditulis ulang (' + e.message + ').')
    }
  }

  // Merge berkas: pertahankan entri lama yang masih ada di disk + tak bentrok dgn yang baru.
  if (previous && Array.isArray(previous.files)) {
    // Dedup CASE-INSENSITIVE (cermin PS -contains): rename yang beda HANYA huruf-besar-kecil
    // antar-versi tak boleh bikin entri ganda. Kunci set + pembanding di-lower-case.
    const newPaths = new Set(state.files.map((f) => String(f.path).toLowerCase()))
    for (const prev of previous.files) {
      if (newPaths.has(String(prev.path).toLowerCase())) continue
      const fullPath = path.join(state.projectRoot, String(prev.path).replace(/\//g, path.sep))
      if (fs.existsSync(fullPath)) {
        const entry = { path: String(prev.path), kind: String(prev.kind), sha256: String(prev.sha256) }
        if (prev.from) entry.from = String(prev.from)
        state.files.push(entry)
        merged = true
      }
    }
  }

  // Merge folder: pertahankan yang masih ada.
  if (previous && Array.isArray(previous.directories_created)) {
    for (const prevDir of previous.directories_created) {
      const d = String(prevDir)
      if (includesCI(state.directories, d)) continue
      const fullDir = path.join(state.projectRoot, d.replace(/\//g, path.sep))
      if (fs.existsSync(fullDir)) { state.directories.push(d); merged = true }
    }
  }

  // Bangun objek manifest (urutan untuk keterbacaan; segel akan urut-abjad sendiri).
  const ts = now || new Date()
  const manifest = {
    schema_version: 1,
    kit_version: kitVersion,
    installed_at: formatLocalTimestamp(ts),
    installed_by: '<USER>',
    project_name: projectName,
    project_root: '<PROJECT_ROOT>',
    metadata: { kit_version: kitVersion, installed_at: formatLocalTimestamp(ts) + 'Z', installer: installerName },
    files: state.files,
    directories_created: state.directories,
  }

  // Segel HMAC (opsional). Kunci secret di kitDir/.manifest-secret (cermin PS).
  let signed = false
  if (!skipSigning) {
    try {
      manifest.metadata.signature = newManifestSignature(manifest, { kitVersion, kitRoot: kitDir })
      signed = true
    } catch (e) {
      console.warn('Catatan: gagal menyegel daftar berkas (' + e.message + '). Tetap ditulis tanpa segel; saat hapus-kit nanti akan ada konfirmasi tambahan.')
    }
  }

  // Tulis JSON (UTF-8 TANPA BOM -> hash stabil + ramah git). ATOMIK (tmp+rename) supaya proses yang
  // ditebas / listrik mati di TENGAH-tulis tak meninggalkan catatan setengah-jadi (rusak) yang
  // melumpuhkan rollback + uninstall sekaligus (audit P3 2026-06-23).
  writeJsonAtomic(manifestPath, manifest)

  return { manifestPath, filesCount: state.files.length, dirsCount: state.directories.length, merged, signed }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  // CLI tipis: `node lib/manifest.mjs sha256 <berkas>` -> cetak sidik-jari (uji manual).
  const [cmd, file] = process.argv.slice(2)
  if (cmd === 'sha256' && file) {
    const h = getFileSha256(file)
    if (h === null) { console.error('Berkas tak ada: ' + file); process.exit(1) }
    console.log(h)
  } else {
    console.error('Pakai: node lib/manifest.mjs sha256 <berkas>')
    process.exit(2)
  }
}
