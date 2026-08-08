#!/usr/bin/env node
// lib/json-merge-helpers.mjs - Penggabung daftar-izin Claude Code (.claude/settings.local.json).
//
// GELOMBANG 4 (ADR-004 / port orkestrator besar ke Node, BERTAHAP + BERDAMPINGAN): pemasang
// (setup-pola-b.ps1) + update-kit.ps1 menggabungkan daftar-izin (permissions.allow) bawaan kit
// ke settings.local.json project, sambil menjaga kunci lain milik user (permissions.deny, env,
// apiKeyHelper, dst.). Modul ini = padanan Node dari lib/json-merge-helpers.ps1.
//
// SIFAT NON-PERUSAK (Strangler Fig): pemanggil live SAAT INI = orkestrator PowerShell, jadi
// .ps1 tetap dipakai. Modul Node ini fondasi untuk orkestrator versi Node nanti; .ps1 TAK
// disentuh (berdampingan). Uji-banding pada HASIL LOGIKA (daftar entri ter-gabung + kunci
// terjaga), BUKAN byte-format: berkas ini TAK ber-tanda-tangan, jadi beda gaya-tulisan
// (indentasi PS ConvertTo-Json vs JSON.stringify; CRLF vs LF) = KOSMETIK + tak berdampak
// fungsional (Claude Code membaca permissions.allow sebagai himpunan, bukan urut byte).
//
// NILAI entri allow sengaja CASE-SENSITIVE (cermin PS [StringComparer]::Ordinal): "Bash(X)" != "bash(x)".
// NAMA KUNCI (permissions/allow) dicocokkan CASE-INSENSITIVE (cermin akses-anggota PS yang abai-huruf)
// lewat getPropCI -> kalau user menulis "Permissions" (P besar), tetap dikenali + digabung ke kunci itu
// (bukan bikin kunci "permissions" huruf-kecil duplikat). Parity dgn lib/json-merge-helpers.ps1.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripBom } from './fs-text.mjs'

// Ambang peringatan-lunak daftar-izin (bukan batas keras - kit tetap menggabung). Daftar-izin
// yang tumbuh tak wajar = erosi prinsip hak-akses-seminimal-mungkin -> owner perlu tahu.
export const ALLOW_WARN_THRESHOLD = 200

function warn(msg) {
  // Mirror Write-Warning (ke stderr). Pakai Bahasa Indonesia (output bisa terlihat staff).
  console.error(`PERINGATAN json-merge: ${msg}`)
}

// Cap-waktu untuk nama berkas cadangan (yyyyMMdd-HHmmss). new Date() aman di modul Node biasa.
function timestampForBackup(d = new Date()) {
  const p2 = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`
}

// Baca + parse JSON dengan kegagalan anggun. Cermin Read-LintasJsonFileSafely:
//   - berkas tak ada -> null.
//   - terkunci/tak terbaca -> THROW (cegah caller perusak salah-anggap "kosong" lalu menimpa),
//     kecuali suppressLockError -> warn + null.
//   - isi kosong -> null.
//   - JSON rusak (ada + non-kosong) -> THROW (cegah penghapusan kunci kustom user),
//     kecuali suppressMalformedError -> warn + null.
export function readJsonFileSafely(filePath, opts = {}) {
  const { suppressLockError = false, suppressMalformedError = false } = opts
  if (!fs.existsSync(filePath)) return null
  let raw
  try {
    raw = fs.readFileSync(filePath, 'utf8')
  } catch (e) {
    const msg = `Tidak bisa baca settings '${filePath}' - berkas mungkin terkunci proses lain (tutup VS Code/editor lalu coba lagi). Detail: ${e.message}`
    if (suppressLockError) { warn(msg); return null }
    throw new Error(msg)
  }
  if (raw == null) return null
  raw = stripBom(raw) // buang BOM (JSON.parse tersedak BOM)
  if (raw.trim().length === 0) return null
  try {
    return JSON.parse(raw)
  } catch (e) {
    const msg = `JSON rusak di '${filePath}' (${e.message}). Berkas ADA dengan isi non-kosong - perbaiki sintaks JSON atau hapus berkas ini manual, lalu jalankan setup ulang. Penolakan ini sengaja untuk mencegah penghapusan kunci kustom (permissions.deny / env / apiKeyHelper).`
    if (suppressMalformedError) { warn(msg); return null }
    throw new Error(msg)
  }
}

// Cari nama properti yang cocok CASE-INSENSITIVE (cermin akses-anggota PS yang abai-huruf). Kembalikan
// nama kunci ASLI yang ada di obj (mis. "Permissions"), atau undefined kalau tak ada. Dipakai supaya
// settings.local.json yang ditulis user dgn kapitalisasi beda tetap dikenali + digabung (parity PS).
function getPropCI(obj, name) {
  if (obj == null || typeof obj !== 'object') return undefined
  const lower = String(name).toLowerCase()
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lower) return k
  }
  return undefined
}

// Ekstrak permissions.allow jadi array string (tak pernah null). Cermin foreach PS yang lewati
// nilai null + toleran kalau allow bukan-array (skalar tunggal di-iterasi sekali). Nama kunci
// permissions/allow dicocokkan case-insensitive (getPropCI) = parity akses-anggota PS.
export function getAllowArrayFromObject(obj) {
  const out = []
  if (obj == null || typeof obj !== 'object') return out
  const permsKey = getPropCI(obj, 'permissions')
  const perms = permsKey ? obj[permsKey] : null
  if (perms == null || typeof perms !== 'object') return out
  const allowKey = getPropCI(perms, 'allow')
  const allow = allowKey ? perms[allowKey] : null
  if (allow == null) return out
  const items = Array.isArray(allow) ? allow : [allow]
  for (const item of items) {
    if (item != null) out.push(String(item))
  }
  return out
}

// Buang entri "bare" yang sudah ditutup varian wildcard ":*". Cermin
// Compress-SupersededAllowEntry (case-sensitive Ordinal, idempoten, jaga urutan input).
// Mis. ada "Bash(git status)" + "Bash(git status:*)" -> buang yang bare.
export function compressSupersededAllowEntry(entries) {
  const out = []
  if (!entries || entries.length === 0) return out
  const entrySet = new Set()
  for (const e of entries) { if (e != null) entrySet.add(String(e)) }
  const toDrop = new Set()
  for (const e of entrySet) {
    if (e.length >= 4 && e.endsWith(':*)')) {
      const bare = e.slice(0, e.length - 3) + ')'
      if (entrySet.has(bare)) toDrop.add(bare)
    }
  }
  for (const e of entries) {
    if (e == null) continue
    if (!toDrop.has(String(e))) out.push(String(e))
  }
  return out
}

// Gabung permissions.allow template ke settings existing. Cermin Merge-LintasAllowList.
// opts (varian berkas): { existingPath, templatePath, outputPath, dryRun }
// opts (varian in-memory): { settingsPath, templateAllowList, dryRun }
// Return: true kalau ada perubahan (atau akan ada saat dryRun), false kalau sudah ter-gabung.
export function mergeAllowList(opts = {}) {
  const { dryRun = false } = opts
  let existingPath, outputPath, templateObj

  const isInMemory = Array.isArray(opts.templateAllowList) || typeof opts.settingsPath === 'string'
  if (isInMemory) {
    existingPath = opts.settingsPath
    outputPath = opts.settingsPath
    templateObj = { permissions: { allow: [...(opts.templateAllowList || [])] } }
  } else {
    existingPath = opts.existingPath
    outputPath = opts.outputPath
    if (!fs.existsSync(opts.templatePath)) {
      throw new Error(`mergeAllowList: TemplatePath tidak ditemukan: '${opts.templatePath}'`)
    }
    templateObj = readJsonFileSafely(opts.templatePath)
    if (templateObj == null) {
      throw new Error(`mergeAllowList: template '${opts.templatePath}' kosong atau rusak.`)
    }
  }

  // Sisi-existing. readJsonFileSafely default THROW saat terkunci / rusak. Untuk rusak,
  // simpan copy mentah ke ".malformed.bak.<ts>" dulu (jejak buat user) lalu re-throw.
  const existingExists = fs.existsSync(existingPath)
  let existingObj
  try {
    existingObj = readJsonFileSafely(existingPath)
  } catch (e) {
    if (existingExists) {
      const malformedBackup = `${existingPath}.malformed.bak.${timestampForBackup()}`
      try {
        fs.copyFileSync(existingPath, malformedBackup)
        warn(`existing settings rusak. Copy mentah disimpan ke '${malformedBackup}' supaya tidak hilang. Perbaiki '${existingPath}' atau hapus berkas itu lalu rerun setup.`)
      } catch (e2) {
        warn(`gagal salin copy rescue '${existingPath}' -> '${malformedBackup}': ${e2.message}. Berkas asli BELUM ditimpa.`)
      }
    }
    throw new Error(`mergeAllowList: menolak menulis '${outputPath}'. ${e.message}`)
  }

  const existingAllow = getAllowArrayFromObject(existingObj)
  const templateAllow = getAllowArrayFromObject(templateObj)

  // Union (dedup case-sensitive) menjaga item tambahan dari template.
  const seen = new Set()
  const merged = []
  for (const item of existingAllow) { if (!seen.has(item)) { seen.add(item); merged.push(item) } }
  for (const item of templateAllow) { if (!seen.has(item)) { seen.add(item); merged.push(item) } }

  // Buang entri tertimpa wildcard.
  const collapsed = compressSupersededAllowEntry(merged)

  if (collapsed.length > ALLOW_WARN_THRESHOLD) {
    warn(`permissions.allow punya ${collapsed.length} entri (> ambang ${ALLOW_WARN_THRESHOLD}). Review '${outputPath}' untuk buang entri usang/tertimpa. Daftar-izin besar = erosi prinsip hak-akses-seminimal-mungkin.`)
  }

  // Sort (ordinal/code-unit, deterministik). Urutan serial adalah KOSMETIK (himpunan yang
  // penting); uji-banding membandingkan himpunan, bukan urutan persis PS.
  const mergedSorted = [...collapsed].sort()

  // Deteksi diff vs existing (banding himpunan, abai urutan).
  const existingSet = new Set(existingAllow)
  const mergedSet = new Set(mergedSorted)
  let hasDiff = existingSet.size !== mergedSet.size
  if (!hasDiff) {
    for (const m of mergedSet) {
      if (!existingSet.has(m)) { hasDiff = true; break }
    }
  }

  if (!hasDiff) return false
  if (dryRun) return true

  // Bangun objek output: jaga kunci top-level existing, timpa permissions.allow saja. Pakai kembali
  // nama kunci yang SUDAH ada secara case-insensitive (mis. "Permissions") supaya merge masuk ke kunci
  // itu -- bukan bikin kunci "permissions" huruf-kecil duplikat (cermin akses-anggota PS yang abai-huruf).
  const outObj = existingObj == null ? {} : structuredClone(existingObj)
  const permsKey = getPropCI(outObj, 'permissions') || 'permissions'
  if (outObj[permsKey] == null || typeof outObj[permsKey] !== 'object' || Array.isArray(outObj[permsKey])) {
    outObj[permsKey] = {}
  }
  const allowKey = getPropCI(outObj[permsKey], 'allow') || 'allow'
  outObj[permsKey][allowKey] = mergedSorted

  // Cadangkan existing kalau ada DAN ada diff.
  if (existingExists) {
    const backupPath = `${existingPath}.bak.${timestampForBackup()}`
    try {
      fs.copyFileSync(existingPath, backupPath)
    } catch (e) {
      warn(`gagal backup '${existingPath}' -> '${backupPath}': ${e.message}`)
    }
  }

  // Pastikan folder output ada.
  const outDir = path.dirname(outputPath)
  if (outDir && !fs.existsSync(outDir)) {
    try {
      fs.mkdirSync(outDir, { recursive: true })
    } catch (e) {
      throw new Error(`mergeAllowList: gagal buat folder output '${outDir}': ${e.message}`)
    }
  }

  // Tulis UTF-8 tanpa BOM (writeFileSync utf8 = no-BOM; JSON.stringify pakai LF). Cermin
  // niat PS WriteAllText(no-BOM); gaya-tulisan beda = kosmetik (berkas tak ber-tanda-tangan).
  const json = JSON.stringify(outObj, null, 2)
  try {
    fs.writeFileSync(outputPath, json, 'utf8')
  } catch (e) {
    throw new Error(`mergeAllowList: gagal tulis '${outputPath}': ${e.message}`)
  }

  return true
}

// Cek apakah semua entri requiredAllowList sudah ada di permissions.allow. Read-only:
// berkas terkunci/rusak -> false ("belum ter-gabung"). Cermin Test-LintasAllowListMerged.
export function testAllowListMerged(filePath, requiredAllowList) {
  if (!requiredAllowList || requiredAllowList.length === 0) return true
  const obj = readJsonFileSafely(filePath, { suppressLockError: true, suppressMalformedError: true })
  if (obj == null) return false
  const set = new Set(getAllowArrayFromObject(obj))
  for (const req of requiredAllowList) {
    if (!set.has(req)) return false
  }
  return true
}

// Ambil permissions.allow dari berkas (array string, mungkin kosong, tak pernah throw).
// Cermin Get-LintasAllowList (read-only, suppress dua mode kegagalan).
export function getAllowList(filePath) {
  const obj = readJsonFileSafely(filePath, { suppressLockError: true, suppressMalformedError: true })
  return getAllowArrayFromObject(obj)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  // CLI ringkas (inspeksi/uji-banding). Bukan perintah user-facing.
  const sub = process.argv[2]
  try {
    if (sub === 'get' && process.argv[3]) {
      console.log(getAllowList(process.argv[3]).join('\n'))
    } else if (sub === 'merge' && process.argv[5]) {
      const changed = mergeAllowList({ existingPath: process.argv[3], templatePath: process.argv[4], outputPath: process.argv[5], dryRun: process.argv.includes('--dry-run') })
      console.log(changed ? 'changed' : 'nochange')
    } else {
      console.error('Pakai: node lib/json-merge-helpers.mjs get <settings.json>')
      console.error('   atau: node lib/json-merge-helpers.mjs merge <existing> <template> <output> [--dry-run]')
      process.exit(2)
    }
  } catch (e) {
    console.error(e.message); process.exit(1)
  }
}
