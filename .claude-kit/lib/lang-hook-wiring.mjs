#!/usr/bin/env node
// lib/lang-hook-wiring.mjs - Pasang hook "pengingat Bahasa Indonesia" ke .claude/settings.json KLIEN.
//
// KENAPA ADA: lib/lang-reminder.mjs (pengingat bahasa) ikut tersalin ke project klien (.claude-kit/lib/),
// TAPI sebuah hook hanya AKTIF kalau terdaftar di .claude/settings.json. Tanpa wiring ini, berkas
// pengingat ADA di klien tapi TAK PERNAH TERPANGGIL -> fitur "rem-mesin bahasa" cuma nyala di repo kit,
// tak sampai ke klien. Modul ini menggabungkan hook itu ke settings.json klien saat init/update.
//
// SIFAT (sengaja):
//  - IDEMPOTEN: kalau hook lang-reminder sudah ada -> tak menambah lagi (changed:false).
//  - DEFENSIF (jangan rusak settings klien): pertahankan SEMUA hook/kunci lain; kalau settings.json
//    klien RUSAK/terkunci -> JANGAN tulis (lapor + lewati; pemasangan tetap sukses) - cegah hapus
//    kunci kustom mereka (permissions.deny / env / apiKeyHelper).
//  - NON-MEMAKSA: hook lang-reminder selalu exit 0 (tak pernah blokir) -> aman dinyalakan otomatis
//    (beda dari risk-gate yang OPT-IN karena ia MEMAKSA konfirmasi).
//  - TULIS ATOMIK: temp + rename, supaya tak ada settings.json setengah-tertulis kalau proses mati.
//
// Dijalankan dari setup-pola-b.mjs (init) -> otomatis ikut saat UPDATE juga (update-kit menjalankan
// ulang setup-pola-b --force). Satu titik wiring = cakupan install + update.
import fs from 'node:fs'
import path from 'node:path'
import { readJsonFileSafely } from './json-merge-helpers.mjs'

// Command yang dijalankan klien. Berkas kit terpasang di .claude-kit/ -> tunjuk ke sana. $CLAUDE_PROJECT_DIR
// di-expand Claude Code (robust, tak bergantung folder-kerja). Penanda idempoten = substring 'lang-reminder.mjs'.
export const LANG_HOOK_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.claude-kit/lib/lang-reminder.mjs"'
const LANG_HOOK_MARKER = 'lang-reminder.mjs'

export function buildLangHookGroup() {
  return { matcher: '', hooks: [{ type: 'command', command: LANG_HOOK_COMMAND, timeout: 15 }] }
}

// Apakah settings sudah memuat hook lang-reminder? Cek SEMUA grup UserPromptSubmit (toleran bentuk).
export function hasLangHook(settings) {
  const ups = settings && settings.hooks && settings.hooks.UserPromptSubmit
  if (!Array.isArray(ups)) return false
  for (const group of ups) {
    const hooks = group && group.hooks
    if (!Array.isArray(hooks)) continue
    for (const h of hooks) {
      if (h && typeof h.command === 'string' && h.command.includes(LANG_HOOK_MARKER)) return true
    }
  }
  return false
}

// Gabung hook lang-reminder ke objek settings TANPA memutasi sumber. Return { settings, changed }.
// Pertahankan SEMUA hook/kunci lain. Idempoten (sudah ada -> changed:false, objek asli dikembalikan).
export function mergeLangHook(settings) {
  const base = (settings && typeof settings === 'object' && !Array.isArray(settings)) ? settings : {}
  if (hasLangHook(base)) return { settings: base, changed: false }
  const next = { ...base }
  const hooks = { ...(base.hooks && typeof base.hooks === 'object' && !Array.isArray(base.hooks) ? base.hooks : {}) }
  const ups = Array.isArray(hooks.UserPromptSubmit) ? hooks.UserPromptSubmit.slice() : []
  ups.push(buildLangHookGroup())
  hooks.UserPromptSubmit = ups
  next.hooks = hooks
  return { settings: next, changed: true }
}

function writeJsonAtomic(filePath, obj) {
  const tmp = `${filePath}.tmp-${process.pid}`
  fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`, 'utf8')
  fs.renameSync(tmp, filePath)
}

// Pasang hook ke .claude/settings.json project. Return { changed, reason }. FAIL-SAFE.
export function ensureLangHook(projectRoot, { dryRun = false } = {}) {
  const settingsDir = path.join(projectRoot, '.claude')
  const settingsPath = path.join(settingsDir, 'settings.json')
  const fileExists = fs.existsSync(settingsPath)
  let existing = null
  try {
    existing = readJsonFileSafely(settingsPath, { suppressMalformedError: true, suppressLockError: true })
  } catch {
    return { changed: false, reason: 'baca-gagal' }
  }
  // readJsonFileSafely -> null kalau tak ada ATAU rusak/terkunci (dengan suppress). Kalau file ADA tapi
  // null = rusak/terkunci -> JANGAN tulis (fail-safe: jangan timpa/rusak pengaturan kustom klien).
  if (existing === null && fileExists) {
    return { changed: false, reason: 'settings-rusak-atau-terkunci' }
  }
  const { settings, changed } = mergeLangHook(existing || {})
  if (!changed) return { changed: false, reason: 'sudah-ada' }
  if (dryRun) return { changed: true, reason: 'simulasi' }
  if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true })
  writeJsonAtomic(settingsPath, settings)
  return { changed: true, reason: fileExists ? 'digabung' : 'dibuat' }
}
