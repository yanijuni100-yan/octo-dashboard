#!/usr/bin/env node
// team-setup.mjs - Nyalakan / segarkan "kerja kelompok" (collaboration essentials) di project (versi Node).
//
// Padanan team-setup.ps1. Memasang berkas inti kerja-kelompok (idempotent, TIDAK menimpa yang sudah
// ada) lalu menampilkan langkah mengunci 'main' di GitHub. Untuk project yang ingin menyalakan /
// menyegarkan mode tim kapan saja - terutama yang dulu init pakai -SkipTeamFiles.
//
// Berkas inti yang dipasang (subset terfokus; `init` memasang set tim LENGKAP):
//   .github/CODEOWNERS, .github/pull_request_template.md,
//   .github/scripts/setup-branch-protection.ps1,
//   docs/KERJA_KELOMPOK.md, docs/CLAUDE_TEAM_GUIDE.md,
//   docs/TEAM_FLOW_SKETCH_v1.md, docs/ACCESS_CONTROL_NREPO_v1.md
// Mengandalkan kit yang SUDAH terpasang di <project>/.claude-kit/ (jalankan `init` dulu).
//
// ===========================================================================================
// STATUS MIGRASI (Gelombang 6, ADR-003/ADR-004) - SUDAH CUTOVER:
//   File ini = JALUR AKTIF untuk `npx lintasai team-setup`. Dispatcher bin/lintasai.js memetakan
//   'team-setup' -> team-setup.mjs di COMMANDS_NODE (bukan lagi team-setup.ps1 di COMMANDS), dan
//   package.json files[] mendaftarkannya eksplisit -> ikut paket npm + jalan di mesin staff.
//   team-setup.ps1 tetap terbit sebagai CADANGAN manual (.\.claude-kit\team-setup.ps1) bila versi
//   Node bermasalah. Pola cutover sama dengan 'init' (setup-pola-b.mjs).
//
// SIFAT NON-INTERAKTIF: TIDAK ada Read-Host / popup -> aman dijalankan otomatis (AI/CI) tanpa risiko
//   menggantung. Idempoten + non-destruktif (Skip kalau berkas sudah ada) -> tidak butuh konfirmasi.
//
// KESETIAAN (parity dgn versi PS): operasi-berkas (Copy-StaticTemplate IfExists=Skip + tulis
//   UTF-8 NO-BOM), pencatatan ke .install-manifest.json (kind='team_file' + field 'from'), dan
//   teks keluaran dijaga identik supaya bisa diuji-banding. Pemasang ini MENGOPERASI kit yang
//   terpasang di project (KitDir = <project>/.claude-kit), bukan cache npm tempat .mjs berjalan -
//   cermin komentar team-setup.ps1 (lib di-dot-source dari $KitDir, sumber template dari $KitDir).
// ===========================================================================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeManifest, addToManifest, addDirToManifest, saveManifest } from './lib/manifest.mjs'
import { copyStaticTemplate } from './lib/template-deploy.mjs'
import { getKitVersionFromChangelog } from './lib/version-detect.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---- Penguraian argumen (gaya Node, double-dash) - cermin param team-setup.ps1 ----
export function parseArgs(argv) {
  const a = { dryRun: false, projectRoot: null }
  for (let i = 0; i < argv.length; i++) {
    const t = String(argv[i]).toLowerCase()
    if (t === '--dry-run' || t === '--dryrun' || t === '--simulasi') a.dryRun = true
    else if (t === '--project-root' || t === '--projectroot') a.projectRoot = argv[++i] || null
  }
  return a
}

// Collaboration essentials (subset terfokus; init memasang set tim lengkap). Diekspor utk uji-banding.
// `src` relatif ke KitDir (garis-miring-depan; di-join dgn path.sep saat dibaca). `dst` = segmen
// relatif ke projectRoot. `from` = label sumber utk catatan-pasang (cermin PS $f.Src.Replace('\','/')).
export const COLLAB_FILES = [
  { src: 'templates/github/CODEOWNERS.template', dst: ['.github', 'CODEOWNERS'], from: 'templates/github/CODEOWNERS.template', desc: 'Approver wajib (EDIT dgn username GitHub asli)' },
  { src: 'templates/github/pull_request_template.md', dst: ['.github', 'pull_request_template.md'], from: 'templates/github/pull_request_template.md', desc: 'Formulir minta-review (PR)' },
  { src: 'templates/github/scripts/setup-branch-protection.ps1', dst: ['.github', 'scripts', 'setup-branch-protection.ps1'], from: 'templates/github/scripts/setup-branch-protection.ps1', desc: 'Skrip kunci main (SIMULASI dulu, baru -Apply)' },
  { src: 'templates/KERJA_KELOMPOK.md', dst: ['docs', 'KERJA_KELOMPOK.md'], from: 'templates/KERJA_KELOMPOK.md', desc: 'Pintu masuk kerja kelompok + langkah kunci main' },
  { src: 'templates/CLAUDE_TEAM_GUIDE.md', dst: ['docs', 'CLAUDE_TEAM_GUIDE.md'], from: 'templates/CLAUDE_TEAM_GUIDE.md', desc: 'Alur harian branch -> PR -> gabung' },
  { src: 'templates/TEAM_FLOW_SKETCH_v1.md', dst: ['docs', 'TEAM_FLOW_SKETCH_v1.md'], from: 'templates/TEAM_FLOW_SKETCH_v1.md', desc: 'Pipa kerja tim + 5 peran' },
  { src: 'templates/ACCESS_CONTROL_NREPO_v1.md', dst: ['docs', 'ACCESS_CONTROL_NREPO_v1.md'], from: 'templates/ACCESS_CONTROL_NREPO_v1.md', desc: 'Akses berjenjang (CODEOWNERS != izin clone)' },
]

export function runTeamSetup(argv) {
  const args = parseArgs(argv)

  // ---- Resolve KitDir + ProjectRoot (operasikan kit yang TERPASANG di project) ----
  // Catatan: via npx, __dirname = cache npm (BUKAN project). Maka saat --project-root diberikan,
  // KitDir = <project>/.claude-kit (kit terpasang), bukan __dirname. Cermin team-setup.ps1.
  let projectRoot
  let kitDir
  if (args.projectRoot && String(args.projectRoot).trim() !== '') {
    if (!fs.existsSync(args.projectRoot)) {
      console.error(`ERROR: Akar project tidak ditemukan: ${args.projectRoot}`)
      return 1
    }
    projectRoot = fs.realpathSync(args.projectRoot)
    kitDir = path.join(projectRoot, '.claude-kit')
  } else {
    kitDir = __dirname
    projectRoot = fs.realpathSync(path.dirname(kitDir))
  }

  if (!fs.existsSync(kitDir)) {
    console.error(`ERROR: Kit lintasAI belum terpasang di project ini (${kitDir} tidak ada).`)
    console.error('       Jalankan dulu: npx lintasai init')
    return 1
  }

  console.log('')
  console.log('=== lintasAI team-setup: nyalakan kerja kelompok ===')
  console.log(`Project: ${projectRoot}`)
  if (args.dryRun) console.log('(MODE SIMULASI - tidak ada berkas yang ditulis)')
  console.log('')

  const docsDir = path.join(projectRoot, 'docs')
  const githubDir = path.join(projectRoot, '.github')
  const scriptsDir = path.join(githubDir, 'scripts')

  const manifestState = initializeManifest(projectRoot)

  // ---- Buat folder yang perlu ----
  for (const d of [docsDir, githubDir, scriptsDir]) {
    if (!fs.existsSync(d)) {
      if (args.dryRun) {
        console.log(`[SIMULASI] BUAT folder ${d}\\`)
      } else {
        fs.mkdirSync(d, { recursive: true })
        addDirToManifest(manifestState, d)
        console.log(`BUAT  ${d}\\`)
      }
    }
  }

  // ---- Collaboration essentials (subset terfokus; init memasang set tim lengkap) ----
  let added = 0
  let existed = 0
  let missingSrc = 0
  for (const f of COLLAB_FILES) {
    const src = path.join(kitDir, ...f.src.split('/'))
    const dst = path.join(projectRoot, ...f.dst)
    if (fs.existsSync(dst)) {
      console.log(`SUDAH ADA  ${dst}`)
      existed++
      continue
    }
    if (!fs.existsSync(src)) {
      console.log(`HILANG di kit  ${f.src} (skip)`)
      missingSrc++
      continue
    }
    if (args.dryRun) {
      console.log(`[SIMULASI] PASANG ${dst} (${f.desc})`)
      added++
      continue
    }
    const r = copyStaticTemplate({ sourcePath: src, targetPath: dst, ifExists: 'Skip' })
    if (r.copied) {
      addToManifest(manifestState, dst, 'team_file', f.from)
      console.log(`PASANG  ${dst} (${f.desc})`)
      added++
    }
  }

  // ---- Simpan manifest (MERGE dengan yang ada) supaya berkas baru ter-track utk uninstall ----
  if (!args.dryRun && added > 0) {
    try {
      const kitChangelog = path.join(kitDir, 'CHANGELOG.md')
      let kv = getKitVersionFromChangelog(kitChangelog)
      if (!kv) kv = 'unknown'
      const pn = path.basename(projectRoot)
      // R7 (audit 2026-06-23): catat installer JUJUR = 'team-setup.mjs'. Tanpa installerName,
      // saveManifest menulis ulang metadata.installer ke default 'setup-pola-b.ps1' (catatan keliru).
      saveManifest(manifestState, { kitDir, kitVersion: kv, projectName: pn, installerName: 'team-setup.mjs' })
      console.log('OK    manifest diperbarui (berkas baru ikut ter-track untuk uninstall).')
    } catch (e) {
      console.log(`WARN  gagal perbarui manifest: ${e.message}`)
      console.log('      Berkas tetap terpasang; cuma pelacakan uninstall yang tidak lengkap.')
    }
  }

  console.log('')
  console.log(`Ringkasan: ${added} dipasang, ${existed} sudah ada, ${missingSrc} hilang-di-kit.`)
  console.log('')
  console.log('LANGKAH BERIKUTNYA (hanya OWNER yang bisa) - kunci main di GitHub:')
  console.log('  1. GitHub repo -> Settings -> Branches (atau Rules -> Rulesets) -> Add rule, pattern: main')
  console.log('  2. Centang: Require a pull request + Require approvals (1) + Require review from Code Owners')
  console.log('  3. Centang: Require status checks to pass + Do not allow bypassing')
  console.log("  4. Pastikan 'Allow force pushes' + 'Allow deletions' TIDAK dicentang -> Save")
  console.log('  (Detail klik-demi-klik + analogi non-programmer: buka docs\\KERJA_KELOMPOK.md Bagian 3.)')
  console.log('')
  console.log('  Lalu isi .github\\CODEOWNERS dengan username GitHub asli (dari .github\\staff-roster.yml).')
  console.log('  Anti-keliru: CODEOWNERS = siapa WAJIB review, BUKAN siapa boleh clone (lihat ACCESS_CONTROL_NREPO_v1.md).')
  console.log('')
  console.log('SELESAI - kerja kelompok siap. Minta tim buka docs\\KERJA_KELOMPOK.md dulu.')
  return 0
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  process.exitCode = runTeamSetup(process.argv.slice(2))
}
