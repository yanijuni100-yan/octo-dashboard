#!/usr/bin/env node
// lib/staff-roster.mjs - Penulis skeleton .github/staff-roster.yml (direktori tim).
//
// GELOMBANG 4/5 (ADR-004): padanan Node dari blok inline di setup-pola-b.ps1 yang membuat
// .github/staff-roster.yml (daftar "siapa + peran" - RUJUKAN scope kerja, BUKAN pagar keras).
// Idempoten: kalau berkas sudah ada -> TIDAK ditimpa (jaga data user). Email owner diisi dari
// `git config user.email` ASLI kalau ada (supaya health-check tak salah-alarm), kalau belum
// di-set -> placeholder. Tulis UTF-8 tanpa BOM (cermin [IO.File]::WriteAllText UTF8($false) PS).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function run(cmd, args) {
  try {
    const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 20000 })
    return { code: r.status, out: (r.stdout || '').trim(), spawnError: r.error }
  } catch (e) {
    return { code: null, out: '', spawnError: e }
  }
}

// Isi roster PERSIS seperti yang dihasilkan setup-pola-b.ps1 (zero-churn saat cutover ke Node).
// __OWNER_EMAIL__ diganti email asli / placeholder.
const ROSTER_TEMPLATE = `# Staff roster - direktori tim lintasAI (siapa + peran/role).
# Dipakai AI/owner sebagai RUJUKAN "siapa boleh apa" saat menetapkan scope kerja.
# Catatan: penegakan otomatis per-role belum aktif - ini RUJUKAN, bukan pagar keras.
#
# Schema per entry:
#   - email: <git config user.email>
#     name: <display name>
#     github: <github handle>
#     role: <owner | backend-architect | frontend-architect | backend-developer | frontend-developer | ui-developer>
#     added_at: <YYYY-MM-DD>
#     notes: <opsional>
#
# Auto-generated skeleton oleh setup-pola-b.ps1. LENGKAPI nama/github entry "owner"
# + tambah staff sebelum onboard.

staff:
  - email: __OWNER_EMAIL__
    name: <Owner Name>
    github: <owner-github-handle>
    role: owner
    added_at: <YYYY-MM-DD>
    notes: Project owner. Real contact via Signal/Telegram untuk hal sensitif.
`

// Baca email git efektif (local-or-global), lalu fallback --global (cermin urutan PS).
function readGitEmail(projectRoot) {
  let email = ''
  const eff = run('git', ['-C', projectRoot, 'config', 'user.email'])
  if (eff.code === 0 && eff.out) email = eff.out.trim()
  if (!email) {
    const g = run('git', ['config', '--global', 'user.email'])
    if (g.code === 0 && g.out) email = g.out.trim()
  }
  return email
}

// Tulis .github/staff-roster.yml kalau belum ada. Return:
//   { written:true, path, emailFromGit:bool } kalau dibuat,
//   { written:false, reason:'exists', path } kalau sudah ada (tak ditimpa).
export function writeStaffRosterIfMissing(projectRoot, opts = {}) {
  const githubDir = path.join(projectRoot, '.github')
  const rosterPath = path.join(githubDir, 'staff-roster.yml')

  if (fs.existsSync(rosterPath)) {
    return { written: false, reason: 'exists', path: rosterPath }
  }
  if (!fs.existsSync(githubDir)) {
    fs.mkdirSync(githubDir, { recursive: true })
  }

  const email = opts.email != null ? String(opts.email).trim() : readGitEmail(projectRoot)
  const rosterEmail = email && email.length > 0 ? email : 'replace-with-owner-email@example.com'
  // split/join (BUKAN .replace string-arg): cermin PS [String]::Replace yang LITERAL. Kalau pakai
  // .replace('__OWNER_EMAIL__', email), token $&/$$/$1 di email akan diekspansi (footgun) - email
  // RFC boleh mengandung '$' di local-part. split/join 100% literal, kebal token '$'.
  const content = ROSTER_TEMPLATE.split('__OWNER_EMAIL__').join(rosterEmail)

  fs.writeFileSync(rosterPath, content, 'utf8') // UTF-8 tanpa BOM (cermin PS UTF8Encoding($false))
  return { written: true, path: rosterPath, emailFromGit: !!(email && email.length > 0) }
}

export { ROSTER_TEMPLATE }
