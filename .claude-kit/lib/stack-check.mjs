#!/usr/bin/env node
// lib/stack-check.mjs - "Robot pemeriksa mutu kode per-bahasa" (versi Node). Padanan lib/stack-check.ps1.
//
// Apa ini: auto-deteksi bahasa sebuah gudang kode, lalu MENJALANKAN alat-cek STATIS standar bahasa itu
// (tsc/eslint/npm-audit, ruff/mypy/bandit, go vet/staticcheck/govulncheck, cargo clippy/fmt, phpstan/pint)
// dan menyerahkan hasil mentahnya ke AI untuk diterjemahkan ke bahasa awam. ROBOT kasih FAKTA (alat apa
// jalan, kode-keluar, cuplikan), AI kasih MAKNA. Sama batas-jujur dengan PS:
//   1. CUMA alat STATIS baca-saja (TIDAK menjalankan tes -- tes = eksekusi kode project).
//   2. TIDAK auto-perbaiki (mode "cek", tanpa --fix).
//   3. CONFIG-GATED (alat hanya jalan kalau config-nya ADA -> anti alarm-palsu).
//   4. Alat belum terpasang -> "DILEWATI", BUKAN diam-diam "0 masalah" (sec. 6.3 #4).
//   5. ANTI-INJEKSI: daftar perintah = KONSTANTA (whitelist); satu-satunya input dari project = JENIS
//      bahasa (dari nama berkas penanda). Tak ada perintah dirakit dari isi project.
//   6. Menjalankan toolchain project tetap memuat config project -> jalankan hanya di repo TEPERCAYA.
// Robot SENGAJA tak pernah GENTING (semua temuan alat = PENTING); AI yang menaikkan ke GENTING kalau soal
// keamanan -> gerbang (sec. 4.6) tak pernah hard-fail dari robot ini (mutu kode = saran owner-gated).
//
// CATATAN PORT (Gelombang 2, ADR-004): logika murni (daftar alat, config-gate, klasifikasi hasil,
// orkestrasi) di-port + diuji-banding deterministik vs PS. Reuse getStackType dari project-detect.mjs
// (sec.5, jangan duplikasi). Bagian "jalankan alat" pakai child_process.spawnSync (padanan
// System.Diagnostics.Process di PS; sama-sama batas-waktu + tangkap kode-keluar + stdout/stderr).
// stack-check.ps1 TETAP HIDUP berdampingan (pemanggil masih PowerShell sampai orkestrator pindah Gel-4).
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { getStackType } from './project-detect.mjs'

// ---- Spesifikasi alat-cek per bahasa (KONSTANTA - whitelist, tak dirakit dari project) ----
// requiresAny = config-gate: alat hanya dipertimbangkan kalau SALAH SATU berkas ini ADA di akar gudang.
// args = mode "cek/baca-saja" (TANPA --fix). category cuma untuk pesan.
const STACK_SPECS = {
  node: [
    { lang: 'node', tool: 'tsc', args: ['--noEmit'], category: 'type', why: 'Cek tipe TypeScript (tanpa hasilkan berkas)', requiresAny: ['tsconfig.json'] },
    { lang: 'node', tool: 'eslint', args: ['.'], category: 'lint', why: 'Cek gaya + bug umum (tanpa --fix)', requiresAny: ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml'] },
    { lang: 'node', tool: 'npm', args: ['audit'], category: 'security', why: 'Cek library rentan (CVE)', requiresAny: ['package-lock.json'] },
  ],
  python: [
    { lang: 'python', tool: 'ruff', args: ['check', '.'], category: 'lint', why: 'Cek gaya + bug umum Python', requiresAny: ['pyproject.toml', 'ruff.toml', '.ruff.toml', 'requirements.txt', 'Pipfile', 'setup.py', 'setup.cfg'] },
    { lang: 'python', tool: 'mypy', args: ['.'], category: 'type', why: 'Cek tipe Python', requiresAny: ['pyproject.toml', 'mypy.ini', '.mypy.ini', 'setup.cfg', 'requirements.txt'] },
    { lang: 'python', tool: 'bandit', args: ['-r', '.', '-q'], category: 'security', why: 'Cek keamanan statis Python', requiresAny: ['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile'] },
  ],
  go: [
    { lang: 'go', tool: 'go', args: ['vet', './...'], category: 'lint', why: 'Cek kesalahan umum Go', requiresAny: ['go.mod'] },
    { lang: 'go', tool: 'staticcheck', args: ['./...'], category: 'lint', why: 'Analisa statis Go mendalam', requiresAny: ['go.mod'] },
    { lang: 'go', tool: 'govulncheck', args: ['./...'], category: 'security', why: 'Cek dependency rentan (CVE) Go', requiresAny: ['go.mod'] },
  ],
  rust: [
    { lang: 'rust', tool: 'cargo', args: ['clippy', '--', '-D', 'warnings'], category: 'lint', why: 'Cek gaya + bug Rust (clippy)', requiresAny: ['Cargo.toml'] },
    { lang: 'rust', tool: 'cargo', args: ['fmt', '--check'], category: 'lint', why: 'Cek format Rust (tanpa menulis)', requiresAny: ['Cargo.toml'] },
  ],
  php: [
    { lang: 'php', tool: 'phpstan', args: ['analyse', '--no-progress'], category: 'lint', why: 'Analisa statis PHP', requiresAny: ['phpstan.neon', 'phpstan.neon.dist', 'phpstan.dist.neon', 'composer.json'] },
    { lang: 'php', tool: 'pint', args: ['--test'], category: 'lint', why: 'Cek format Laravel Pint (tanpa menulis)', requiresAny: ['pint.json', 'composer.json'] },
  ],
}

// Daftar spesifikasi alat-cek untuk sebuah jenis stack. Stack tak dikenal -> [].
// Kembalikan SALINAN (deep-ish) supaya pemanggil tak mengubah konstanta.
export function getLintasStackToolSpec(stack) {
  const specs = STACK_SPECS[stack]
  if (!specs) return []
  return specs.map((s) => ({ ...s, args: [...s.args], requiresAny: [...s.requiresAny] }))
}

// Config-gate: apakah SALAH SATU berkas requiresAny ADA (sebagai berkas) di akar gudang. (Murni)
export function testLintasStackConfigured(root, spec) {
  for (const req of spec.requiresAny) {
    const p = path.join(root, req)
    try { if (fs.statSync(p).isFile()) return true } catch { /* lanjut */ }
  }
  return false
}

// Cari `tool` di PATH (+ PATHEXT di Windows). Kembalikan { path, isBatch } atau null.
// Cermin Get-Command PS untuk executable eksternal (tool whitelist = .exe/.cmd di PATH).
function resolveCommand(tool) {
  const isWin = process.platform === 'win32'
  const pathVar = process.env.PATH || process.env.Path || ''
  const dirs = pathVar.split(isWin ? ';' : ':').filter(Boolean)
  const exts = isWin ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : ['']
  const hasExt = isWin && path.extname(tool) !== ''
  for (const dir of dirs) {
    const tries = []
    if (!isWin) tries.push(path.join(dir, tool))
    else if (hasExt) tries.push(path.join(dir, tool))
    else for (const ext of exts) tries.push(path.join(dir, tool + ext))
    for (const cand of tries) {
      try {
        if (fs.statSync(cand).isFile()) {
          const e = path.extname(cand).toLowerCase()
          return { path: cand, isBatch: e === '.cmd' || e === '.bat' }
        }
      } catch { /* lanjut */ }
    }
  }
  return null
}

// Config-gate + ketersediaan alat -> 'run' | 'skip-not-configured' | 'skip-missing-tool'.
export function getLintasStackApplicability(root, spec) {
  if (!testLintasStackConfigured(root, spec)) return 'skip-not-configured'
  if (!resolveCommand(spec.tool)) return 'skip-missing-tool'
  return 'run'
}

// Jalankan SATU alat dengan batas-waktu, tangkap kode-keluar + keluaran (stdout+stderr).
// Return { spec, ran, reason, exitCode, output, timedOut }. Tak melempar (cermin PS try/catch).
export function invokeLintasStackTool(root, spec, timeoutSec = 120) {
  const resolved = resolveCommand(spec.tool)
  if (!resolved) {
    return { spec, ran: false, reason: 'missing-tool', exitCode: null, output: '', timedOut: false }
  }
  try {
    // .exe -> spawn langsung (UseShellExecute=false padanan); .cmd/.bat -> butuh shell (Node 18.20+/
    // 20.12+ menolak spawn .cmd tanpa shell, CVE-2024-27980). Args = KONSTANTA whitelist (tak ada input
    // project) -> aman walau lewat shell (sec.5 anti-injeksi). Diuji-banding dgn git (.exe) deterministik.
    const opts = {
      cwd: root,
      timeout: timeoutSec * 1000,
      encoding: 'utf8',
      windowsHide: true,
      killSignal: 'SIGTERM',
      maxBuffer: 16 * 1024 * 1024,
    }
    const r = resolved.isBatch
      ? spawnSync(resolved.path, spec.args, { ...opts, shell: true })
      : spawnSync(resolved.path, spec.args, opts)

    const timedOut = !!(r.error && r.error.code === 'ETIMEDOUT')
    if (r.error && !timedOut) {
      return { spec, ran: false, reason: 'run-error: ' + r.error.message, exitCode: null, output: '', timedOut: false }
    }
    const exitCode = timedOut ? null : (r.status == null ? null : r.status)
    const output = [r.stdout || '', r.stderr || ''].join('\n').trim()
    return { spec, ran: true, reason: 'ran', exitCode, output, timedOut }
  } catch (e) {
    return { spec, ran: false, reason: 'run-error: ' + e.message, exitCode: null, output: '', timedOut: false }
  }
}

// Klasifikasi hasil-jalan SATU alat -> array temuan (MURNI). Robot TAK PERNAH GENTING.
// timeoutSec hanya untuk teks pesan TIMEOUT (cermin $TimeoutSec PS, default 120).
export function getLintasStackFinding(runResult, timeoutSec = 120) {
  if (!runResult.ran) return [] // alat absen / gagal-jalan -> caller catat sebagai dilewati
  const tool = runResult.spec.tool
  const lang = runResult.spec.lang
  const findings = []

  if (runResult.timedOut) {
    findings.push({
      lang, tool, tingkat: 'PENTING', kode: 'TOOL_TIMEOUT',
      pesan: `Alat '${tool}' tidak selesai dalam ${timeoutSec} detik - dilewati (BUKAN berarti bersih). Jalankan manual untuk hasil lengkap.`,
    })
    return findings
  }
  if (runResult.exitCode != null && runResult.exitCode !== 0) {
    const snippet = runResult.output
      ? runResult.output.slice(0, Math.min(400, runResult.output.length))
      : '(tanpa keluaran)'
    findings.push({
      lang, tool, tingkat: 'PENTING', kode: 'TOOL_FINDINGS',
      pesan: `Alat '${tool}' melaporkan masalah (kode keluar ${runResult.exitCode}). AI: baca keluaran + tentukan tingkat sebenarnya (naikkan ke GENTING kalau soal keamanan). Cuplikan: ${snippet}`,
    })
  }
  return findings
}

// Orkestrasi penuh. opts = { repoRoot, stack, timeoutSec=120, noRun=false, quiet=false }.
export function invokeLintasStackCheck(opts = {}) {
  let { repoRoot, stack } = opts
  const timeoutSec = opts.timeoutSec ?? 120
  const noRun = opts.noRun === true
  const quiet = opts.quiet === true

  // !repoRoot -> induk folder lib/ (cermin Split-Path -Parent $PSScriptRoot).
  if (!repoRoot) repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  if (!stack) stack = getStackType(repoRoot).stackType

  const specs = getLintasStackToolSpec(stack)
  const findings = []
  const ran = []
  const skipMissing = []
  const skipNotConfigured = []

  for (const spec of specs) {
    // Urutan: config-gate dulu -> SIMULASI (noRun) -> ketersediaan alat -> jalankan.
    if (!testLintasStackConfigured(repoRoot, spec)) { skipNotConfigured.push(spec.tool); continue }
    if (noRun) { ran.push(`${spec.tool} (SIMULASI)`); continue }
    if (!resolveCommand(spec.tool)) { skipMissing.push(spec.tool); continue }

    const res = invokeLintasStackTool(repoRoot, spec, timeoutSec)
    if (!res.ran) { skipMissing.push(spec.tool); continue }
    ran.push(spec.tool)
    for (const f of getLintasStackFinding(res, timeoutSec)) findings.push(f)
  }

  const genting = findings.filter((f) => f.tingkat === 'GENTING').length
  const penting = findings.filter((f) => f.tingkat === 'PENTING').length
  const rapikan = findings.filter((f) => f.tingkat === 'RAPIKAN').length

  if (!quiet) {
    const log = (m) => console.log(m)
    log(`Robot pemeriksa mutu kode per-bahasa (stack: ${stack})`)
    log('-'.repeat(60))
    if (stack === 'unknown' || specs.length === 0) {
      log('Stack tidak dikenali / belum didukung - pakai baseline 8-divisi (sec. 4.13). Tidak ada alat dijalankan.')
    } else {
      if (ran.length > 0) log(`Alat dijalankan : ${ran.join(', ')}`)
      if (skipNotConfigured.length > 0) log(`Dilewati (config tak ada): ${skipNotConfigured.join(', ')}`)
      if (skipMissing.length > 0) log(`Dilewati (alat belum terpasang): ${skipMissing.join(', ')}`)
      if (findings.length === 0) {
        log('BERSIH: alat yang dijalankan tidak melaporkan masalah.')
      } else {
        for (const x of findings) log(`  [${x.tingkat}] ${x.lang}/${x.tool}  ${x.pesan}`)
      }
      log('-'.repeat(60))
      log(`Ringkasan: GENTING ${genting} - PENTING ${penting} - RAPIKAN ${rapikan}. (Robot tak pernah GENTING; AI yang naikkan kalau keamanan.)`)
    }
  }

  return {
    stack,
    findings,
    count: findings.length,
    genting,
    penting,
    rapikan,
    ran,
    skippedMissingTool: skipMissing,
    skippedNotConfigured: skipNotConfigured,
  }
}

// --- CLI: jalankan langsung + verb uji-banding deterministik ----------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const argv = process.argv.slice(2)
  const verb = argv[0]
  const bool = (v) => (v === true || v === 'true' || v === '1')

  if (verb === 'toolspec') {
    // toolspec <stack> -> 1 baris per alat: tool|args|category|requiresAny
    for (const s of getLintasStackToolSpec(argv[1])) {
      console.log([s.tool, s.args.join(' '), s.category, s.requiresAny.join(',')].join('|'))
    }
  } else if (verb === 'configured') {
    // configured <root> <stack> <toolIndex> -> true/false
    const spec = getLintasStackToolSpec(argv[2])[Number(argv[3])]
    console.log(String(testLintasStackConfigured(argv[1], spec)))
  } else if (verb === 'applicability') {
    // applicability <root> <tool> <requiresAny-csv> -> verdict
    const spec = { tool: argv[2], requiresAny: (argv[3] || '').split(',').filter(Boolean) }
    console.log(getLintasStackApplicability(argv[1], spec))
  } else if (verb === 'finding') {
    // finding <ran> <timedOut> <exitCode|null> <tool> <lang> [output] -> count|tingkat0|kode0|pesan0
    const rr = {
      ran: bool(argv[1]),
      timedOut: bool(argv[2]),
      exitCode: argv[3] === 'null' || argv[3] === '' ? null : Number(argv[3]),
      output: argv[6] ?? '',
      spec: { tool: argv[4], lang: argv[5] },
    }
    const f = getLintasStackFinding(rr, 120)
    console.log([f.length, f[0]?.tingkat ?? '', f[0]?.kode ?? '', f[0]?.pesan ?? ''].join('|'))
  } else if (verb === 'tool') {
    // tool <root> <toolName> [args...] -> ran|exitCode|timedOut|output40
    const res = invokeLintasStackTool(argv[1], { tool: argv[2], args: argv.slice(3), lang: 'tool' }, 120)
    console.log([res.ran, res.exitCode == null ? 'null' : res.exitCode, res.timedOut, (res.output || '').slice(0, 40)].join('|'))
  } else if (verb === 'check') {
    // check <root> <stack> <noRun> -> stack|count|genting|penting|rapikan|ran|skipMissing|skipNotConf
    const r = invokeLintasStackCheck({ repoRoot: argv[1], stack: argv[2] || undefined, noRun: bool(argv[3]), quiet: true })
    console.log([r.stack, r.count, r.genting, r.penting, r.rapikan, r.ran.join(','), r.skippedMissingTool.join(','), r.skippedNotConfigured.join(',')].join('|'))
  } else if (verb === 'run' || verb === undefined) {
    // run [--repo-root X] [--stack Y] [--timeout N] [--no-run] [--quiet] -> jalankan + exit = genting
    const getFlag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
    const r = invokeLintasStackCheck({
      repoRoot: getFlag('--repo-root'),
      stack: getFlag('--stack'),
      timeoutSec: getFlag('--timeout') ? Number(getFlag('--timeout')) : 120,
      noRun: argv.includes('--no-run'),
      quiet: argv.includes('--quiet'),
    })
    process.exitCode = r.genting // exitCode (BUKAN process.exit) -> stdout sempat ter-flush
  } else {
    console.error('Pakai: node lib/stack-check.mjs <run|toolspec|configured|applicability|finding|tool|check> ...')
    process.exitCode = 2
  }
}
