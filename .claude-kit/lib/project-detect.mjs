#!/usr/bin/env node
// lib/project-detect.mjs - Deteksi keadaan project (versi Node). Padanan lib/project-detect.ps1.
//
// DI-PORT (logika MURNI: baca berkas/folder + parse package.json, tanpa spawn alat luar -> aman & lintas-OS,
// perilaku identik dgn PS):
//   - getMonorepoState   : tebak apakah project = monorepo (1 gudang isi banyak peran) + ragam + keyakinan.
//   - testPostSplitState : tebak apakah project sudah pernah dipecah jadi banyak repo (anti-tawar-ulang).
//   - getPackageManager  : tebak alat paket Node (pnpm/yarn/bun/npm) dari berkas-kunci + field Corepack.
//   - getStackType       : tebak bahasa gudang (node/python/go/rust/ruby/php) dari berkas penanda.
//
// SENGAJA TIDAK DI-PORT:
//   - Get-DynamicPopup2Order : USANG sejak v1.43.0 (skema Popup #2 LAMA), TANPA pemanggil aktif di kode
//                              (cuma muncul di CHANGELOG = riwayat). Hindari menghidupkan kode mati (sec.5
//                              reuse/anti-duplikasi). Kalau suatu saat skema lama dibutuhkan lagi, rujuk
//                              sumber asli lib/project-detect.ps1 + perbarui ke skema Popup #3 dulu.
//
// CATATAN GERBANG (penting saat menyunting): nilai string "Evidence"/"Flavor"/"Reason"/"DetectedPatterns"
// DISENGAJA berbahasa Inggris & dijaga BYTE-IDENTIK dengan PS (gerbang "output-identik" ADR-003). Itu DATA
// INTERNAL yang dibaca orkestrator/AI (lalu AI yang menerjemahkan ke bahasa awam untuk user) -- BUKAN teks
// yang langsung dipajang ke user. Jangan "rapikan" ke Indonesia: itu akan memecah uji-banding PS vs Node.
// Gerbang bahasa non-programmer (ADR-004 #3) berlaku untuk teks USER-FACING (popup/prompt/narasi/error),
// bukan untuk nilai-data internal ini. Komentar kode = Indonesia (untuk perawat berikutnya).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSafe, isFile, isDir, pathExists } from './fs-text.mjs'

// --- util kecil (senyap): pathExists/isDir/isFile/readTextSafe dipindah ke sumber bersama
// lib/fs-text.mjs (impor di atas) -> audit fungsi-kembar 2026-06-25. Cermin Test-Path PS + parse aman.

// Folder yang DILEWATI saat menghitung berkas (cermin Where-Object regex + cap 500 di PS).
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.claude-kit'])

// Hitung berkas di bawah root, lewati folder berat + berkas *.log/*.lock, BERHENTI di 500
// (cermin: Get-ChildItem -Recurse -File -Exclude '*.log','*.lock' | Where {bukan folder berat} | Select -First 500).
function countFilesCapped(root, cap = 500) {
  let count = 0
  const stack = [root]
  while (stack.length > 0) {
    if (count >= cap) break
    const dir = stack.pop()
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const ent of entries) {
      if (count >= cap) break
      if (ent.isDirectory()) {
        // CASE-INSENSITIVE (cermin PS -notmatch): folder 'Node_Modules'/'.GIT'/'.NEXT' juga dilewati.
        // SKIP_DIRS semua huruf-kecil, jadi turunkan nama folder dulu sebelum cek.
        if (SKIP_DIRS.has(ent.name.toLowerCase())) continue
        stack.push(path.join(dir, ent.name))
      } else if (ent.isFile()) {
        const lower = ent.name.toLowerCase()
        if (lower.endsWith('.log') || lower.endsWith('.lock')) continue
        count++
      }
    }
  }
  return count
}

// Kumpulkan dependencies + devDependencies dari package.json jadi satu Set nama paket. {} kalau gagal.
function readDepNames(pkgPath) {
  const names = new Set()
  const raw = readTextSafe(pkgPath)
  if (raw == null) return names
  let pkg
  try { pkg = JSON.parse(raw) } catch { return names }
  for (const field of ['dependencies', 'devDependencies']) {
    const obj = pkg && pkg[field]
    if (obj && typeof obj === 'object') for (const k of Object.keys(obj)) names.add(k)
  }
  return names
}

// === getMonorepoState ============================================================================
// Tebak apakah project = monorepo + ragamnya. 4 pola (urut prioritas, cermin PS PERSIS termasuk
// pola 1 & 2 yang TIDAK dijaga "-not IsMonorepo" -> bisa MENUMPUK; pola 3 & 4 dijaga).
//
// SATU DIVERGENSI DISENGAJA dari lib/project-detect.ps1 (Node lebih benar, BUKAN bug-replikasi):
//   PS Get-MonorepoState membaca dep via `$pkg.dependencies` / `$pkg.devDependencies`. Di bawah
//   `Set-StrictMode -Version Latest`, mengakses properti yang ABSEN (mis. package.json yang punya
//   "dependencies" tapi TANPA "devDependencies") akan MELEMPAR -> tertangkap try/catch PS -> SEMUA
//   dep gagal terbaca -> project Next.js bisa salah-divonis "None". Itu bug-laten PS (terverifikasi
//   2026-06-22: `./package.json` repo ini sendiri tak punya devDependencies = pemicu nyata). Node
//   memakai `pkg[field]` yang aman (absen -> undefined, tak melempar) -> tetap membaca dep dengan
//   BENAR. Pada package.json REALISTIS (punya kedua field) hasil 100% identik dgn PS (uji-banding
//   23/23 lulus di StrictMode). Sengaja TIDAK meniru bug PS (§12: jangan lemahkan kebenaran).
export function getMonorepoState(projectRoot) {
  const result = {
    isMonorepo: false,
    monorepoFlavor: 'None',
    fileCount: 0,
    confidence: 'low',
    evidence: [],
    detectedPatterns: [],
  }
  if (!pathExists(projectRoot)) return result

  result.fileCount = countFilesCapped(projectRoot, 500)

  const pkgPath = path.join(projectRoot, 'package.json')
  const deps = readDepNames(pkgPath)
  const hasNext = deps.has('next')
  const hasReact = deps.has('react') && !hasNext
  const hasVue = deps.has('vue')
  const hasSvelte = deps.has('svelte') || deps.has('@sveltejs/kit')
  const hasExpress = deps.has('express')
  const hasFastify = deps.has('fastify')
  const hasHono = deps.has('hono')
  const hasNest = deps.has('@nestjs/core')

  const hasApiFolder = pathExists(path.join(projectRoot, 'src/app/api'))
  const hasComponentsFolder = pathExists(path.join(projectRoot, 'src/components'))
  const hasPrismaFolder = pathExists(path.join(projectRoot, 'prisma/schema.prisma'))

  // Pola 1: Next.js fullstack monolith (TANPA penjaga IsMonorepo -- cermin PS).
  if (hasNext && hasApiFolder && hasComponentsFolder) {
    result.isMonorepo = true
    result.monorepoFlavor = 'NextjsFullstack'
    result.confidence = 'high'
    result.evidence.push('package.json contains "next" + src/app/api/ + src/components/ co-exist')
    result.detectedPatterns.push('Pattern1_NextjsFullstack')
  }

  // Pola 2: Workspace monorepo (TANPA penjaga IsMonorepo -- bisa menimpa ragam pola 1, cermin PS).
  const hasBackendFolder =
    pathExists(path.join(projectRoot, 'backend')) ||
    pathExists(path.join(projectRoot, 'apps/backend')) ||
    pathExists(path.join(projectRoot, 'packages/backend'))
  const hasFrontendFolder =
    pathExists(path.join(projectRoot, 'frontend')) ||
    pathExists(path.join(projectRoot, 'apps/frontend')) ||
    pathExists(path.join(projectRoot, 'packages/frontend')) ||
    pathExists(path.join(projectRoot, 'apps/web'))
  const hasSharedFolder =
    pathExists(path.join(projectRoot, 'shared')) ||
    pathExists(path.join(projectRoot, 'packages/shared'))

  if ((hasBackendFolder && hasFrontendFolder) || hasSharedFolder) {
    let hasWorkspacesField = false
    const pkgRaw = readTextSafe(pkgPath)
    if (pkgRaw) hasWorkspacesField = /"workspaces"\s*:/i.test(pkgRaw)
    const hasPnpmWs = pathExists(path.join(projectRoot, 'pnpm-workspace.yaml'))
    const hasTurbo = pathExists(path.join(projectRoot, 'turbo.json'))
    const hasNx = pathExists(path.join(projectRoot, 'nx.json'))

    if (hasWorkspacesField || hasPnpmWs || hasTurbo || hasNx) {
      result.isMonorepo = true
      result.monorepoFlavor = 'WorkspaceMonorepo'
      result.confidence = 'high'
      result.evidence.push('Sibling backend/frontend folders + workspace tool detected (Yarn/PNPM/Turbo/Nx)')
      result.detectedPatterns.push('Pattern2_WorkspaceMonorepo')
    } else {
      // Cermin PS: cabang "loose" ini HANYA menambah Evidence, TIDAK menambah DetectedPatterns.
      result.isMonorepo = true
      result.monorepoFlavor = 'WorkspaceMonorepo'
      result.confidence = 'medium'
      result.evidence.push('Sibling backend/frontend/shared folders but no workspace tool (loose monorepo)')
    }
  }

  // Pola 3: Prisma + components (sinyal lebih lemah; DIJAGA -not isMonorepo).
  if (hasPrismaFolder && hasComponentsFolder && !result.isMonorepo) {
    result.isMonorepo = true
    result.monorepoFlavor = 'PrismaPlusComponents'
    result.confidence = 'medium'
    result.evidence.push('prisma/schema.prisma + src/components/ co-exist (DB layer mixed with UI layer)')
    result.detectedPatterns.push('Pattern3_PrismaPlusComponents')
  }

  // Pola 4: dependency backend + frontend campur (DIJAGA -not isMonorepo).
  const hasBackendDep = hasExpress || hasFastify || hasHono || hasNest
  const hasFrontendDep = hasReact || hasVue || hasSvelte || hasNext
  if (hasBackendDep && hasFrontendDep && !result.isMonorepo) {
    result.isMonorepo = true
    result.monorepoFlavor = 'MixedBackendFrontendDeps'
    result.confidence = 'medium'
    result.evidence.push('package.json has BOTH backend framework + frontend framework deps')
    result.detectedPatterns.push('Pattern4_MixedBackendFrontendDeps')
  }

  return result
}

// === testPostSplitState ==========================================================================
// Tebak apakah project sudah pernah dipecah jadi banyak repo (3 lapis deteksi). Cermin PS.
export function testPostSplitState(projectRoot) {
  const result = {
    isPostSplit: false,
    evidence: [],
    siblingRepos: { frontend: null, backend: null, shared: null },
    detectionLayer: 'none',
    roleOfThisRepo: 'unknown',
  }

  // Lapis 1: berkas penanda .claude-kit/.split-state (paling andal).
  const markerPath = path.join(projectRoot, '.claude-kit/.split-state')
  if (pathExists(markerPath)) {
    result.isPostSplit = true
    result.detectionLayer = 'marker_file'
    const markerContent = readTextSafe(markerPath)
    result.evidence.push('.claude-kit/.split-state marker exists')
    // PS -match = peka-huruf MATI (case-insensitive) + \w. Tiru dengan /i.
    const m = markerContent && markerContent.match(/role:\s*(\w+)/i)
    if (m) {
      result.roleOfThisRepo = m[1].toLowerCase()
      result.evidence.push(`marker declares role: ${result.roleOfThisRepo}`)
    }
  }

  // Lapis 2: penyebutan di AGENTS.md (case-insensitive, cermin PS -match).
  const agentsPath = path.join(projectRoot, 'AGENTS.md')
  if (pathExists(agentsPath)) {
    const agentsContent = readTextSafe(agentsPath)
    if (agentsContent) {
      const postSplitKeywords = [
        'post-split',
        'multi-repo coordination',
        'sister repo:',
        'cross-repo types pipeline',
      ]
      for (const kw of postSplitKeywords) {
        // Cocokkan sebagai substring case-insensitive (kata kunci tak punya karakter regex spesial).
        if (agentsContent.toLowerCase().includes(kw.toLowerCase())) {
          result.isPostSplit = true
          result.evidence.push(`AGENTS.md mentions: '${kw}'`)
          if (result.detectionLayer === 'none') result.detectionLayer = 'agents_md_mention'
          else if (result.detectionLayer !== 'marker_file') result.detectionLayer = 'multiple'
        }
      }
    }
  }

  // Lapis 3: folder repo "saudara" di induk (mis. <base>-frontend / <base>-backend / <base>-shared).
  const parentDir = path.dirname(projectRoot)
  const thisName = path.basename(projectRoot)
  // PS -replace = case-insensitive regex. Buang akhiran peran kalau ada.
  // Daftar peran mencakup Model 1 (frontend/backend/shared/web/api/ui/server) DAN Model 2
  // (microservice varian shared-DB): engine/dashboard/core/service/worker. Tanpa peran Model 2,
  // repo hasil-pecah microservice (mis. `<base>-core`, `<base>-dashboard`) salah-divonis "belum
  // dipecah" -> kit menawarkan pecah-ulang. WAJIB identik dgn project-detect.ps1 (gerbang ADR-003).
  // Catatan jujur: nama KAPABILITAS bebas (mis. `<base>-data-domain`) tak punya kata-kunci tetap ->
  // tetap mengandalkan penanda `.claude-kit/.split-state` (Lapis 1) yang selalu ditulis saat split.
  const baseName = thisName.replace(/-(frontend|backend|shared|web|api|ui|server|engine|dashboard|core|service|worker)$/i, '')

  if (baseName !== thisName) {
    // thisName = baseName + '-' + <peran> -> peran = sisa setelah 'baseName-'.
    result.roleOfThisRepo = thisName.slice(baseName.length + 1).toLowerCase()
    result.evidence.push(`Current repo name '${thisName}' has role suffix`)
  }

  // Bucket peran tetap frontend/backend/shared (struktur output dijaga), tapi tiap bucket menampung
  // padanan Model 2: dashboard = lapisan tampilan (bucket frontend); core/engine = lapisan server
  // rahasia (bucket backend). Konsisten dgn roleToTier() di split-guard.mjs (dashboard=feature,
  // engine/core/service=sensitive). WAJIB identik dgn project-detect.ps1 (gerbang ADR-003).
  const siblingCandidates = {
    frontend: [`${baseName}-frontend`, `${baseName}-web`, `${baseName}-ui`, `${baseName}-dashboard`],
    backend: [`${baseName}-backend`, `${baseName}-api`, `${baseName}-server`, `${baseName}-core`, `${baseName}-engine`],
    shared: [`${baseName}-shared`, `${baseName}-types`, `${baseName}-common`],
  }

  let siblingHits = 0
  // Urutan tetap frontend->backend->shared (PS Hashtable.Keys tak terurut; hasil tak bergantung urutan
  // karena tiap peran mandiri -- hanya urutan Evidence yang bisa beda, dan PS sendiri non-deterministik).
  for (const role of ['frontend', 'backend', 'shared']) {
    for (const candidate of siblingCandidates[role]) {
      const candidatePath = path.join(parentDir, candidate)
      if (pathExists(candidatePath) && candidatePath !== projectRoot) {
        result.siblingRepos[role] = candidatePath
        siblingHits++
        result.evidence.push(`Sibling repo detected: ../${candidate}`)
        break
      }
    }
  }

  if (siblingHits >= 1) {
    result.isPostSplit = true
    if (result.detectionLayer === 'none') result.detectionLayer = 'sibling_folders'
    else if (result.detectionLayer !== 'marker_file') result.detectionLayer = 'multiple'
  }

  return result
}

// === getPackageManager ===========================================================================
// Tebak alat paket Node dari berkas-kunci (pnpm>yarn>bun>npm), lalu field "packageManager" (Corepack)
// menimpa saat tak ada berkas-kunci. Cermin PS.
export function getPackageManager(projectRoot) {
  const result = {
    manager: 'none',
    lockFile: null,
    installCmd: null,
    runCmd: null,
    confidence: 'low',
    reason: 'No lockfile or package.json detected',
  }

  if (!isDir(projectRoot)) {
    result.reason = `ProjectRoot does not exist: ${projectRoot}`
    return result
  }

  // Urutan deteksi (cocok PERTAMA menang -- paling spesifik di atas).
  const checks = [
    { lock: 'pnpm-lock.yaml', mgr: 'pnpm', install: 'pnpm install', run: 'pnpm dev' },
    { lock: 'yarn.lock', mgr: 'yarn', install: 'yarn install', run: 'yarn dev' },
    { lock: 'bun.lockb', mgr: 'bun', install: 'bun install', run: 'bun dev' },
    { lock: 'package-lock.json', mgr: 'npm', install: 'npm install', run: 'npm run dev' },
  ]

  for (const check of checks) {
    if (isFile(path.join(projectRoot, check.lock))) {
      result.manager = check.mgr
      result.lockFile = check.lock
      result.installCmd = check.install
      result.runCmd = check.run
      result.confidence = 'high'
      result.reason = `Detected from ${check.lock}`
      return result
    }
  }

  // Tak ada berkas-kunci tapi ada package.json -> default npm (medium).
  const packageJsonPath = path.join(projectRoot, 'package.json')
  if (isFile(packageJsonPath)) {
    result.manager = 'npm'
    result.lockFile = null
    result.installCmd = 'npm install'
    result.runCmd = 'npm run dev'
    result.confidence = 'medium'
    result.reason = 'package.json found, no lockfile yet (default npm)'

    // Heuristik tambahan: field packageManager (Corepack). Senyap kalau parse gagal/invalid.
    try {
      const pkgJson = JSON.parse(readTextSafe(packageJsonPath))
      if (pkgJson && pkgJson.packageManager) {
        const pmDeclared = String(pkgJson.packageManager).split('@')[0]
        if (['pnpm', 'yarn', 'bun', 'npm'].includes(pmDeclared)) {
          result.manager = pmDeclared
          result.installCmd = `${pmDeclared} install`
          result.runCmd = pmDeclared === 'npm' ? 'npm run dev' : `${pmDeclared} dev`
          result.confidence = 'high'
          result.reason = `Declared in package.json packageManager field: ${pkgJson.packageManager}`
        }
      }
    } catch {
      /* senyap -- pakai default npm */
    }
  }

  return result
}

// === getStackType ================================================================================
// Tebak bahasa gudang dari berkas penanda (cocok PERTAMA menang; node di atas supaya project Next.js
// yang punya skrip Python tetap = node). lintasAI v1.x hanya dukung Node. Cermin PS.
export function getStackType(projectRoot) {
  const result = {
    stackType: 'unknown',
    isSupported: false,
    detectedFiles: [],
    reason: 'No recognized stack marker file detected',
  }

  if (!isDir(projectRoot)) {
    result.reason = `ProjectRoot does not exist: ${projectRoot}`
    return result
  }

  const stackChecks = [
    { marker: 'package.json', stack: 'node', supported: true },
    { marker: 'pyproject.toml', stack: 'python', supported: false },
    { marker: 'requirements.txt', stack: 'python', supported: false },
    { marker: 'Pipfile', stack: 'python', supported: false },
    { marker: 'go.mod', stack: 'go', supported: false },
    { marker: 'Cargo.toml', stack: 'rust', supported: false },
    { marker: 'Gemfile', stack: 'ruby', supported: false },
    { marker: 'composer.json', stack: 'php', supported: false },
  ]

  for (const check of stackChecks) {
    if (isFile(path.join(projectRoot, check.marker))) {
      result.stackType = check.stack
      result.isSupported = check.supported
      result.detectedFiles = [check.marker]
      result.reason = `Detected from ${check.marker}`

      // Scan penanda lain (informasional saja, cermin PS).
      for (const other of stackChecks) {
        if (other.marker !== check.marker && isFile(path.join(projectRoot, other.marker))) {
          result.detectedFiles.push(other.marker)
        }
      }
      return result
    }
  }

  return result
}

// --- CLI tipis untuk uji-banding (output deterministik; bool huruf-kecil; null -> kosong) ---------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [cmd, root] = process.argv.slice(2)
  const nv = (v) => (v == null ? '' : String(v)) // null/undefined -> string kosong
  if (root != null && (cmd === 'stack' || cmd === 'pm' || cmd === 'monorepo' || cmd === 'postsplit')) {
    if (cmd === 'stack') {
      const r = getStackType(root)
      console.log([r.stackType, r.isSupported, r.detectedFiles.join(',')].join('\t'))
    } else if (cmd === 'pm') {
      const r = getPackageManager(root)
      console.log([r.manager, r.confidence, nv(r.lockFile), nv(r.installCmd), nv(r.runCmd)].join('\t'))
    } else if (cmd === 'monorepo') {
      const r = getMonorepoState(root)
      console.log([r.isMonorepo, r.monorepoFlavor, r.confidence, r.fileCount, r.detectedPatterns.join(',')].join('\t'))
    } else {
      const r = testPostSplitState(root)
      const hits = Object.values(r.siblingRepos).filter((v) => v != null).length
      console.log([r.isPostSplit, r.detectionLayer, r.roleOfThisRepo, hits].join('\t'))
    }
  } else {
    console.error('Pakai: node lib/project-detect.mjs <stack|pm|monorepo|postsplit> <projectRoot>')
    process.exit(2)
  }
}
