#!/usr/bin/env node
// setup-pola-b.mjs - Pemasang kit lintasAI di project (Pola B), versi Node.
//
// Gelombang 4 (ADR-004 / migrasi-besar-node-program.md): port orkestrator pemasang dari
// setup-pola-b.ps1 (1755 baris). Dibangun BERDAMPINGAN - pemasang PowerShell lama TETAP jadi
// jalur default (dispatcher `init` masih menunjuk .ps1) sampai versi Node ini terbukti
// uji-jalan berkali-kali. JANGAN daftarkan ke COMMANDS_NODE sebelum gerbang end-to-end lulus.
//
// TAHAP 1: TULANG PUNGGUNG = bagian yang berjalan SAMA dengan/tanpa manusia (deterministik): salin
//   berkas kit + dokumen + tulis kartu identitas + simpan catatan-pasang (.install-manifest.json,
//   ber-stempel keaslian) + gabung daftar izin + daftar tim.
// TAHAP 2 (kini AKTIF, NON-INTERAKTIF): nama/repo, pilihan AGENTS.md, rapikan folder bersarang,
//   identitas git, buka VS Code, rangkuman penutup + panduan kunci-gabung. KEPUTUSAN OWNER 06-22:
//   popup jendela GUI DIBUANG dari versi Node - pemasang kini SEPENUHNYA OTOMATIS: tiap "pertanyaan"
//   lewat lib/popup-shim.mjs langsung dijawab NILAI-AMAN (tak menampilkan apa pun, tak hang, tak crash),
//   dan pilihan sebenarnya dilakukan staff lewat AI di chat sesudah pemasangan. Logika murni yang bisa
//   diuji (validasi email, urutan opsi, deteksi VS Code, panduan commit) ada di lib/setup-interactive.mjs.
//
// Bahasa output WAJIB non-programmer Indonesia (ADR-004 #3) - dijaga robot output-lang-check.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync, spawn } from 'node:child_process'

import { isInteractiveInput, showYesNo, showInput, showChoice, showNumberedChoice, showInfo } from './lib/popup-shim.mjs'
import { initializeManifest, addToManifest, addDirToManifest, saveManifest } from './lib/manifest.mjs'
import { copyTemplateWithPlaceholder, copyStaticTemplate } from './lib/template-deploy.mjs'
import { removeGitMetadata, removeMotwBlock } from './lib/git-helpers.mjs'
import { publishAgentsMd, publishClaudeMd } from './lib/agents-md.mjs'
import { getKitVersionFromChangelog } from './lib/version-detect.mjs'
import { readKitFiles } from './lib/kit-files.mjs'
import { getStackType, getPackageManager } from './lib/project-detect.mjs'
import { writeLintasProjectManifestIfMissing } from './lib/project-manifest.mjs'
import { mergeAllowList } from './lib/json-merge-helpers.mjs'
import { writeStaffRosterIfMissing } from './lib/staff-roster.mjs'
import { ensureLangHook } from './lib/lang-hook-wiring.mjs'
import { ensureRiskGateHook } from './lib/ensure-risk-gate-hook.mjs'
import { installSecretHook } from './lib/install-secret-hook.mjs'
import { testMainBranchProtected } from './lib/branch-protect.mjs'
import {
  STARTER_PROMPT,
  isValidGitEmail,
  deriveGitName,
  detectAgentsFormat,
  buildAgentsMdOptions,
  findVsCodeExe,
  buildCommitGuidance,
  diffLines,
} from './lib/setup-interactive.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---- Baca pilihan baris-perintah ----
function parseArgs(argv) {
  const a = { force: false, dryRun: false, skipTeamFiles: false, noGui: false, projectRoot: null }
  for (let i = 0; i < argv.length; i++) {
    const t = String(argv[i]).toLowerCase()
    if (t === '--force') a.force = true
    else if (t === '--dry-run' || t === '--dryrun' || t === '--simulasi') a.dryRun = true
    else if (t === '--skip-team-files' || t === '--skipteamfiles') a.skipTeamFiles = true
    else if (t === '--no-gui' || t === '--nogui') a.noGui = true
    else if (t === '--project-root' || t === '--projectroot') a.projectRoot = argv[++i] || null
  }
  return a
}

// Tambah pola ke .gitignore KALAU belum ada (pertahankan isi lama). UTF-8 no-BOM.
function appendGitignoreIfMissing(gitignorePath, entries, headerComment, dryRun) {
  let existingLines = []
  if (fs.existsSync(gitignorePath)) {
    let raw = fs.readFileSync(gitignorePath, 'utf8')
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1) // buang BOM
    existingLines = raw.split(/\r?\n/)
  }
  const missing = entries.filter((e) => !existingLines.includes(e))
  if (missing.length === 0) return { added: 0 }
  if (dryRun) return { added: missing.length }
  const block = headerComment + missing.join('\n') + '\n'
  if (existingLines.length > 0 && fs.existsSync(gitignorePath)) {
    fs.appendFileSync(gitignorePath, block, 'utf8')
  } else {
    fs.writeFileSync(gitignorePath, block.replace(/^\n+/, ''), 'utf8')
  }
  return { added: missing.length }
}

// Berkas/folder yang JANGAN ikut tersalin ke <project>/.claude-kit/ saat mode npx (filter fs.cpSync).
// Tujuan: (a) KEAMANAN - cegah rahasia kit-sumber (kunci-segel, profil tim, rencana internal) bocor ke
// project staff saat pemasang dijalankan LANGSUNG dari repo-dev/CI; (b) kurangi bloat. Selaras .npmignore
// + CLAUDE_universal §8.1 #6 (daftar berkas rahasia yang tak boleh disebar). Jalur npm staff sudah aman
// (tarball whitelist files[]); filter ini = pertahanan-berlapis untuk jalur dev-direct + kalau files[] bocor.
const KIT_COPY_EXCLUDE_NAMES = new Set([
  '.git', '.manifest-secret', '.install-manifest.json', '.audit-log',
  'node_modules', 'experiments', 'testResults.xml',
])
function shouldCopyKitEntry(srcAbs, kitRootAbs) {
  const rel = path.relative(kitRootAbs, srcAbs).replace(/\\/g, '/')
  if (rel === '') return true // akar kit sendiri
  const base = rel.split('/').pop()
  if (KIT_COPY_EXCLUDE_NAMES.has(base)) return false
  // Pola berkas rahasia / identitas per-staff (di level mana pun):
  if (/\.local\.md$/i.test(base)) return false          // PROFIL_TIM.local.md dll
  if (base.toLowerCase() === '.staff-profile.md') return false
  if (/^\.git-identity-/i.test(base)) return false
  if (/\.(pem|key)$/i.test(base)) return false
  if (/^\.env(\.|$)/i.test(base)) return false
  // Folder rencana internal (tak untuk staff) - KECUALI POLA_REPO_AMAN.md = SSOT topologi repo yang
  // SPLIT_REPO_MIGRATION_PROMPT_v1.md + templates/split-agents/ENGINE.md perintahkan AI klien "WAJIB
  // baca docs/plans/POLA_REPO_AMAN.md". Tanpa pengecualian ini, microservice/pecah-repo di project klien
  // menunjuk berkas yang tak pernah mendarat. Cermin re-include di package.json files[]:23 (jalur npm).
  // CATATAN: folder 'docs/plans' itu sendiri WAJIB di-izinkan (return true) supaya cpSync menelusurinya;
  // kalau folder-nya ditolak, Node melewati SELURUH isi termasuk POLA_REPO_AMAN.md (filter cpSync skip-dir).
  if (rel === 'docs/plans') return true
  if (rel === 'docs/plans/POLA_REPO_AMAN.md') return true
  if (rel.startsWith('docs/plans/')) return false
  return true
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const { force, dryRun, skipTeamFiles, noGui } = args
  let KitDir = __dirname

  // Daftar langkah yang DILEWATI user (batal popup / tanpa isi) - dilaporkan jujur di rangkuman
  // akhir (cermin $script:__lintasAI_SkippedSteps PS). Tetap selesai dengan kode-keluar 0 (graceful).
  const skippedSteps = []

  // ---- Mode non-interaktif (tanpa keyboard manusia - dijalankan AI/CI) ----
  // --no-gui = paksa mode aman TANPA popup. popup-shim tak punya jalur input-konsol, jadi "tanpa GUI"
  // = pakai nilai-aman = sama efeknya dengan non-interaktif. Di-set SEBELUM isInteractiveInput dipanggil
  // (cache-nya hanya di-set sekali) supaya semua popup Tahap 2 ikut membalas nilai-aman.
  if (noGui) process.env.LINTASAI_NONINTERACTIVE = '1'
  const nonInteractive = !isInteractiveInput()
  if (nonInteractive) {
    console.log('INFO: Mode non-interaktif terdeteksi (tidak ada keyboard manusia / dijalankan otomatis).')
    console.log('      Semua pertanyaan dilewati pakai nilai default yang aman.')
  } else {
    // Manusia di terminal NYATA (TTY). Pemasang versi Node ini SENGAJA tak punya input konsol -- popup
    // GUI dibuang (ADR-004), pilihan dilakukan lewat AI di chat. Ini BEDA dari setup-pola-b.ps1 yang
    // -NoGui-nya masih bertanya via Read-Host. JUJURKAN supaya tak ada divergensi diam-diam: tanpa
    // pemberitahuan ini, manusia mengira akan ditanya Nama/repo/email padahal semuanya dilewati.
    console.log('CATATAN: Pemasang versi Node ini berjalan OTOMATIS PENUH - tidak menanyakan apa pun lewat konsol.')
    console.log('         Semua pertanyaan (Nama / URL repo / email) dilewati pakai nilai default aman.')
    console.log('         Atur sesudah pasang: lewat AI di chat, atau `git config user.name` / `git config user.email`.')
  }

  // ---- Tentukan akar project ----
  let projectRoot = args.projectRoot
  const npxMode = !!projectRoot
  if (!projectRoot) {
    projectRoot = path.dirname(KitDir) // tradisional: kit di <project>/.claude-kit/
  } else {
    console.log(`[npx] Mode: akar project dari pemanggil = ${projectRoot}`)
  }
  if (!fs.existsSync(projectRoot)) {
    console.error(`ERROR: Akar project tidak ditemukan: ${projectRoot}`)
    process.exit(1)
  }
  projectRoot = fs.realpathSync(projectRoot)

  // ---- Pra-cek: jenis stack (HENTI KERAS untuk non-Node) ----
  // SEBELUM menyalin apa pun: kalau project BUKAN Node (mis. Python/PHP), pemasang berhenti DI SINI
  // supaya TIDAK ada folder .claude-kit setengah-jadi yang tertinggal jadi sampah di project non-Node.
  // (Dulu pra-cek ini ada SETELAH penyalinan -> folder sudah terlanjur tersalin saat [STOP] dipanggil.)
  const stack = getStackType(projectRoot)
  console.log('\n=== Pra-cek: deteksi stack ===')
  if (stack.stackType === 'unknown') {
    console.log('[!] Stack tidak dikenali. lintasAI v1.x dioptimalkan untuk Node.js (Next.js). Lanjut dengan asumsi Node.js.')
  } else if (stack.isSupported) {
    console.log(`OK: stack terdeteksi = ${stack.stackType} (dari ${stack.detectedFiles.join(', ')}).`)
  } else {
    console.log('\n[STOP] lintasAI v1.x saat ini Node.js-only.')
    console.log(`       Stack terdeteksi: ${stack.stackType} (dari ${stack.detectedFiles.join(', ')})`)
    console.log('       Cara sementara: pasang kit di project Node lain (mis. Next.js), atau tunggu v2.0+.')
    console.log('       (Belum ada berkas yang disalin ke project ini - aman, tak ada folder tertinggal.)')
    process.exit(1)
  }

  // ---- Mode npx: salin kit dari sumber (cache npm) ke <project>/.claude-kit/ ----
  const expectedKitDir = path.join(projectRoot, '.claude-kit')
  const sameLocation = path.resolve(KitDir).toLowerCase() === path.resolve(expectedKitDir).toLowerCase()
  if (npxMode && sameLocation) {
    console.log('[npx] Sumber kit sudah di lokasi yang benar, lewati penyalinan.')
  } else if (npxMode) {
    console.log(`[npx] Salin kit: ${KitDir} -> ${expectedKitDir}`)
    if (!dryRun) {
      try {
        fs.mkdirSync(expectedKitDir, { recursive: true })
        // filter: cegah rahasia kit-sumber (kunci-segel, profil tim, docs/plans) bocor + kurangi bloat
        // saat dijalankan dari repo-dev/CI (jalur npm staff sudah bersih via files[]). Lihat shouldCopyKitEntry.
        fs.cpSync(KitDir, expectedKitDir, { recursive: true, filter: (src) => shouldCopyKitEntry(src, KitDir) })
        KitDir = expectedKitDir
        console.log('[npx] Kit berhasil disalin.')
      } catch (e) {
        console.error(`ERROR: Gagal menyalin berkas kit ke ${expectedKitDir}`)
        console.error(`       Rincian: ${e.message}`)
        console.error('       Kemungkinan: antivirus mengunci berkas, path kepanjangan (>260), atau folder/disk penuh.')
        console.error('       Perbaiki penyebab di atas, lalu jalankan ulang.')
        process.exit(1)
      }
    } else {
      console.log(`[SIMULASI] [npx] Akan menyalin isi kit dari ${KitDir} ke ${expectedKitDir}`)
    }
  }

  // ---- Deteksi kit ter-ekstrak BERSARANG (.claude-kit/<folder>/...) ----
  const kitFolderName = path.basename(KitDir)
  const parentDir = path.dirname(KitDir)
  const parentFolderName = path.basename(parentDir)
  if (parentFolderName === '.claude-kit') {
    console.log(`DETEKSI: Kit ter-ekstrak BERSARANG (folder di dalam folder) - skrip ada di '${kitFolderName}' di dalam '.claude-kit'.`)
    console.log('        Ini biasa terjadi kalau membuka zip pakai Windows Explorer (tombol Extract All).')
    if (dryRun) {
      console.log(`[SIMULASI] Akan rapikan: pindahkan isi '${KitDir}' ke '${parentDir}', lalu hapus folder kosong.`)
      console.log('Mode SIMULASI: berhenti setelah pratinjau bersarang.')
      process.exit(0)
    }
    // Tanpa -Force: tawarkan rapikan otomatis lewat popup Ya/Tidak. Default AMAN = Tidak
    // (operasi ini MENGHAPUS folder). Mode otomatis/tanpa-layar -> 'No' -> instruksi manual + henti.
    let doFlatten = force
    if (!force) {
      console.log('')
      const ans = showYesNo({
        title: 'Folder kit bersarang',
        message: `Folder kit ada di dalam folder lain ('${kitFolderName}' di dalam '.claude-kit'). Mau aku rapikan otomatis? (pindahkan isinya ke folder yang benar, lalu hapus folder kosong). Tidak = biarkan apa adanya (paling aman).`,
        defaultYes: false,
        kitDir: KitDir,
      })
      doFlatten = ans === 'Yes'
    }
    if (doFlatten) {
      try {
        for (const name of fs.readdirSync(KitDir)) {
          fs.renameSync(path.join(KitDir, name), path.join(parentDir, name))
        }
        fs.rmSync(KitDir, { recursive: true, force: true })
        console.log('OK    Rapikan selesai.')
        KitDir = parentDir
      } catch (e) {
        console.error(`GAGAL merapikan: ${e.message}`)
        console.error('       Perbaiki manual: pindahkan isi folder ke induknya, hapus folder kosong.')
        // Cermin PS (setup-pola-b.ps1:359-363): tunjukkan berkas yang MASIH tertinggal di folder
        // sumber supaya staff tahu persis apa yang perlu dipindah manual (mis. saat 1 berkas terkunci
        // antivirus di tengah pemindahan). Best-effort: kalau folder sudah terhapus sebagian, abaikan.
        try {
          const sisa = fs.readdirSync(KitDir)
          if (sisa.length > 0) {
            console.error(`       Berkas yang masih di ${KitDir}:`)
            for (const name of sisa) console.error(`         ${name}`)
          }
        } catch { /* folder mungkin sudah terhapus sebagian - lewati daftar */ }
        process.exit(1)
      }
    } else {
      console.log('Dibiarkan apa adanya (tidak ada persetujuan rapikan otomatis). Perbaiki manual:')
      console.log(`  1. Pindahkan SEMUA isi '${KitDir}' ke induk '${parentDir}'.`)
      console.log(`  2. Hapus folder kosong '${KitDir}'.`)
      console.log('  3. Jalankan ulang pemasang dari folder induk.')
      process.exit(1)
    }
  }

  if (path.basename(KitDir) !== '.claude-kit') {
    console.log(`PERINGATAN: Folder kit ini bernama '${path.basename(KitDir)}', bukan '.claude-kit'.`)
    console.log('          Pola B mengasumsikan kit ada di "<project>/.claude-kit/". Aku tetap lanjut.')
  }

  const projectName = path.basename(projectRoot)
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // ---- Siapkan catatan-pasang (manifest) ----
  const manifestState = initializeManifest(projectRoot)

  // ---- Label versi kit dari CHANGELOG.md ----
  const detectedVersion = getKitVersionFromChangelog(path.join(KitDir, 'CHANGELOG.md'))
  const kitVersion = detectedVersion || 'pre-launch (testing)'

  // ---- Bersihkan .git bawaan kit + buka kunci keamanan Windows (Mark-of-the-Web) ----
  if (!dryRun) {
    if (!removeGitMetadata(KitDir)) console.log('PERINGATAN: Gagal hapus .claude-kit/.git/ (lanjut).')
    if (removeMotwBlock(KitDir)) {
      console.log('OK    Kunci keamanan Windows dibuka untuk semua berkas kit.')
    } else {
      console.log('PERINGATAN: Buka-kunci keamanan Windows gagal (lanjut; mungkin perlu buka manual).')
    }
  }

  // ---- Ringkasan awal ----
  console.log('\n=== Pemasangan kit lintasAI (Pola B, versi Node) ===')
  console.log(`Folder kit    : ${KitDir}`)
  console.log(`Akar project  : ${projectRoot}`)
  console.log(`Nama project  : ${projectName}`)
  console.log(`Tanggal       : ${today}`)
  if (dryRun) console.log('Mode          : SIMULASI (tidak ada berkas yang ditulis)')

  // ---- Verifikasi berkas inti kit ADA (sumber-tunggal: lib/kit-files.psd1) ----
  const kitFilesPath = path.join(KitDir, 'lib', 'kit-files.psd1')
  if (!fs.existsSync(kitFilesPath)) {
    console.error('ERROR: lib/kit-files.psd1 hilang. Pasang ulang kit.')
    process.exit(1)
  }
  let kitFiles
  try {
    kitFiles = readKitFiles(kitFilesPath)
  } catch (e) {
    console.error(`ERROR: Gagal baca lib/kit-files.psd1: ${e.message}`)
    process.exit(1)
  }
  // Grup 'tests' SENGAJA TIDAK diverifikasi sebagai "wajib ada": berkas tes Pester (*.Tests.ps1) = internal
  // dev, sengaja DIKECUALIKAN dari paket npm (package.json files[] !tests/*.Tests.ps1, "ramping tarball").
  // kit-files.psd1 tetap mendaftar semua tes (dijaga install-mapping-sync.Tests.ps1 untuk integritas DEV),
  // tapi PEMASANG CLIENT cuma boleh mewajibkan berkas yang BENAR-BENAR dikirim ke client. Dulu mewajibkan
  // 'tests' -> "Kit tidak lengkap. Berkas hilang" di TIAP install/re-install npm (bug terdeteksi uji-tarball
  // 2026-06-25). Dijaga package-bundle.Tests.ps1 (berkas wajib pemasang non-tests WAJIB ada di tarball).
  const groups = ['core_prompts', 'universal_rules', 'scripts', 'lib_files', 'templates', 'docs', 'ci', 'meta']
  const wajibAda = []
  for (const g of groups) {
    for (const f of (kitFiles[g] || [])) wajibAda.push(String(f))
  }
  const missing = wajibAda.filter((f) => !fs.existsSync(path.join(KitDir, f)))
  if (missing.length > 0) {
    console.error('ERROR: Kit tidak lengkap. Berkas hilang:')
    for (const f of missing) console.error(`        - ${f}`)
    console.error('       Pasang ulang kit, lalu jalankan lagi.')
    process.exit(1)
  }
  console.log(`OK    ${wajibAda.length} berkas inti kit terverifikasi`)

  // ---- Catat berkas lib/ ke catatan-pasang ----
  // Ringkasan 1-baris (bukan per-berkas seperti PS) supaya log tak berisik tapi tetap transparan.
  let libTracked = 0
  for (const lf of (kitFiles.lib_files || [])) {
    const rel = String(lf)
    const p = path.join(KitDir, rel)
    if (fs.existsSync(p)) {
      if (!dryRun) addToManifest(manifestState, p, 'lib', '.claude-kit/' + rel.replace(/\\/g, '/'))
      libTracked++
    }
  }
  console.log(dryRun
    ? `[SIMULASI] ${libTracked} berkas lib/ akan dicatat ke catatan-pasang`
    : `OK    ${libTracked} berkas lib/ dicatat ke catatan-pasang`)

  // Catat berkas Node (.mjs) ke catatan-pasang juga (sumber: node_lib di kit-files.psd1) supaya
  // ikut deteksi-utak-atik + dilacak saat uninstall. Ringkasan 1-baris (tak berisik).
  let nodeLibTracked = 0
  for (const nf of (kitFiles.node_lib || [])) {
    const rel = String(nf)
    const p = path.join(KitDir, rel)
    if (fs.existsSync(p)) {
      if (!dryRun) addToManifest(manifestState, p, 'node_lib', '.claude-kit/' + rel.replace(/\\/g, '/'))
      nodeLibTracked++
    }
  }
  console.log(dryRun
    ? `[SIMULASI] ${nodeLibTracked} berkas Node (.mjs) akan dicatat ke catatan-pasang`
    : `OK    ${nodeLibTracked} berkas Node (.mjs) dicatat ke catatan-pasang`)

  // ---- Info pemilik/repo (opsional, untuk isi AGENTS.md) ----
  // Tanya lewat popup HANYA kalau bukan --force / bukan --dry-run. Mode otomatis/tanpa-layar ->
  // showInput balas Cancel -> pakai nilai default aman (cermin pemasang PS non-interaktif, baris ~533).
  // os.userInfo() bisa melempar (akun tanpa nama/homedir di sandbox tertentu) - bungkus supaya tak
  // menghentikan pemasang sebelum apa pun jalan. Di Windows normal USERNAME hampir selalu terisi.
  let osUser = ''
  try { osUser = os.userInfo().username || '' } catch { osUser = '' }
  const defaultOwner = process.env.USERNAME || osUser || 'staff'
  let ownerName = defaultOwner
  let repoUrl = 'belum-ada (solo project)'
  if (!force && !dryRun) {
    const nameRes = showInput({
      title: 'Info untuk AGENTS.md (opsional)',
      message: `Nama kamu (Enter / batal = pakai bawaan: ${defaultOwner}):`,
      defaultValue: defaultOwner,
      kitDir: KitDir,
    })
    if (nameRes.status === 'OK' && nameRes.value.trim()) ownerName = nameRes.value.trim()
    const repoRes = showInput({
      title: 'Info untuk AGENTS.md (opsional)',
      message: "URL repo standar tim (Enter / batal = pakai bawaan: 'belum-ada'):",
      defaultValue: '',
      kitDir: KitDir,
    })
    if (repoRes.status === 'OK' && repoRes.value.trim()) repoUrl = repoRes.value.trim()
  }
  const placeholders = {
    '<NAMA_PROYEK>': projectName,
    '<TANGGAL_HARI_INI>': today,
    '<NAMA_KAMU>': ownerName,
    '<URL_REPO_STANDAR>': repoUrl,
    '<VERSI_KIT>': kitVersion,
  }

  // ---- Pasang AGENTS.md ----
  // Kalau sudah ada + bukan --force: TANYA lewat popup (Lewati / Cadangkan-lalu-ganti / Lihat-beda).
  // Opsi paling AMAN di posisi pertama (§14.1): format lintasAI -> Lewati; format asing -> Cadangkan-
  // lalu-ganti (biar aturan asing tak ikut menyetir AI; berkas lama tetap dicadangkan). Mode otomatis/
  // tanpa-layar -> showChoice balas indeks default (0 = aman) tanpa popup. Cermin PS baris ~555-714.
  const agentsTemplate = path.join(KitDir, 'AGENTS.md.template')
  const agentsTarget = path.join(projectRoot, 'AGENTS.md')
  const agentsExists = fs.existsSync(agentsTarget)
  let agentsAction = agentsExists ? (force ? 'backup-replace' : 'skip') : 'create'

  if (agentsExists && !force && !dryRun) {
    console.log('')
    console.log(`PERHATIAN: ${agentsTarget} sudah ada.`)
    let existingContent = ''
    try { existingContent = fs.readFileSync(agentsTarget, 'utf8') } catch { existingContent = '' }
    const isLintasai = detectAgentsFormat(existingContent) === 'lintasai'
    if (isLintasai) {
      console.log('INFO: Terdeteksi format lintasAI - aman di-Lewati (berkas lama tidak diubah).')
    } else {
      console.log('PERHATIAN: BUKAN format lintasAI (kemungkinan berkas dari alat lain).')
      console.log('          Kalau di-Lewati, aturannya ikut menyetir AI + bisa bentrok aturan tim.')
      console.log('          Cadangkan-lalu-ganti = berkas lama DICADANGKAN (tidak hilang) + bisa dibalik.')
    }
    const opts = buildAgentsMdOptions(isLintasai)
    const idx = showChoice({
      title: 'AGENTS.md sudah ada',
      message: isLintasai
        ? 'AGENTS.md ini sudah format lintasAI - Lewati aman. Pilih:'
        : 'AGENTS.md ini BUKAN format lintasAI (berkas asing). Lewati = aturan asing ikut aktif + bisa bentrok. Berkas lama dicadangkan kalau pilih Cadangkan-lalu-ganti. Pilih:',
      options: opts.map((o) => o.label),
      defaultIndex: 0,
      kitDir: KitDir,
    })
    if (idx < 0 || idx >= opts.length) {
      agentsAction = opts[0].action // batal popup / indeks aneh -> pilihan paling aman
      skippedSteps.push('Pilihan AGENTS.md (batal popup -> pilihan paling aman)')
    } else {
      agentsAction = opts[idx].action
    }

    if (agentsAction === 'skip') {
      console.log('INFO: AGENTS.md di-Lewati - lanjut ke identitas git + buka VS Code.')
      skippedSteps.push('AGENTS.md (kamu pilih Lewati, berkas lama dipertahankan)')
    } else if (agentsAction === 'diff') {
      console.log('')
      console.log('BEDA: AGENTS.md lama vs template baru')
      try {
        const tplContent = fs.readFileSync(agentsTemplate, 'utf8')
        const d = diffLines(existingContent, tplContent)
        console.log(`  Baris HANYA di berkas lama (${d.onlyExisting.length}):`)
        for (const l of d.onlyExisting.slice(0, 40)) console.log(`    - ${l}`)
        if (d.onlyExisting.length > 40) console.log(`    ... (+${d.onlyExisting.length - 40} baris lagi)`)
        console.log(`  Baris HANYA di template baru (${d.onlyTemplate.length}):`)
        for (const l of d.onlyTemplate.slice(0, 40)) console.log(`    + ${l}`)
        if (d.onlyTemplate.length > 40) console.log(`    ... (+${d.onlyTemplate.length - 40} baris lagi)`)
      } catch (e) {
        console.log(`PERINGATAN: Gagal bandingkan isi berkas: ${e.message}`)
      }
      console.log('Pemasangan berhenti - gabung manual dulu, lalu jalankan ulang dengan --force kalau mau timpa.')
      process.exit(0)
    }
    // 'backup-replace' / 'create' -> lanjut ke publishAgentsMd di bawah
  }

  if (dryRun) {
    console.log('[SIMULASI] PASANG AGENTS.md (isi template + cadangkan kalau sudah ada)')
  } else if (agentsAction === 'skip') {
    console.log('LEWATI AGENTS.md (kamu pilih Lewati - berkas lama dipertahankan).')
  } else {
    try {
      const r = publishAgentsMd({ projectRoot, templatePath: agentsTemplate, placeholders, preserve: false })
      if (r.backup_path) {
        addToManifest(manifestState, r.backup_path, 'backup', 'AGENTS.md (cadangan pra-timpa)')
        console.log(`CADANGAN AGENTS.md -> ${r.backup_path}`)
      }
      addToManifest(manifestState, r.target_path, 'filled_template', 'AGENTS.md.template')
      console.log(`OK    ${r.target_path}`)
    } catch (e) {
      console.error(`GAGAL pasang AGENTS.md: ${e.message}`)
      process.exit(1)
    }
  }

  // ---- Pasang pemuat CLAUDE.md (otomatis dibaca Claude Code) ----
  const claudeTemplate = path.join(KitDir, 'CLAUDE.md.template')
  if (dryRun) {
    console.log('[SIMULASI] PASANG pemuat CLAUDE.md')
  } else if (!fs.existsSync(claudeTemplate)) {
    console.log('PERINGATAN: CLAUDE.md.template tidak ada di kit - lewati pemuat (aturan mungkin tidak auto-baca).')
  } else {
    try {
      const r = publishClaudeMd({ projectRoot, templatePath: claudeTemplate, placeholders: { '<NAMA_PROYEK>': projectName } })
      if (r.action === 'current') {
        console.log('OK    Pemuat CLAUDE.md sudah terpasang (tidak diubah).')
      } else {
        if (r.backup_path) {
          addToManifest(manifestState, r.backup_path, 'backup', 'CLAUDE.md (kustom, cadangan pra-pemuat)')
          console.log(`CADANGAN CLAUDE.md kustom -> ${r.backup_path}`)
        }
        addToManifest(manifestState, r.target_path, 'filled_template', 'CLAUDE.md.template')
        console.log(`OK    ${r.target_path} (pemuat aturan tim - otomatis dibaca Claude Code)`)
      }
    } catch (e) {
      console.log(`PERINGATAN: Gagal pasang pemuat CLAUDE.md: ${e.message} (AGENTS.md tetap ada).`)
    }
  }

  // ---- Bootstrap docs/ skeleton (lewati kalau project hampir kosong) ----
  const docsDir = path.join(projectRoot, 'docs')
  const excludeNames = new Set(['.git', '.claude-kit', 'AGENTS.md', 'CLAUDE.md', 'docs', 'node_modules', 'vendor', 'dist', 'build', 'out', 'target', '__pycache__', '.venv', 'venv', '.next', '.nuxt', '.turbo', '.cache'])
  let nonHidden = []
  try {
    nonHidden = fs.readdirSync(projectRoot).filter((n) => !excludeNames.has(n) && !n.startsWith('.'))
  } catch { nonHidden = [] }
  const almostEmpty = nonHidden.length <= 1

  if (almostEmpty) {
    console.log('\nINFO: Project terlihat hampir kosong - lewati skeleton docs/ (terlalu dini). Akan auto-dibuat setelah ada kode.')
  } else {
    if (!fs.existsSync(docsDir) && !dryRun) {
      fs.mkdirSync(docsDir, { recursive: true })
      addDirToManifest(manifestState, docsDir)
      console.log(`\nDIBUAT ${docsDir}`)
    }
    const docsWithPlaceholder = [
      { src: 'templates/architecture.md', dst: path.join(docsDir, 'architecture.md'), from: 'templates/architecture.md', ph: { '<NAMA_PROYEK>': projectName, '[TBD: tanggal hari ini, format YYYY-MM-DD]': today, '[TBD: YYYY-MM-DD]': today } },
      { src: 'templates/glossary.md', dst: path.join(docsDir, 'glossary.md'), from: 'templates/glossary.md', ph: { '<NAMA_PROYEK>': projectName, '<YYYY-MM-DD>': today } },
    ]
    for (const t of docsWithPlaceholder) {
      const src = path.join(KitDir, t.src)
      deployOne({ src, dst: t.dst, from: t.from, kind: 'skeleton', placeholders: t.ph, manifestState, dryRun, withPlaceholder: true })
    }
    const extraStatic = [
      { name: '_PATTERNS.md', desc: 'aturan dokumentasi tim' },
      { name: '_EXAMPLE.md', desc: 'contoh format .md pendamping' },
      { name: 'architecture_auto.md', desc: 'registry TOC' },
    ]
    for (const t of extraStatic) {
      const src = path.join(KitDir, 'templates', t.name)
      deployOne({ src, dst: path.join(docsDir, t.name), from: 'templates/' + t.name, kind: 'skeleton', manifestState, dryRun, withPlaceholder: false })
    }
  }

  // ---- Bootstrap berkas TIM ----
  if (!skipTeamFiles && !almostEmpty) {
    console.log('\n=== Salin berkas tim (Team Mode) ===')
    const githubDir = path.join(projectRoot, '.github')
    const workflowsDir = path.join(githubDir, 'workflows')
    const scriptsDir = path.join(githubDir, 'scripts')
    const decisionsDir = path.join(docsDir, 'decisions')
    for (const d of [githubDir, workflowsDir, scriptsDir, decisionsDir]) {
      if (!fs.existsSync(d) && !dryRun) {
        fs.mkdirSync(d, { recursive: true })
        addDirToManifest(manifestState, d)
        console.log(`DIBUAT ${d}`)
      }
    }
    const teamFiles = [
      ['templates/github/workflows/ai-review.yml', path.join(workflowsDir, 'ai-review.yml')],
      ['templates/github/workflows/backup-schemas.yml', path.join(workflowsDir, 'backup-schemas.yml')],
      ['templates/github/workflows/secret-guard.yml', path.join(workflowsDir, 'secret-guard.yml')],
      ['templates/github/workflows/audit-access.yml', path.join(workflowsDir, 'audit-access.yml')],
      ['templates/github/scripts/ai-review.cjs', path.join(scriptsDir, 'ai-review.cjs')],
      ['templates/github/scripts/setup-branch-protection.ps1', path.join(scriptsDir, 'setup-branch-protection.ps1')],
      ['templates/github/CODEOWNERS.template', path.join(githubDir, 'CODEOWNERS')],
      ['templates/github/pull_request_template.md', path.join(githubDir, 'pull_request_template.md')],
      ['templates/KERJA_KELOMPOK.md', path.join(docsDir, 'KERJA_KELOMPOK.md')],
      ['templates/CLAUDE_TEAM_GUIDE.md', path.join(docsDir, 'CLAUDE_TEAM_GUIDE.md')],
      ['templates/PROMPT_LIBRARY.md', path.join(docsDir, 'PROMPT_LIBRARY.md')],
      ['templates/ONBOARDING.md', path.join(docsDir, 'ONBOARDING.md')],
      ['templates/TEAM_FLOW_SKETCH_v1.md', path.join(docsDir, 'TEAM_FLOW_SKETCH_v1.md')],
      ['templates/OWNER_SETUP_CHECKLIST_v1.md', path.join(docsDir, 'OWNER_SETUP_CHECKLIST.md')],
      ['templates/STACK_GUIDE.md', path.join(docsDir, 'STACK_GUIDE.md')],
      ['templates/STACK_MIGRATION_GUIDE.md', path.join(docsDir, 'STACK_MIGRATION_GUIDE.md')],
      ['templates/REFACTOR_STANDARD.md', path.join(docsDir, 'REFACTOR_STANDARD.md')],
      ['templates/RESEP_PERUBAHAN.md', path.join(docsDir, 'RESEP_PERUBAHAN.md')],
      // Contoh peta-konsistensi (anti drift "ubah A lupa B"). .jsonc = format yang dibaca GERBANG NODE
      // klien (`npx lintasai preflight` -> robot consistency-check.mjs). .psd1 = format robot PowerShell
      // cadangan (consistency-check.ps1). Keduanya disalin supaya jalur Node (utama) + PS (cadangan)
      // sama-sama punya contoh; klien/AI salin yang sesuai -> docs/consistency-map.jsonc lalu isi fakta.
      ['templates/consistency-map.example.jsonc', path.join(docsDir, 'consistency-map.example.jsonc')],
      ['templates/consistency-map.example.psd1', path.join(docsDir, 'consistency-map.example.psd1')],
      // Contoh "Buku Pelajaran" (LAPIS 3 anti-bug-berulang): tiap bug yang lolos -> jadi pengaman tetap.
      // Disalin sbg CONTOH (.example) -> klien/AI salin jadi docs/BUKU_PELAJARAN.md saat bug pertama,
      // lewat alur "AI usul -> owner setujui" (aturan CLAUDE_universal sec. 6.4, auto-baca tiap sesi).
      ['templates/BUKU_PELAJARAN.example.md', path.join(docsDir, 'BUKU_PELAJARAN.example.md')],
      ['templates/MCP_SETUP.md', path.join(docsDir, 'MCP_SETUP.md')],
      ['templates/RLS_SETUP_PROMPT.md', path.join(docsDir, 'RLS_SETUP_PROMPT.md')],
      ['templates/DB_SCHEMA_SCAN_PROMPT.md', path.join(docsDir, 'DB_SCHEMA_SCAN_PROMPT.md')],
      ['templates/OPERASI_DATABASE_AMAN.md', path.join(docsDir, 'OPERASI_DATABASE_AMAN.md')],
      ['templates/OBSERVABILITY_PRODUKSI.md', path.join(docsDir, 'OBSERVABILITY_PRODUKSI.md')],
      ['templates/GLOSSARY_NON_PROGRAMMER.md', path.join(docsDir, 'GLOSSARY_NON_PROGRAMMER.md')],
      ['templates/ANALOGI_LIBRARY.md', path.join(docsDir, 'ANALOGI_LIBRARY.md')],
      ['templates/UPDATE_GUIDE.md', path.join(docsDir, 'UPDATE_GUIDE.md')],
      ['templates/SECURITY_INCIDENT_PLAYBOOK.md', path.join(docsDir, 'SECURITY_INCIDENT_PLAYBOOK.md')],
      ['templates/THREAT_MODEL_NON_LEGAL.md', path.join(docsDir, 'THREAT_MODEL_NON_LEGAL.md')],
      ['templates/ACCESS_CONTROL_NREPO_v1.md', path.join(docsDir, 'ACCESS_CONTROL_NREPO_v1.md')],
      ['templates/feature-flags-advanced.md', path.join(docsDir, 'feature-flags-advanced.md')],
      ['templates/decisions/_TEMPLATE.md', path.join(decisionsDir, '_TEMPLATE.md')],
      ['templates/decisions/README.md', path.join(decisionsDir, 'README.md')],
    ]
    for (const [src, dst] of teamFiles) {
      deployOne({ src: path.join(KitDir, src), dst, from: src, kind: 'team_file', manifestState, dryRun, withPlaceholder: false })
    }
    // docs/SIGNED_RELEASE.md (dari folder docs/ kit, bukan templates/)
    deployOne({ src: path.join(KitDir, 'docs/SIGNED_RELEASE.md'), dst: path.join(docsDir, 'SIGNED_RELEASE.md'), from: 'docs/SIGNED_RELEASE.md', kind: 'team_file', manifestState, dryRun, withPlaceholder: false })

    // Pengingat mode-tim (cermin setup-pola-b.ps1:939-949): tunjuk berkas tim yang baru disalin supaya
    // staff tahu langkah lanjut yang TAK muncul di rangkuman akhir (kunci branch main + setup database).
    console.log('')
    console.log('=== Pengingat (mode tim) ===')
    console.log('  - Kunci branch utama (main) biar tiap perubahan lewat review: baca docs/KERJA_KELOMPOK.md.')
    console.log('  - Lengkapi peran tim: .github/CODEOWNERS + .github/staff-roster.yml.')
    console.log('  - Panduan tim + kumpulan perintah siap-pakai: docs/CLAUDE_TEAM_GUIDE.md + docs/PROMPT_LIBRARY.md.')
    console.log('  - Kalau pakai database: docs/MCP_SETUP.md, docs/RLS_SETUP_PROMPT.md, docs/DB_SCHEMA_SCAN_PROMPT.md.')
  } else if (skipTeamFiles) {
    console.log('\nINFO: --skip-team-files aktif - lewati salin .github/ + docs tim.')
  }

  // ---- Tulis kartu identitas project (project.lintas.jsonc) ----
  try {
    const pmWrite = writeLintasProjectManifestIfMissing(projectRoot, { dryRun })
    if (pmWrite.Written) {
      addToManifest(manifestState, pmWrite.Path, 'project_manifest', 'generated: project.lintas.jsonc')
      console.log(`OK    ${pmWrite.Path} (kartu identitas project - stack otomatis, tujuan menunggu AI)`)
    } else if (pmWrite.Reason === 'exists') {
      console.log('LEWATI project.lintas.jsonc (sudah ada, tidak ditimpa)')
    } else if (pmWrite.Reason === 'whatif') {
      console.log('[SIMULASI] TULIS project.lintas.jsonc di akar project')
    }
  } catch (e) {
    console.log(`PERINGATAN: Gagal tulis kartu identitas (lanjut): ${e.message}`)
  }

  // ---- Simpan catatan-pasang (.install-manifest.json + stempel keaslian) ----
  if (!dryRun) {
    try {
      const saveResult = saveManifest(manifestState, { kitDir: KitDir, kitVersion, projectName, installerName: 'setup-pola-b.mjs' })
      // .claude-kit/.gitignore: cegah kebocoran catatan-pasang + cadangan + rahasia
      appendGitignoreIfMissing(
        path.join(KitDir, '.gitignore'),
        ['.install-manifest.json', '.manifest-secret', '.audit-log', '.git-identity-*', '*.bak', '*.backup-*', '*.env', '*.env.local', '*.pem', '*.key'],
        '\n# Ditambah otomatis oleh pemasang lintasAI (cegah kebocoran rahasia + metadata):\n',
        false,
      )
      console.log(`\nOK    catatan-pasang ditulis (${saveResult.filesCount} berkas + ${saveResult.dirsCount} folder dicatat)`)
      if (saveResult.merged) console.log('      Digabung dengan catatan sebelumnya (pasang ulang terdeteksi).')
      if (saveResult.signed) console.log('      Diberi stempel keaslian (deteksi utak-atik aktif).')
    } catch (e) {
      console.log(`PERINGATAN: Gagal tulis catatan-pasang: ${e.message} (pemasangan TETAP berhasil).`)
    }

    // .gitignore akar project: cegah commit rahasia + identitas per-staff + folder cadangan
    try {
      const r = appendGitignoreIfMissing(
        path.join(projectRoot, '.gitignore'),
        ['.claude-kit/.audit-log', '.claude-kit/.manifest-secret', '.claude-kit/.install-manifest.json', '.git-identity-*', '.staff-profile.md', '.claude-kit.backup-*/', '*.backup-*', '*.bak', '*.bak.*'],
        '\n\n# === pola lintasAI (ditambah otomatis pemasang) ===\n# Cegah kebocoran: rahasia kit, identitas per-staff, folder cadangan.\n',
        false,
      )
      if (r.added > 0) console.log(`OK    .gitignore akar project: ${r.added} pola lintasAI ditambah (cegah kebocoran rahasia)`)
      else console.log('OK    .gitignore akar project: pola lintasAI sudah ada (tidak diubah)')
    } catch (e) {
      console.log(`PERINGATAN: Gagal perbarui .gitignore akar project: ${e.message}`)
    }
  }

  // ---- Direktori tim: .github/staff-roster.yml ----
  if (!dryRun) {
    try {
      const r = writeStaffRosterIfMissing(projectRoot)
      if (r.written) console.log(`OK    .github/staff-roster.yml dibuat (${r.emailFromGit ? 'email owner dari git config' : 'isi email owner - masih placeholder'}; lengkapi sebelum staff onboard)`)
      else if (r.reason === 'exists') console.log('LEWATI .github/staff-roster.yml (sudah ada, data tidak ditimpa)')
    } catch (e) {
      console.log(`PERINGATAN: Gagal buat staff-roster.yml: ${e.message}`)
    }
  }

  // ---- Gabung daftar izin Claude Code (.claude/settings.local.json) ----
  // Deterministik (pertahankan entri pengguna + buang duplikat). Notifikasi popup = [TAHAP 2].
  try {
    const settingsDir = path.join(projectRoot, '.claude')
    const settingsTarget = path.join(settingsDir, 'settings.local.json')
    const settingsTemplate = path.join(KitDir, 'templates', 'settings.local.json.template')
    if (!fs.existsSync(settingsTemplate)) {
      console.log('PERINGATAN: templates/settings.local.json.template tidak ada - lewati gabung daftar izin.')
    } else if (dryRun) {
      console.log('[SIMULASI] GABUNG daftar izin ke .claude/settings.local.json')
    } else {
      if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true })
        console.log(`DIBUAT ${settingsDir}`)
      }
      const changed = mergeAllowList({ existingPath: settingsTarget, templatePath: settingsTemplate, outputPath: settingsTarget })
      console.log(changed ? 'OK    Daftar izin digabung (tutup + buka ulang VS Code untuk menerapkan).' : 'OK    Daftar izin sudah lengkap (tidak ada perubahan).')
      // CATATAN URUTAN (beda SENGAJA dari PS): di pemasang Node, gabung daftar izin ini bagian TULANG
      // PUNGGUNG Tahap 1 (deterministik) - jalan SEBELUM identitas git. Di PS ia di Pass 2 SETELAH git,
      // jadi jalur "batal di langkah git" PS melewatinya; di Node ia sudah jalan duluan (idempoten +
      // lebih benar: izin selalu terpasang). Header berkas menyatakan ini bagian Tahap 1.
      // (Pemberitahuan popup GUI dibuang 06-22 - pesan konsol di atas sudah cukup untuk semua mode.)
    }
  } catch (e) {
    console.log(`PERINGATAN: Gabung daftar izin dilewati: ${e.message} (pemasangan TETAP berhasil).`)
  }

  // ---- Pasang hook "pengingat Bahasa Indonesia" ke .claude/settings.json ----
  // Idempoten + fail-safe (lib/lang-hook-wiring.mjs). Non-blokir: cuma menambah pengingat bahasa ke
  // konteks AI tiap pesan. Jalan di init DAN update (update-kit menjalankan ulang setup-pola-b --force).
  try {
    if (dryRun) {
      console.log('[SIMULASI] PASANG hook pengingat Bahasa Indonesia ke .claude/settings.json')
    } else {
      const r = ensureLangHook(projectRoot)
      if (r.changed) console.log(`OK    Hook pengingat Bahasa Indonesia ${r.reason === 'dibuat' ? 'dipasang' : 'digabung'} (.claude/settings.json) - tutup + buka ulang VS Code untuk menerapkan.`)
      else if (r.reason === 'sudah-ada') console.log('OK    Hook pengingat Bahasa Indonesia sudah terpasang (tidak ada perubahan).')
      else if (r.reason === 'settings-rusak-atau-terkunci') console.log('PERINGATAN: .claude/settings.json rusak/terkunci - hook bahasa dilewati (perbaiki JSON lalu jalankan setup ulang). Pemasangan TETAP berhasil.')
    }
  } catch (e) {
    console.log(`PERINGATAN: Pasang hook bahasa dilewati: ${e.message} (pemasangan TETAP berhasil).`)
  }

  // ---- Pasang "Palang Rem Otomatis" (risk-gate) ke .claude/settings.json (default NYALA sejak v1.61.0) ----
  // Idempoten + FAIL-SAFE (lib/ensure-risk-gate-hook.mjs): minta konfirmasi klik sebelum aksi BENAR-BENAR
  // berbahaya (rm -rf, DROP/DELETE tanpa WHERE, push --force, sentuh .env, format disk) + blokir menembus-
  // pagar. Mode "ask" = kerja normal TAK terganggu (hanya aksi bahaya yang ditanya). BEDA dari mode-otonomi
  // (§4.12 default mati): Palang Rem MENGURANGI risiko, jadi default NYALA = selaras "keamanan dulu" (tie-breaker #1).
  // Sangat mudah dimatikan: hapus blok PreToolUse risk-gate dari .claude/settings.json.
  try {
    if (dryRun) {
      console.log('[SIMULASI] PASANG Palang Rem risk-gate ke .claude/settings.json')
    } else {
      const rg = ensureRiskGateHook(projectRoot)
      if (rg.changed) console.log(`OK    Palang Rem aksi-berbahaya ${rg.reason === 'dibuat' ? 'dipasang' : 'digabung'} (.claude/settings.json) - minta konfirmasi sebelum aksi merusak. Matikan: hapus blok PreToolUse risk-gate. Aktif setelah buka chat BARU.`)
      else if (rg.reason === 'sudah-ada') console.log('OK    Palang Rem aksi-berbahaya sudah terpasang (tidak ada perubahan).')
      else if (rg.reason === 'settings-rusak-atau-terkunci') console.log('PERINGATAN: .claude/settings.json rusak/terkunci - Palang Rem dilewati (perbaiki JSON lalu jalankan setup ulang). Pemasangan TETAP berhasil.')
    }
  } catch (e) {
    console.log(`PERINGATAN: Pasang Palang Rem dilewati: ${e.message} (pemasangan TETAP berhasil).`)
  }

  // Penanda: penjaga rahasia DILEWATI karena project belum "git init" saat langkah ini. Kalau nanti
  // setupGitIdentity() membuat git init di sesi yang SAMA, kita pasang ulang penjaga (tutup celah-bocor
  // .env di antara git-init dan update berikutnya).
  let secretHookDeferred = false
  // ---- Pasang penjaga rahasia pre-commit (.env / kunci API) ke .git/hooks/pre-commit ----
  // Idempoten + FAIL-OPEN (lib/install-secret-hook.mjs): cegah rahasia ter-commit DI LAPTOP (shift-left,
  // lapis-1). Lapis-2 = .github/workflows/secret-guard.yml (CI). PENTING, BUKAN jaminan menyeluruh:
  // cegah commit BARU (bukan riwayat lama); bisa dilewati darurat `git commit --no-verify`. Jalan di init
  // DAN update (update-kit menjalankan ulang setup-pola-b --force) -> idempoten, tak dobel.
  try {
    if (dryRun) {
      console.log('[SIMULASI] PASANG penjaga rahasia pre-commit ke .git/hooks/pre-commit')
    } else {
      const sh = installSecretHook(projectRoot)
      if (sh.installed) {
        addToManifest(manifestState, sh.hookPath, 'secret_hook', 'generated: .git/hooks/pre-commit')
        const note = sh.backupPath ? ` (hook lama dicadangkan ke ${path.basename(sh.backupPath)})` : ''
        console.log(`OK    Penjaga rahasia pre-commit terpasang${note} - file .env/kunci ditolak sebelum commit. Lewati darurat: git commit --no-verify.`)
      } else if (sh.reason === 'sudah-ada') {
        console.log('OK    Penjaga rahasia pre-commit sudah terpasang (tidak ada perubahan).')
      } else if (sh.reason === 'tak-ada-git') {
        secretHookDeferred = true
        console.log('INFO  Penjaga rahasia pre-commit dilewati (project belum "git init"). Akan dipasang otomatis kalau git init dibuat di langkah berikut.')
      }
    }
  } catch (e) {
    console.log(`PERINGATAN: Pasang penjaga rahasia dilewati: ${e.message} (pemasangan TETAP berhasil).`)
  }

  // ---- TAHAP 2: identitas git + buka VS Code ----
  // Lewati semua di mode SIMULASI (tanpa efek samping). setupGitIdentity bisa MENGHENTIKAN proses
  // (process.exit) kalau user pilih "batalkan setup di langkah git" - cermin PS (return) baris ~1246.
  if (!dryRun) {
    setupGitIdentity({ projectRoot, kitDir: KitDir, skippedSteps })
    // #1 tutup celah-bocor: kalau penjaga rahasia tadi DILEWATI karena belum git init, DAN setupGitIdentity
    // baru saja membuat git init di sesi ini, pasang penjaga SEKARANG (jangan tunggu update berikutnya).
    // installSecretHook idempoten + fail-open: kalau git tetap tak ada (user lewati init) -> no-op aman.
    // Catatan: tak addToManifest di sini (saveManifest baris ~628 sudah jalan -> entri tak akan ter-persist,
    // sama seperti pencatatan hook awal baris ~723; yang penting hook fisik terpasang).
    if (secretHookDeferred) {
      try {
        const sh2 = installSecretHook(projectRoot)
        if (sh2.installed) {
          console.log('OK    Penjaga rahasia pre-commit terpasang setelah git init - file .env/kunci ditolak sebelum commit. Lewati darurat: git commit --no-verify.')
        }
      } catch (e) {
        console.log(`PERINGATAN: Pasang penjaga rahasia (setelah git init) dilewati: ${e.message} (pemasangan TETAP berhasil).`)
      }
    }
    launchVsCode({ projectRoot, kitDir: KitDir, skippedSteps })
  }

  // ---- Rangkuman akhir (terstruktur + bisa langsung ditindaklanjuti) ----
  printFinalSummary({ projectName, projectRoot, kitDir: KitDir, kitVersion, almostEmpty, skipTeamFiles, dryRun, skippedSteps })
  process.exit(0)
}

// ============================================================================
// TAHAP 2 - fungsi "lem" interaktif (popup via lib/popup-shim.mjs + penolong murni lib/setup-interactive.mjs).
// Mode otomatis/tanpa-layar: popup tak tampil, pakai nilai-aman (cermin pemasang PS non-interaktif).
// ============================================================================

// Atur identitas git (email -> user.email/user.name). Cermin setup-pola-b.ps1:1142-1423.
// Alur: cek repo sudah git init? (kalau belum, tawarkan lewati/init/batal) -> kalau email belum
// di-set, minta lewat popup -> validasi -> simpan ke scope LOKAL (atau global kalau bukan repo) ->
// tulis penanda biar tak ditanya ulang. Semua dibungkus try/catch: git hilang/gagal != crash.
function setupGitIdentity({ projectRoot, kitDir, skippedSteps }) {
  try {
    const setMarker = path.join(projectRoot, '.claude-kit', '.git-identity-set')
    const skipMarker = path.join(projectRoot, '.claude-kit', '.git-identity-skipped')
    if (fs.existsSync(setMarker)) {
      console.log('INFO: Identitas Git sudah diatur sebelumnya (tidak ditanya lagi). Hapus .claude-kit/.git-identity-set kalau mau atur ulang.')
      return
    }
    if (fs.existsSync(skipMarker)) {
      console.log('INFO: Pengaturan identitas Git sebelumnya dilewati (hapus .claude-kit/.git-identity-skipped kalau mau coba lagi).')
      skippedSteps.push('Setup identitas Git (dilewati via penanda)')
      return
    }

    // ---- Pra-cek: project sudah `git init`? ----
    // Cermin PS '-PathType Container': "belum git init" HANYA kalau .git BUKAN direktori. (.git bisa
    // berupa BERKAS gitlink di submodule/worktree - diperlakukan sama seperti PS, bukan existsSync biasa.)
    const gitFolder = path.join(projectRoot, '.git')
    let hasGitDir = false
    try { hasGitDir = fs.statSync(gitFolder).isDirectory() } catch { hasGitDir = false }
    if (!hasGitDir) {
      console.log('')
      console.log('=== Pra-cek: cek repo Git ===')
      console.log(`Project '${path.basename(projectRoot)}' belum di-git init.`)
      console.log('Tanpa repo git lokal, pencarian peran lewat git config user.email tidak bisa per-project.')
      console.log('')
      // Opsi [1] = lewati git (paling aman, tidak mengubah berkas) = rekomendasi + default (indeks 0).
      const idx = showNumberedChoice({
        title: 'Repo Git belum ada',
        message: `Project '${path.basename(projectRoot)}' belum di-git init. Pilih:`,
        options: [
          { Label: 'Lewati langkah git, pakai identitas global (rekomendasi, paling aman: tidak mengubah berkas)', Recommended: true },
          { Label: 'Buat git init otomatis di folder project (kalau mau simpan setup di sini)' },
          { Label: 'Batalkan setup di langkah git (mau init git manual dulu)', SpecialKey: 'cancel' },
        ],
        defaultIndex: 0,
        kitDir,
      })
      const choice = (Number.isInteger(idx) ? idx : 0) + 1 // 0-based -> 1-based; -1/aneh -> 0 -> [1] aman
      if (choice === 2) {
        console.log(`Menjalankan git init di ${projectRoot} ...`)
        const r = spawnSync('git', ['-C', projectRoot, 'init'], { encoding: 'utf8' })
        if (!r.error && r.status === 0) {
          console.log('OK    Repo git dibuat.')
        } else {
          console.log('PERINGATAN: git init gagal. Pakai identitas --global sebagai cadangan.')
        }
      } else if (choice === 3) {
        console.log('Identitas git dilewati (kamu pilih batal di langkah git).')
        console.log('CATATAN: berkas kit SUDAH ter-pasang. Yang dilewati cuma setup identitas git.')
        console.log('Jalankan ulang pemasang kapan saja untuk menyelesaikan langkah ini.')
        skippedSteps.push('Setup identitas Git (kamu batalkan di pra-cek)')
        writeMarkerSafe(skipMarker)
        // Cermin PS (return setelah pesan -> tak lanjut ke VS Code / rangkuman penuh).
        process.exit(0)
      } else {
        console.log('Lewati git init. Identitas akan di-set di scope --global.')
      }
    }

    // ---- Cek email saat ini (LOCAL dulu, lalu GLOBAL) - scope baca = scope tulis (cegah tanya ulang) ----
    let currentEmail = ''
    const localEmail = spawnSync('git', ['-C', projectRoot, 'config', '--local', '--get', 'user.email'], { encoding: 'utf8' })
    if (!localEmail.error && localEmail.status === 0 && (localEmail.stdout || '').trim()) {
      currentEmail = localEmail.stdout.trim()
    }
    if (!currentEmail) {
      const globalEmail = spawnSync('git', ['config', '--global', '--get', 'user.email'], { encoding: 'utf8' })
      if (!globalEmail.error && globalEmail.status === 0 && (globalEmail.stdout || '').trim()) {
        currentEmail = globalEmail.stdout.trim()
      }
    }
    if (currentEmail) return // sudah di-set -> selesai

    // ---- Minta email (popup input). Mode tanpa-layar -> Cancel -> lewati (bisa diatur nanti). ----
    console.log('')
    console.log('=== Setup identitas Git ===')
    console.log('Git user.email belum di-set. Diperlukan untuk pencarian peran (staff-roster.yml).')
    const res = showInput({
      title: 'Setup Identitas Git',
      message: 'Email kamu (untuk pencarian peran):',
      defaultValue: '',
      kitDir,
    })
    const email = (res.status === 'OK' ? String(res.value || '') : '').trim()
    if (!email) {
      // Pemasang Node non-interaktif (popup GUI dibuang 06-22): showInput selalu balas Cancel, jadi
      // langkah email SELALU dilewati di sini - identitas git diatur lewat AI/chat atau `git config`
      // sesudahnya. JANGAN tulis penanda skip (cermin PS non-interaktif): kalau ditulis, pasang-ulang
      // oleh staff akan lompati langkah ini diam-diam.
      skippedSteps.push('Setup identitas Git (dilewati - atur lewat AI/chat atau git config nanti)')
      return
    }
    if (!isValidGitEmail(email)) {
      console.log('PERINGATAN: Format email tidak sah - identitas git tidak di-set.')
      skippedSteps.push('Setup identitas Git (format email tidak sah)')
      return
    }

    // ---- Simpan ke scope LOKAL (kalau di dalam repo) atau GLOBAL (kalau bukan repo) ----
    const derivedName = deriveGitName(email)
    let isRepo = false
    const inside = spawnSync('git', ['-C', projectRoot, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' })
    if (!inside.error && inside.status === 0 && (inside.stdout || '').trim() === 'true') isRepo = true
    if (isRepo) {
      spawnSync('git', ['-C', projectRoot, 'config', '--local', 'user.email', email])
      spawnSync('git', ['-C', projectRoot, 'config', '--local', 'user.name', derivedName])
      console.log(`Identitas git di-set (scope lokal): ${email} (nama=${derivedName})`)
    } else {
      console.log(`INFO: ${projectRoot} bukan repo git. Set identitas --global sebagai cadangan.`)
      spawnSync('git', ['config', '--global', 'user.email', email])
      spawnSync('git', ['config', '--global', 'user.name', derivedName])
      console.log(`Identitas git di-set (scope global, tanpa repo lokal): ${email} (nama=${derivedName})`)
    }
    // Penanda sukses (idempoten lintas-proses: pasang-ulang tak menanya lagi).
    writeMarkerSafe(setMarker, `${email}|${new Date().toISOString()}`)
  } catch (e) {
    console.log(`PERINGATAN: Setup identitas git dilewati: ${e.message}`)
  }
}

// Tulis berkas penanda kecil (best-effort: gagal-pun tak menghentikan pemasangan). UTF-8 no-BOM.
function writeMarkerSafe(markerPath, content = '') {
  try {
    fs.mkdirSync(path.dirname(markerPath), { recursive: true })
    fs.writeFileSync(markerPath, content, 'utf8')
  } catch (e) {
    console.log(`PERINGATAN: Gagal tulis penanda ${path.basename(markerPath)}: ${e.message}`)
  }
}

// Deteksi VS Code + tawarkan buka (popup Ya/Tidak) + salin kalimat pembuka ke papan-tempel.
// Cermin setup-pola-b.ps1:1500-1591. Mode tanpa-layar -> popup tak tampil -> 'No' -> lewati.
function launchVsCode({ projectRoot, kitDir, skippedSteps }) {
  const vsCodeExe = findVsCodeExe(process.env)
  if (!vsCodeExe) {
    console.log('VS Code tidak terdeteksi - pasang dari code.visualstudio.com kalau perlu.')
    return
  }
  const ans = showYesNo({
    title: 'Pemasangan selesai!',
    message: 'Buka VS Code sekarang? (disarankan: Ya - langsung buka lalu tempel kalimat pembuka). Catatan: isi papan-tempel (clipboard) akan diganti kalimat pembuka - pastikan tidak ada password/rahasia yang sedang kamu salin. Lanjut?',
    defaultYes: false,
    kitDir,
  })
  if (ans !== 'Yes') {
    skippedSteps.push('Buka VS Code (kamu pilih Tidak / batal popup)')
    return
  }
  // Salin kalimat pembuka ke papan-tempel (lewat clip.exe). Catat hasilnya supaya pesan tip jujur.
  let clipboardOk = true
  try {
    const c = spawnSync('clip', [], { input: STARTER_PROMPT, encoding: 'utf8' })
    if (c.error || c.status !== 0) clipboardOk = false
  } catch (e) {
    clipboardOk = false
  }
  // Buka VS Code TANPA menunggu (lepas + unref) - cermin Start-Process. Path project sebagai argumen
  // posisional (aman untuk path ber-spasi/Unicode; spawn tak menyatukan argumen dengan spasi).
  try {
    const child = spawn(vsCodeExe, [projectRoot], { detached: true, stdio: 'ignore' })
    child.unref()
  } catch (e) {
    console.log(`PERINGATAN: Gagal buka VS Code: ${e.message}`)
    return
  }
  if (clipboardOk) {
    showInfo({
      title: 'Tip',
      message: 'Kalimat pembuka sudah ada di papan-tempel. Buka chat Claude Code, tekan Ctrl+V, lalu Enter.',
      kitDir,
    })
  } else {
    // Papan-tempel gagal (mis. clipboard RDP terkunci) - tampilkan kalimatnya biar bisa disalin manual.
    showInfo({
      title: 'Tip',
      message: `Papan-tempel gagal diisi - salin manual kalimat pembuka berikut ke chat Claude Code lalu tekan Enter:\n\n${STARTER_PROMPT}`,
      kitDir,
    })
  }
}

// Cetak rangkuman akhir + panduan tindak-lanjut. Cermin setup-pola-b.ps1:1594-1755 (struktur sama:
// SUDAH AKTIF / yang perlu kamu lakukan / alat paket / panduan kunci-gabung / langkah berikut /
// checklist untuk AI / langkah yang dilewati / Status SIAP NGODING + arahan AI lanjut Fase B).
// #4 Papan "apa yang sudah nyala vs belum": cek deterministik (cuma-baca) status tiap PENJAGA yang bisa
// dinyalakan di project, supaya owner tahu di Hari-0 mana yang masih tidur (bukan baru ketahuan saat
// insiden). Pola lintasAI: beberapa penjaga terkuat default-MATI/opt-in (Palang Rem risk-gate, pencegah
// salah-ketik-angka consistency-map, Buku Induk akses) -> panel ini MEMBUATNYA TERLIHAT + 1 kalimat cara
// nyalakan (ramah non-programmer). Semua cek = existsSync / baca teks -> tak mengubah apa pun. Diekspor
// untuk uji-banding. Dipakai printFinalSummary (hanya saat bukan simulasi).
export function buildGuardStatusLines(projectRoot, { almostEmpty = false, skipTeamFiles = false } = {}) {
  const lines = []
  const mark = (on) => (on ? '[x]' : '[ ]')
  const hasText = (p, needle) => {
    try { return fs.existsSync(p) && fs.readFileSync(p, 'utf8').includes(needle) } catch { return false }
  }
  // 1) Penjaga rahasia pre-commit (tolak commit .env/kunci di laptop). Penanda = baris header template.
  const secretOn = hasText(path.join(projectRoot, '.git', 'hooks', 'pre-commit'), 'lintasAI pre-commit secret guard')
  lines.push(`  ${mark(secretOn)} Penjaga rahasia (commit)   : ${secretOn ? 'NYALA' : 'BELUM - buat repo dulu (git init), lalu: npx lintasai update'}`)
  // 2) Pencegah salah-ketik-angka (consistency-check) - butuh peta fakta AKTIF (bukan .example).
  const consistOn = fs.existsSync(path.join(projectRoot, 'docs', 'consistency-map.jsonc'))
  lines.push(`  ${mark(consistOn)} Pencegah salah-ketik-angka : ${consistOn ? 'NYALA' : 'BELUM - minta AI: "aktifkan pencegah-drift"'}`)
  // 3) Palang Rem aksi-berbahaya (risk-gate) - default NYALA sejak v1.61.0, di .claude/settings.json.
  const riskOn = hasText(path.join(projectRoot, '.claude', 'settings.json'), 'risk-gate')
  lines.push(`  ${mark(riskOn)} Palang Rem aksi-berbahaya  : ${riskOn ? 'NYALA (matikan: hapus blok PreToolUse risk-gate)' : 'BELUM (harusnya default NYALA) - jalankan: npx lintasai enable-risk-gate'}`)
  // 4) Buku Induk akses (fondasi kontrol-akses pisah-repo) - hanya relevan untuk tim multi-repo.
  if (!skipTeamFiles && !almostEmpty) {
    const portfolioOn = fs.existsSync(path.join(projectRoot, 'lintasai-portfolio.yml'))
    lines.push(`  ${mark(portfolioOn)} Buku Induk akses (tim)     : ${portfolioOn ? 'NYALA' : 'BELUM - minta AI: "buatkan Buku Induk akses"'}`)
  }
  return lines
}

function printFinalSummary({ projectName, projectRoot, kitDir, kitVersion, almostEmpty, skipTeamFiles, dryRun, skippedSteps }) {
  console.log('')
  console.log('================================================================')
  // Teks banner SENGAJA byte-identik dgn PS (setup-pola-b.ps1:1597): "KIT lintasAI - TER-INSTALL" =
  // string PEMICU auto-lanjut Fase B (CLAUDE_universal §4.3b kondisi #1). Jangan ganti tanpa
  // memperbarui §4.3b + POST_SETUP_CHECKLIST (kontrak antar-berkas; dikunci tes smoke orkestrator).
  console.log(`  OK    KIT lintasAI - TER-INSTALL DI ${projectName}`)
  console.log('================================================================')
  console.log('')

  console.log('SUDAH AKTIF (otomatis dibaca tiap sesi AI):')
  console.log('  [x] Aturan AI         : 4 dokumen aturan + Tinjauan lintasAI Divisi (programmer + non-programmer)')
  if (almostEmpty) {
    console.log('  [ ] docs/             : DILEWATI (project hampir kosong) - akan dibuat otomatis saat ada kode')
    console.log('  [ ] .github/          : DILEWATI (project hampir kosong) - berkas tim belum disalin')
  } else {
    console.log('  [x] docs/             : skeleton + panduan tim (architecture, glossary, _PATTERNS, dll.)')
    if (!skipTeamFiles) console.log('  [x] .github/          : ai-review.yml + CODEOWNERS + template PR')
    else console.log('  [ ] .github/          : DILEWATI (--skip-team-files aktif)')
  }
  console.log('  [x] Lokasi aturan     : dari folder .claude-kit/ di project ini')
  console.log('')

  // #4 Papan status penjaga (nyala vs belum) - hanya saat bukan simulasi (di simulasi berkas tak ditulis).
  if (!dryRun) {
    try {
      console.log('STATUS PENJAGA (nyala vs belum - cek cepat, cuma-baca):')
      for (const line of buildGuardStatusLines(projectRoot, { almostEmpty, skipTeamFiles })) console.log(line)
      console.log('  Lihat kondisi SEMUA repo tim 1 layar kapan saja: npx lintasai board')
      console.log('  Frasa ajaib untuk AI (tinggal ketik): "lintasAI skill" = pindai menyeluruh; "audit"; "refactor bertingkat". Daftar lengkap: docs/ONBOARDING.md.')
      console.log('')
    } catch { /* panel status = pelengkap; jangan pernah bikin pemasangan gagal */ }
  }

  console.log('HAL YANG PERLU KAMU LAKUKAN SENDIRI:')
  let itemIdx = 1
  if (!skipTeamFiles && !almostEmpty) {
    console.log(`  [ ] (${itemIdx}) ~5 menit  Edit .github/CODEOWNERS - ganti placeholder @username dengan username GitHub asli.`)
    itemIdx++
    console.log(`  [ ] (${itemIdx}) ~2 menit  Atur ANTHROPIC_API_KEY di GitHub: Settings -> Secrets and variables -> Actions -> New secret.`)
    itemIdx++
  }
  console.log(`  [ ] (${itemIdx}) opsional  Baca docs/CLAUDE_TEAM_GUIDE.md (panduan tim) + docs/PROMPT_LIBRARY.md.`)
  itemIdx++

  // ---- Alat paket (biar staff tahu perintah pasang yang benar) ----
  try {
    const pm = getPackageManager(projectRoot)
    if (pm.manager && pm.manager !== 'none' && pm.installCmd) {
      console.log('')
      console.log(`=== Perintah pasang dependensi (terdeteksi: ${pm.manager}) ===`)
      console.log(`  Pakai: ${pm.installCmd}`)
      // Susun alasan dalam Bahasa Indonesia (pm.reason dari modul lain berbahasa Inggris - jangan
      // dicetak mentah ke staff non-programmer, §2.1; robot bahasa tak lihat nilai antar-modul).
      const alasan = pm.lockFile
        ? `terdeteksi dari berkas-kunci ${pm.lockFile}`
        : (pm.confidence === 'high'
            ? 'dideklarasikan di package.json (kolom packageManager)'
            : 'bawaan npm - belum ada berkas-kunci (keyakinan sedang)')
      console.log(`  Alasan: ${alasan}`)
      if (pm.runCmd) console.log(`  Jalankan server lokal: ${pm.runCmd}`)
    }
  } catch (e) {
    // diam - deteksi alat paket cuma pelengkap, jangan bikin gagal.
  }

  // ---- Panduan simpan ke git (kunci-gabung / branch protection) ----
  try {
    const bp = testMainBranchProtected(projectRoot)
    console.log('')
    console.log('=== Panduan simpan ke git (kunci-gabung / branch protection) ===')
    for (const line of buildCommitGuidance(bp, kitVersion)) console.log(line)
  } catch (e) {
    console.log('')
    console.log('=== Panduan simpan ke git ===')
    console.log("  [ ] opsional  Simpan setup ke git: git add AGENTS.md .claude-kit/ docs/ .github/ && git commit -m 'chore: pasang standar tim IT'")
  }
  console.log('')

  console.log('LANGKAH SELANJUTNYA - BIASANYA OTOMATIS:')
  console.log(`  Buka Claude Code di ${projectRoot}.`)
  console.log('  Popup pemandu akan MUNCUL SENDIRI (kamu tinggal klik/ketik angka) - kamu TIDAK')
  console.log('  perlu menempel apa-apa. AI yang baca + memandu langkah demi langkah.')
  console.log('')
  console.log('  KALAU popup tidak muncul sendiri, ketik 1 kalimat ini ke Claude Code:')
  console.log('      lanjutkan setup lintasAI')
  console.log(`  (cara lama juga boleh: tempel isi ${path.join(kitDir, 'JALANKAN_KIT.md')} - hasil sama persis).`)
  console.log('')
  // Baris penenang (cermin PS:1690-1691): tegaskan tak ada paksaan langkah lanjutan.
  console.log('  Kalau mau langsung kerja: boleh - aturan AI tetap otomatis kebaca tiap')
  console.log('  sesi, catatan kode dibuat otomatis saat dibutuhkan.')
  console.log('')

  // Catatan untuk AI (bukan untuk manusia) - cegah AI berhenti di "SIAP NGODING" tanpa lanjut Fase B.
  console.log('(Catatan di bawah ini UNTUK AI, bukan untukmu. Kamu sebagai manusia TIDAK perlu')
  console.log(' melakukan apa-apa - cukup biarkan AI yang baca + lanjut sendiri.)')
  console.log('=== AI: POST-INSTALL CHECKLIST (WAJIB EKSEKUSI - JANGAN STOP) ===')
  console.log('Pemasangan (Fase A) SELESAI - tapi tugasmu (AI) BELUM. Fase B (pemanduan chat) BELUM jalan.')
  console.log("'Status: SIAP NGODING' di bawah = Fase A beres, BUKAN akhir tugasmu. JANGAN berhenti:")
  console.log('  [ ] (1) WAJIB baca .claude-kit/POST_SETUP_CHECKLIST_PROMPT_v1.md')
  console.log('  [ ] (2) WAJIB jalankan popup dari SUMBER TUNGGAL JALANKAN_KIT.md Bagian 2-7')
  console.log('  [ ] (3) Eksekusi sesuai jawaban user (mapping di JALANKAN_KIT.md Bagian 2-6).')
  console.log('  [ ] (4) WAJIB tawarkan Audit Post-Setup ke user (mode aman cuma-baca): ya/nanti.')
  console.log('  [ ] (5) WAJIB lapor Pending Action Items + arahkan owner ke docs/OWNER_SETUP_CHECKLIST.md.')
  console.log('  [ ] (6) WAJIB pakai Bahasa Non-Programmer di SEMUA output sesi setelah ini (PRE-SEND CHECKLIST §2.1.1).')
  console.log('LARANGAN: AI TIDAK BOLEH berhenti di "Status: SIAP NGODING" tanpa lapor checklist (1-6).')
  console.log('Per CLAUDE_universal_v1.md §2.1.1 + §4.3b + §4.4 (audit auto-tawar setelah setup-pola-b).')
  console.log('User boleh menolak via chat: "skip post-setup checklist" / "cuma popup 3" / "cuma audit".')
  console.log('')

  console.log('UPDATE KIT KE VERSI BARU:')
  console.log('  .\\.claude-kit\\update-kit.ps1   (auto unduh-ulang + cadangkan + deteksi [BREAKING]/[SCAN-REQUIRED])')
  console.log('')

  if (dryRun) console.log('Mode SIMULASI: jalankan ulang tanpa --dry-run untuk eksekusi sungguhan.')

  // Lapor jujur langkah yang dilewati (tetap selesai dengan kode-keluar 0 / graceful).
  if (skippedSteps.length > 0) {
    console.log('')
    console.log('Pemasangan selesai dengan beberapa langkah dilewati oleh user:')
    for (const s of skippedSteps) console.log(`  - ${s}`)
    console.log('')
  }
  console.log('Status: SIAP NGODING')
  console.log('')
  // Baris terakhir = arahan AI lanjut Fase B (cermin PS v1.43.1): kesan terakhir bukan "selesai".
  console.log('=== AI (penutup): JANGAN berhenti di "SIAP NGODING" - itu cuma akhir Fase A. ===')
  console.log('    LANJUT SEKARANG: baca .claude-kit/POST_SETUP_CHECKLIST_PROMPT_v1.md, lalu jalankan')
  console.log('    popup pemandu Fase B (JALANKAN_KIT.md Bagian 2-7). Tugasmu belum kelar.')
  console.log('')
}

// Salin 1 berkas template -> target + catat ke manifest. Lewati kalau target sudah ada.
function deployOne({ src, dst, from, kind, placeholders = {}, manifestState, dryRun, withPlaceholder }) {
  if (fs.existsSync(dst)) {
    console.log(`LEWATI ${dst} (sudah ada, tidak ditimpa)`)
    return
  }
  if (!fs.existsSync(src)) {
    console.log(`PERINGATAN: Template tidak ditemukan: ${src} (lewati)`)
    return
  }
  if (dryRun) {
    console.log(`[SIMULASI] SALIN ${src} -> ${dst}`)
    return
  }
  const r = withPlaceholder
    ? copyTemplateWithPlaceholder({ sourcePath: src, targetPath: dst, placeholders, ifExists: 'Skip' })
    : copyStaticTemplate({ sourcePath: src, targetPath: dst, ifExists: 'Skip' })
  if (r.copied) {
    addToManifest(manifestState, dst, kind, from.replace(/\\/g, '/'))
    console.log(`OK    ${dst}`)
  } else if (r.action === 'missing') {
    console.log(`GAGAL salin ${dst}: sumber hilang`)
  }
}

// Jalankan HANYA kalau dipanggil langsung (node setup-pola-b.mjs ...), bukan saat di-import untuk
// diuji. Cermin pola isMain di lib/popup-shim.mjs (cegah eksekusi tak sengaja + buka jalan uji).
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
