#!/usr/bin/env node
// lib/agents-md.mjs - Deploy AGENTS.md + CLAUDE.md loader (port Node dari agents-md.ps1).
//
// MIGRASI grup [A] (ADR-003): robot PENULIS PENUH terakhir. Strangler Fig = BERDAMPINGAN:
// versi .ps1 TETAP hidup (dipakai setup-pola-b/update-kit PS).
//
// Kontrak (byte-identik dgn PS): substitusi LITERAL (split/join, aman $0/$1/$); tulis UTF-8
// NO-BOM; strip BOM saat baca (charCodeAt 0xFEFF); backup .backup-<timestamp> sebelum overwrite;
// Publish-ClaudeMd idempoten (kalau sudah ada marker loader -> 'current', jangan timpa).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isFile, isDir, writeUtf8NoBom, readTemplate, backupStamp } from './fs-text.mjs'

// readTemplate/writeUtf8NoBom/isFile/isDir + cap-waktu cadangan (backupStamp) dipindah ke sumber
// bersama lib/fs-text.mjs (audit fungsi-kembar 2026-06-25).

// Publish AGENTS.md ke project root: fill template + backup existing.
// Mode: tidak ada -> CREATE; ada + preserve -> PRESERVE; ada tanpa flag -> BACKUP + UPDATE.
export function publishAgentsMd({ projectRoot, templatePath, placeholders = {}, preserve = false } = {}) {
  if (!isDir(projectRoot)) throw new Error(`Publish-AgentsMd: ProjectRoot tidak ditemukan atau bukan folder: ${projectRoot}`)
  if (!isFile(templatePath)) throw new Error(`Publish-AgentsMd: TemplatePath tidak ditemukan: ${templatePath}`)

  const target = path.join(projectRoot, 'AGENTS.md')
  const existing = isFile(target)

  if (existing && preserve) {
    return { action: 'preserved', backup_path: null, target_path: target, placeholders_applied: 0 }
  }

  let backupPath = null
  if (existing) {
    backupPath = `${target}.backup-${backupStamp(new Date())}`
    fs.copyFileSync(target, backupPath)
  }

  let content = readTemplate(templatePath)
  let applied = 0
  for (const [key, value] of Object.entries(placeholders || {})) {
    content = content.split(String(key)).join(String(value)) // .Replace() literal
    applied++
  }
  writeUtf8NoBom(target, content)

  return { action: existing ? 'updated' : 'created', backup_path: backupPath, target_path: target, placeholders_applied: applied }
}

// Publish CLAUDE.md loader. Idempoten: kalau existing sudah punya marker @import -> 'current'.
export function publishClaudeMd({ projectRoot, templatePath, placeholders = {} } = {}) {
  if (!isDir(projectRoot)) throw new Error(`Publish-ClaudeMd: ProjectRoot tidak ditemukan atau bukan folder: ${projectRoot}`)
  if (!isFile(templatePath)) throw new Error(`Publish-ClaudeMd: TemplatePath tidak ditemukan: ${templatePath}`)

  const target = path.join(projectRoot, 'CLAUDE.md')
  const marker = '@./.claude-kit/CLAUDE_universal_v1.md'
  const existing = isFile(target)

  if (existing) {
    let cur = ''
    try { cur = fs.readFileSync(target, 'utf8') } catch { cur = '' }
    if (cur && cur.includes(marker)) {
      return { action: 'current', backup_path: null, target_path: target }
    }
  }

  let backupPath = null
  if (existing) {
    backupPath = `${target}.backup-${backupStamp(new Date())}`
    fs.copyFileSync(target, backupPath)
  }

  let content = readTemplate(templatePath)
  for (const [key, value] of Object.entries(placeholders || {})) {
    content = content.split(String(key)).join(String(value))
  }
  writeUtf8NoBom(target, content)

  return { action: existing ? 'updated' : 'created', backup_path: backupPath, target_path: target }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) console.log('lib/agents-md.mjs - library (import publishAgentsMd / publishClaudeMd).')
