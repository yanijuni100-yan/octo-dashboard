#!/usr/bin/env node
// lib/parity-check.mjs - Alat banding Node vs PowerShell (detektor lapangan, migrasi PS->Node 2026-06-25).
//
// MASALAH yang dipecahkan: setelah migrasi PS->Node, sulit tahu kalau logika Node diam-diam memberi
// hasil BERBEDA dari PowerShell di mesin client tertentu (kasus "kelihatan jalan, tapi hasil salah").
// Tes kita jalan di mesin KITA, bukan mesin client. Alat ini = "2 kasir menghitung uang yang sama":
// untuk tiap pemeriksaan, jalankan jalur Node DAN jalur PowerShell pada input yang SAMA, lalu bandingkan.
// Kalau beda -> langsung ketahuan, TANPA manusia perlu tahu jawaban benarnya.
//
// SIFAT (penting):
//   - CUMA-BACA: tak mengubah berkas apa pun. Aman dijalankan kapan saja di mesin client.
//   - BUTUH PowerShell hadir (untuk sisi pembanding). Kalau PowerShell tak terpasang -> lapor
//     "tak bisa banding" (BUKAN kegagalan) -> client andalkan jalur lain (rilis bertahap/canary).
//   - Alat transisi: berguna SELAMA PowerShell masih ada sebagai cadangan. Saat .ps1 dihapus
//     (bersih-total, ADR-005), alat ini ikut pensiun (tak ada lagi yang dibandingkan).
//
// Kode-keluar (exit code) = jumlah pemeriksaan yang BEDA (0 = semua cocok = Node sehat di mesin ini).
// Dipakai: `npx lintasai parity-check` (lihat bin/lintasai.js).
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolvePowerShellExe } from './popup-shim.mjs'
import { invokeLintasConsistencyCheckKit } from './consistency-check.mjs'
import { testReparseNode, testReparsePowerShell } from './reparse-guard.mjs'

const SPAWN_TIMEOUT_MS = 300000

// Folder kit (induk dari lib/ tempat berkas ini berada). Di client = .claude-kit.
function resolveKitDir() {
  return path.dirname(path.dirname(fileURLToPath(import.meta.url)))
}

// Spawn PowerShell cuma-baca (selalu -NoProfile -NonInteractive -ExecutionPolicy Bypass, cermin shim lain).
// Return { spawned, code, stdout, stderr }. spawned=false kalau PowerShell tak bisa dijalankan sama sekali.
function runPs(psExe, args) {
  const r = spawnSync(psExe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args], {
    encoding: 'utf8', timeout: SPAWN_TIMEOUT_MS, windowsHide: true,
  })
  if (r.error) return { spawned: false, code: null, stdout: '', stderr: r.error.message }
  return { spawned: true, code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' }
}

// Spawn Node anak (perintah kit) cuma untuk ambil kode-keluar. Return { code }.
function runNode(scriptPath, args) {
  const r = spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8', timeout: SPAWN_TIMEOUT_MS, windowsHide: true,
  })
  return { code: r.error ? null : r.status }
}

// --- Pemeriksaan 1: Robot kecocokan versi (MODE KIT) ---
// Node invokeLintasConsistencyCheckKit.MismatchCount vs PS consistency-check.ps1 (exit = MismatchCount).
// Ini mencakup logika versi + buku-fakta + istilah-pensiun sekaligus.
function checkConsistency(kitDir, psExe) {
  const name = 'Robot kecocokan versi (MODE KIT)'
  let nodeVal
  try { nodeVal = invokeLintasConsistencyCheckKit(kitDir, { quiet: true }).MismatchCount } catch (e) {
    return { name, available: true, node: `ERROR: ${e.message}`, ps: '-', match: false, note: 'Jalur Node melempar - perlu diperiksa.' }
  }
  const ccPs1 = path.join(kitDir, 'lib', 'consistency-check.ps1')
  if (!fs.existsSync(ccPs1)) return { name, available: false, node: nodeVal, ps: '-', note: 'lib/consistency-check.ps1 tak ada (cadangan PS sudah dihapus?)' }
  const r = runPs(psExe, ['-File', ccPs1, '-RepoRoot', kitDir, '-Quiet'])
  if (!r.spawned) return { name, available: false, node: nodeVal, ps: '-', note: 'PowerShell tak bisa dijalankan.' }
  const psVal = r.code
  return { name, available: true, node: nodeVal, ps: psVal, match: nodeVal === psVal, note: nodeVal === psVal ? '' : 'Jumlah ketakcocokan BERBEDA Node vs PowerShell!' }
}

// --- Pemeriksaan 2: Doctor (integritas kit) ---
// Node kit.mjs doctor (exit) vs PS kit.ps1 doctor (exit). Banding kode-keluar (0=sehat, !=0=ada masalah).
function checkDoctor(kitDir, projectRoot, psExe) {
  const name = 'Doctor (integritas kit)'
  const kitMjs = path.join(kitDir, 'kit.mjs')
  const kitPs1 = path.join(kitDir, 'kit.ps1')
  if (!fs.existsSync(kitMjs)) return { name, available: false, node: '-', ps: '-', note: 'kit.mjs tak ada.' }
  const nodeVal = runNode(kitMjs, ['doctor', '--project-root', projectRoot]).code
  if (!fs.existsSync(kitPs1)) return { name, available: false, node: nodeVal, ps: '-', note: 'kit.ps1 tak ada (cadangan PS sudah dihapus?)' }
  const r = runPs(psExe, ['-File', kitPs1, 'doctor', '-ProjectRoot', projectRoot])
  if (!r.spawned) return { name, available: false, node: nodeVal, ps: '-', note: 'PowerShell tak bisa dijalankan.' }
  const psVal = r.code
  return { name, available: true, node: nodeVal, ps: psVal, match: nodeVal === psVal, note: nodeVal === psVal ? '' : 'Kode-keluar doctor BERBEDA Node vs PowerShell!' }
}

// --- Pemeriksaan 3: Penjaga junction/symlink (keamanan) ---
// testReparseNode vs testReparsePowerShell pada beberapa berkas NYATA di kit (cuma-baca). Banding Map.
function checkReparse(kitDir, psExe) {
  const name = 'Penjaga junction/symlink (keamanan)'
  // Ambil sampel berkas nyata milik kit (deterministik, cuma-baca).
  const candidates = ['package.json', 'kit.mjs', path.join('lib', 'safety.ps1'), path.join('lib', 'parity-check.mjs')]
  const samplePaths = candidates.map((c) => path.join(kitDir, c)).filter((p) => fs.existsSync(p))
  if (samplePaths.length === 0) return { name, available: false, node: '-', ps: '-', note: 'Tak ada berkas sampel di kit.' }
  let nodeMap
  try { nodeMap = testReparseNode(samplePaths, kitDir) } catch (e) {
    return { name, available: true, node: `ERROR: ${e.message}`, ps: '-', match: false, note: 'Jalur Node melempar - perlu diperiksa.' }
  }
  const safetyPs = path.join(kitDir, 'lib', 'safety.ps1')
  if (!fs.existsSync(safetyPs)) return { name, available: false, node: 'OK', ps: '-', note: 'lib/safety.ps1 tak ada (cadangan PS sudah dihapus?)' }
  let psMap
  try { psMap = testReparsePowerShell(samplePaths, kitDir, kitDir) } catch (e) {
    // PS gagal jalan (mis. PowerShell tak ada) -> tak bisa banding (bukan kegagalan Node).
    return { name, available: false, node: 'OK', ps: '-', note: `Tak bisa jalankan sisi PowerShell: ${e.message}` }
  }
  // Banding tiap path.
  const diffs = []
  for (const p of samplePaths) {
    const n = nodeMap.get(p)
    const s = psMap.get(p)
    if (n !== s) diffs.push(`${path.basename(p)} (Node=${n} PS=${s})`)
  }
  const match = diffs.length === 0
  return {
    name, available: true,
    node: `${samplePaths.length} path`, ps: `${samplePaths.length} path`,
    match, note: match ? '' : `BEDA di: ${diffs.join(', ')}`,
  }
}

export function runParityCheck({ kitDir, projectRoot } = {}) {
  const kd = kitDir || resolveKitDir()
  const pr = projectRoot || process.cwd()
  const psExe = resolvePowerShellExe()

  const results = [
    checkConsistency(kd, psExe),
    checkDoctor(kd, pr, psExe),
    checkReparse(kd, psExe),
  ]

  const compared = results.filter((r) => r.available !== false)
  const mismatches = compared.filter((r) => r.match === false)
  const skipped = results.filter((r) => r.available === false)

  return { kitDir: kd, projectRoot: pr, results, mismatchCount: mismatches.length, comparedCount: compared.length, skippedCount: skipped.length }
}

// Cetak laporan banding (nama unik 'printParityReport' - hindari tabrakan dgn printReport di split-guard/preflight).
function printParityReport(rep) {
  console.log('')
  console.log('=== lintasAI parity-check - banding Node vs PowerShell (cuma-baca) ===')
  console.log(`Kit: ${rep.kitDir}`)
  console.log('-'.repeat(64))
  for (const r of rep.results) {
    if (r.available === false) {
      console.log(`  [LEWATI]    ${r.name}`)
      if (r.note) console.log(`              ${r.note}`)
    } else if (r.match) {
      console.log(`  [COCOK]     ${r.name}  (Node=${r.node} == PS=${r.ps})`)
    } else {
      console.log(`  [BEDA]      ${r.name}  (Node=${r.node} vs PS=${r.ps})`)
      if (r.note) console.log(`              ${r.note}`)
    }
  }
  console.log('-'.repeat(64))
  if (rep.comparedCount === 0) {
    console.log('Tidak ada yang bisa dibandingkan (PowerShell tak terpasang / cadangan .ps1 sudah dihapus).')
    console.log('Andalkan cara lain: rilis bertahap (canary) + tes + laporan staff.')
  } else if (rep.mismatchCount === 0) {
    console.log(`COCOK: ${rep.comparedCount} pemeriksaan -> Node memberi hasil SAMA dengan PowerShell di mesin ini.`)
  } else {
    console.log(`${rep.mismatchCount} pemeriksaan BERBEDA - logika Node mungkin tak setara PowerShell di mesin ini. Laporkan ke tim teknis (sertakan tampilan di atas).`)
  }
  if (rep.skippedCount > 0 && rep.comparedCount > 0) console.log(`(${rep.skippedCount} pemeriksaan dilewati - lihat catatan di atas.)`)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = process.argv.slice(2)
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 && i + 1 < args.length ? args[i + 1] : null }
  const projectRoot = get('--project-root') || process.cwd()
  const rep = runParityCheck({ projectRoot })
  printParityReport(rep)
  // Exit = jumlah BEDA (0 = sehat). PowerShell-tak-ada (comparedCount 0) -> exit 0 (bukan kegagalan).
  process.exit(rep.mismatchCount)
}
