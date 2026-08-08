#!/usr/bin/env node
// install-windows.mjs - Installer paket Claude config global untuk Windows (versi Node).
//
// Padanan install-windows.ps1. Menyalin berkas paket (aturan global + template) ke
// %USERPROFILE%\.claude\ dengan backup otomatis bila berkas tujuan sudah ada
// (format .backup-yyyyMMdd-HHmmss). CLAUDE_universal_v1.md di-RENAME jadi CLAUDE.md saat install.
//
// ===========================================================================================
// STATUS MIGRASI (Gelombang 6, ADR-003/ADR-004) - SUDAH CUTOVER:
//   File ini = JALUR AKTIF untuk `npx lintasai install-windows`. Dispatcher bin/lintasai.js
//   memetakan 'install-windows' -> install-windows.mjs di COMMANDS_NODE. install-windows.ps1
//   tetap terbit sebagai CADANGAN manual bila versi Node bermasalah. install-windows TIDAK ada
//   di shouldPassProjectRoot (target = %USERPROFILE%\.claude, BUKAN project) -> dispatcher tak
//   menyuntik --project-root.
//
// KESETIAAN (parity dgn versi PS):
//   - Salin MENTAH byte-identik via fs.copyFileSync (cermin Copy-Item; versi PS TIDAK menormalkan
//     encoding -> jangan pakai helper template-deploy yang strip-BOM/re-encode).
//   - Sumber = folder paket tempat skrip ini berada (cermin $PSScriptRoot). Di npm, ini = folder
//     paket (tanpa node_modules) -> cepat.
//   - Target = (process.env.USERPROFILE || os.homedir()) + '\.claude' (cermin $env:USERPROFILE).
//   - Backup nama .backup-<timestamp>, ringkasan, + Mark-of-the-Web unblock = identik.
//
// SIFAT NON-INTERAKTIF (ADR-004): versi Node TIDAK menampilkan prompt/popup. Bila ada berkas
//   tujuan yang sudah ada + TANPA --force -> BERHENTI AMAN (default tidak menimpa); untuk menimpa
//   (dgn backup otomatis) WAJIB beri --force. Install FRESH (belum ada berkas) jalan tanpa --force.
//   Ini cermin cabang non-interaktif install-windows.ps1 (default aman 'N') + selaras uninstall.mjs.
//
// MARK-OF-THE-WEB: removeMotwBlock kini NODE MURNI (migrasi PS->Node 2026-06-25 - hapus stream
//   <file>:Zone.Identifier via fs.rmSync, tanpa PowerShell). Best-effort: gagal -> lanjut. Dilewati saat --dry-run atau bila
//   env LINTASAI_SKIP_MOTW di-set (katup untuk CI/tes supaya tak memindai folder besar - cermin
//   katup LINTASAI_FORCE_WINPS). Di jalur npm berkas umumnya tak ber-MOTW -> langkah ini no-op.
// ===========================================================================================
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { removeMotwBlock } from './lib/git-helpers.mjs'
import { backupStamp } from './lib/fs-text.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---- Penguraian argumen (gaya Node, double-dash) - cermin param install-windows.ps1 ----
export function parseArgs(argv) {
  const a = { dryRun: false, force: false }
  for (let i = 0; i < argv.length; i++) {
    const t = String(argv[i]).toLowerCase()
    if (t === '--dry-run' || t === '--dryrun' || t === '--simulasi') a.dryRun = true
    else if (t === '--force') a.force = true
  }
  return a
}

// Mapping berkas sumber -> tujuan. `src` relatif ke folder paket (garis-miring-depan). `dst` =
// segmen relatif ke ClaudeDir. Diekspor untuk uji-banding dgn $mapping install-windows.ps1.
// Catatan: CLAUDE_universal_v1.md di-RENAME jadi CLAUDE.md saat di-install.
export const MAPPING = [
  { src: 'CLAUDE_universal_v1.md', dst: ['CLAUDE.md'] },
  { src: 'LINTASAI_WORKFLOWS_v1.md', dst: ['LINTASAI_WORKFLOWS_v1.md'] },
  { src: 'PROJECT_LIFECYCLE_PROMPT_v1.md', dst: ['PROJECT_LIFECYCLE_PROMPT_v1.md'] },
  { src: 'TEAM_ROLLOUT_GUIDE_v1.md', dst: ['TEAM_ROLLOUT_GUIDE_v1.md'] },
  { src: 'templates/architecture.md', dst: ['templates', 'architecture.md'] },
  { src: 'templates/glossary.md', dst: ['templates', 'glossary.md'] },
  { src: 'templates/_PATTERNS.md', dst: ['templates', '_PATTERNS.md'] },
  { src: 'templates/_EXAMPLE.md', dst: ['templates', '_EXAMPLE.md'] },
  { src: 'templates/architecture_auto.md', dst: ['templates', 'architecture_auto.md'] },
]

// Cap-waktu cadangan 'yyyyMMdd-HHmmss' -> backupStamp (sumber bersama lib/fs-text.mjs).

function isTruthyEnv(v) { return !!(v && v !== '0' && String(v).toLowerCase() !== 'false') }

export function runInstallWindows(argv, { now = null } = {}) {
  const args = parseArgs(argv)

  // ---- Konfigurasi dasar ----
  const claudeDir = path.join(process.env.USERPROFILE || os.homedir(), '.claude')
  const templatesDir = path.join(claudeDir, 'templates')
  const timestamp = backupStamp(now || new Date())
  const scriptDir = __dirname

  let okCount = 0
  let bakCount = 0
  let missCount = 0

  console.log('')
  console.log('=== Installer paket Claude (Windows) ===')
  console.log(`Sumber : ${scriptDir}`)
  console.log(`Target : ${claudeDir}`)
  if (args.dryRun) console.log('Mode   : SIMULASI (tidak ada file yang benar-benar disalin)')
  console.log('')

  // ---- Pastikan folder tujuan ada ----
  const confirmDirectory = (p) => {
    if (fs.existsSync(p)) return true
    if (args.dryRun) {
      console.log(`[DRY] Akan dibuat folder: ${p}`)
      return true
    }
    try {
      fs.mkdirSync(p, { recursive: true })
      console.log(`DIBUAT    ${p}`)
      return true
    } catch (e) {
      console.error(`GAGAL bikin folder ${p} : ${e.message}`)
      console.error(`       Cek permission write ke ${process.env.USERPROFILE || os.homedir()}.`)
      return false
    }
  }
  if (!confirmDirectory(claudeDir)) return 1
  if (!confirmDirectory(templatesDir)) return 1

  // ---- Mark-of-the-Web unblock (cegah error 'script tidak digital signed' setelah download) ----
  if (!args.dryRun) {
    if (isTruthyEnv(process.env.LINTASAI_SKIP_MOTW)) {
      console.log('INFO  Buka-kunci Mark-of-the-Web dilewati (LINTASAI_SKIP_MOTW).')
    } else if (removeMotwBlock(scriptDir)) {
      console.log('OK    Mark-of-the-Web di-unblock untuk file di folder paket.')
    } else {
      console.log('PERINGATAN: Unblock-File gagal (script tetap lanjut).')
    }
  }

  // ---- Konfirmasi sekali di awal kalau ada existing file (non-interaktif: butuh --force) ----
  if (!args.force && !args.dryRun) {
    const existing = MAPPING
      .map((m) => path.join(claudeDir, ...m.dst))
      .filter((dst) => fs.existsSync(dst))
    if (existing.length > 0) {
      console.log(`PERHATIAN: ${existing.length} file tujuan sudah ada dan akan ditimpa.`)
      console.log(`          Backup otomatis dibuat dengan akhiran .backup-${timestamp}`)
      for (const e of existing) console.log(`          - ${e}`)
      console.log('')
      // ADR-004: versi Node non-interaktif -> tidak ada prompt. Default AMAN = tidak menimpa.
      console.log('INFO: Ada berkas yang sudah ada + sesi non-interaktif. Install tidak dilanjutkan (default aman).')
      console.log('      Pakai --force kalau memang mau timpa (berkas lama otomatis di-backup), lalu jalankan ulang.')
      console.log('Dibatalkan. Tidak ada file yang diubah.')
      return 0
    }
  }

  for (const m of MAPPING) {
    const srcPath = path.join(scriptDir, ...m.src.split('/'))
    const dstPath = path.join(claudeDir, ...m.dst)
    const label = m.src.split('/').join(path.sep)

    // Source hilang -> tandai MISSING
    if (!fs.existsSync(srcPath)) {
      console.error(`MISSING   ${label}  (tidak ditemukan di folder paket)`)
      missCount++
      continue
    }

    // Dry-run: cuma log rencana
    if (args.dryRun) {
      if (fs.existsSync(dstPath)) {
        console.log(`[DRY] BACKUP  ${dstPath}  ->  ${dstPath}.backup-${timestamp}`)
        console.log(`[DRY] INSTALL ${label}  ->  ${dstPath}`)
      } else {
        console.log(`[DRY] INSTALL ${label}  ->  ${dstPath}`)
      }
      continue
    }

    // Destination sudah ada -> backup dulu (pakai .backup-<ts>, bukan .bak)
    if (fs.existsSync(dstPath)) {
      const bakPath = `${dstPath}.backup-${timestamp}`
      try {
        fs.copyFileSync(dstPath, bakPath)
        console.log(`BACKUP    ${dstPath}  ->  ${bakPath}`)
        bakCount++
      } catch (e) {
        console.error(`GAGAL backup ${dstPath} -> ${bakPath} : ${e.message}`)
        missCount++
        continue
      }
    }

    // Copy source ke destination (overwrite kalau perlu)
    try {
      fs.copyFileSync(srcPath, dstPath)
      console.log(`OK        ${label}  ->  ${dstPath}`)
      okCount++
    } catch (e) {
      console.error(`GAGAL copy ${label} : ${e.message}`)
      missCount++
    }
  }

  // ---- Ringkasan & panduan ----
  console.log('')
  console.log('=== Ringkasan ===')
  if (args.dryRun) {
    console.log('Mode SIMULASI: tidak ada file yang benar-benar disalin.')
    console.log('Jalankan ulang tanpa --dry-run untuk eksekusi sungguhan.')
    console.log('')
    return 0
  }

  const totalSrc = MAPPING.length
  console.log(`Total file di paket : ${totalSrc}`)
  console.log(`Ter-install         : ${okCount}`)
  console.log(`Di-backup (timpa)   : ${bakCount}`)
  console.log(`Missing/error       : ${missCount}`)
  console.log('')

  console.log('Langkah berikutnya:')
  console.log(`  1. Buka folder ${claudeDir} untuk memastikan file ter-install.`)
  console.log(`  2. File backup berakhiran .backup-${timestamp} adalah salinan file lama;`)
  console.log('     hapus kalau sudah yakin install ini OK.')
  console.log('  3. Buka project pakai Claude Code -> CLAUDE.md akan otomatis ter-load.')
  console.log(`     Verifikasi dengan buka langsung file ${path.join(claudeDir, 'CLAUDE.md')},`)
  console.log("     atau tanya AI: 'Kamu baca aturan global dari file apa?'")
  console.log('  4. Baca README untuk cara pakai PROJECT_LIFECYCLE_PROMPT_v1.md')
  console.log('     (Stage 1 (Proyek Baru): Kickoff / Stage 2 (Bikin Catatan Proyek): Bootstrap Docs / Stage 3 (Perbarui Catatan): Update Docs / Stage 4 (Rapikan ke Standar Tim): Migration).')
  console.log('')

  if (missCount > 0) {
    console.error(`PERINGATAN: ${okCount} file ter-install, ${missCount} file gagal/missing.`)
    console.error('           Install partial -- cek pesan MISSING/GAGAL di atas,')
    console.error('           lalu jalankan ulang setelah file lengkap.')
    return 1
  }

  console.log('Selesai. Selamat ngoding!')
  return 0
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  process.exitCode = runInstallWindows(process.argv.slice(2))
}
