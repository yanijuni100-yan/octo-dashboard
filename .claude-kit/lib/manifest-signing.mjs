#!/usr/bin/env node
// lib/manifest-signing.mjs - Tanda-tangan keaslian manifest (HMAC-SHA256), versi Node.
//
// FUNGSI: mencegah manifest (.install-manifest.json) diam-diam diubah. Bukan rahasia anti-pemalsuan
// total -- ini "segel anti-utak-atik": kalau isi manifest diubah tanpa kunci, segel jadi tak cocok.
//
// GANDENG dgn lib/manifest-signing.ps1 (PowerShell). KEDUANYA WAJIB hasilkan tanda-tangan
// BYTE-IDENTIK pada manifest + kunci yang sama -> manifest yang ditandatangani PowerShell bisa
// diverifikasi Node, dan sebaliknya. Kunci kecocokan = "penyusun baku" (canonicalize) di bawah:
// urut-abjad kunci + escape JSON standar. (ADR-004 / Gelombang 1 migrasi PS->Node.)
//
// CATATAN PEMBAKUAN (2026-06-22): versi PowerShell LAMA menandatangani JSON urutan-acak-internal
// .NET (Hashtable) yang TAK bisa ditiru Node. Maka cara penyusunan dibakukan jadi urut-abjad
// (deterministik, sama di mana pun). Versi PS baru pakai penyusun baku yang sama + cadangan baca
// tanda-tangan lama supaya manifest lama tidak salah dikira "dirusak" saat masa transisi.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ---- Penyusun baku (canonical JSON): urut-abjad kunci + escape standar + tanpa spasi ----
// Kunci kecocokan byte-identik dgn ConvertTo-LintasCanonicalJson di manifest-signing.ps1.
// Escape: hanya " \ dan karakter kontrol (<0x20); non-ASCII & < > ' dibiarkan apa adanya
// (sama dgn JSON.stringify). Urutan kunci pakai sort default (per code-unit) = ordinal utk ASCII.
function escCanonString(s) {
  let out = '"'
  for (const ch of s) {
    const code = ch.codePointAt(0)
    if (ch === '"') out += '\\"'
    else if (ch === '\\') out += '\\\\'
    else if (code === 8) out += '\\b'
    else if (code === 9) out += '\\t'
    else if (code === 10) out += '\\n'
    else if (code === 12) out += '\\f'
    else if (code === 13) out += '\\r'
    else if (code < 32) out += '\\u' + code.toString(16).padStart(4, '0')
    else out += ch
  }
  return out + '"'
}

export function canonicalize(v) {
  if (v === null || v === undefined) return 'null'
  const t = typeof v
  if (t === 'boolean') return v ? 'true' : 'false'
  if (t === 'number') return JSON.stringify(v)
  if (t === 'string') return escCanonString(v)
  if (Array.isArray(v)) return '[' + v.map(canonicalize).join(',') + ']'
  if (t === 'object') {
    const keys = Object.keys(v).sort()
    return '{' + keys.map((k) => escCanonString(k) + ':' + canonicalize(v[k])).join(',') + '}'
  }
  return escCanonString(String(v))
}

// ---- Kunci tanda-tangan (per-install acak ATAU env LINTASAI_MANIFEST_SECRET) ----
function defaultKitRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
}

export function getOrCreateLocalSecret(kitRoot) {
  if (!kitRoot) kitRoot = defaultKitRoot()
  const secretFile = path.join(kitRoot, '.manifest-secret')
  if (fs.existsSync(secretFile)) {
    const existing = fs.readFileSync(secretFile, 'utf8').trim()
    if (existing) return existing
  }
  // 32 byte (256-bit) acak aman-kripto -> base64. Sama mesin = kunci sama = tanda-tangan stabil.
  const secret = crypto.randomBytes(32).toString('base64')
  // Tulis UTF-8 TANPA BOM, TANPA baris-baru akhir (cermin PS WriteAllText UTF8Encoding($false)).
  fs.writeFileSync(secretFile, secret, { encoding: 'utf8' })
  return secret
}

export function getManifestSecret({ kitRoot } = {}) {
  if (process.env.LINTASAI_MANIFEST_SECRET) return process.env.LINTASAI_MANIFEST_SECRET
  // Tanpa kunci global, pakai kunci lokal per-install: aman, tapi tanda-tangan tak pindah antar-komputer.
  console.warn('Catatan: kunci segel (LINTASAI_MANIFEST_SECRET) belum diatur. Memakai kunci lokal di .manifest-secret (segel ini tidak bisa dipindah ke komputer lain).')
  return getOrCreateLocalSecret(kitRoot)
}

// ---- Buat tanda-tangan (HMAC-SHA256 atas JSON kanonik) ----
export function newManifestSignature(manifest, { kitVersion, kitRoot } = {}) {
  void kitVersion // dicadangkan utk turunan-kunci per-versi (kompat tanda tangan stabil antar pemanggil)
  const secret = getManifestSecret({ kitRoot })
  const canonical = canonicalize(manifest)
  return crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(Buffer.from(canonical, 'utf8')).digest('base64')
}

// Banding konstan-waktu byte (Ordinal). base64 case-SENSITIVE -> jangan banding case-insensitive.
function constantTimeEqual(a, b) {
  const ab = Buffer.from(String(a), 'utf8')
  const bb = Buffer.from(String(b), 'utf8')
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export function testManifestSignature(manifest, { kitVersion, expectedSignature, kitRoot } = {}) {
  const actual = newManifestSignature(manifest, { kitVersion, kitRoot })
  return constantTimeEqual(actual, expectedSignature)
}

// Buang field metadata.signature (tanda-tangan dihitung SEBELUM disisipkan). Deep-clone aman.
export function toSignableManifest(manifest) {
  const copy = JSON.parse(JSON.stringify(manifest))
  if (copy && copy.metadata && typeof copy.metadata === 'object') delete copy.metadata.signature
  return copy
}

// Status keaslian manifest yang sudah di-parse:
//   'verified' -> ada segel + COCOK (daftar berkas asli)
//   'invalid'  -> ada segel tapi TIDAK cocok (mungkin di-utak-atik)
//   'unsigned' -> tanpa segel (legacy / sebelum fitur ini)
// Catatan: Node hanya bisa verifikasi segel format-baru (urut-abjad). Manifest bersegel-LAMA
// (urutan-acak-.NET) tak bisa diverifikasi Node -> selama transisi, verifikasi dipegang PowerShell
// (yang punya cadangan baca segel lama). Saat orkestrator pindah ke Node (Gelombang 4), manifest
// sudah disegel-ulang format-baru oleh PS lebih dulu.
export function getManifestSignatureStatus(manifest, { kitRoot } = {}) {
  let sig = null
  if (manifest && manifest.metadata && manifest.metadata.signature) sig = String(manifest.metadata.signature)
  if (!sig || sig.trim() === '') return 'unsigned'
  const copy = toSignableManifest(manifest)
  let kitVer = ''
  if (manifest.metadata && manifest.metadata.kit_version) kitVer = String(manifest.metadata.kit_version)
  else if (manifest.kit_version) kitVer = String(manifest.kit_version)
  return testManifestSignature(copy, { kitVersion: kitVer, expectedSignature: sig, kitRoot }) ? 'verified' : 'invalid'
}

// CLI tipis: `node lib/manifest-signing.mjs verify <manifest.json>` -> cetak status (utk uji manual).
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [cmd, file] = process.argv.slice(2)
  if (cmd === 'verify' && file) {
    const m = JSON.parse(fs.readFileSync(file, 'utf8'))
    console.log(getManifestSignatureStatus(m, {}))
  } else {
    console.error('Pakai: node lib/manifest-signing.mjs verify <manifest.json>')
    process.exit(2)
  }
}
