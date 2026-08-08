#!/usr/bin/env node
// tests/smoke-portable.mjs - Gerbang smoke Node PELENGKAP (port SEBAGIAN dari tests/smoke-fast.ps1).
//
// MIGRASI grup [A] PARSIAL (ADR-003 / keputusan-per-elemen): smoke-fast.ps1 TERKUNCI-KEMAMPUAN di 2
// cek (parse-PowerShell via [Language.Parser] + baca .psd1 manifest) yang Node TAK BISA -> ITU TETAP
// PowerShell. Modul ini memport HANYA 3 cek PORTABLE sebagai gerbang Node tambahan:
//   1. critical-files ada   2. orphan-refs (pola stub terhapus)   3. json valid
// smoke-fast.ps1 TETAP gerbang utama (parse-PS + manifest). Ini BERDAMPINGAN, bukan pengganti.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SKIP_DIRS = ['\\.git\\', '\\node_modules\\', '\\.backup-']
function walk(root, exts) {
  const out = []
  const rec = (dir) => {
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      const norm = full.replace(/\//g, '\\')
      if (SKIP_DIRS.some((s) => norm.includes(s))) continue
      if (e.isDirectory()) rec(full)
      else if (exts.includes(path.extname(e.name).toLowerCase())) out.push(full)
    }
  }
  rec(root)
  return out
}

// Cek 12 berkas kritis ada (cermin Test-LintasCriticalFile).
export function checkCriticalFiles(kitRoot) {
  const critical = ['bin/lintasai.js', 'README.md', 'package.json', 'lib/kit-files.psd1',
    'setup-pola-b.ps1', 'kit.ps1', 'uninstall.ps1', 'update-kit.ps1',
    'install-windows.ps1', 'AGENTS.md.template', 'lib/popup-helpers.ps1', 'lib/json-merge-helpers.ps1']
  const missing = critical.filter((rel) => !fs.existsSync(path.join(kitRoot, rel)))
  return { total: critical.length, missing }
}

// Cek referensi stub yang sudah dihapus (cermin Test-LintasOrphanRef). Count = jumlah BARIS cocok.
export function checkOrphanRefs(kitRoot) {
  const deletedStubs = ['BOOTSTRAP_PROJECT_DOCS_PROMPT', 'PROJECT_KICKOFF_PROMPT', 'PROJECT_MIGRATION_PROMPT', 'SETUP_POLA_B_PROMPT', 'UPDATE_DOCS_PROMPT']
  const pattern = new RegExp(deletedStubs.join('|'))
  // Self-exclude smoke-fast.ps1 (literal deteksi) + history. (.mjs tak ikut dipindai -> modul ini aman.)
  const excludeNames = new Set(['CHANGELOG.md', 'AUDIT_HISTORY.md', 'smoke-fast.ps1'])
  let count = 0
  for (const f of walk(kitRoot, ['.md', '.ps1', '.psd1'])) {
    if (excludeNames.has(path.basename(f))) continue
    let content
    try { content = fs.readFileSync(f, 'utf8') } catch { continue }
    for (const line of content.split(/\r?\n/)) { if (pattern.test(line)) count++ }
  }
  return { count }
}

// Cek semua .json parse (cermin Test-LintasJsonValid) + settings.local.json.template eksplisit.
export function checkJsonValid(kitRoot) {
  const jsonFiles = walk(kitRoot, ['.json'])
  const tmpl = path.join(kitRoot, 'templates', 'settings.local.json.template')
  if (fs.existsSync(tmpl)) jsonFiles.push(tmpl)
  const invalid = []
  for (const f of jsonFiles) {
    try {
      let raw = fs.readFileSync(f, 'utf8')
      if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1) // strip BOM sebelum parse
      JSON.parse(raw)
    } catch { invalid.push(path.basename(f)) }
  }
  return { total: jsonFiles.length, invalid }
}

export function runPortableSmoke(kitRoot, { quiet = false } = {}) {
  const crit = checkCriticalFiles(kitRoot)
  const orphan = checkOrphanRefs(kitRoot)
  const json = checkJsonValid(kitRoot)
  const pass = crit.missing.length === 0 && orphan.count === 0 && json.invalid.length === 0
  if (!quiet) {
    console.log('=== lintasAI Smoke Portable (Node, pelengkap smoke-fast.ps1) ===')
    console.log(`Critical    : ${crit.total} expected, ${crit.missing.length} missing`)
    console.log(`Orphan refs : ${orphan.count}`)
    console.log(`JSON files  : ${json.total} checked, ${json.invalid.length} invalid`)
    console.log(pass ? 'PASS: SMOKE PORTABLE PASSED' : 'FAIL: SMOKE PORTABLE FAILED')
    console.log('(Catatan: parse-PowerShell + manifest .psd1 dicek terpisah oleh smoke-fast.ps1 - Node tak bisa.)')
  }
  return { pass, crit, orphan, json }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  process.exit(runPortableSmoke(kitRoot).pass ? 0 : 1)
}
