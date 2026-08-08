#!/usr/bin/env node
// lib/access-verify.mjs - Verifikator Akses: banding "siapa tim yang BISA akses repo di GitHub-NYATA"
// vs "yang TERCATAT di Buku Induk (lintasai-portfolio.yml)". CUMA-LAPOR SELISIH - READ-ONLY.
//
// KENAPA ADA: ACCESS_CONTROL_NREPO_v1.md "Cek-akses BULANAN" minta banding GitHub vs Buku Induk lalu
// cetak selisih - selama ini 100% manual. Robot ini mengotomasi BAGIAN BACA + BANDING saja. Tindakan
// (cabut/undang) TETAP MANUSIA (owner klik GitHub). TIDAK ADA fungsi mengubah izin di modul ini.
//
// 🚨 ANTI RASA-AMAN-PALSU (paling penting): kalau `gh` (GitHub CLI) tak terpasang / belum login /
// gagal baca -> robot BERHENTI + lapor KERAS (exit !=0). DILARANG diam-diam mengembalikan "tak ada
// selisih" saat sebenarnya data GAGAL dibaca - itu menipu owner mengira akses aman.
//
// READ-ONLY: cuma `gh api` GET (baca) + baca Buku Induk + tulis audit-log. Tak ada PUT/DELETE/POST.
// Dependency: gh CLI + auth + GitHub ORGANISASI (endpoint /repos/<owner>/<repo>/teams butuh org;
// akun personal tak punya "teams" -> robot melapor jelas). fetchTeams DISUNTIK (injectable) -> logika
// banding bisa diuji penuh tanpa gh/jaringan (tests/access-verify.test.mjs).
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readLintasPortfolio } from './portfolio-read.mjs'
import { addLintasAuditEntry } from './audit-helpers.mjs'

const PORTFOLIO_FILE = 'lintasai-portfolio.yml'

// Banding PURE: set tim yang DIHARAPKAN (Buku Induk) vs NYATA (GitHub). Return selisih dua arah.
// extra   = punya akses di GitHub TAPI tak terdaftar di Buku Induk (akses berlebih / lupa cabut).
// missing = terdaftar di Buku Induk TAPI tak punya akses di GitHub (kurang akses / belum diundang).
export function compareTeams(expected, actual) {
  const E = new Set(expected || [])
  const A = new Set(actual || [])
  const extra = (actual || []).filter((t) => !E.has(t))
  const missing = (expected || []).filter((t) => !A.has(t))
  return { extra, missing, match: extra.length === 0 && missing.length === 0 }
}

// PRA-CEK gh usable. Throw (STOP) kalau gh tak ada / belum login. Anti rasa-aman-palsu.
export function realPreflight() {
  let r
  try {
    r = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' })
  } catch (e) {
    throw new Error(`gh CLI tidak bisa dijalankan: ${e.message}`)
  }
  if (r.error) {
    if (r.error.code === 'ENOENT') throw new Error('gh CLI tidak terpasang. Pasang dari https://cli.github.com lalu jalankan: gh auth login.')
    throw new Error(`gh CLI gagal dijalankan: ${r.error.message}`)
  }
  if (r.status !== 0) throw new Error(`gh belum login / tidak terotorisasi. Jalankan: gh auth login. ${(r.stderr || '').trim()}`)
}

// Ambil daftar slug tim yang punya akses ke 1 repo (GET, read-only). Throw kalau gagal (jangan
// kembalikan array kosong diam-diam - itu rasa-aman-palsu: "tak ada tim" != "gagal baca").
export function realFetchTeams(owner, repo) {
  let r
  try {
    r = spawnSync('gh', ['api', `/repos/${owner}/${repo}/teams`, '--paginate', '--jq', '.[].slug'], { encoding: 'utf8' })
  } catch (e) {
    throw new Error(`gh gagal untuk repo "${repo}": ${e.message}`)
  }
  if (r.error) throw new Error(`gh gagal untuk repo "${repo}": ${r.error.message}`)
  if (r.status !== 0) throw new Error(`gh api gagal untuk repo "${repo}" (cek owner=organisasi? repo ada? auth?): ${(r.stderr || '').trim()}`)
  return r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
}

// Orkestrasi: baca Buku Induk -> pra-cek gh -> per repo banding tim NYATA vs HARAPAN -> laporan.
// fetchTeams + preflight DISUNTIK (default real gh) supaya bisa diuji tanpa gh.
export function verifyAccess({ portfolioPath, owner = null, fetchTeams = realFetchTeams, preflight = realPreflight, auditDir = null } = {}) {
  const data = readLintasPortfolio(portfolioPath)
  if (!data.Present) {
    throw new Error(`Buku Induk tidak ada di "${portfolioPath}". Buat dulu (minta AI: "buatkan Buku Induk akses").`)
  }
  const ownerResolved = owner || data.GithubOwner
  if (!ownerResolved) throw new Error('github_owner tak diketahui (isi di Buku Induk atau pakai --owner).')

  // PRA-CEK gh DULU. Gagal -> THROW (STOP seluruh proses). JANGAN lanjut + JANGAN klaim aman.
  preflight()

  const repos = []
  for (const r of data.Repos) {
    const expected = r.allowed_teams || []
    try {
      const actual = fetchTeams(ownerResolved, r.name)
      const cmp = compareTeams(expected, actual)
      repos.push({ name: r.name, access_tier: r.access_tier, expected, actual, extra: cmp.extra, missing: cmp.missing, status: cmp.match ? 'cocok' : 'beda' })
    } catch (e) {
      // 1 repo gagal dibaca != seluruh gagal. Tandai 'gagal-baca' (BUKAN 'cocok') + lanjut repo lain.
      repos.push({ name: r.name, access_tier: r.access_tier, expected, actual: null, extra: [], missing: [], status: 'gagal-baca', error: e.message })
    }
  }
  const drift = repos.filter((r) => r.status === 'beda').length
  const unreadable = repos.filter((r) => r.status === 'gagal-baca').length
  addLintasAuditEntry({
    source: 'access-verify', action: 'verify',
    detail: `owner=${ownerResolved} repos=${repos.length} beda=${drift} gagal-baca=${unreadable}`,
    auditDir: auditDir || process.cwd(),
  })
  return { owner: ownerResolved, repos, summary: { total: repos.length, drift, unreadable } }
}

// Cetak laporan bahasa awam. READ-ONLY: cuma menampilkan; pencabutan akses = MANUSIA di GitHub.
function printAccessReport(report) {
  console.log('')
  console.log('Verifikator Akses (RINGKASAN - READ-ONLY, tidak mengubah izin apa pun)')
  console.log(`Owner GitHub : ${report.owner}`)
  console.log('-'.repeat(70))
  for (const r of report.repos) {
    if (r.status === 'cocok') {
      console.log(`  [COCOK]      ${r.name}  (tim: ${r.expected.join(', ') || '-'})`)
    } else if (r.status === 'beda') {
      console.log(`  [BEDA]       ${r.name}`)
      if (r.extra.length) console.log(`      + Punya akses di GitHub TAPI tak di Buku Induk: ${r.extra.join(', ')}  (akses berlebih - pertimbangkan cabut)`)
      if (r.missing.length) console.log(`      - Di Buku Induk TAPI belum punya akses di GitHub: ${r.missing.join(', ')}  (belum diundang)`)
    } else {
      console.log(`  [GAGAL-BACA] ${r.name}  -> ${r.error}`)
    }
  }
  console.log('-'.repeat(70))
  console.log(`Ringkasan: ${report.summary.total} repo · beda: ${report.summary.drift} · gagal-baca: ${report.summary.unreadable}`)
  if (report.summary.unreadable > 0) {
    console.log('PERHATIAN: ada repo yang GAGAL dibaca -> JANGAN anggap akses aman. Perbaiki gh/owner lalu ulang.')
  }
  console.log('Tindakan (undang/cabut) = MANUSIA di GitHub. Robot ini cuma melapor. Lihat ACCESS_CONTROL_NREPO_v1.md.')
  console.log('')
}

function main() {
  let projectRoot = process.cwd()
  let portfolioArg = null
  let owner = null
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project-root') projectRoot = argv[++i] || projectRoot
    else if (argv[i] === '--portfolio') portfolioArg = argv[++i]
    else if (argv[i] === '--owner') owner = argv[++i]
  }
  const portfolioPath = portfolioArg
    ? (path.isAbsolute(portfolioArg) ? portfolioArg : path.join(projectRoot, portfolioArg))
    : path.join(projectRoot, PORTFOLIO_FILE)

  let report
  try {
    report = verifyAccess({ portfolioPath, owner, auditDir: projectRoot })
  } catch (e) {
    // STOP keras: gh tak tersedia / Buku Induk tak ada / owner tak diketahui.
    console.error(`[BERHENTI] Verifikator akses tidak bisa lanjut: ${e.message}`)
    console.error('  (Robot SENGAJA berhenti daripada diam-diam bilang "aman" saat data gagal dibaca.)')
    process.exit(1)
  }
  printAccessReport(report)
  // gagal-baca = masalah teknis yang harus diperhatikan -> exit !=0 (anti rasa-aman-palsu di skrip/CI).
  // 'beda' (drift) = temuan informatif yang owner tindak manual -> robot tetap dianggap sukses (exit 0).
  process.exit(report.summary.unreadable > 0 ? 2 : 0)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
