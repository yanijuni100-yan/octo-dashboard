#!/usr/bin/env node
// lib/template-deploy.mjs - Helper deploy template (port Node dari template-deploy.ps1).
//
// MIGRASI grup [A] (ADR-003): robot PENULIS PENUH (salin template + placeholder + backup).
// Strangler Fig = BERDAMPINGAN: versi .ps1 TETAP hidup (dipakai setup-pola-b/update-kit PS).
//
// Kontrak penting (byte-identik dgn versi PS):
//  - Substitusi LITERAL via split/join (bukan regex) -> value ber-karakter $0/$1/$ tak corrupt.
//  - Tulis UTF-8 NO-BOM (fs writeFileSync utf8). Strip BOM saat baca (cermin Get-Content -Encoding UTF8).
//  - SHA256 file TARGET (post-substitution), hex UPPERCASE (cermin Get-FileHash.Hash).
//  - action: created | updated | skipped | missing.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { writeUtf8NoBom, readTemplate, backupStamp } from './fs-text.mjs'

export function getSupportedPlaceholder() {
  return ['<NAMA_PROYEK>', '<TANGGAL_HARI_INI>', '<NAMA_KAMU>', '<URL_REPO_STANDAR>', '<VERSI_KIT>']
}

// SHA256 hex UPPERCASE dari file (cermin Get-FileHash -Algorithm SHA256 .Hash).
function fileSha256Hex(filePath) {
  if (!fs.existsSync(filePath)) return null
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase()
}

// writeUtf8NoBom dipindah ke sumber bersama lib/fs-text.mjs (audit fungsi-kembar 2026-06-25).

// defaultBackupSuffix -> backupStamp (sumber bersama lib/fs-text.mjs).

// Skip/Backup/Overwrite. Return true kalau caller boleh write, false kalau skip.
function resolveExistingTarget(targetPath, mode, backupSuffix) {
  if (!fs.existsSync(targetPath)) return true // target tidak ada -> bebas write
  if (mode === 'Skip') return false
  if (mode === 'Overwrite') return true
  if (mode === 'Backup') {
    const suffix = backupSuffix || backupStamp(new Date())
    fs.copyFileSync(targetPath, `${targetPath}.backup-${suffix}`)
    return true
  }
  return false
}

// readTemplate -> sumber bersama lib/fs-text.mjs (audit fungsi-kembar 2026-06-25).

// Copy template + placeholder substitution -> { copied, action, sha256 }.
export function copyTemplateWithPlaceholder({ sourcePath, targetPath, placeholders = {}, ifExists = 'Skip', backupSuffix = null } = {}) {
  if (!fs.existsSync(sourcePath)) return { copied: false, action: 'missing', sha256: null }

  const targetExists = fs.existsSync(targetPath)
  if (!resolveExistingTarget(targetPath, ifExists, backupSuffix)) {
    return { copied: false, action: 'skipped', sha256: null }
  }

  const parentDir = path.dirname(targetPath)
  if (parentDir && !fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true })

  let content = readTemplate(sourcePath)
  for (const [key, value] of Object.entries(placeholders || {})) {
    // split/join = substitusi LITERAL (search + replacement), aman utk value ber-$/regex.
    content = content.split(key).join(String(value))
  }

  writeUtf8NoBom(targetPath, content)
  const sha = fileSha256Hex(targetPath)
  return { copied: true, action: targetExists ? 'updated' : 'created', sha256: sha }
}

// Copy verbatim (tanpa substitusi), tetap normalize ke UTF-8 NO-BOM -> { copied, action, sha256 }.
export function copyStaticTemplate({ sourcePath, targetPath, ifExists = 'Skip', backupSuffix = null } = {}) {
  if (!fs.existsSync(sourcePath)) return { copied: false, action: 'missing', sha256: null }

  const targetExists = fs.existsSync(targetPath)
  if (!resolveExistingTarget(targetPath, ifExists, backupSuffix)) {
    return { copied: false, action: 'skipped', sha256: null }
  }

  const parentDir = path.dirname(targetPath)
  if (parentDir && !fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true })

  const content = readTemplate(sourcePath)
  writeUtf8NoBom(targetPath, content)
  const sha = fileSha256Hex(targetPath)
  return { copied: true, action: targetExists ? 'updated' : 'created', sha256: sha }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) console.log('lib/template-deploy.mjs - library (import getSupportedPlaceholder/copyTemplateWithPlaceholder/copyStaticTemplate).')
