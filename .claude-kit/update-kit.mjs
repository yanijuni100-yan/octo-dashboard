#!/usr/bin/env node
// update-kit.mjs - Perbarui kit lintasAI di sebuah project ke versi terbaru (versi Node), via ambil-ulang bersih.
//
// Padanan update-kit.ps1. Alur atomic (tanpa setengah-jadi):
//   1. Cadangkan .claude-kit/ lama -> .claude-kit.backup-<cap-waktu>
//   2. Ambil (clone) versi baru dari GitHub ke .claude-kit/ baru
//   3. Hapus .git/ internal supaya tak bentrok dengan git project kamu
//   4. Jalankan ulang pemasang (-Force) supaya docs/ kamu TIDAK ditimpa
//   5. Tampilkan beda CHANGELOG lama vs baru + langkah lanjut + peringatan keamanan
//
// ===========================================================================================
// STATUS MIGRASI (Gelombang 4, ADR-003/ADR-004) - SUDAH CUTOVER:
//   File ini = JALUR AKTIF untuk `npx lintasai update`. Dispatcher bin/lintasai.js memetakan
//   'update' -> update-kit.mjs di COMMANDS_NODE (bukan lagi update-kit.ps1 di COMMANDS), dan
//   package.json files[] mendaftarkannya eksplisit -> ikut paket npm + jalan di mesin staff.
//   update-kit.ps1 tetap terbit sebagai CADANGAN manual (.\.claude-kit\update-kit.ps1) bila
//   versi Node bermasalah. Pola cutover sama dengan 'init' (setup-pola-b.mjs).
//
// SIFAT NON-INTERAKTIF (keputusan owner 06-22): versi Node TIDAK menampilkan popup jendela.
//   Keputusan keamanan yang di versi PS pakai popup/Read-Host -> di sini jadi default-AMAN:
//     - Repo di luar daftar-putih (URL asing)  -> BATAL, kecuali --allow-untrusted-repo.
//     - Hapus PERMANEN kit lama (--no-backup)   -> BATAL, kecuali --yes-delete-no-backup.
//     - Gagal hubungi server saat cek versi     -> BATAL aman (tak memaksa update buta).
//   AI mengonfirmasi ke staff di chat dulu, baru menjalankan dengan bendera yang sesuai.
//
// PENGGANTI POWERSHELL YANG DIPAKAI (suku cadang Node yang sudah ada):
//   - removeGitMetadata (git-helpers.mjs)  -> hapus .git/ internal (Langkah 3).
//   - addLintasAuditEntry (audit-helpers.mjs) -> catat keputusan keamanan GPG (lewati/lolos/bypass/gagal).
//   - resolvePowerShellExe (popup-shim.mjs) -> hanya bila perlu jatuh ke pemasang/.ps1 lama.
//   Langkah pasang-ulang (4) MEMILIH pemasang Node (setup-pola-b.mjs) bila ada di kit baru;
//   kalau tidak ada, jatuh ke setup-pola-b.ps1 lama (kit baru yang di-clone selalu punya keduanya
//   setelah rilis). Langkah cek-kesehatan (6) memanggil 'kit.mjs doctor' bila ada, jika belum
//   diport jatuh ke 'kit.ps1 doctor' (kit.ps1 = mesin lama berikutnya yang diport setelah ini).
//
// BATAS JUJUR (§4.6): operasi NYATA (ambil dari internet + GPG + pasang-ulang + doctor) hanya bisa
//   diuji penuh saat owner RILIS + uji di mesin staff baru. Yang terverifikasi DI SINI = (a) semua
//   fungsi-logika murni (CHANGELOG/tier/repo-tepercaya/bersih-cadangan) uji-banding identik vs PS,
//   (b) jalur SIMULASI + cek-saja (tanpa jaringan) terstruktur benar. Real-run = uji lapangan owner.
// ===========================================================================================
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { removeGitMetadata } from './lib/git-helpers.mjs'
import { addLintasAuditEntry } from './lib/audit-helpers.mjs'
import { resolvePowerShellExe } from './lib/popup-shim.mjs'
import { stripBom, eqCI, backupStamp } from './lib/fs-text.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---- Konstanta (cermin update-kit.ps1) ----
const DEFAULT_REPO_URL = 'https://github.com/ojokesusu/lintasAI.git'

// Daftar repo TEPERCAYA (auto-lewati cek GPG untuk repo owner resmi). Filosofi: GPG = bukti SIAPA
// (penanda-tangan tag); daftar-putih repo = bukti DARI MANA (sumber clone). Untuk repo owner resmi,
// HTTPS+TLS + proteksi-branch GitHub sudah jamin integritas; GPG jadi lapis ke-3 yang boleh dilewati.
export const DEFAULT_TRUSTED_REPOS = [
  'https://github.com/ojokesusu/lintasAI.git',
  'https://github.com/ojokesusu/lintasAI',
  'git@github.com:ojokesusu/lintasAI.git',
]

// Daftar-putih URL untuk pra-cek anti-rantai-pasok (lebih ketat dari TrustedRepos: hanya .git resmi).
const ALLOWED_REPO_URLS = ['https://github.com/ojokesusu/lintasAI.git']

// Kata kunci Tier 2 (fitur/aturan baru) - spesifik supaya tak salah-vonis.
const TIER2_KEYWORDS = [
  'tambah section', 'fitur baru', 'aturan AI', 'aturan baru', 'panduan baru',
  'section baru', 'rule baru', 'tambah fitur', 'tambah aturan', 'tambah panduan',
]

// ---- Util kecil ---- (stripBom dari sumber bersama lib/fs-text.mjs, impor di atas)
function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
// eqCI -> sumber bersama lib/fs-text.mjs (impor di atas).

// Cap-waktu cadangan -> backupStamp (sumber bersama lib/fs-text.mjs).

// Normalisasi URL repo (cermin Test-LintasTrustedRepo PS): trim spasi -> buang semua '/' di akhir ->
// huruf-kecil -> buang akhiran '.git'. Supaya 'x/y.git' = 'x/y/' = 'x/y'.
function normalizeRepoUrl(u) {
  if (u == null) return null
  let n = String(u).trim().replace(/\/+$/, '').toLowerCase()
  if (n.endsWith('.git')) n = n.slice(0, -4)
  return n
}

// Urai versi gaya .NET [version] untuk X.Y.Z (2-4 komponen numerik). Return array angka panjang-4
// (komponen absen = -1, cermin .NET) atau null kalau gagal. JANGAN buang 'v' di sini (pemanggil yang buang).
export function parseDotNetVersion(s) {
  if (s == null) return null
  const parts = String(s).trim().split('.')
  if (parts.length < 2 || parts.length > 4) return null
  const nums = []
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null
    const n = Number(p)
    if (!Number.isSafeInteger(n) || n < 0) return null
    nums.push(n)
  }
  while (nums.length < 4) nums.push(-1)
  return nums
}
// Banding 2 array versi hasil parseDotNetVersion. Return -1/0/1, atau null kalau salah satu gagal-urai.
export function compareDotNetVersion(a, b) {
  const va = parseDotNetVersion(a), vb = parseDotNetVersion(b)
  if (va === null || vb === null) return null
  for (let i = 0; i < 4; i++) { if (va[i] !== vb[i]) return va[i] < vb[i] ? -1 : 1 }
  return 0
}

// ============================================================================================
// FUNGSI-LOGIKA MURNI (mudah diuji + jadi target uji-banding vs PS)
// ============================================================================================

// Bangun daftar repo tepercaya = bawaan + tambahan dari env LINTASAI_TRUSTED_REPOS (pisah koma).
export function getTrustedRepos(env = process.env) {
  const list = [...DEFAULT_TRUSTED_REPOS]
  if (env && env.LINTASAI_TRUSTED_REPOS) {
    const extra = String(env.LINTASAI_TRUSTED_REPOS).split(',').map((s) => s.trim()).filter(Boolean)
    list.push(...extra)
  }
  return list
}

// Tiruan Test-LintasTrustedRepo: cek apakah repoUrl cocok daftar tepercaya (sesudah normalisasi).
export function testTrustedRepo(repoUrl, trustedRepos = getTrustedRepos()) {
  if (repoUrl == null || String(repoUrl).trim() === '') return false
  const normalized = normalizeRepoUrl(repoUrl)
  for (const trusted of trustedRepos) {
    if (trusted == null || String(trusted).trim() === '') continue
    if (normalized === normalizeRepoUrl(trusted)) return true
  }
  return false
}

// Pra-cek daftar-putih URL (anti-rantai-pasok). Cermin PS `$RepoUrl -in $allowedRepoUrls`: banding
// PERSIS (TANPA normalisasi seperti testTrustedRepo) tapi TAK-peka huruf-besar-kecil (PS -in default
// case-insensitive). Diperbaiki via cek-silang 06-22: dulu pakai .includes() (peka huruf) -> URL resmi
// ber-huruf-besar salah-divonis "asing". Beda dari testTrustedRepo (yang utk lewati GPG + dinormalisasi).
export function isAllowedRepoUrl(repoUrl) {
  return ALLOWED_REPO_URLS.some((u) => eqCI(u, repoUrl))
}

// Tiruan Get-LatestChangelogEntry: ambil entri versi PALING ATAS (= terbaru) dari CHANGELOG.
// Pola heading FLEKSIBEL (cermin PS): "## [1.2.3]" (Keep-a-Changelog) / "## v1.2.3" (gaya lama).
// Return { version: '1.2.3' (tanpa 'v'), body: '...' } atau null. (Catatan: PS pakai \s* bukan \s+.)
export function getLatestChangelogEntry(changelogPath) {
  if (!changelogPath || !fs.existsSync(changelogPath)) return null
  let content
  try { content = fs.readFileSync(changelogPath, 'utf8') } catch { return null }
  content = stripBom(content)
  const lines = content.split(/\r\n|\r|\n/) // cermin Get-Content (PS 5.1): pecah \r\n, \r-tunggal, \n
  const versionPattern = /^##\s*\[?v?(\d+\.\d+\.\d+)\]?/
  let latestVersion = null
  const bodyLines = []
  let inLatest = false
  for (const line of lines) {
    const m = line.match(versionPattern)
    if (m) {
      if (latestVersion === null) { latestVersion = m[1]; inLatest = true; continue }
      break // heading versi kedua = berhenti, entri pertama sudah lengkap
    }
    if (inLatest) bodyLines.push(line)
  }
  if (latestVersion === null) return null
  return { version: latestVersion, body: bodyLines.join('\n').trim() }
}

// Tiruan Get-ChangelogRangeBody: gabung body SEMUA entri di rentang (fromExclusive, toInclusive].
// Dipakai supaya label keamanan di versi-TENGAH yang dilewati (mis. lompat v1.20 -> v1.33) tetap kebaca.
// Return string gabungan atau '' kalau gagal/kosong/from-to tak valid.
export function getChangelogRangeBody(changelogPath, fromVersionExclusive, toVersionInclusive) {
  try {
    if (!changelogPath || !fs.existsSync(changelogPath)) return ''
    let content
    try { content = fs.readFileSync(changelogPath, 'utf8') } catch { return '' }
    content = stripBom(content)
    const lines = content.split(/\r\n|\r|\n/)
    const versionPattern = /^##\s*\[?v?(\d+\.\d+\.\d+)\]?/
    const fromV = parseDotNetVersion(String(fromVersionExclusive).replace(/^v/, ''))
    const toV = parseDotNetVersion(String(toVersionInclusive).replace(/^v/, ''))
    if (fromV === null || toV === null) return ''
    const collect = []
    let inRange = false
    for (const line of lines) {
      const m = line.match(versionPattern)
      if (m) {
        const v = parseDotNetVersion(m[1])
        inRange = (v !== null && cmpArr(v, fromV) > 0 && cmpArr(v, toV) <= 0)
        continue // heading-nya sendiri tak ikut dikumpulkan
      }
      if (inRange) collect.push(line)
    }
    return collect.join('\n').trim()
  } catch { return '' }
}
function cmpArr(a, b) { for (let i = 0; i < 4; i++) { if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1 } return 0 }

// Pesan panduan AWAM saat gagal hubungi repo standar tim (ls-remote / clone). Penyebab tersering di
// lapangan = (a) repo TIM bersifat PRIVAT & kamu belum diundang/login Git, atau (b) Git belum
// terpasang. Pesan git mentah ("could not read Username for https://github.com") tak dimengerti staff
// non-programmer -> terjemahkan + beri langkah konkret. (Bukan selalu "jaringan" -> jangan menyesatkan.)
function printRepoAccessHint(repoUrl) {
  console.log('')
  console.log('Kemungkinan penyebab (cek dari atas ke bawah):')
  console.log('  1. Repo standar tim bersifat PRIVAT + kamu belum punya akses. Minta owner UNDANG akun')
  console.log("     GitHub-mu ke repo, lalu login Git sekali (Git Credential Manager / 'gh auth login').")
  console.log('  2. Git belum terpasang di komputer ini. Pasang dari https://git-scm.com/ lalu buka terminal baru.')
  console.log('  3. Sedang offline / jaringan kantor memblokir GitHub.')
  console.log(`  Repo yang dicoba: ${repoUrl}`)
}

// Tiruan Test-LintasChangelogLabel: deteksi label [SECURITY]/[BREAKING]/[SCAN-REQUIRED] di POSISI
// KONVENSIONAL awal baris. Dua pola (cermin update-kit.ps1):
//  (1) baris HEADING (#..######) yang DI MANA PUN memuat [LABEL] -> tangkap '### Diperbaiki [SECURITY]'
//      (label setelah teks judul, gaya entri CHANGELOG kit) + '### [SECURITY] ...' (label langsung).
//  (2) [LABEL] di AWAL baris setelah opsional butir (-/*) + bold (**) -> '- **[SECURITY]**', '[SECURITY]'.
// Anchored awal baris supaya penyebutan label di TENGAH prosa / di tengah butir-prosa TIDAK memicu
// alarm palsu. PS -match = TAK-peka huruf-besar-kecil -> flag 'i' (+ 'm' untuk ^ per-baris).
// SEJARAH: fix 2026-06-18 menambah '### [SECURITY]' (label langsung); fix 2026-06-25 menambah label
// SETELAH teks judul ('### Diperbaiki [SECURITY]') supaya banner keamanan tak hilang gara-gara gaya judul.
export function testChangelogLabel(body, label) {
  if (body == null || String(body).trim() === '') return false
  const esc = escapeRegex(label)
  const pattern = new RegExp(
    '^\\s*#{1,6}\\s+.*\\[' + esc + '\\]' +        // (1) baris heading memuat [LABEL] di mana pun
    '|^\\s*[-*]?\\s*\\*{0,2}\\[' + esc + '\\]',   // (2) [LABEL] di awal baris (butir/bold/polos)
    'mi'
  )
  return pattern.test(String(body))
}

// Tiruan Resolve-UpdateTier: klasifikasi "Tier 1".."Tier 4" dari isi entri CHANGELOG.
// Urutan cek (paling spesifik dulu): SCAN-REQUIRED -> BREAKING -> kata-kunci Tier 2 -> Tier 1 default.
export function resolveUpdateTier(entryBody) {
  try {
    if (entryBody == null || String(entryBody).trim() === '') return 'Tier 1'
    if (testChangelogLabel(entryBody, 'SCAN-REQUIRED')) return 'Tier 4'
    if (testChangelogLabel(entryBody, 'BREAKING')) return 'Tier 3'
    for (const kw of TIER2_KEYWORDS) {
      // PS -match = TAK-peka huruf-besar-kecil -> flag 'i'. Tak ter-anchor (cocok di mana saja).
      if (new RegExp(escapeRegex(kw), 'i').test(String(entryBody))) return 'Tier 2'
    }
    return 'Tier 1'
  } catch { return 'Tier 1' }
}

// Tiruan Format-UpdateSummary: susun ringkasan ramah staff non-programmer (pakai analogi tools digital).
// CATATAN PARITY: teks SENGAJA dipertahankan persis seperti PS (target uji-banding fungsi). PS pakai
// StringBuilder.AppendLine (akhir-baris Environment.NewLine = CRLF di Windows); versi Node pakai '\n'
// (akhir-baris beda = KOSMETIK; ringkasan dibaca manusia, dibanding per-baris saat uji-banding).
export function formatUpdateSummary(tier, entry) {
  const version = entry.version
  const body = entry.body
  let analogi = '', action = ''
  switch (tier) {
    case 'Tier 1':
      analogi = 'Tier 1 (kayak WhatsApp minor update, 2.23.10 -> 2.23.11)'
      action = 'Action: udah selesai. Tinggal pakai biasa, ga ada yang berubah cara kerjanya.'
      break
    case 'Tier 2':
      analogi = 'Tier 2 (kayak iPhone iOS 17.3 -> 17.4 minor, ada fitur baru)'
      action = 'Action: AI bakal otomatis pakai aturan/fitur baru sesi berikutnya. Restart chat = aman.'
      break
    case 'Tier 3':
      analogi = 'Tier 3 BREAKING (kayak iPhone iOS 16 -> iOS 17 major, backup wajib)'
      action = 'Action: BACA migration notes di CHANGELOG, jalanin PS commands yang tertera. Backup udah otomatis di .bak.'
      break
    case 'Tier 4':
      analogi = 'Tier 4 SCAN-REQUIRED (kayak Tokopedia ganti algoritma kategori, perlu re-mapping)'
      action = 'Action: paste ulang isi JALANKAN_KIT.md ke Claude Code. AI bakal re-scan project & re-bootstrap.'
      break
    default:
      analogi = 'Unknown tier - treat as Tier 1 (paling aman)'
      action = 'Action: pakai biasa, monitor sesi berikutnya.'
  }
  const lines = []
  lines.push('')
  lines.push('============================================================')
  lines.push(`  Kit Update Summary - v${version}`)
  lines.push('============================================================')
  lines.push(`Klasifikasi: ${analogi}`)
  lines.push('')
  lines.push(action)
  lines.push('')
  lines.push('--- CHANGELOG entry (verbatim) ---')
  if (body == null || String(body).trim() === '') lines.push('(entry kosong)')
  else lines.push(body)
  lines.push('============================================================')
  return lines.join('\n') + '\n' // tiap AppendLine PS tambah akhir-baris (termasuk yang terakhir)
}

// Tiruan Invoke-BackupCleanup: bersihkan berkas cadangan (*.bak / *.backup-*) di akar project +
// rotasi FOLDER cadangan (.claude-kit.backup-*). Hapus yang > maxAgeDays hari, lalu per nama-dasar
// simpan keepLatest terbaru. Return jumlah yang dihapus. Aman: folder tak ada / tak ada cadangan -> 0.
// Pencocokan nama TAK-peka huruf-besar-kecil (NTFS Windows; cermin Get-ChildItem -Filter).
export function invokeBackupCleanup(projectRoot = '.', { maxAgeDays = 30, keepLatest = 3 } = {}) {
  try {
    if (!fs.existsSync(projectRoot)) {
      console.log(`[WARN] Project root tidak ada: ${projectRoot}`)
      return 0
    }
    const listFiles = (matcher) => {
      let out = []
      try {
        for (const e of fs.readdirSync(projectRoot, { withFileTypes: true })) {
          if (e.isFile() && matcher(e.name.toLowerCase())) out.push(path.join(projectRoot, e.name))
        }
      } catch { /* abaikan */ }
      return out
    }
    const listDirs = (matcher) => {
      let out = []
      try {
        for (const e of fs.readdirSync(projectRoot, { withFileTypes: true })) {
          if (e.isDirectory() && matcher(e.name.toLowerCase())) out.push(path.join(projectRoot, e.name))
        }
      } catch { /* abaikan */ }
      return out
    }
    const isBak = (n) => n.endsWith('.bak')
    const isBackupDash = (n) => n.includes('.backup-')
    const isKitBackupDir = (n) => n.startsWith('.claude-kit.backup-')

    // Cermin PS: dua Get-ChildItem digabung (.bak DAN .backup-*).
    let backupFiles = [...listFiles(isBak), ...listFiles(isBackupDash)]
    const backupDirsPre = listDirs(isKitBackupDir)
    if (backupFiles.length === 0 && backupDirsPre.length === 0) {
      console.log('Cleanup: tidak ada cadangan (berkas/folder) ditemukan.')
      return 0
    }

    let removed = 0
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    const mtime = (p) => { try { return fs.statSync(p).mtimeMs } catch { return 0 } }

    // --- Langkah 1: hapus yang lebih tua dari maxAgeDays ---
    for (const f of backupFiles) {
      if (mtime(f) < cutoff) {
        try { fs.rmSync(f, { force: true }); removed++ }
        catch (e) { console.log(`[WARN] Gagal hapus ${path.basename(f)}: ${e.message}`) }
      }
    }

    // --- Langkah 2: per nama-dasar, simpan keepLatest terbaru ---
    // "Nama-dasar" = nama sebelum akhiran .bak / .backup-* (mis. AGENTS.md.backup-... -> "AGENTS.md").
    const remaining = [...listFiles(isBak), ...listFiles(isBackupDash)]
    const groups = new Map()
    for (const f of remaining) {
      const base = backupBaseName(path.basename(f))
      if (!groups.has(base)) groups.set(base, [])
      groups.get(base).push(f)
    }
    for (const [, grp] of groups) {
      if (grp.length <= keepLatest) continue
      const sorted = grp.slice().sort((a, b) => mtime(b) - mtime(a)) // terbaru dulu
      const excess = sorted.slice(keepLatest) // sisanya = paling lama
      for (const f of excess) {
        try { fs.rmSync(f, { force: true }); removed++ }
        catch (e) { console.log(`[WARN] Gagal hapus ${path.basename(f)}: ${e.message}`) }
      }
    }

    // --- Langkah 3: rotasi FOLDER cadangan .claude-kit.backup-* ---
    const backupDirs = listDirs(isKitBackupDir)
    if (backupDirs.length > keepLatest) {
      const excessDirs = backupDirs.slice().sort((a, b) => mtime(b) - mtime(a)).slice(keepLatest)
      for (const d of excessDirs) {
        try { fs.rmSync(d, { recursive: true, force: true }); removed++ }
        catch (e) { console.log(`[WARN] Gagal hapus folder cadangan ${path.basename(d)}: ${e.message}`) }
      }
    }

    console.log(`Cleanup: ${removed} cadangan/folder lama dihapus (> ${maxAgeDays} hari atau di luar ${keepLatest} terbaru).`)
    return removed
  } catch (e) {
    console.log(`[ERROR] Bersih-bersih cadangan gagal total: ${e.message}`)
    return 0
  }
}
// Nama-dasar berkas cadangan. Cermin PS -match (TAK-peka huruf-besar-kecil) -> flag 'i'.
function backupBaseName(name) {
  let m = name.match(/^(.+?)\.backup-/i)
  if (m) return m[1]
  m = name.match(/^(.+?)\.bak$/i)
  if (m) return m[1]
  return name
}

// ============================================================================================
// PENGURAIAN ARGUMEN
// ============================================================================================
export function parseArgs(argv) {
  const a = {
    noBackup: false,
    repoUrl: DEFAULT_REPO_URL,
    branch: 'main',
    dryRun: false,
    checkOnly: false,
    allowUntrustedRepo: false,
    force: false,
    allowUnsignedTag: false,
    cleanupBackups: false,
    yesDeleteNoBackup: false,
    projectRoot: null,
    noGui: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const t = String(argv[i]).toLowerCase()
    if (t === '--no-backup' || t === '--nobackup') a.noBackup = true
    else if (t === '--repo-url' || t === '--repourl') a.repoUrl = argv[++i] ?? a.repoUrl
    else if (t === '--branch') a.branch = argv[++i] ?? a.branch
    else if (t === '--dry-run' || t === '--dryrun' || t === '--simulasi') a.dryRun = true
    else if (t === '--check-only' || t === '--checkonly') a.checkOnly = true
    else if (t === '--allow-untrusted-repo' || t === '--allowuntrustedrepo') a.allowUntrustedRepo = true
    else if (t === '--force') a.force = true
    else if (t === '--allow-unsigned-tag' || t === '--allowunsignedtag') a.allowUnsignedTag = true
    else if (t === '--cleanup-backups' || t === '--cleanupbackups') a.cleanupBackups = true
    else if (t === '--yes-delete-no-backup' || t === '--yesdeletenobackup') a.yesDeleteNoBackup = true
    else if (t === '--no-gui' || t === '--nogui') a.noGui = true
    else if (t === '--project-root' || t === '--projectroot') a.projectRoot = argv[++i] ?? null
  }
  return a
}

// ============================================================================================
// ORKESTRATOR UTAMA
// ============================================================================================
// Pembungkus git tipis (cermin '& git ...'). Tak melempar; pemanggil cek .status.
function runGit(args, opts = {}) {
  const r = spawnSync('git', args, { cwd: opts.cwd, encoding: 'utf8', timeout: opts.timeout || 120000 })
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error }
}

// Urutkan daftar tag 'vX.Y.Z' versi-menurun (terbaru dulu); buang duplikat. Return array.
function sortTagsDesc(tags) {
  const uniq = [...new Set(tags)]
  return uniq.sort((a, b) => {
    const c = compareDotNetVersion(String(a).replace(/^v/, ''), String(b).replace(/^v/, ''))
    return c === null ? 0 : -c // menurun
  })
}

// Parse output 'git ls-remote --tags' jadi daftar tag 'vX.Y.Z' (urut menurun).
function parseRemoteTags(stdout) {
  const re = /refs\/tags\/(v\d+\.\d+\.\d+)(?:\^\{\})?$/
  const tags = []
  for (const line of String(stdout).split(/\r\n|\r|\n/)) {
    const m = line.match(re)
    if (m) tags.push(m[1])
  }
  return sortTagsDesc(tags)
}

export function runUpdate(argv) {
  const args = parseArgs(argv)

  // ---- Resolusi akar project (cermin update-kit.ps1:131-175) ----
  const projectRootExplicit = args.projectRoot != null && String(args.projectRoot).trim() !== ''
  let projectRoot
  if (!projectRootExplicit) {
    projectRoot = path.dirname(__dirname) // induk dari .claude-kit/ = akar project
  } else {
    try { projectRoot = fs.realpathSync(path.resolve(String(args.projectRoot))) }
    catch { console.log(`ERROR: --project-root tidak ditemukan: ${args.projectRoot}`); return 1 }
  }
  console.log(`Root proyek   : ${projectRoot}`)

  // ---- -Force = alias usang untuk --allow-untrusted-repo (peringatan, lalu set) ----
  if (args.force) {
    console.log('')
    console.log('[USANG] Bendera --force. Pakai --allow-untrusted-repo.')
    console.log('        --force masih bekerja sebagai alias lewati-daftar-putih-URL, tapi akan dihapus nanti.')
    console.log('        Untuk lewati GPG, pakai --allow-unsigned-tag (bukan --force).')
    console.log('')
    if (!args.allowUntrustedRepo) args.allowUntrustedRepo = true
  }

  // ---- Resolusi path (cermin: kalau --project-root eksplisit, kit = projectRoot/.claude-kit) ----
  const kitDir = projectRootExplicit ? path.join(projectRoot, '.claude-kit') : __dirname
  const kitFolderName = path.basename(kitDir)
  const timestamp = backupStamp(new Date())
  const backupDir = `${kitDir}.backup-${timestamp}`

  // ---- Validasi posisi: folder kit HARUS bernama .claude-kit (cermin uninstall.mjs hard-stop) ----
  // Kalau BUKAN: clone mendarat di '.claude-kit' (folder BARU) sementara backup/GPG/setup pakai kitDir
  // (folder LAMA) -> jadi 2 folder + langkah verifikasi/setup menyasar folder yang sudah jadi backup
  // (GPG fail-open, setup no-op). Fail-closed: BERHENTI di sini, jangan biarkan update separuh-jadi.
  if (kitFolderName !== '.claude-kit') {
    console.log('')
    console.log(`BERHENTI: Folder kit ini bernama '${kitFolderName}', bukan '.claude-kit'.`)
    console.log('          Update dirancang untuk Pola B (.claude-kit/ di akar proyek).')
    console.log('Kemungkinan:')
    console.log('  (A) Kamu jalankan dari folder SALAH (project ini belum pernah pasang lintasAI).')
    console.log('  (B) Folder kit di-rename dari .claude-kit ke nama lain (rename balik lalu ulangi).')
    console.log('')
    console.log('TIDAK ADA satu pun berkas yang disentuh. Aman.')
    return 1
  }

  console.log('')
  console.log('=== Update Kit lintasAI ===')
  console.log(`Kit folder    : ${kitDir}`)
  console.log(`Project root  : ${projectRoot}`)
  console.log(`Repo URL      : ${args.repoUrl}`)
  console.log(`Branch        : ${args.branch}`)
  console.log(`Backup        : ${args.noBackup ? 'DIMATIKAN (--no-backup)' : backupDir}`)
  if (args.dryRun) console.log('Mode          : SIMULASI (tidak ada perubahan berkas)')
  console.log('')

  // ---- Pra-cek: git terpasang ----
  const gitVer = runGit(['--version'])
  if (gitVer.error || gitVer.status !== 0) {
    console.log('ERROR: git tidak terpasang atau tidak di PATH.')
    console.log('       Pasang dari https://git-scm.com/ lalu buka terminal baru.')
    return 1
  }
  console.log(`OK    Git terdeteksi: ${(gitVer.stdout || '').trim()}`)

  // ---- Pra-cek: daftar-putih URL (anti-rantai-pasok) ----
  if (!args.checkOnly && !isAllowedRepoUrl(args.repoUrl)) {
    console.log(`PERINGATAN: Repo URL '${args.repoUrl}' BUKAN di daftar-putih. Default: github.com/ojokesusu/lintasAI.`)
    console.log('PERINGATAN: Detail setup repo tepercaya: docs/SIGNED_RELEASE.md')
    if (!args.allowUntrustedRepo) {
      // Non-interaktif: default-AMAN = BATAL. Untuk lanjut, pakai --allow-untrusted-repo (atau --force).
      console.log('BATAL: repo di luar daftar-putih. Kalau yakin sumbernya tepercaya, ulangi dengan --allow-untrusted-repo.')
      console.log('       (Verifikasi dulu URL-nya ke owner lewat jalur aman sebelum memaksa.)')
      return 1
    }
    console.log('--allow-untrusted-repo aktif: lewati cek daftar-putih (TIDAK AMAN).')
  }

  // ---- Pra-cek: deteksi versi kit sekarang (dari .install-manifest.json) ----
  const manifestPath = path.join(kitDir, '.install-manifest.json')
  let currentVersion = null
  let manifestPresent = false
  if (fs.existsSync(manifestPath)) {
    manifestPresent = true
    try {
      const raw = stripBom(fs.readFileSync(manifestPath, 'utf8'))
      const obj = JSON.parse(raw)
      if (obj && obj.metadata && obj.metadata.kit_version) {
        currentVersion = String(obj.metadata.kit_version).replace(/^v/, '').trim()
      }
    } catch (e) {
      console.log(`WARN  Gagal urai .install-manifest.json: ${e.message}`)
    }
  }
  const canCheckRemote = Boolean(currentVersion)
  if (currentVersion) {
    console.log(`OK    Versi sekarang (manifest): ${currentVersion}`)
  } else if (manifestPresent) {
    console.log('WARN  manifest ada tapi metadata.kit_version kosong - lewati cek versi.')
    currentVersion = 'unknown'
  } else {
    console.log('INFO  .install-manifest.json tidak ada - anggap pasang-baru, lewati cek versi.')
    currentVersion = 'unknown'
  }

  // ---- Pra-cek: tanya tag terbaru di remote (cuma kalau ada baseline + bukan SIMULASI) ----
  let latestVersion = null
  if (canCheckRemote && !args.dryRun) {
    console.log('')
    console.log('Cek versi terbaru di remote...')
    let lsRemoteOk = false
    const ls = runGit(['ls-remote', '--tags', args.repoUrl])
    if (ls.status === 0 && ls.stdout) {
      lsRemoteOk = true
      const tags = parseRemoteTags(ls.stdout)
      if (tags.length > 0) latestVersion = tags[0]
    }

    if (!lsRemoteOk) {
      console.log('WARN  Gagal mengambil daftar versi dari repo standar tim.')
      printRepoAccessHint(args.repoUrl)
      if (args.checkOnly) {
        console.log('')
        console.log('[i] Mode cek-saja: belum bisa banding versi. Beresin akses di atas lalu coba lagi.')
        return 0
      }
      // Non-interaktif: tak memaksa update buta -> BATAL aman (kit lama TIDAK diubah).
      console.log('')
      console.log('Dibatalkan (aman): kit lama TIDAK diubah. Beresin akses di atas lalu jalankan update lagi.')
      return 0
    } else if (latestVersion == null || String(latestVersion).trim() === '') {
      console.log('WARN  Tag remote tak ditemukan/terbaca - lanjut update dengan peringatan.')
    } else {
      const currentNorm = String(currentVersion).replace(/^v/, '').trim()
      const latestNorm = String(latestVersion).replace(/^v/, '').trim()
      if (currentNorm === latestNorm) {
        console.log(`[OK] Sudah versi terbaru (${currentVersion}). Tidak ada update.`)
        return 0
      }
      const cmp = compareDotNetVersion(currentNorm, latestNorm)
      if (cmp !== null && cmp >= 0) {
        console.log(`[OK] Versi lokal (${currentVersion}) >= remote terbaru (${latestVersion}). Tidak ada update.`)
        return 0
      }
      console.log(`[INFO] Update tersedia: ${currentVersion} -> ${latestVersion}`)
    }
  }

  // ---- Mode cek-saja (cuma-baca): lapor status lalu berhenti TANPA mengubah apa pun ----
  if (args.checkOnly) {
    if (!canCheckRemote) {
      console.log('[i] Belum bisa banding versi (belum ada catatan-pasang / pasang-baru).')
      console.log("    Cek versi terbaru di npm: jalankan 'npm view lintasai version'.")
    }
    console.log('Mode cek-saja: TIDAK ada perubahan dilakukan.')
    console.log("Kalau mau update: minta AI 'tolong update kit', atau jalankan '.\\.claude-kit\\kit.ps1 update'.")
    return 0
  }

  // Ingatkan editan DI DALAM .claude-kit/ akan diganti (versi lama aman di folder cadangan).
  if (!args.dryRun && !args.noBackup) {
    console.log('')
    console.log('Catatan: kalau kamu pernah MENGEDIT berkas DI DALAM .claude-kit/ (mis. aturan lokal),')
    console.log('         editan itu akan diganti versi baru; versi lamamu tetap aman di folder cadangan.')
  }

  // Pulihkan folder cadangan kit lama (fail-closed). Dipakai saat clone gagal ATAU verifikasi GPG
  // gagal/tak-bisa-diikat -> JANGAN biarkan kit BARU yang belum lolos pemeriksaan tetap aktif;
  // kembalikan kit lama (yang sudah terverifikasi). Audit P2 2026-06-23: dulu jalur abort-GPG
  // `return 1` TANPA pulihkan cadangan -> kit tak-terverifikasi malah jadi aktif (fail-closed TERBALIK).
  function restoreBackupOrWarn() {
    if (!args.noBackup && fs.existsSync(backupDir)) {
      console.log('')
      console.log('PEMULIHAN: kembalikan folder cadangan (kit lama yang sudah terverifikasi)...')
      try {
        if (fs.existsSync(kitDir)) { try { fs.rmSync(kitDir, { recursive: true, force: true }) } catch { /* best-effort */ } }
        fs.renameSync(backupDir, kitDir)
        console.log(`OK    Cadangan dipulihkan. Kit lama aktif lagi di ${kitDir}`)
      } catch (e) {
        console.log(`GAGAL pulihkan: ${e.message}`)
        console.log(`       Pulihkan manual: pindahkan '${backupDir}' ke '${kitDir}'`)
      }
    } else {
      console.log('TIDAK ada cadangan untuk dipulihkan (--no-backup aktif atau folder cadangan tak ada).')
    }
  }

  // ---- Langkah 1: Cadangkan .claude-kit/ lama ----
  if (!args.noBackup) {
    if (args.dryRun) {
      console.log(`[SIMULASI] Akan cadangkan: ${kitDir} -> ${backupDir}`)
    } else {
      console.log('')
      console.log('Langkah 1: Cadangkan .claude-kit/ lama...')
      try {
        fs.renameSync(kitDir, backupDir)
        console.log(`OK    Cadangan: ${backupDir}`)
      } catch (e) {
        console.log(`ERROR: Cadangan gagal: ${e.message}`)
        console.log('       Mungkin ada berkas terkunci (editor terbuka, antivirus scan).')
        return 1
      }
    }
  } else {
    console.log('Langkah 1: Lewati cadangan (--no-backup aktif)')
    // Tanpa cadangan = hapus PERMANEN (tak bisa dibalik). Non-interaktif: WAJIB --yes-delete-no-backup.
    if (!args.dryRun) {
      if (!args.yesDeleteNoBackup) {
        console.log('BATAL: --no-backup akan HAPUS PERMANEN kit lama tanpa cadangan.')
        console.log('       Kalau yakin, ulangi dengan --yes-delete-no-backup (atau jalankan TANPA --no-backup supaya aman).')
        return 1
      }
      try {
        fs.rmSync(kitDir, { recursive: true, force: true })
        console.log('OK    Kit lama dihapus.')
      } catch (e) {
        console.log(`ERROR: Gagal hapus kit lama: ${e.message}`)
        return 1
      }
    }
  }

  // ---- Langkah 2: Ambil (clone) versi baru ke .claude-kit/ baru ----
  console.log('')
  console.log('Langkah 2: Ambil versi baru dari GitHub...')
  // Pin ke TAG RILIS (bukan branch 'main' yang berjalan) supaya mendarat di kode sama dgn pasang-baru npm.
  let cloneRef = args.branch
  if (args.branch === 'main' && latestVersion != null && String(latestVersion).trim() !== '') {
    cloneRef = latestVersion
    console.log(`  Pin ke versi rilis: ${cloneRef} (bukan 'main' yang bisa berisi kerjaan belum-rilis)`)
  }

  if (args.dryRun) {
    console.log(`[SIMULASI] git clone --depth 1 -b ${cloneRef} ${args.repoUrl} '${kitDir}'`)
    console.log(`           (real run: pin ke tag rilis terbaru; '${cloneRef}' di SIMULASI = fallback karena cek-versi dilewati)`)
  } else {
    let cloneOk = false
    let cloneErrorMsg = ''
    const clone = runGit(['clone', '--depth', '1', '-b', cloneRef, args.repoUrl, '.claude-kit'], { cwd: projectRoot })
    if (clone.error) {
      cloneErrorMsg = `git clone gagal dijalankan: ${clone.error.message}`
    } else if (clone.status === 0) {
      cloneOk = true
      console.log('OK    Ambil selesai.')
    } else {
      cloneErrorMsg = `git clone kode-keluar: ${clone.status}. ${(clone.stderr || '').trim()}`
    }

    if (!cloneOk) {
      console.log('')
      console.log(`ERROR: ${cloneErrorMsg}`)
      printRepoAccessHint(args.repoUrl)
      // Pulihkan cadangan (WAJIB jalan kalau clone gagal).
      restoreBackupOrWarn()
      return 1
    }
  }

  // ---- Langkah 2b: Verifikasi tanda tangan tag (GPG) sebelum hapus .git/ ----
  // FAIL-CLOSED: kalau verifikasi gagal -> BATAL, kecuali --allow-unsigned-tag.
  if (!args.dryRun && fs.existsSync(path.join(kitDir, '.git'))) {
    console.log('')
    console.log('Langkah 2b: Verifikasi tanda tangan tag (GPG)...')

    if (testTrustedRepo(args.repoUrl)) {
      console.log(`[OK] Repo URL: ${args.repoUrl} (repo owner tepercaya, cek GPG dilewati)`)
      addLintasAuditEntry({ source: 'update-kit.mjs', action: 'gpg-check-skipped', detail: `repo=${args.repoUrl} branch=${args.branch} reason=trusted-repo-whitelist`, auditDir: kitDir })
    } else {
      // Resolusi nama tag yang menunjuk HEAD hasil clone.
      let resolvedTag = null
      const describe = runGit(['-C', kitDir, 'describe', '--exact-match', '--tags', 'HEAD'])
      if (describe.status === 0 && describe.stdout) {
        resolvedTag = String(describe.stdout).split(/\r\n|\r|\n/)[0].trim() || null
        if (resolvedTag) console.log(`  Tag di HEAD (describe --exact-match): ${resolvedTag}`)
      }
      // Fallback: tag terbaru dari ls-remote (kalau HEAD bukan commit ber-tag).
      if (!resolvedTag) {
        console.log('  HEAD bukan tag tepat - fallback ke tag terbaru via ls-remote...')
        const lsTags = runGit(['ls-remote', '--tags', args.repoUrl])
        if (lsTags.status === 0 && lsTags.stdout) {
          const tags = parseRemoteTags(lsTags.stdout)
          if (tags.length > 0) {
            resolvedTag = tags[0]
            console.log(`  Tag terbaru remote: ${resolvedTag}`)
            // Ambil object tag spesifik supaya verify-tag bisa membacanya.
            runGit(['-C', kitDir, 'fetch', '--depth', '1', 'origin', `refs/tags/${resolvedTag}:refs/tags/${resolvedTag}`])
          }
        }
      }

      if (!resolvedTag) {
        if (args.allowUnsignedTag) {
          console.log('PERINGATAN: Tak ada tag GPG yang bisa di-resolve, tapi --allow-unsigned-tag aktif. Lewati verifikasi (TIDAK AMAN).')
        } else {
          console.log('BATAL: tak ada tag yang bisa di-resolve dari HEAD maupun ls-remote (rilis belum di-tag?).')
          console.log('       Pakai --allow-unsigned-tag untuk lewati (TIDAK AMAN). Setup kunci publik: docs/SIGNED_RELEASE.md')
          restoreBackupOrWarn() // fail-closed: jangan biarkan kit baru tak-terverifikasi aktif (audit P2).
          return 1
        }
      } else {
        const verify = runGit(['-C', kitDir, 'verify-tag', resolvedTag])
        if (verify.status === 0) {
          console.log(`[OK] Tanda tangan GPG tag ${resolvedTag} terverifikasi`)
          addLintasAuditEntry({ source: 'update-kit.mjs', action: 'gpg-check-passed', detail: `repo=${args.repoUrl} tag=${resolvedTag}`, auditDir: kitDir })
          // P1 (audit 2026-06-23): IKAT isi yang dipasang ke commit tag terverifikasi. verify-tag
          // HANYA memeriksa tanda tangan TAG, bukan menjamin isi yang di-clone (HEAD 'main' yang
          // bergerak, atau clone yang mendarat di branch) SAMA dengan commit bertanda-tangan itu.
          // checkout mengikat isi terpasang = isi terverifikasi (pola docs/SIGNED_RELEASE.md:111).
          // Gagal mengikat -> perlakukan sebagai gagal verifikasi (fail-closed: pulihkan kit lama).
          const bind = runGit(['-C', kitDir, 'checkout', '--quiet', `refs/tags/${resolvedTag}`])
          if (bind.status !== 0) {
            const bindDetail = `${(bind.stdout || '').trim()} ${(bind.stderr || '').trim()}`.trim()
            console.log(`[GAGAL] Tak bisa mengikat isi ke commit tag terverifikasi ${resolvedTag}${bindDetail ? ' (' + bindDetail + ')' : ''}.`)
            addLintasAuditEntry({ source: 'update-kit.mjs', action: 'gpg-bind-failed', detail: `repo=${args.repoUrl} tag=${resolvedTag} aborted=true`, auditDir: kitDir })
            console.log('BATAL: isi terpasang tak bisa dipastikan = isi yang terverifikasi.')
            restoreBackupOrWarn() // fail-closed: kembalikan kit lama terverifikasi (audit P1).
            return 1
          }
          console.log(`[OK] Isi terpasang diikat ke commit tag ${resolvedTag} (yang dipasang = yang terverifikasi).`)
        } else {
          console.log(`[GAGAL] Tag ${resolvedTag} bukan GPG-signed valid (atau kunci publik owner belum di-import)`)
          const detail = `${(verify.stdout || '').trim()} ${(verify.stderr || '').trim()}`.trim()
          if (detail) console.log(`Detail: ${detail}`)
          console.log('Setup kunci publik owner: docs/SIGNED_RELEASE.md')
          if (args.allowUnsignedTag) {
            console.log('PERINGATAN: Bypass via --allow-unsigned-tag aktif: lanjut tanpa verifikasi (TIDAK AMAN).')
            addLintasAuditEntry({ source: 'update-kit.mjs', action: 'gpg-check-bypassed', detail: `repo=${args.repoUrl} tag=${resolvedTag} reason=AllowUnsignedTag-flag UNSAFE=true`, auditDir: kitDir })
          } else {
            addLintasAuditEntry({ source: 'update-kit.mjs', action: 'gpg-check-failed', detail: `repo=${args.repoUrl} tag=${resolvedTag} aborted=true`, auditDir: kitDir })
            console.log(`BATAL: verify-tag ${resolvedTag} gagal. Pakai --allow-unsigned-tag untuk lewati (TIDAK AMAN).`)
            restoreBackupOrWarn() // fail-closed: kembalikan kit lama terverifikasi (audit P2).
            return 1
          }
        }
      }
    }
  }

  // ---- Langkah 3: Hapus .git/ internal (pakai suku cadang Node removeGitMetadata) ----
  console.log('')
  console.log('Langkah 3: Hapus .git/ internal supaya tak bentrok dengan git proyek...')
  if (args.dryRun) {
    console.log(`[SIMULASI] hapus folder ${path.join(kitDir, '.git')}`)
  } else if (fs.existsSync(path.join(kitDir, '.git'))) {
    if (removeGitMetadata(kitDir)) console.log('OK    .git/ internal dihapus.')
    else console.log(`WARN  Gagal hapus .git/. Hapus manual folder: ${path.join(kitDir, '.git')}`)
  }

  // ---- Langkah 4: Jalankan ulang pemasang (-Force, anti-timpa docs/) ----
  console.log('')
  console.log('Langkah 4: Jalankan ulang pemasang (anti-timpa untuk docs/ yang sudah ada)...')
  if (args.dryRun) {
    console.log(`[SIMULASI] jalankan pemasang ulang: setup-pola-b (--force --project-root '${projectRoot}')`)
  } else {
    const setupMjs = path.join(kitDir, 'setup-pola-b.mjs')
    const setupPs1 = path.join(kitDir, 'setup-pola-b.ps1')
    if (fs.existsSync(setupMjs)) {
      // Utamakan pemasang Node (arah konsolidasi ADR-004; sama efek = berkas ter-deploy identik).
      const r = spawnSync(process.execPath, [setupMjs, '--force', '--project-root', projectRoot], { stdio: 'inherit', timeout: 600000 })
      if (r.error || r.status !== 0) {
        console.log(`WARN  Pemasang Node bermasalah (kode ${r.status ?? 'error'}). Berkas kit sudah ter-ambil, tapi setup mungkin tak komplit.`)
      }
    } else if (fs.existsSync(setupPs1)) {
      const psExe = resolvePowerShellExe()
      const r = spawnSync(psExe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', setupPs1, '-Force', '-ProjectRoot', projectRoot], { stdio: 'inherit', timeout: 600000 })
      if (r.error || r.status !== 0) {
        console.log(`WARN  Pemasang PowerShell bermasalah (kode ${r.status ?? 'error'}). Jalankan manual: .\\.claude-kit\\setup-pola-b.ps1 -Force`)
      }
    } else {
      console.log('WARN  Pemasang (setup-pola-b) tak ada di kit baru - lewati.')
    }
  }

  // ---- Langkah 5: Deteksi versi baru + beda CHANGELOG + peringatan label ----
  if (!args.dryRun) {
    const newChangelog = path.join(kitDir, 'CHANGELOG.md')
    let newVersion = 'unknown'
    let newEntry = null
    if (fs.existsSync(newChangelog)) {
      newEntry = getLatestChangelogEntry(newChangelog)
      if (newEntry && newEntry.version) newVersion = String(newEntry.version).replace(/^v/, '').trim()
    }

    console.log('')
    console.log('=== Update selesai ===')
    console.log(`Versi lama   : v${currentVersion}`)
    console.log(`Versi baru   : v${newVersion}`)

    if (currentVersion !== newVersion && newVersion !== 'unknown') {
      console.log('')
      console.log(`Update v${currentVersion} -> v${newVersion} sukses!`)

      let breakingFound = false, scanRequiredFound = false, securityFound = false
      if (newEntry && newEntry.body) {
        let entryText = newEntry.body
        // Pindai SELURUH rentang (versi-lama, versi-baru] supaya label di versi-tengah yang dilewati kebaca.
        if (currentVersion && currentVersion !== 'unknown') {
          const rangeBody = getChangelogRangeBody(newChangelog, currentVersion, newVersion)
          if (rangeBody && rangeBody.trim() !== '') entryText = rangeBody
        }
        if (testChangelogLabel(entryText, 'BREAKING')) breakingFound = true
        if (testChangelogLabel(entryText, 'SCAN-REQUIRED')) scanRequiredFound = true
        if (testChangelogLabel(entryText, 'SECURITY')) securityFound = true
      }

      if (breakingFound || scanRequiredFound || securityFound) {
        console.log('')
        console.log('================================================================')
        console.log('  PERHATIAN: VERSI INI ADA PERUBAHAN PENTING')
        console.log('================================================================')
        if (securityFound) {
          console.log('  [SECURITY] Perbaikan KEAMANAN - pasang SEGERA, jangan tunda.')
          console.log('             (Walau update kecil, ini menambal lubang keamanan.)')
        }
        if (breakingFound) {
          console.log('  [BREAKING] Ada perubahan yang tidak backward-compatible.')
          console.log(`             Baca CHANGELOG entri v${newVersion} sebelum lanjut kerja.`)
        }
        if (scanRequiredFound) {
          console.log('  [SCAN-REQUIRED] Wajib regenerate docs/ supaya kompatibel.')
          console.log('                  Re-paste isi .claude-kit\\PROJECT_LIFECYCLE_PROMPT_v1.md (Stage 2: Bikin Catatan Proyek)')
          console.log('                  ke Claude Code untuk regenerate docs lama.')
        }
        console.log('================================================================')
      }

      console.log('')
      console.log('Langkah lanjut yang disarankan:')
      console.log(`  1. Baca CHANGELOG entri [v${newVersion}]:`)
      console.log(`     ${newChangelog}`)
      console.log('  2. Verifikasi berkas baru di docs/ + .github/ (kalau ada di catatan rilis).')
      console.log('  3. Versi kit dibaca OTOMATIS dari baris atas .claude-kit/CHANGELOG.md (kini')
      console.log(`     v${newVersion}) - TIDAK perlu edit AGENTS.md manual. Kalau AGENTS.md-mu masih`)
      console.log("     punya baris lama 'Versi kit di .claude-kit/: vX.Y.Z', itu tak dipakai lagi (boleh dihapus).")
      if (!breakingFound && !scanRequiredFound && !securityFound) {
        console.log('  4. Tidak ada label [BREAKING]/[SCAN-REQUIRED]/[SECURITY] - docs/ kamu AMAN, tak perlu scan ulang.')
        console.log('  5. Kalau CHANGELOG sebut perubahan alur di JALANKAN_KIT.md:')
        console.log('     Re-paste isi .claude-kit\\JALANKAN_KIT.md ke Claude Code.')
      } else {
        console.log('  4. WAJIB ikuti instruksi PERHATIAN di atas sebelum kerja lanjut.')
      }
    } else if (currentVersion === newVersion) {
      console.log('')
      console.log(`Tidak ada perubahan versi (v${currentVersion}). Update mungkin cuma perbaikan kecil.`)
      console.log('Cek CHANGELOG untuk detail.')
    }

    // ---- Langkah 6: Cek kesehatan kit baru (doctor) ----
    const newKitMjs = path.join(kitDir, 'kit.mjs')
    const newKitPs1 = path.join(kitDir, 'kit.ps1')
    let doctorExit = null
    if (fs.existsSync(newKitMjs)) {
      console.log('')
      console.log('Langkah 6: Cek kesehatan kit baru (doctor)...')
      const r = spawnSync(process.execPath, [newKitMjs, 'doctor'], { stdio: 'inherit', timeout: 300000 })
      doctorExit = r.error ? 1 : r.status
    } else if (fs.existsSync(newKitPs1)) {
      console.log('')
      console.log('Langkah 6: Cek kesehatan kit baru (doctor)...')
      const psExe = resolvePowerShellExe()
      const r = spawnSync(psExe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', newKitPs1, 'doctor'], { stdio: 'inherit', timeout: 300000 })
      doctorExit = r.error ? 1 : r.status
    }
    if (doctorExit !== null && doctorExit !== 0) {
      console.log('')
      console.log(`WARN  Doctor menemukan masalah di kit baru (kode ${doctorExit}) - update mungkin tak lengkap.`)
      if (!args.noBackup && fs.existsSync(backupDir)) {
        console.log('      Versi lama AMAN tersimpan UTUH di folder cadangan:')
        console.log(`        ${backupDir}`)
        console.log("      Cara balik ke versi lama (paling mudah): minta AI -> 'rollback dong'")
        console.log('      Atau manual - kembalikan folder cadangan (2 langkah):')
        console.log(`        1) pindahkan '${kitDir}' ke '${kitDir}.broken-${timestamp}'`)
        console.log(`        2) pindahkan '${backupDir}' ke '${kitDir}'`)
        console.log("      (CATATAN: 'rollback' hanya memulihkan berkas project per-satuan, BUKAN folder kit ini.)")
      } else {
        console.log('      Tidak ada cadangan (--no-backup) - perbaiki manual: jalankan update lagi.')
      }
    } else if (doctorExit === 0) {
      console.log('OK    Kit baru sehat (doctor lulus).')
    }

    if (!args.noBackup && fs.existsSync(backupDir)) {
      console.log('')
      console.log('Cadangan lama tersimpan di:')
      console.log(`  ${backupDir}`)
      console.log('')
      console.log('Hapus cadangan kalau sudah yakin update sukses:')
      console.log(`  hapus folder '${backupDir}'`)
    }
  }

  console.log('')

  // ---- Klasifikasi tier + ringkasan (selalu jalan, non-fatal) ----
  try {
    console.log('')
    console.log('[*] Klasifikasi tier update dari CHANGELOG...')
    let changelogPath = path.join(kitDir, 'CHANGELOG.md')
    if (!fs.existsSync(changelogPath)) changelogPath = path.join(process.cwd(), '.claude-kit', 'CHANGELOG.md')
    const entry = getLatestChangelogEntry(changelogPath)
    if (entry) {
      const tier = resolveUpdateTier(entry.body)
      const summary = formatUpdateSummary(tier, entry)
      console.log(summary)
    } else {
      console.log('[WARN] Lewati klasifikasi tier - CHANGELOG tak bisa diurai.')
    }
  } catch (e) {
    console.log(`[WARN] Klasifikasi tier error (non-fatal): ${e.message}`)
  }

  // ---- Bersih-bersih cadangan - OPT-IN via --cleanup-backups (default MATI) ----
  if (args.cleanupBackups) {
    try {
      console.log('')
      console.log('[*] Bersih-bersih cadangan lama (--cleanup-backups aktif)...')
      const rootForCleanup = projectRoot || '.'
      invokeBackupCleanup(rootForCleanup, { maxAgeDays: 30, keepLatest: 3 })
    } catch (e) {
      console.log(`[WARN] Bersih-bersih cadangan error (non-fatal): ${e.message}`)
    }
  } else {
    console.log('')
    console.log('[i] Bersih-bersih cadangan DILEWATI (opt-in via --cleanup-backups).')
    console.log('    Berkas *.bak / *.backup-* di akar proyek tidak diutak-atik.')
    console.log('    Jalankan ulang dengan --cleanup-backups kalau mau auto-hapus cadangan > 30 hari.')
  }

  console.log('OK update-kit.mjs selesai.')
  return 0
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  process.exitCode = runUpdate(process.argv.slice(2))
}
