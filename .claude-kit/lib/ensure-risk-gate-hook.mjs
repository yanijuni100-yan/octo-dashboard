#!/usr/bin/env node
// lib/ensure-risk-gate-hook.mjs - Nyalakan "Palang Rem Otomatis" (lib/risk-gate.js) dengan 1 langkah.
//
// KENAPA ADA: lib/risk-gate.js (hook PreToolUse yang minta konfirmasi klik untuk aksi berisiko -
// hapus massal, DROP TABLE, force-push, sentuh .env) ikut tersalin ke klien (.claude-kit/lib/), TAPI
// hook hanya AKTIF kalau terdaftar di .claude/settings.json. Selama ini "nyalakan" = salin-tempel
// manual dari templates/hooks/risk-gate.settings.example.json (docs/risk-gate.md langkah 2) -> ribet
// untuk staff non-programmer. Modul ini menggabungkan hook itu ke settings.json klien DALAM 1 PERINTAH.
//
// DEFAULT NYALA sejak v1.61.0 (keputusan owner): setup-pola-b memanggil ensureRiskGateHook() otomatis tiap
// init/update (cermin lang-hook). Alasan: Palang Rem MENGURANGI risiko AI (MEMBATASI aksi, bukan menambah
// otonomi), jadi default NYALA = selaras "keamanan dulu" (tie-breaker #1) - BEDA dari mode-OTONOMI
// (co-pilot/auto-confirm) yang TETAP default MATI (§4.12). Mode "ask" tak ganggu kerja normal (cuma aksi
// benar-benar bahaya yang ditanya). Tetap MUDAH dimatikan (hapus blok PreToolUse) + bisa dipasang manual
// via `npx lintasai enable-risk-gate`. Pemasangan FAIL-SAFE (settings rusak/terkunci -> dilewati, tak ditimpa).
//
// SIFAT (cermin lib/lang-hook-wiring.mjs - pola pemasang-hook yang sudah teruji):
//  - IDEMPOTEN: hook risk-gate sudah ada -> tak menambah lagi (changed:false).
//  - DEFENSIF: pertahankan SEMUA hook/kunci lain; settings.json RUSAK/terkunci -> JANGAN tulis
//    (lapor + lewati) supaya tak menghapus pengaturan kustom klien (permissions/env/hook lain).
//  - TULIS ATOMIK: temp + rename (tak ada settings setengah-tertulis kalau proses mati).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonFileSafely } from './json-merge-helpers.mjs'

// Bentuk hook = SSOT templates/hooks/risk-gate.settings.example.json (matcher + command).
// Dikunci tes paritas (tests/ensure-risk-gate-hook.test.mjs) supaya kalau example berubah, nilai di
// sini ikut diperbarui (anti-drift). command relatif '.claude-kit/...' = sama seperti contoh + docs;
// Claude Code menjalankan hook dari akar project, jadi path relatif benar.
export const RISK_GATE_MATCHER = 'Bash|Edit|Write|MultiEdit'
export const RISK_GATE_HOOK_COMMAND = 'node .claude-kit/lib/risk-gate.js'
const RISK_GATE_MARKER = 'risk-gate.js' // penanda idempoten = substring command

export function buildRiskGateHookGroup() {
  return { matcher: RISK_GATE_MATCHER, hooks: [{ type: 'command', command: RISK_GATE_HOOK_COMMAND }] }
}

// Apakah settings sudah memuat hook risk-gate? Cek SEMUA grup PreToolUse (toleran bentuk).
export function hasRiskGateHook(settings) {
  const pre = settings && settings.hooks && settings.hooks.PreToolUse
  if (!Array.isArray(pre)) return false
  for (const group of pre) {
    const hooks = group && group.hooks
    if (!Array.isArray(hooks)) continue
    for (const h of hooks) {
      if (h && typeof h.command === 'string' && h.command.includes(RISK_GATE_MARKER)) return true
    }
  }
  return false
}

// Gabung hook risk-gate ke objek settings TANPA memutasi sumber. Return { settings, changed }.
// Pertahankan SEMUA hook/kunci lain. Idempoten (sudah ada -> changed:false, objek asli dikembalikan).
export function mergeRiskGateHook(settings) {
  const base = (settings && typeof settings === 'object' && !Array.isArray(settings)) ? settings : {}
  if (hasRiskGateHook(base)) return { settings: base, changed: false }
  const next = { ...base }
  const hooks = { ...(base.hooks && typeof base.hooks === 'object' && !Array.isArray(base.hooks) ? base.hooks : {}) }
  const pre = Array.isArray(hooks.PreToolUse) ? hooks.PreToolUse.slice() : []
  pre.push(buildRiskGateHookGroup())
  hooks.PreToolUse = pre
  next.hooks = hooks
  return { settings: next, changed: true }
}

function writeJsonAtomic(filePath, obj) {
  const tmp = `${filePath}.tmp-${process.pid}`
  fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`, 'utf8')
  fs.renameSync(tmp, filePath)
}

// Pasang hook risk-gate ke .claude/settings.json project. Return { changed, reason }. FAIL-SAFE.
export function ensureRiskGateHook(projectRoot, { dryRun = false } = {}) {
  const settingsDir = path.join(projectRoot, '.claude')
  const settingsPath = path.join(settingsDir, 'settings.json')
  const fileExists = fs.existsSync(settingsPath)
  let existing = null
  try {
    existing = readJsonFileSafely(settingsPath, { suppressMalformedError: true, suppressLockError: true })
  } catch {
    return { changed: false, reason: 'baca-gagal' }
  }
  // null + file ADA = rusak/terkunci -> JANGAN tulis (jangan timpa pengaturan kustom klien).
  if (existing === null && fileExists) {
    return { changed: false, reason: 'settings-rusak-atau-terkunci' }
  }
  const { settings, changed } = mergeRiskGateHook(existing || {})
  if (!changed) return { changed: false, reason: 'sudah-ada' }
  if (dryRun) return { changed: true, reason: 'simulasi' }
  if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true })
  writeJsonAtomic(settingsPath, settings)
  return { changed: true, reason: fileExists ? 'digabung' : 'dibuat' }
}

// --- CLI: `node lib/ensure-risk-gate-hook.mjs [--project-root <dir>] [--dry-run]` ---
function main() {
  let projectRoot = process.cwd()
  let dryRun = false
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project-root') projectRoot = argv[++i] || projectRoot
    else if (argv[i] === '--dry-run' || argv[i] === '--simulasi') dryRun = true
  }

  const res = ensureRiskGateHook(projectRoot, { dryRun })
  switch (res.reason) {
    case 'sudah-ada':
      console.log('OK - Palang Rem risk-gate SUDAH nyala di .claude/settings.json (tak ada perubahan).')
      break
    case 'simulasi':
      console.log('SIMULASI - Palang Rem AKAN dinyalakan (belum menulis apa pun). Jalankan tanpa --dry-run untuk benar-benar pasang.')
      break
    case 'dibuat':
    case 'digabung':
      console.log('OK - Palang Rem risk-gate DINYALAKAN di .claude/settings.json (pengaturan lain tetap utuh).')
      console.log('LANGKAH WAJIB: buka chat BARU (hook dimuat saat sesi mulai), lalu uji-jalan - lihat docs/risk-gate.md langkah 4.')
      console.log('Matikan kapan saja: hapus blok PreToolUse risk-gate dari .claude/settings.json.')
      break
    case 'settings-rusak-atau-terkunci':
      console.error('[LEWATI] .claude/settings.json ada tapi rusak/terkunci - TIDAK diubah (jaga pengaturanmu).')
      console.error('  Tutup editor (mis. VS Code) yang mengunci berkas, atau perbaiki JSON-nya, lalu ulang.')
      process.exit(1)
      break
    default:
      console.error(`[GAGAL] Tidak bisa menyalakan Palang Rem (alasan: ${res.reason}).`)
      process.exit(1)
  }
  process.exit(0)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
