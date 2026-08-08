#!/usr/bin/env node
// tests/preflight.mjs - "Gerbang Pra-Rilis 1-perintah" (LAPIS 2 cetak-biru docs/plans/BUKU_PELAJARAN_DAN_PREFLIGHT.md).
//
// TUJUAN (WHY): selama ini pemeriksa (tes Node, ESLint, Pester, robot kecocokan, smoke, pemindai
//   Unicode) dijalankan MANUAL satu-satu -> gampang "lupa cek sesuatu", dan tak ada cek KELENGKAPAN
//   RILIS (mis. versi naik tapi CHANGELOG belum punya entrinya). Berkas ini menggabung SEMUA jadi
//   satu perintah `npm run preflight` + menambah cek kelengkapan rilis, lalu memilah hasil jadi
//   GENTING / PENTING / RAPIKAN dengan satu exit-code. Itu yang dipakai sebagai "gerbang sebelum
//   menyatakan selesai/rilis" (CLAUDE_universal_v1.md sec. 4.6).
//
// KEPUTUSAN OWNER (2026-06-24, Tahap A):
//   - CAKUPAN: "Node dulu, PowerShell kalau ada". Bagian Node SELALU jalan; bagian PowerShell
//     (Pester + smoke) otomatis DILEWATI dengan PERINGATAN JELAS (level PENTING) kalau PowerShell
//     (pwsh/powershell) tidak terpasang. Ramah mesin minim + tetap jujur "belum tercek".
//   - PEMBLOKIR: hanya GENTING yang MENGHENTIKAN (exit !=0) saat kerja harian. PENTING & RAPIKAN =
//     peringatan (tetap exit 0). Mode `--strict` (dipakai saat MAU RILIS) juga menghentikan PENTING.
//   - BELUM dipasang di CI (Tahap D nanti) + BELUM disambung ke dispatcher `lintasai` (Tahap E).
//
// REUSE (anti-duplikasi, CLAUDE_universal sec. 5): robot kecocokan + pemindai Unicode + parser
//   CHANGELOG di-IMPORT dari lib/ (fungsi murni cuma-baca yang sudah teruji), BUKAN ditulis ulang.
//   Tes Node / ESLint / Pester / smoke di-SPAWN sebagai proses terpisah (pakai exit-code-nya).
//
// AMAN dari rekursi: berkas ini BUKAN '*.test.mjs' -> tidak ikut dijalankan `npm test`. Saat di-import
//   (oleh tests/preflight.test.mjs untuk menguji fungsinya), main() TIDAK jalan (dijaga isMain).
//   Tes pengunci HANYA memanggil fungsi murni (classify, checkReleaseCompleteness, dll), TIDAK
//   memanggil runPreflight() -> tak ada "preflight memanggil tes yang memanggil preflight".
//
// Versi: 1 - 2026-06-24

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { invokeLintasConsistencyCheckKit, invokeLintasConsistencyCheckProject } from '../lib/consistency-check.mjs'
import { scan as unicodeScan } from '../lib/unicode-safety-check.mjs'
import { getKitVersionFromChangelog } from '../lib/version-detect.mjs'
import { stripBom } from '../lib/fs-text.mjs'
import { runPerfBudget, fmtKb } from '../lib/perf-budget.mjs'
import { invokeLintasRegistryCheck } from '../lib/project-manifest.mjs'

// Tingkat keseriusan (bahasa non-programmer, sec. 2.1 #7 - bukan P0/Critical/High).
//   GENTING = wajib diperbaiki, menghentikan gerbang. PENTING = saran kuat (menghentikan saat --strict).
//   RAPIKAN = enak kalau dibereskan, tak pernah menghentikan. OK = lulus. INFO = konteks, tak dihitung.
export const LEVEL = { OK: 'OK', GENTING: 'GENTING', PENTING: 'PENTING', RAPIKAN: 'RAPIKAN', INFO: 'INFO' }

// ---------------------------------------------------------------------------
// Util kecil
// ---------------------------------------------------------------------------

// Akar repo default = folder induk dari tests/ (tempat package.json kit/project berada).
export function defaultRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
}

function readText(p) {
  return stripBom(fs.readFileSync(p, 'utf8')) // cermin ReadAllText UTF-8 (buang BOM)
}

function readPackageJson(repoRoot) {
  try { return JSON.parse(readText(path.join(repoRoot, 'package.json'))) } catch { return {} }
}

// Buang kode warna ANSI (mis. "[32m"). WHY: saat output PowerShell/Pester di-PIPE (bukan layar),
// Pester TETAP menyisipkan kode warna -> menyela baris ringkasan ("Tests Passed: 677, <ANSI>Failed: 0")
// sehingga regex penghitung GAGAL (tampil "?"). Karakter ESC dibangun via String.fromCharCode(27)
// (BUKAN regex literal) supaya tidak melanggar aturan ESLint no-control-regex.
const ANSI_RX = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g')
export function stripAnsi(s) { return String(s || '').replace(ANSI_RX, '') }

// Ambil N baris terakhir sebuah teks (untuk menampilkan ekor output saat sebuah pemeriksa gagal),
// sudah bersih dari kode warna ANSI supaya laporan rapi terbaca.
function tailLines(s, n) {
  return stripAnsi(s).split(/\r?\n/).filter((l) => l.length > 0).slice(-n).join('\n')
}

// Jalankan perintah eksternal dengan AMAN. WHY: spawnSync JARANG melempar (hanya argumen invalid);
// untuk error proses (ENOENT command tak ada, ENOBUFS output melebihi maxBuffer, ETIMEDOUT timeout) ia
// TIDAK melempar - melainkan mengembalikan { status: null, error, signal } (terbukti uji empiris 2026-06-24).
// Helper ini menyeragamkan: kalau spawnSync MELEMPAR (langka) -> dibungkus jadi objek yang sama. maxBuffer
// 64MB karena Pester Detailed / node:test bisa ber-output banyak.
function runCmd(exe, args, opts = {}) {
  try {
    return spawnSync(exe, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts })
  } catch (e) {
    return { status: null, stdout: '', stderr: '', error: e }
  }
}

// Apakah perintah GAGAL DIJALANKAN (beda dari "jalan tapi tesnya gagal")? true kalau spawnSync melempar,
// proses dihentikan, atau status null (ENOENT/ENOBUFS-overflow/timeout/sinyal). Untuk GERBANG ini WAJIB
// jadi GENTING dengan pesan JELAS - BUKAN diam-diam OK (fail-closed) dan BUKAN bikin preflight crash.
function cmdNotRun(r) {
  return Boolean(r.error) || r.status === null || r.status === undefined
}
// Pesan error proses dalam BAHASA AWAM (#2, keputusan owner 2026-06-24): kode sistem mentah seperti
// "ENOENT" bikin staff non-programmer bingung. Terjemahkan ke kalimat + selipkan kode asli dalam kurung
// untuk diagnosa programmer. Kode tak dikenal -> tampil apa adanya (tak crash, tetap jujur).
const ERR_AWAM = {
  ENOENT: 'perintahnya tak ditemukan - program seperti Node/git/PowerShell mungkin belum terpasang',
  ENOBUFS: 'keluaran terlalu besar (membludak melewati batas)',
  ETIMEDOUT: 'kelamaan - melewati batas waktu (timeout)',
  EACCES: 'akses ditolak - izin kurang',
}
export function cmdErrMsg(r) {
  if (r.error) {
    const code = r.error.code
    if (code && ERR_AWAM[code]) return `${ERR_AWAM[code]} (${code})`
    return code || r.error.message
  }
  if (r.signal) return `proses dihentikan paksa (sinyal ${r.signal}) - mungkin keluaran melebihi batas / kelamaan`
  return 'proses tak mengembalikan kode hasil'
}

// Bandingkan dua versi semver "X.Y.Z". Return -1 (A<B) / 0 (sama) / 1 (A>B). Non-versi -> 0.
export function cmpSemver(a, b) {
  const pa = String(a).split('.').map((x) => parseInt(x, 10))
  const pb = String(b).split('.').map((x) => parseInt(x, 10))
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x < y) return -1
    if (x > y) return 1
  }
  return 0
}

// ---------------------------------------------------------------------------
// Deteksi PowerShell: coba pwsh (PS7) dulu, lalu powershell (Windows PowerShell 5.1).
// Return nama exe yang BISA dipakai, atau null kalau dua-duanya tak ada. `probe` di-inject di tes.
// ---------------------------------------------------------------------------
function realProbe(exe) {
  const r = spawnSync(exe, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8' })
  return r.status === 0
}

export function findPowerShell(probe = realProbe) {
  for (const exe of ['pwsh', 'powershell']) {
    try { if (probe(exe)) return exe } catch { /* lanjut ke kandidat berikut */ }
  }
  return null
}

// ---------------------------------------------------------------------------
// Helper CHANGELOG (fungsi MURNI -> mudah diuji tanpa menjalankan apa pun)
// ---------------------------------------------------------------------------

// Pola heading versi CHANGELOG: terima "## [X.Y.Z]" (Keep-a-Changelog) DAN "## vX.Y.Z" (lama).
const RX_CHANGELOG_HEADING = /^##\s+\[?v?\d+\.\d+\.\d+/

// Ambil BLOK entri teratas CHANGELOG: dari heading versi PERTAMA sampai SEBELUM heading versi berikutnya.
// Return null kalau tak ada heading versi sama sekali. Dipakai untuk cek "isi entri" + label [BREAKING].
export function getTopChangelogBlock(text) {
  const lines = String(text || '').split(/\r\n|\r|\n/)
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (RX_CHANGELOG_HEADING.test(lines[i])) { start = i; break }
  }
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (RX_CHANGELOG_HEADING.test(lines[i])) { end = i; break }
  }
  return lines.slice(start, end).join('\n')
}

// Apakah blok entri masih berisi TEKS-CONTOH dari kerangka bump (Add-LintasChangelogSkeleton di
// consistency-check.ps1)? Kalau ya -> entri belum diisi manusia. Pola sengaja spesifik pada
// placeholder kerangka (pakai kurung-siku < >) supaya tak salah-tangkap prosa biasa.
export function hasChangelogPlaceholder(block) {
  if (!block) return false
  return /<ISI deskripsi|<Diubah\/Ditambah\/Diperbaiki>|<ringkas apa yang berubah/.test(block)
}

// ---------------------------------------------------------------------------
// Cek KELENGKAPAN RILIS (bagian BARU & paling berharga - fungsi MURNI cuma-baca).
// lastTag = tag git terbaru (mis. "v1.57.1") atau null kalau git tak tersedia.
// ---------------------------------------------------------------------------
// mode='kit' (default): version + CHANGELOG WAJIB -> ketiadaan/drift = GENTING (memblokir).
// mode='project' (klien): banyak app klien tak pakai versi/CHANGELOG formal -> ketiadaannya = INFO
//   (lewati, bukan masalah); kalau KEDUANYA ada tapi entri drift = PENTING (saran kuat, tetap blokir
//   saat --strict/rilis, tapi tak memblokir kerja harian klien). Default 'kit' menjaga perilaku lama.
export function checkReleaseCompleteness(repoRoot, { lastTag = null, mode = 'kit' } = {}) {
  const out = []
  const pkg = readPackageJson(repoRoot)
  const version = pkg.version
  const clPath = path.join(repoRoot, 'CHANGELOG.md')
  const missingLevel = mode === 'kit' ? LEVEL.GENTING : LEVEL.INFO   // tak ada versi/CHANGELOG
  const driftLevel = mode === 'kit' ? LEVEL.GENTING : LEVEL.PENTING  // entri tak cocok versi

  if (!version) {
    out.push({
      id: 'cl-versi', label: 'Versi package.json', level: missingLevel,
      detail: mode === 'kit' ? 'field "version" tak ada di package.json.' : 'tak ada field "version" di package.json - cek kelengkapan rilis dilewati (project tanpa versi formal).',
    })
    return out
  }
  if (!fs.existsSync(clPath)) {
    out.push({
      id: 'cl-ada', label: 'CHANGELOG.md ada', level: missingLevel,
      detail: mode === 'kit' ? 'CHANGELOG.md tidak ditemukan - tak bisa cek kelengkapan rilis.' : 'tak ada CHANGELOG.md - cek kelengkapan rilis dilewati (project tanpa CHANGELOG formal).',
    })
    return out
  }

  const clText = readText(clPath)
  const topVerRaw = getKitVersionFromChangelog(clPath)            // "vX.Y.Z" atau null
  const topVer = topVerRaw ? topVerRaw.replace(/^v/, '') : null

  // CL-1: entri teratas CHANGELOG = versi package.json (entri rilis SUDAH ditulis).
  if (topVer === version) {
    out.push({ id: 'cl-versi', label: `Entri CHANGELOG utk v${version}`, level: LEVEL.OK, detail: 'ada (entri teratas).' })
  } else {
    out.push({
      id: 'cl-versi', label: `Entri CHANGELOG utk v${version}`, level: driftLevel,
      detail: `Versi package.json = ${version}, tapi entri teratas CHANGELOG = ${topVer ?? '(tak ada)'}. Tambah entri CHANGELOG utk v${version} sebelum rilis.`,
    })
  }

  // CL-2: entri teratas tidak lagi berisi teks-contoh kerangka bump (sudah ditulis manusia).
  const block = getTopChangelogBlock(clText)
  if (block && hasChangelogPlaceholder(block)) {
    out.push({
      id: 'cl-isi', label: 'Isi entri CHANGELOG teratas', level: LEVEL.PENTING,
      detail: 'Entri teratas masih berisi teks-contoh dari kerangka bump (mis. "<ISI deskripsi...>"). Ganti dengan deskripsi nyata sebelum rilis.',
    })
  } else {
    out.push({ id: 'cl-isi', label: 'Isi entri CHANGELOG teratas', level: LEVEL.OK, detail: 'sudah terisi (tak ada teks-contoh).' })
  }

  // CL-3 + breaking: butuh tag git pembanding.
  if (lastTag) {
    const tagNorm = lastTag.replace(/^v/, '')
    const c = cmpSemver(version, tagNorm)
    if (c > 0) {
      out.push({ id: 'rilis-vs-tag', label: 'Versi vs tag terakhir', level: LEVEL.INFO, detail: `versi ${version} > tag ${lastTag}: ada rilis tertunda untuk v${version}.` })
      // Aturan sec. 11: perubahan [BREAKING] WAJIB menaikkan angka BESAR (major). Cek di blok entri teratas saja.
      const hasBreaking = block ? /\[BREAKING\]/.test(block) : false
      const majorBumped = (parseInt(version.split('.')[0], 10) || 0) > (parseInt(tagNorm.split('.')[0], 10) || 0)
      if (hasBreaking && !majorBumped) {
        out.push({
          id: 'breaking-versi', label: 'Breaking tanpa naik BESAR', level: LEVEL.PENTING,
          detail: `Entri v${version} mengandung [BREAKING] tapi angka BESAR tak naik dari ${lastTag}. Aturan sec. 11: breaking WAJIB menaikkan angka BESAR (mis. 1.x -> 2.0).`,
        })
      }
    } else if (c === 0) {
      out.push({ id: 'rilis-vs-tag', label: 'Versi vs tag terakhir', level: LEVEL.INFO, detail: `versi ${version} == tag terakhir ${lastTag} (sudah dirilis).` })
    } else {
      out.push({
        id: 'rilis-vs-tag', label: 'Versi vs tag terakhir', level: LEVEL.PENTING,
        detail: `versi package.json ${version} LEBIH RENDAH dari tag terakhir ${lastTag} (downgrade?). Cek apakah disengaja.`,
      })
    }
  } else {
    out.push({ id: 'rilis-vs-tag', label: 'Versi vs tag terakhir', level: LEVEL.INFO, detail: 'tag git tidak tersedia - banding versi dilewati.' })
  }

  return out
}

// Klasifikasi heuristik "perubahan kode tanpa perubahan tes" (RAPIKAN/peringatan saja). MURNI.
// changedFiles = daftar path relatif gaya git ('/'). Kode = .mjs/.js/.ps1/.psm1 di LUAR tests/.
export function classifyCodeVsTests(changedFiles) {
  const list = Array.isArray(changedFiles) ? changedFiles.map((f) => f.replace(/\\/g, '/')) : []
  const codeExt = /\.(mjs|js|ps1|psm1)$/i
  const code = list.filter((f) => codeExt.test(f) && !f.startsWith('tests/'))
  const tests = list.filter((f) => f.startsWith('tests/'))
  if (code.length > 0 && tests.length === 0) {
    return {
      id: 'kode-vs-tes', label: 'Tes untuk perubahan kode', level: LEVEL.RAPIKAN,
      detail: `${code.length} berkas kode berubah tanpa perubahan berkas tes. Pertimbangkan tambah/ubah tes (sec. 4 DoD: minimal 1 tes happy-path).`,
    }
  }
  return {
    id: 'kode-vs-tes', label: 'Tes untuk perubahan kode', level: LEVEL.OK,
    detail: code.length > 0 ? `${code.length} berkas kode + ${tests.length} berkas tes berubah.` : 'tak ada perubahan kode terlacak sejak tag.',
  }
}

// Pilah semua hasil -> bucket per tingkat + tentukan exit-code (1 kalau ada pemblokir, else 0).
// strict=true -> PENTING ikut jadi pemblokir (dipakai saat mau rilis).
export function classify(results, { strict = false } = {}) {
  const at = (lvl) => results.filter((r) => r.level === lvl)
  const genting = at(LEVEL.GENTING)
  const penting = at(LEVEL.PENTING)
  const rapikan = at(LEVEL.RAPIKAN)
  const blockers = strict ? [...genting, ...penting] : [...genting]
  return { genting, penting, rapikan, blockers, exitCode: blockers.length > 0 ? 1 : 0 }
}

// ---------------------------------------------------------------------------
// Pemeriksa yang di-SPAWN (proses terpisah) - butuh runtime, jadi BUKAN fungsi murni.
// ---------------------------------------------------------------------------

// Jalankan tes. Mode KIT = suite Node kit (tests/run-node-tests.mjs, format `node --test` -> angka
// pass/fail terbaca). Mode PROJECT (klien) = `npm test` milik KLIEN (kontrak universal lintas-runner:
// jest/vitest/mocha/node:test) -> andalkan EXIT CODE saja (format output beragam, tak diparse).
// WHY (bug Tahap E): versi lama HARDCODE tests/run-node-tests.mjs -> di project klien berkas itu TAK ADA
//   (itu berkas kit) -> Node gagal dgn stack-trace mentah = GENTING palsu menakutkan staff non-programmer.
export function runNodeTests(repoRoot, env, mode = 'kit') {
  if (mode === 'kit') {
    const r = runCmd(process.execPath, [path.join(repoRoot, 'tests', 'run-node-tests.mjs')], { cwd: repoRoot, env })
    if (cmdNotRun(r)) return { id: 'node-test', label: 'Tes Node', level: LEVEL.GENTING, detail: `tak bisa dijalankan: ${cmdErrMsg(r)}.` }
    const out = (r.stdout || '') + (r.stderr || '')
    const pass = (out.match(/(?:^|\s)pass\s+(\d+)/m) || [])[1]
    const fail = (out.match(/(?:^|\s)fail\s+(\d+)/m) || [])[1]
    if (r.status !== 0) return { id: 'node-test', label: 'Tes Node', level: LEVEL.GENTING, detail: `${fail ?? '?'} gagal (exit ${r.status}).\n${tailLines(out, 18)}` }
    // Exit 0 = lulus menurut runner (sumber kebenaran; run-node-tests.mjs meneruskan exit `node --test`).
    // Angka tak terbaca -> JANGAN diam-diam OK: lapor PENTING (fail-closed) supaya "format output runner
    // berubah" TERLIHAT, bukan tersembunyi jadi hijau palsu.
    if (pass === undefined && fail === undefined) return { id: 'node-test', label: 'Tes Node', level: LEVEL.PENTING, detail: 'lulus (exit 0) tapi jumlah tes tak terbaca - cek format output runner.' }
    return { id: 'node-test', label: 'Tes Node', level: LEVEL.OK, detail: `${pass ?? '?'} lulus / ${fail ?? '0'} gagal.` }
  }

  // --- Mode PROJECT (klien) ---
  const pkg = readPackageJson(repoRoot)
  const testScript = pkg && pkg.scripts && pkg.scripts.test
  if (!testScript) {
    // Tak punya tes = bukan GENTING (dorongan, bukan pemblokir). DoD sec. 4 anjurkan minimal 1 tes.
    return { id: 'node-test', label: 'Tes project', level: LEVEL.RAPIKAN, detail: 'project belum punya script "test" di package.json - dilewati. Pertimbangkan tambah tes (minimal 1 happy-path).' }
  }
  if (/no test specified/i.test(testScript)) {
    return { id: 'node-test', label: 'Tes project', level: LEVEL.RAPIKAN, detail: 'script "test" masih teks-contoh bawaan npm ("no test specified") - dilewati. Ganti dengan tes nyata.' }
  }
  // Jalankan `npm test` klien. Di Windows npm = npm.cmd -> butuh shell:true (Node modern menolak
  // spawn .cmd tanpa shell). cwd = project klien supaya tes klien jalan di akar mereka. Perintah
  // dikirim sebagai SATU STRING (args kosong) -> hindari DeprecationWarning DEP0190 ("args + shell")
  // yang akan tampil ke layar staff. Tak ada input user di perintah -> aman.
  const isWin = process.platform === 'win32'
  const r = runCmd((isWin ? 'npm.cmd' : 'npm') + ' test', [], { cwd: repoRoot, env, shell: true })
  if (cmdNotRun(r)) return { id: 'node-test', label: 'Tes project (npm test)', level: LEVEL.GENTING, detail: `tak bisa menjalankan "npm test": ${cmdErrMsg(r)}. Pastikan Node + npm terpasang & sudah "npm install".` }
  const out = (r.stdout || '') + (r.stderr || '')
  if (r.status !== 0) return { id: 'node-test', label: 'Tes project (npm test)', level: LEVEL.GENTING, detail: `"npm test" gagal (exit ${r.status}). Kalau gagal karena dependency belum ada, jalankan "npm install" dulu.\n${tailLines(out, 18)}` }
  return { id: 'node-test', label: 'Tes project (npm test)', level: LEVEL.OK, detail: '"npm test" lulus (exit 0).' }
}

export function runEslint(repoRoot, mode = 'kit') {
  const bin = path.join(repoRoot, 'node_modules', 'eslint', 'bin', 'eslint.js')
  if (!fs.existsSync(bin)) {
    // Kit WAJIB punya eslint (devDep) -> PENTING kalau hilang. Klien: eslint opsional (tak semua project
    // pakai) -> RAPIKAN (saran lembut, tak memblokir rilis). Kalau eslint ADA + error -> tetap GENTING.
    return mode === 'kit'
      ? { id: 'eslint', label: 'ESLint', level: LEVEL.PENTING, detail: 'eslint belum terpasang (jalankan `npm ci`) - dilewati.' }
      : { id: 'eslint', label: 'ESLint', level: LEVEL.RAPIKAN, detail: 'eslint tak terpasang di project ini - dilewati (opsional). Pasang + konfigurasi kalau mau cek gaya kode otomatis.' }
  }
  const r = runCmd(process.execPath, [bin, '.'], { cwd: repoRoot })
  if (cmdNotRun(r)) return { id: 'eslint', label: 'ESLint', level: LEVEL.GENTING, detail: `tak bisa dijalankan: ${cmdErrMsg(r)}.` }
  const ok = r.status === 0
  return {
    id: 'eslint', label: 'ESLint', level: ok ? LEVEL.OK : LEVEL.GENTING,
    detail: ok ? 'bersih.' : `menemukan masalah (exit ${r.status}).\n${tailLines((r.stdout || '') + (r.stderr || ''), 20)}`,
  }
}

function runConsistency(repoRoot) {
  try {
    const pkg = readPackageJson(repoRoot)
    const mapJsonc = path.join(repoRoot, 'docs', 'consistency-map.jsonc')
    let r
    if (pkg.name === 'lintasai') {
      r = invokeLintasConsistencyCheckKit(repoRoot, { quiet: true })       // MODE KIT (repo kit ini)
    } else if (fs.existsSync(mapJsonc)) {
      r = invokeLintasConsistencyCheckProject(repoRoot, mapJsonc, { quiet: true }) // MODE PROJECT (klien)
    } else {
      // Klien belum daftar fakta-berulang = WAJAR (opsional). RAPIKAN (saran lembut), BUKAN PENTING:
      // PENTING jadi pemblokir saat --strict/rilis -> klien tak boleh diblokir rilis cuma karena belum
      // bikin peta-konsistensi. RAPIKAN tak pernah memblokir, tetap mendorong mereka mengaktifkannya.
      return { id: 'konsistensi', label: 'Robot kecocokan', level: LEVEL.RAPIKAN, detail: 'belum ada docs/consistency-map.jsonc - dilewati (opsional). Salin docs/consistency-map.example.jsonc -> docs/consistency-map.jsonc lalu daftarkan fakta-berulang project untuk aktifkan pencegah drift.' }
    }
    if (r.MismatchCount === 0) {
      const nFacts = (r.FactFindings || []).length
      // RetiredFindings hanya ada di MODE KIT (penjaga istilah-pensiun) -> tampilkan status bersihnya.
      const retiredNote = Object.prototype.hasOwnProperty.call(r, 'RetiredFindings') ? ' + istilah-pensiun bersih' : ''
      return { id: 'konsistensi', label: 'Robot kecocokan', level: LEVEL.OK, detail: `${r.Findings.length} versi${nFacts ? ` + ${nFacts} fakta` : ''}${retiredNote} cocok @ v${r.CanonicalVersion}.` }
    }
    const bad = [...r.Findings, ...(r.FactFindings || []), ...(r.RetiredFindings || [])].filter((f) => f.Status !== 'OK').map((f) => `${f.File} (${f.Status})`)
    return { id: 'konsistensi', label: 'Robot kecocokan', level: LEVEL.GENTING, detail: `${r.MismatchCount} tak cocok: ${bad.join(', ')}.` }
  } catch (e) {
    return { id: 'konsistensi', label: 'Robot kecocokan', level: LEVEL.GENTING, detail: `gagal jalan: ${e.message}` }
  }
}

function runUnicode(repoRoot) {
  try {
    const findings = unicodeScan([repoRoot])
    if (findings.length === 0) return { id: 'unicode', label: 'Pemindai huruf-tipuan (Unicode)', level: LEVEL.OK, detail: '0 temuan.' }
    const sample = findings.slice(0, 10).map((f) => `${f.File}:${f.Line}:${f.Col} ${f.Hex} ${f.Name}`)
    return { id: 'unicode', label: 'Pemindai huruf-tipuan (Unicode)', level: LEVEL.GENTING, detail: `${findings.length} temuan:\n  ${sample.join('\n  ')}` }
  } catch (e) {
    return { id: 'unicode', label: 'Pemindai huruf-tipuan (Unicode)', level: LEVEL.GENTING, detail: `gagal jalan: ${e.message}` }
  }
}

function runSmokeFast(repoRoot, psExe) {
  const script = path.join(repoRoot, 'tests', 'smoke-fast.ps1')
  if (!fs.existsSync(script)) return { id: 'smoke', label: 'Smoke cepat (PowerShell)', level: LEVEL.INFO, detail: 'tests/smoke-fast.ps1 tak ada - dilewati.' }
  const r = runCmd(psExe, ['-NoProfile', '-File', script], { cwd: repoRoot })
  if (cmdNotRun(r)) return { id: 'smoke', label: 'Smoke cepat (PowerShell)', level: LEVEL.GENTING, detail: `tak bisa dijalankan: ${cmdErrMsg(r)}.` }
  const ok = r.status === 0
  return {
    id: 'smoke', label: 'Smoke cepat (PowerShell)', level: ok ? LEVEL.OK : LEVEL.GENTING,
    detail: ok ? 'PASS.' : `FAIL (exit ${r.status}).\n${tailLines((r.stdout || '') + (r.stderr || ''), 20)}`,
  }
}

function runPester(repoRoot, psExe) {
  const script = path.join(repoRoot, 'tests', 'Run-Tests.ps1')
  if (!fs.existsSync(script)) return { id: 'pester', label: 'Tes PowerShell (Pester)', level: LEVEL.INFO, detail: 'tests/Run-Tests.ps1 tak ada - dilewati.' }
  // Pra-cek modul Pester 5+ ADA - hindari Run-Tests.ps1 auto-meng-install (lama + kejutan di gerbang).
  const probe = runCmd(psExe, ['-NoProfile', '-Command', "if (Get-Module -ListAvailable -Name Pester | Where-Object { $_.Version.Major -ge 5 }) { 'ada' } else { 'tidak' }"])
  if (cmdNotRun(probe)) return { id: 'pester', label: 'Tes PowerShell (Pester)', level: LEVEL.GENTING, detail: `tak bisa cek modul Pester: ${cmdErrMsg(probe)}.` }
  if ((probe.stdout || '').trim() !== 'ada') {
    return { id: 'pester', label: 'Tes PowerShell (Pester)', level: LEVEL.PENTING, detail: 'modul Pester 5+ belum terpasang. Pasang: Install-Module Pester -MinimumVersion 5.0 -Scope CurrentUser. Dilewati.' }
  }
  const r = runCmd(psExe, ['-NoProfile', '-File', script], { cwd: repoRoot })
  if (cmdNotRun(r)) return { id: 'pester', label: 'Tes PowerShell (Pester)', level: LEVEL.GENTING, detail: `tak bisa dijalankan: ${cmdErrMsg(r)}.` }
  const out = stripAnsi((r.stdout || '') + (r.stderr || '')) // buang ANSI dulu supaya regex penghitung cocok (lihat stripAnsi)
  const m = out.match(/Tests Passed:\s*(\d+),\s*Failed:\s*(\d+)/)
  if (r.status !== 0) return { id: 'pester', label: 'Tes PowerShell (Pester)', level: LEVEL.GENTING, detail: `gagal (exit ${r.status}${m ? `, ${m[2]} gagal` : ''}).\n${tailLines(out, 25)}` }
  // Exit 0 = lulus (Run-Tests.ps1 pakai Run.Exit=$true -> exit = jumlah gagal). Fail-closed pada count:
  // kalau angka tak terbaca (mis. Run.Exit dihapus / format Pester berubah) -> PENTING, jangan diam-diam OK.
  if (!m) return { id: 'pester', label: 'Tes PowerShell (Pester)', level: LEVEL.PENTING, detail: 'lulus (exit 0) tapi jumlah tes Pester tak terbaca - cek format output Run-Tests.ps1.' }
  if (m[2] !== '0') return { id: 'pester', label: 'Tes PowerShell (Pester)', level: LEVEL.GENTING, detail: `anomali: exit 0 tapi ${m[2]} gagal terdeteksi.` }
  return { id: 'pester', label: 'Tes PowerShell (Pester)', level: LEVEL.OK, detail: `${m[1]} lulus / 0 gagal.` }
}

// Penjaga anggaran ukuran halaman (Next.js). AUTO-SKIP anggun: belum build / bukan Next -> INFO (bukan
// alarm). Route lewat-anggaran -> RAPIKAN (saran, TAK PERNAH memblokir - SEO/perf bukan pemblokir keras).
// Cuma-baca. Berguna saat dijalankan SETELAH `npm run build` (mis. di CI post-build).
function checkPerfBudget(repoRoot) {
  try {
    const res = runPerfBudget({ repoRoot })
    if (!res.present) return { id: 'perf', label: 'Anggaran ukuran halaman (Next.js)', level: LEVEL.INFO, detail: 'tak ada .next/ build (belum `npm run build` / bukan Next.js) - dilewati.' }
    if (res.over.length === 0) return { id: 'perf', label: 'Anggaran ukuran halaman (Next.js)', level: LEVEL.OK, detail: `${res.routes.length} route, terberat ${fmtKb(res.maxBytes)} <= ${res.budgetKb} KB (perkiraan JS).` }
    const sample = res.over.slice(0, 5).map((r) => `${r.route} ${fmtKb(r.bytes)}`)
    return { id: 'perf', label: 'Anggaran ukuran halaman (Next.js)', level: LEVEL.RAPIKAN, detail: `${res.over.length} route > ${res.budgetKb} KB JS (perkiraan): ${sample.join(', ')}. Optimalkan bundle (sec. 10).` }
  } catch (e) {
    return { id: 'perf', label: 'Anggaran ukuran halaman (Next.js)', level: LEVEL.INFO, detail: `dilewati (${e.message}).` }
  }
}

// Penjaga keselarasan registry docs (architecture_auto.md vs docs/*.md nyata). Cuma-baca. Port Node
// dari project-manifest.ps1 -> client Node-only (tanpa pwsh) juga dapat teguran saat TOC docs basi.
// MISMATCH (MISSING/ORPHAN) = RAPIKAN (saran, TAK memblokir): TOC basi bikin navigasi AI meleset
// (lambat/meraba berkas salah), tapi bukan crash/data-loss -> jangan blokir rilis. Registry opsional -> INFO.
function runRegistryCheck(repoRoot) {
  try {
    const r = invokeLintasRegistryCheck(repoRoot, { quiet: true })
    if (!r.Present) return { id: 'registry', label: 'Registry docs (architecture_auto.md)', level: LEVEL.INFO, detail: 'tak ada docs/architecture_auto.md - registry belum dibuat (opsional).' }
    if (r.MismatchCount === 0) return { id: 'registry', label: 'Registry docs (architecture_auto.md)', level: LEVEL.OK, detail: `${r.Findings.length} entri docs selaras.` }
    const bad = r.Findings.filter((f) => f.Status !== 'OK').map((f) => `${f.Field} (${f.Status})`)
    return { id: 'registry', label: 'Registry docs (architecture_auto.md)', level: LEVEL.RAPIKAN, detail: `${r.MismatchCount} TOC basi: ${bad.slice(0, 8).join(', ')}${bad.length > 8 ? ` (+${bad.length - 8})` : ''}. Perbarui architecture_auto.md (§7.4) supaya navigasi AI tetap gesit.` }
  } catch (e) {
    return { id: 'registry', label: 'Registry docs (architecture_auto.md)', level: LEVEL.INFO, detail: `dilewati (${e.message}).` }
  }
}

// ---------------------------------------------------------------------------
// Helper git (defensif: kalau git tak ada / bukan repo -> return null, pemeriksa terkait dilewati).
// ---------------------------------------------------------------------------
function getLastTag(repoRoot) {
  const r = runCmd('git', ['-C', repoRoot, 'tag', '--sort=-v:refname'])
  if (cmdNotRun(r) || r.status !== 0 || !r.stdout) return null
  const tags = r.stdout.split(/\r?\n/).map((s) => s.trim()).filter((s) => /^v?\d+\.\d+\.\d+$/.test(s))
  return tags[0] || null
}

function getChangedFiles(repoRoot, lastTag) {
  const r = runCmd('git', ['-C', repoRoot, 'diff', '--name-only', `${lastTag}..HEAD`])
  if (cmdNotRun(r) || r.status !== 0) return null
  return r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Laporan (bahasa Indonesia non-programmer)
// ---------------------------------------------------------------------------
const ICON = { OK: '[OK]   ', GENTING: '[GENTING]', PENTING: '[PENTING]', RAPIKAN: '[RAPIKAN]', INFO: '[info] ' }

// Format lama-waktu ramah baca (#1 "cara aman", keputusan owner 2026-06-24): < 1 dtk -> "850 ms";
// >= 1 dtk -> "12.3 dtk". Dipakai untuk menampilkan bagian mana yang lambat (transparansi).
export function fmtDur(ms) {
  if (typeof ms !== 'number' || ms < 0) return ''
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} dtk`
}

function printReport(results, summary, ctx) {
  const log = ctx.log || console.log
  log('')
  log('=== lintasAI Preflight - Gerbang Pra-Rilis (QA + QC) ===')
  const psLabel = ctx.skipPs ? 'dilewati (--skip-ps)' : (ctx.psExe || 'TIDAK ADA')
  log(`Mode: ${ctx.mode}  |  strict (rilis): ${ctx.strict ? 'YA' : 'tidak'}  |  PowerShell: ${psLabel}`)
  log('-'.repeat(64))
  for (const r of results) {
    const dur = (typeof r.ms === 'number') ? `  (${fmtDur(r.ms)})` : ''
    const head = `  ${ICON[r.level] || '[?]'}  ${r.label}${dur}`
    // detail multi-baris di-indent supaya rapi terbaca.
    const detail = String(r.detail || '').split('\n').map((l, i) => (i === 0 ? l : '          ' + l)).join('\n')
    log(`${head.padEnd(52)} ${detail}`)
  }
  log('-'.repeat(64))
  const totalDur = (typeof ctx.totalMs === 'number') ? `  |  total waktu ${fmtDur(ctx.totalMs)}` : ''
  log(`Ringkasan: GENTING ${summary.genting.length} | PENTING ${summary.penting.length} | RAPIKAN ${summary.rapikan.length}${totalDur}`)
  if (summary.exitCode === 0) {
    if (summary.penting.length > 0 || summary.rapikan.length > 0) {
      log('HASIL: LULUS (boleh dilanjut). Ada peringatan di atas - tinjau sebelum RILIS. Untuk gerbang rilis ketat: `npm run preflight -- --strict`.')
    } else {
      log('HASIL: LULUS - bersih.')
    }
  } else {
    const why = ctx.strict ? 'GENTING/PENTING (mode --strict)' : 'GENTING'
    log(`HASIL: GAGAL - ada ${summary.blockers.length} hal ${why} yang harus diperbaiki dulu. Gerbang BELUM boleh dinyatakan "lulus".`)
  }
  log('')
}

// ---------------------------------------------------------------------------
// Orkestrator utama. Jalankan semua pemeriksa berurutan, kumpulkan hasil, pilah, cetak.
// ---------------------------------------------------------------------------
export function runPreflight({ repoRoot = defaultRepoRoot(), strict = false, skipPs = false, ps = undefined, log = console.log } = {}) {
  // Penjaga anti-rekursi STRUKTURAL (bukan sekadar konvensi-komentar): runPreflight men-spawn `npm test`,
  // yang menjalankan SEMUA *.test.mjs termasuk preflight.test.mjs. Kalau suatu saat tes itu memanggil
  // runPreflight() -> preflight men-spawn npm test lagi -> rekursi tak hingga. Anak-proses tes diberi
  // env LINTASAI_PREFLIGHT_ACTIVE=1 (lihat childEnv di bawah); kalau runPreflight terpanggil saat env itu
  // menyala -> TOLAK keras. Ini mengubah "dijaga komentar" jadi "dijaga mesin".
  if (process.env.LINTASAI_PREFLIGHT_ACTIVE === '1') {
    throw new Error('runPreflight() dipanggil DI DALAM preflight (rekursi) - dicegah. Tes harus menguji fungsi murni, jangan menjalankan preflight penuh.')
  }
  const pkg = readPackageJson(repoRoot)
  const mode = pkg.name === 'lintasai' ? 'kit' : 'project'
  const results = []
  const tStart = Date.now()
  // Stopwatch per-pemeriksa (#1 "cara aman", keputusan owner 2026-06-24): lampirkan lama-waktu (ms) ke
  // hasil tiap pemeriksa supaya laporan menampilkan bagian mana yang lambat (transparansi) TANPA
  // memparalelkan tes berat. Kenapa tak paralel: menjalankan tes Node + Pester (dua suite berat yang
  // sama-sama men-spawn sub-proses) bersamaan berisiko bikin tes "gagal acak"/flaky di mesin lemah ->
  // gerbang yang ANDAL lebih penting dari sedikit lebih cepat (pelajaran kit, anti rasa-aman-palsu).
  // Hanya MENAMBAH r.ms; hasil & urutan pemeriksa tetap utuh.
  const timed = (fn) => { const t0 = Date.now(); const r = fn(); if (r && typeof r === 'object' && !Array.isArray(r)) r.ms = Date.now() - t0; return r }

  // PowerShell: pakai yang di-inject (tes) > auto-deteksi. skipPs -> tak usah cari.
  const psExe = skipPs ? null : (ps !== undefined ? ps : findPowerShell())

  // --- Bagian Node (SELALU jalan) --- anak-proses tes diberi penanda anti-rekursi di env.
  const childEnv = { ...process.env, LINTASAI_PREFLIGHT_ACTIVE: '1' }
  results.push(timed(() => runNodeTests(repoRoot, childEnv, mode)))
  results.push(timed(() => runEslint(repoRoot, mode)))
  results.push(timed(() => runConsistency(repoRoot)))
  results.push(timed(() => runUnicode(repoRoot)))
  results.push(timed(() => checkPerfBudget(repoRoot)))
  results.push(timed(() => runRegistryCheck(repoRoot)))

  // --- Bagian PowerShell (kalau ada; kalau tidak -> peringatan PENTING, bukan diam-diam) ---
  if (psExe) {
    results.push(timed(() => runSmokeFast(repoRoot, psExe)))
    results.push(timed(() => runPester(repoRoot, psExe)))
  } else {
    results.push({
      id: 'powershell', label: 'Tes PowerShell (smoke + Pester)',
      level: skipPs ? LEVEL.INFO : LEVEL.PENTING,
      detail: skipPs
        ? 'dilewati atas permintaan (--skip-ps).'
        : 'PowerShell (pwsh/powershell) tak terpasang - tes PowerShell DILEWATI. Pasang PowerShell agar gerbang lengkap (separuh kit ini PowerShell).',
    })
  }

  // --- Cek kelengkapan rilis + kode-vs-tes (butuh tag git; defensif kalau git tak ada) ---
  const lastTag = getLastTag(repoRoot)
  for (const r of checkReleaseCompleteness(repoRoot, { lastTag, mode })) results.push(r)
  if (lastTag) {
    const changed = getChangedFiles(repoRoot, lastTag)
    if (changed) results.push(classifyCodeVsTests(changed))
  }

  const summary = classify(results, { strict })
  const totalMs = Date.now() - tStart
  printReport(results, summary, { mode, strict, psExe, skipPs, log, totalMs })
  return { mode, results, totalMs, ...summary }
}

// ---------------------------------------------------------------------------
// main (CLI)
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2)
  const strict = args.includes('--strict')
  const skipPs = args.includes('--skip-ps') || args.includes('--node-only')
  // Terima --repo-root ATAU --project-root (dispatcher `npx lintasai preflight` menyuntik
  // --project-root <cwd-user>; lihat bin/lintasai.js). Tanpa ini, default repoRoot = folder kit (cache
  // npm) -> preflight memeriksa KIT, bukan project klien. --repo-root menang kalau keduanya diberi.
  const flagIdx = (name) => { const k = args.indexOf(name); return k >= 0 && k + 1 < args.length ? path.resolve(args[k + 1]) : null }
  const repoRoot = flagIdx('--repo-root') || flagIdx('--project-root') || defaultRepoRoot()
  const r = runPreflight({ repoRoot, strict, skipPs })
  // exit-code = 1 kalau ada pemblokir, 0 kalau lulus. process.exitCode (bukan exit) supaya stdout
  // selesai di-flush dulu (cermin pola aman lib/risk-gate.js).
  process.exitCode = r.exitCode
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
