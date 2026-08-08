#!/usr/bin/env node
// kit.mjs - Router perintah kit lintasAI (port Node dari kit.ps1, Gelombang 4 ADR-004).
//
// SATU pintu masuk yang gampang diingat staff: `kit <perintah>` daripada hafal 3 nama skrip.
// Subperintah: setup / update / check-update / uninstall / doctor / scan / status / diff /
//   version / rollback / bump / help.
//
// STRANGLER FIG (berdampingan, BUKAN pengganti): kit.ps1 TETAP HIDUP sebagai cadangan PowerShell.
// Dispatcher (bin/lintasai.js) memilih versi Node ini untuk perintah cuma-baca + setup yang
// sudah lulus uji-banding; perintah yang belum diport tetap jatuh ke PowerShell. Port ini
// MENGHASILKAN tulisan ke-user yang IDENTIK dengan kit.ps1 (diuji baris-per-baris) - kecuali
// 2 perbaikan bug yang DISENGAJA + DIDOKUMENTASIKAN (lihat di bawah), yang JUGA diterapkan ke
// kit.ps1 supaya kedua versi tetap sama.
//
// DELEGASI:
//   - setup/update/check-update/uninstall/rollback -> port Node (setup-pola-b.mjs, update-kit.mjs,
//     uninstall.mjs, lib/rollback.mjs) di KitDir. Ini arah migrasi (orkestrator sudah Node).
//   - bump -> DIPORT ke Node (migrasi PS->Node 2026-06-25, ADR-005): penulis cap-versi
//     (invokeLintasVersionBump + setLintasDeclaredVersion + addLintasChangelogSkeleton dll) kini ada di
//     lib/consistency-check.mjs. case 'bump' memanggilnya LANGSUNG (bukan shim kit.ps1 lagi). Cadangan
//     PowerShell `kit.ps1 bump` tetap ada. Catatan: pesan verifikasi-akhir bump SENGAJA beda per-runtime
//     (Node -> "npm run preflight"; PS -> "tests/Run-Tests.ps1") - bukan drift; cap versi + exit code +
//     guard semuanya identik kit.ps1.
//   - rollback CUTOVER 2026-06-23 (Gelombang 6, aksi MERUSAK sesi-khusus owner): dulu shim ke kit.ps1,
//     kini -> lib/rollback.mjs (Node). Cadangan PowerShell `kit.ps1 rollback` -> lib/rollback.ps1.
//
// 2 PERBAIKAN BUG yang disengaja (juga di kit.ps1, supaya PS==Node):
//   (1) SCAN CRASH: pola Security '*-guard*' = regex tak-valid (.NET + JS sama-sama melempar
//       "Quantifier following nothing"). Di kit.ps1 lama, `scan` pada project nyata ber-folder
//       src/ CRASH di pola ini. Perbaikan: cabang pencocokan-regex (FullName) DILEWATI untuk pola
//       yang bukan regex sah; cabang wildcard (Name -like) tetap jalan. + urutan kategori dibuat
//       DETERMINISTIK (deklarasi, bukan urutan-hash).
//   (2) DOBEL-"v": Show-Help + scan dulu mencetak "vv1.57.1" (versi dari CHANGELOG sudah ber-awalan
//       'v', lalu ditambah 'v' lagi). Diperbaiki dengan normalisasi awalan-v (cermin logika doctor/status).
//
// KETAHANAN INPUT CACAT (diperbaiki di KEDUA versi pasca cek-silang skeptis 2026-06-23):
//   - kit-files.psd1 ADA tapi RUSAK -> kit.ps1 + kit.mjs sama-sama cetak "ERROR ... rusak / tak terbaca"
//     lalu LANJUT ke baris Result (dulu kit.ps1 CRASH dengan error merah tanpa Result).
//   - manifest .json RUSAK saat `diff` -> kedua versi cetak peringatan rapi (dulu kit.ps1 bocorkan
//     jejak-error .NET teknis ke staf). Pesan dibuat TANPA detail-runtime supaya identik PS==Node.
//   - Perintah PEKA-HURUF: 'Doctor' = 'doctor' (cermin ValidateSet PowerShell).
//   - skip-folder di scan menguji path INDUK juga (cermin '$_.FullName -match' PS).
//   CATATAN: pada manifest cacat-tangan LAIN (mis. `files` ditulis objek/bukan array, `sha256` angka),
//   kit.mjs SENGAJA lebih ketat (pakai Array.isArray + banding-string) -> bisa beda dari truthiness PS;
//   ini peningkatan ketahanan, BUKAN regresi. Pada manifest SAH (yang ditulis kit), keduanya identik.
//
// Bahasa output WAJIB non-programmer Indonesia (ADR-004 #3) - dijaga robot lib/output-lang-check.mjs.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { getKitVersionFallback } from './lib/version-detect.mjs'
import { getManifestSignatureStatus } from './lib/manifest-signing.mjs'
import { readKitFiles } from './lib/kit-files.mjs'
import { runEnvCheck } from './lib/env-check.mjs'
import { stripBom } from './lib/fs-text.mjs'
import { invokeLintasVersionBump, invokeLintasConsistencyCheckKit } from './lib/consistency-check.mjs'

// Lokasi kit.mjs sendiri (cache npm saat lewat `npx`, .claude-kit project saat dipanggil langsung).
const ScriptRoot = path.dirname(fileURLToPath(import.meta.url))

// ---- Baca pilihan baris-perintah (cermin param kit.ps1: Command, -ProjectRoot, ExtraArgs) ----
// Dispatcher memanggil: node kit.mjs <perintah> --project-root <cwd-user> [args].
function parseArgs(argv) {
  const a = { command: '', projectRoot: null, extra: [] }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--project-root' || t === '--projectroot') { a.projectRoot = argv[++i] ?? null; continue }
    if (!a.command && !t.startsWith('--')) { a.command = t; continue }
    a.extra.push(t)
  }
  return a
}

// ---- Resolusi path (cermin kit.ps1 baris 64-76) ----
// Dengan --project-root (kasus npx launcher): inspeksi kit di CWD USER (.claude-kit di project),
// BUKAN lokasi kit.mjs ($ScriptRoot di cache npm). Tanpa --project-root (pemanggilan langsung),
// $ScriptRoot SUDAH .claude-kit project -> fallback pakai $ScriptRoot.
function resolveDirs(projectRootArg) {
  let projectRoot = projectRootArg
  let kitDir
  if (projectRoot) {
    kitDir = path.join(projectRoot, '.claude-kit')
  } else {
    kitDir = ScriptRoot
    projectRoot = path.dirname(kitDir)
  }
  // PowerShell selalu menormalkan huruf drive jadi KAPITAL (mis. "D:\...") di $PSScriptRoot dkk.
  // Node mempertahankan huruf dari cara dipanggil (bisa "d:\..."). Samakan supaya tampilan path
  // IDENTIK dengan kit.ps1 (huruf drive tak memengaruhi operasi berkas - Windows abai-huruf).
  return { kitDir: upperDrive(kitDir), projectRoot: upperDrive(projectRoot) }
}

// Naikkan huruf drive Windows jadi kapital (cermin normalisasi path PowerShell). "d:\x" -> "D:\x".
function upperDrive(p) {
  return typeof p === 'string' ? p.replace(/^([a-z]):/, (_m, d) => d.toUpperCase() + ':') : p
}

// ---- Helper: deteksi versi kit (rantai pertahanan-berlapis, cermin Get-KitVersion) ----
// manifest (kit_version) -> CHANGELOG '## [X.Y.Z]'/'## vX.Y.Z' -> 'unknown'. Reuse helper teruji.
function getKitVersion(kitDir) {
  return getKitVersionFallback(kitDir, { changelogPath: path.join(kitDir, 'CHANGELOG.md') })
}

// Tampilan versi yang dinormalkan (cermin logika Invoke-Status baris ~502): kalau sudah ber-awalan
// 'v' -> apa adanya; 'unknown' -> 'unknown'; selain itu tambah 'v'. PERBAIKAN dobel-v (lihat header).
function versionDisplay(version) {
  if (/^v/.test(version)) return version
  if (version === 'unknown') return 'unknown'
  return 'v' + version
}

// Baca manifest JSON dengan aman: buang BOM (cermin ReadAllText UTF8 PS) lalu JSON.parse.
// Melempar kalau gagal parse -> pemanggil yang memutuskan pesan (WARN/skip).
function readManifestJson(manifestPath) {
  return JSON.parse(stripBom(fs.readFileSync(manifestPath, 'utf8')))
}

// Format waktu lokal 'yyyy-MM-dd HH:mm:ss' (cermin .ToString('yyyy-MM-dd HH:mm:ss') PS, waktu lokal).
function formatTimestamp(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ` +
    `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

// ---- Helper SCAN: cocokkan glob (Name -like) + regex sah (FullName -match) ----
// Cermin `-like` PowerShell (wildcard penuh, peka-huruf TIDAK): hanya * dan ? jadi wildcard,
// sisanya literal; cocok seluruh string (anchor). Pola dari kit.ps1 tak memakai kelas [..].
function likeMatch(name, glob) {
  const esc = glob.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // escape SEMUA metachar regex
  const rx = '^' + esc.replace(/\\\*/g, '.*').replace(/\\\?/g, '.') + '$' // lalu buka * dan ?
  return new RegExp(rx, 'i').test(name)
}
// Apakah pola adalah regex sah? (mis. '*-guard*' = TIDAK -> cabang -match dilewati, anti-crash.)
function regexValid(p) {
  try { new RegExp(p); return true } catch { return false }
}

// ---- Helper: tampilkan usage (cermin Show-Help) ----
function showHelp(kitDir) {
  const v = versionDisplay(getKitVersion(kitDir)) // PERBAIKAN dobel-v (dulu "v$(Get-KitVersion)")
  const L = (s = '') => console.log(s)
  L('')
  L(`kit.ps1 - Single entry point untuk kit lintasAI (${v})`)
  L('')
  L('USAGE:')
  L('  .\\.claude-kit\\kit.ps1 <command> [args]')
  L('')
  L('COMMANDS:')
  L('  setup     - Setup Pola B di proyek (copy AGENTS.md, docs skeleton, file tim)')
  L('              Args: -Force, -DryRun, -SkipTeamFiles')
  L('')
  L('  update    - Update kit ke versi terbaru via re-clone fresh dari GitHub')
  L('              Args: -NoBackup, -RepoUrl <url>, -Branch <name>, -DryRun')
  L('')
  L('  check-update - Cek apakah ada versi baru TANPA mengubah apa pun (read-only)')
  L('              (no args)')
  L('')
  L('  uninstall - Hapus kit dari proyek dengan AMAN (diff vs daftar file kit)')
  L('              Args: -DryRun, -Force, -DeleteAgents, -KeepKit, -Yes, -AllowProjectRootMismatch')
  L('              File project (yang BUKAN dari kit) AMAN tidak terhapus.')
  L('              Path traversal + symlink protection aktif by default.')
  L('')
  L('  doctor    - Diagnostic: cek versi + file inti utuh + cross-ref')
  L('              --env: cek lingkungan (Node/PowerShell/OS/Git) - sumber "beda di client"')
  L('')
  L('  scan      - Re-run scan project untuk identifikasi kandidat CRITICAL')
  L('              (tanpa setup ulang)')
  L('')
  L('  status    - Ringkasan 1-layar: versi, install mode, AGENTS.md, manifest, tier')
  L('              (no args)')
  L('')
  L('  version   - Print versi kit aktif (dari .install-manifest.json)')
  L('')
  L('  rollback  - Pulihkan berkas project per-satuan dari cadangan (AGENTS.md/docs)')
  L('              (cadangan per-berkas, bukan seluruh folder). Untuk balik SELURUH folder kit')
  L('              yang rusak: kembalikan .claude-kit.backup-<tanggal> (atau minta')
  L("              AI: 'rollback dong').")
  L('')
  L('  bump      - [kit dev] Naikkan versi 1-langkah: cap nomor versi ke semua')
  L('              berkas + tambah kerangka CHANGELOG + cek kecocokan otomatis.')
  L('              Args: <versi> (mis. bump 1.42.0). Cuma untuk repo kit.')
  L('')
  L('  help      - Tampilkan help ini')
  L('')
  L('EXAMPLES:')
  L('  .\\.claude-kit\\kit.ps1 setup -Force')
  L('  .\\.claude-kit\\kit.ps1 update')
  L('  .\\.claude-kit\\kit.ps1 doctor')
  L('')
  L('BACKWARD COMPATIBILITY:')
  L('  Setup script lama tetap bisa dipanggil langsung:')
  L('    .\\.claude-kit\\setup-pola-b.ps1 -Force')
  L('    .\\.claude-kit\\update-kit.ps1')
  L('')
  L('  kit.ps1 cuma alternative entry point yang lebih ringkas.')
  L('')
}

// ---- Helper: doctor diagnostic (cermin Invoke-Doctor) ----
// Mengembalikan kode-keluar (0 sehat/warning, 1 ada ERROR).
function invokeDoctor(kitDir, projectRoot, extra = []) {
  const L = (s = '') => console.log(s)
  L('')
  L('=== Kit Doctor (diagnostic) ===')
  L('')

  let ok = 0
  let warn = 0
  let err = 0

  // 1. Versi kit
  const version = getKitVersion(kitDir)
  if (/^v?\d+\.\d+\.\d+/.test(version)) {
    const display = /^v/.test(version) ? version : 'v' + version
    L(`OK    Kit version: ${display}`)
    ok++
  } else if (version === 'unknown') {
    L('WARN  Kit version: unknown (manifest hilang, $script:KIT_VERSION kosong, CHANGELOG.md tidak parseable)')
    warn++
  } else {
    L(`ERROR Kit version: format tidak dikenali ('${version}')`)
    err++
  }

  // 2. Cek file inti. Sumber tunggal: lib/kit-files.psd1 (10 grup, urutan SAMA dengan kit.ps1).
  const kitFilesPsd1 = path.join(kitDir, 'lib', 'kit-files.psd1')
  let wajibAda = []
  if (!fs.existsSync(kitFilesPsd1)) {
    L('ERROR lib\\kit-files.psd1 hilang (manifest single-source-of-truth)')
    err++
  } else {
    let kitFiles
    try { kitFiles = readKitFiles(kitFilesPsd1) } catch (e) {
      // psd1 ADA tapi RUSAK (gagal parse). kit.ps1 kini juga menangkap ini + cetak pesan SAMA
      // + LANJUT (dulu kit.ps1 CRASH dengan error merah tanpa baris Result - lebih buruk untuk staf).
      L('ERROR lib\\kit-files.psd1 rusak / tak terbaca (cek sintaks .psd1)')
      err++
      kitFiles = null
    }
    if (kitFiles) {
      const groups = ['core_prompts', 'universal_rules', 'scripts', 'lib_files', 'node_lib',
        'templates', 'docs', 'tests', 'ci', 'meta']
      const merged = []
      for (const g of groups) { if (Array.isArray(kitFiles[g])) merged.push(...kitFiles[g]) }
      wajibAda = merged.map((f) => String(f).replace(/\//g, '\\'))
    }
  }

  if (wajibAda.length > 0) {
    const missing = []
    for (const f of wajibAda) {
      if (!fs.existsSync(path.join(kitDir, f))) missing.push(f)
    }
    if (missing.length === 0) {
      L(`OK    ${wajibAda.length} file inti utuh`)
      ok++
    } else {
      L(`ERROR ${missing.length} file missing:`)
      for (const m of missing) L(`        - ${m}`)
      err++
      L('      Saran: .\\.claude-kit\\kit.ps1 update (re-clone fresh)')
    }
  }

  // 2b. Cek integritas (sha256) - manifest di kitDir/.install-manifest.json.
  const manifestPath = path.join(kitDir, '.install-manifest.json')
  if (fs.existsSync(manifestPath)) {
    let manifest = null
    try {
      manifest = readManifestJson(manifestPath)
    } catch (e) {
      // Pesan TETAP tanpa detail-error runtime: identik PS==Node + tak bocorkan isi manifest rusak
      // (bisa memuat path komputer) ke layar staff. Cermin pola yang sudah benar di invokeDiff.
      L('WARN  Integrity check skipped: manifest .install-manifest.json rusak / tak terbaca (cek format JSON).')
      warn++
      manifest = null
    }

    if (manifest !== null) {
      // 2b-i. Verifikasi KEASLIAN manifest (tanda-tangan) DULU supaya 'PRISTINE' tidak menyesatkan.
      // Helper Node selalu ada (di-import), TAPI hormati niat PS "skip kalau helper kit tak ada":
      // gate ke keberadaan lib/manifest-signing.mjs di kit yang diinspeksi. Gagal/error => 'skipped'.
      let sigStatus = 'skipped'
      const signingLib = path.join(kitDir, 'lib', 'manifest-signing.mjs')
      if (fs.existsSync(signingLib)) {
        try { sigStatus = getManifestSignatureStatus(manifest, { kitRoot: kitDir }) } catch { sigStatus = 'skipped' }
      }
      switch (sigStatus) {
        case 'verified': L('OK    Manifest: tanda-tangan VALID (daftar berkas terverifikasi asli)'); ok++; break
        case 'invalid': L('WARN  Manifest: tanda-tangan TIDAK COCOK - daftar mungkin diubah; hasil integrity di bawah BELUM tentu bisa dipercaya.'); warn++; break
        case 'unsigned': L('INFO  Manifest: tanpa tanda-tangan (legacy) - integrity di bawah = cek sha256 saja, keaslian daftar belum diverifikasi.'); break
        default: L('INFO  Manifest: verifikasi tanda-tangan dilewati (helper tidak tersedia).'); break
      }

      let pristine = 0
      const modifiedList = []
      let integrityMissing = 0

      let entries = []
      if (Array.isArray(manifest.files) && manifest.files.length) entries = manifest.files
      else if (Array.isArray(manifest.entries) && manifest.entries.length) entries = manifest.entries

      for (const entry of entries) {
        let relPath = null
        if (entry.path) relPath = entry.path
        else if (entry.file) relPath = entry.file
        if (!relPath) continue

        let expectedSha = null
        if (entry.sha256) expectedSha = entry.sha256
        if (!expectedSha) continue

        const relPathNorm = String(relPath).replace(/\//g, '\\')
        // Manifest menyimpan path relatif terhadap AKAR PROJECT (mis. ".claude-kit/lib/rollback.ps1",
        // "AGENTS.md") -> gabung ke projectRoot (cermin kit.ps1 baris 324, hindari double-prefix).
        const absPath = path.join(projectRoot, relPathNorm)

        if (!fs.existsSync(absPath)) { integrityMissing++; continue }

        try {
          const buf = fs.readFileSync(absPath)
          const actualSha = crypto.createHash('sha256').update(buf).digest('hex')
          if (actualSha.toLowerCase() === String(expectedSha).toLowerCase()) {
            pristine++
          } else {
            modifiedList.push(relPath)
          }
        } catch (e) {
          modifiedList.push(`${relPath} (hash error: ${e.message})`)
        }
      }

      const modifiedCount = modifiedList.length
      L(`OK    Integrity: PRISTINE=${pristine}, MODIFIED=${modifiedCount}, MISSING=${integrityMissing}`)
      if (modifiedCount > 0) {
        L('WARN  File berikut dimodifikasi sejak install (mungkin disengaja):')
        for (const m of modifiedList) L(`        - ${m}`)
        warn++
      } else {
        ok++
      }
      if (integrityMissing > 0) {
        L(`ERROR Integrity: ${integrityMissing} file di manifest tapi tidak ada di disk`)
        err++
      }
    }
  } else {
    L('INFO  Integrity check skipped: .install-manifest.json tidak ada (kit pre-manifest atau belum di-install)')
  }

  // 3. AGENTS.md di root proyek
  if (fs.existsSync(path.join(projectRoot, 'AGENTS.md'))) {
    L('OK    AGENTS.md ada di root proyek')
    ok++
  } else {
    L('WARN  AGENTS.md belum di-copy ke root proyek')
    L('      Saran: .\\.claude-kit\\kit.ps1 setup')
    warn++
  }

  // 4. docs/ folder
  const docsDir = path.join(projectRoot, 'docs')
  if (fs.existsSync(docsDir)) {
    const docsCount = countFilesRecursive(docsDir)
    L(`OK    docs/ ada (${docsCount} file)`)
    ok++
  } else {
    L('WARN  docs/ belum dibuat')
    L('      Saran: .\\.claude-kit\\kit.ps1 setup')
    warn++
  }

  // 5. .github/ folder (team mode)
  if (fs.existsSync(path.join(projectRoot, '.github'))) {
    L('OK    .github/ ada (Team Mode aktif)')
    ok++
  } else {
    L('INFO  .github/ tidak ada (Team Mode skipped, atau project non-GitHub)')
  }

  // 6. .git/ internal (seharusnya TIDAK ada untuk clone Pola B)
  const internalGit = path.join(kitDir, '.git')
  if (fs.existsSync(internalGit)) {
    L('WARN  .claude-kit\\.git\\ masih ada (sisa dari clone)')
    L(`      Saran: Remove-Item '${internalGit}' -Recurse -Force`)
    warn++
  } else {
    L('OK    .claude-kit/ tidak ada .git/ internal')
    ok++
  }

  // 7. Lingkungan eksekusi (OPT-IN via --env). Robot lib/env-check.mjs memotret versi runtime client
  //    (Node/PowerShell/OS/Git) + node_modules/lockfile -> menutup akar "terasa beda di client" (parity).
  //    HANYA jalan kalau diminta -> `kit doctor` polos tetap byte-identik dgn cadangan kit.ps1
  //    (gerbang output-identik ADR-003). Fitur Node-only (kit.ps1 = cadangan perilaku LAMA).
  const wantEnv = extra.some((a) => String(a).toLowerCase() === '--env')
  if (wantEnv) {
    L('')
    L('--- Lingkungan eksekusi (parity) ---')
    try {
      const { findings } = runEnvCheck(projectRoot)
      for (const f of findings) {
        L(`${f.level.padEnd(5)} ${f.label}: ${f.message}`)
        if (f.hint) L(`        -> ${f.hint}`)
        if (f.level === 'OK') ok++
        else if (f.level === 'WARN') warn++
        else if (f.level === 'ERROR') err++
      }
    } catch {
      // Robot env gagal != kit rusak: lapor jujur (fail-honest), jangan diam-diam OK, jangan crash doctor.
      L('WARN  Pemeriksaan lingkungan gagal dijalankan (dilewati). Bagian kit di atas tetap sahih.')
      warn++
    }
  }

  // Ringkasan
  L('')
  L(`Result: OK=${ok} WARN=${warn} ERROR=${err}`)
  if (err === 0 && warn === 0) {
    L('Kit sehat. Siap dipakai.')
    return 0
  } else if (err === 0) {
    L('Kit OK dengan warning. Bisa dipakai, tapi fix warning kalau bisa.')
    return 0
  } else {
    L('Kit BERMASALAH. Fix ERROR di atas dulu.')
    return 1
  }
}

// Hitung file rekursif di sebuah folder (cermin (Get-ChildItem -Recurse -File).Count).
function countFilesRecursive(dir) {
  let count = 0
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return 0 }
  for (const e of entries) {
    if (e.isDirectory()) count += countFilesRecursive(path.join(dir, e.name))
    else if (e.isFile()) count++
  }
  return count
}

// ---- Helper: scan project (cermin Invoke-Scan + 2 perbaikan: urutan deterministik + anti-crash) ----
function invokeScan(kitDir, projectRoot) {
  const L = (s = '') => console.log(s)
  L('')
  L(`=== Kit Scan - Universal Adaptive Scan (kit ${versionDisplay(getKitVersion(kitDir))}) ===`)
  L('')
  L('Catatan: kit.ps1 scan = scan ringan untuk count kandidat.')
  L('        Untuk bulk-bootstrap actual, paste JALANKAN_KIT.md ke Claude Code (yang trigger AI workflow).')
  L('')

  // Pola CRITICAL (universal, sesuai JALANKAN_KIT). URUTAN DETERMINISTIK (array, bukan hashtable acak).
  const patterns = [
    ['Auth', ['auth*', 'session*', 'login*', 'oauth*', 'jwt*', 'passport*']],
    ['DB', ['db.*', 'prisma*', 'drizzle*', 'repository*', 'schema*', 'models']],
    ['Security', ['crypto*', 'encrypt*', 'decrypt*', 'permissions*', 'acl*', 'policies*', '*-guard*', 'rate-limit*', 'csrf*', 'cors*']],
    ['API/Router', ['routes', 'controllers', 'handlers', 'api', 'endpoints', 'resolvers', 'actions']],
    ['Entry/MW', ['main.*', 'index.*', 'app.*', 'server.*', 'layout.*', 'middleware.*', 'interceptor.*']],
  ]

  const sourceFolders = ['src', 'app', 'lib', 'internal', 'pkg', 'cmd', 'features', 'modules', 'routes', 'controllers', 'handlers', 'services', 'domain']
  const skipFolders = ['node_modules', 'dist', '.next', 'target', 'build', 'vendor', '__pycache__', '.venv', 'generated', '.git']
  // Regex pemangkas direktori - cermin filter PS `$_.FullName -match "[\\/]$skip[\\/]"` (peka-huruf TIDAK).
  const skipRx = skipFolders.map((s) => new RegExp('[\\\\/]' + s + '[\\\\/]', 'i'))

  const totalByCategory = {}
  for (const [cat] of patterns) totalByCategory[cat] = 0

  for (const src of sourceFolders) {
    const srcPath = path.join(projectRoot, src)
    if (!fs.existsSync(srcPath)) continue

    // Cermin PS: filter '$_.FullName -match "[\\/]skip[\\/]"' menguji SELURUH path absolut, termasuk
    // segmen INDUK DI ATAS srcPath. Jadi kalau project berada di dalam folder ber-nama-skip (mis.
    // C:\build\proj\src), PS men-skip SEMUA berkasnya -> Total 0. Tiru: kalau srcPath sendiri memuat
    // segmen skip, lewati seluruh folder ini (selain pemangkasan dir DI BAWAH srcPath di walkFilesSkipping).
    if (skipRx.some((rx) => rx.test(srcPath + path.sep))) continue

    const allFiles = walkFilesSkipping(srcPath, skipRx) // [{ name, fullName }]

    for (const [cat, pats] of patterns) {
      for (const p of pats) {
        const rxOk = regexValid(p)
        let rx = null
        if (rxOk) { try { rx = new RegExp(p, 'i') } catch { rx = null } }
        let matched = 0
        for (const f of allFiles) {
          if (likeMatch(f.name, p) || (rx && rx.test(f.fullName))) matched++
        }
        totalByCategory[cat] += matched
      }
    }
  }

  L('Kandidat CRITICAL per kategori (rough estimate):')
  let grandTotal = 0
  for (const [cat] of patterns) {
    const count = totalByCategory[cat]
    L(`  ${cat.padEnd(15)} ${String(count).padStart(4)} file`)
    grandTotal += count
  }
  L('')
  L(`Total kandidat (rough, may include duplicates): ${grandTotal}`)
  L('')

  if (grandTotal >= 30) {
    L('Saran: total >= 30, pakai subfolder grouping saat bulk-bootstrap.')
    L('      Mapping: docs/api/, docs/lib/, docs/security/, docs/features/<n>/, dst.')
  } else {
    L('Saran: total < 30, flat docs/ masih oke.')
  }

  L('')
  L('Next step:')
  L('  1. Paste isi .claude-kit\\JALANKAN_KIT.md ke Claude Code untuk full workflow.')
  L('  2. AI akan tanya pilih (1)/(2)/(3)/(4) di step 12 (default (3) Skeleton-first).')
  L('')
  return 0
}

// Walk file rekursif dengan PEMANGKASAN direktori yang cocok skipRx (cermin Get-ChildItem -Recurse -File
// lalu Where-Object skip-filter: file dikecualikan iff suatu segmen direktorinya cocok skipRx).
function walkFilesSkipping(root, skipRx) {
  const out = []
  const rec = (dir) => {
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.isDirectory()) {
        // Segmen "/name/" diuji ke skipRx - sama dengan PS menolak file ber-segmen ini di FullName.
        if (skipRx.some((rx) => rx.test('\\' + e.name + '\\'))) continue
        rec(path.join(dir, e.name))
      } else if (e.isFile()) {
        out.push({ name: e.name, fullName: path.join(dir, e.name) })
      }
    }
  }
  rec(root)
  return out
}

// ---- Helper: status ringkas 1-layar (cermin Invoke-Status) ----
function invokeStatus(kitDir, projectRoot) {
  const L = (s = '') => console.log(s)
  L('')
  L('=== Kit Status (ringkas) ===')
  L('')

  // 1. Versi kit
  const version = getKitVersion(kitDir)
  L(`Kit version    : ${versionDisplay(version)}`)

  // 2. Install mode (npx vs git-clone). Heuristik: lokasi kit.mjs mengandung jejak cache npm?
  let installMode = 'git-clone-mode'
  if (/(node_modules|npm-cache|_npx|AppData[\\/]+Local[\\/]+npm-cache)/i.test(ScriptRoot)) {
    installMode = 'npx-mode'
  }
  L(`Install mode   : ${installMode}`)

  // 3. AGENTS.md ada? (+ waktu modifikasi)
  const agentsAtRoot = path.join(projectRoot, 'AGENTS.md')
  if (fs.existsSync(agentsAtRoot)) {
    try {
      const mtime = formatTimestamp(fs.statSync(agentsAtRoot).mtime)
      L(`AGENTS.md      : Y (last modified: ${mtime})`)
    } catch {
      L('AGENTS.md      : Y (mtime unavailable)')
    }
  } else {
    L('AGENTS.md      : N (belum di-copy ke project root)')
  }

  // 4. Manifest signed? (+ last update)
  const manifestPath = path.join(kitDir, '.install-manifest.json')
  let manifestSignedDisplay = 'N (manifest hilang)'
  let lastUpdateDisplay = 'unknown'
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = readManifestJson(manifestPath)

      let hasSignature = false
      if (manifest.metadata && manifest.metadata.signature) hasSignature = true
      if (!hasSignature) {
        let entries = []
        if (Array.isArray(manifest.files) && manifest.files.length) entries = manifest.files
        else if (Array.isArray(manifest.entries) && manifest.entries.length) entries = manifest.entries
        const shaCount = entries.filter((e) => e && e.sha256).length
        if (shaCount > 0) {
          hasSignature = true
          manifestSignedDisplay = `Y (${shaCount} files w/ sha256)`
        }
      } else {
        manifestSignedDisplay = 'Y (manifest bertanda-tangan)'
      }

      if (!hasSignature) {
        manifestSignedDisplay = 'N (manifest ada tapi tidak signed)'
      }

      // Waktu update terakhir dari manifest
      if (manifest.metadata && manifest.metadata.installed_at) lastUpdateDisplay = manifest.metadata.installed_at
      else if (manifest.metadata && manifest.metadata.updated_at) lastUpdateDisplay = manifest.metadata.updated_at
      else if (manifest.installed_at) lastUpdateDisplay = manifest.installed_at
    } catch (e) {
      // Pesan TETAP tanpa detail runtime (identik PS==Node + tak bocorkan isi manifest). Lihat invokeDiff.
      manifestSignedDisplay = 'N (manifest rusak / tak terbaca)'
    }
  }
  L(`Daftar file kit signed: ${manifestSignedDisplay}`)

  // 5. Last update
  L(`Last update    : ${lastUpdateDisplay}`)

  // 6. Tier setup (.staff-profile.md ada?)
  if (fs.existsSync(path.join(projectRoot, '.staff-profile.md'))) {
    L('Tier setup     : Y (.staff-profile.md ada)')
  } else {
    L('Tier setup     : N (.staff-profile.md belum dibuat - solo/owner mode)')
  }

  L('')
  L('Untuk detail lebih lengkap: .\\.claude-kit\\kit.ps1 doctor')
  L('')
  return 0
}

// ---- Helper: print versi (cermin Show-Version) ----
function showVersion(kitDir) {
  console.log(getKitVersion(kitDir))
}

// ---- Helper: diff vs manifest (cermin Invoke-Diff) ----
// CATATAN: cermin kit.ps1 - diff SELALU pakai projectRoot/.claude-kit (BUKAN $KitDir), beda dari
// doctor/status. Saat dipanggil langsung tanpa --project-root, ini menengok .claude-kit di INDUK.
function invokeDiff(projectRoot) {
  const kitDir = path.join(projectRoot, '.claude-kit')
  const manifestPath = path.join(kitDir, '.install-manifest.json')
  if (!fs.existsSync(manifestPath)) {
    // Cermin PS Write-Warning (awalan "WARNING:" ditambah PS otomatis, teks Indonesia) -> stderr.
    console.error(`WARNING: Tidak ada manifest di ${manifestPath}. Kit belum di-install atau corrupt.`)
    return 1
  }
  let manifest
  try {
    manifest = readManifestJson(manifestPath)
  } catch (e) {
    // Manifest RUSAK (gagal parse JSON). kit.ps1 kini juga menangkap ini + cetak peringatan SAMA
    // (dulu kit.ps1 membocorkan jejak-error .NET teknis ke staf - langgar prinsip non-programmer).
    // Pesan dibuat TANPA detail-error runtime supaya identik PS==Node.
    console.error('WARNING: Manifest .install-manifest.json rusak / tak terbaca (cek format JSON).')
    return 1
  }
  const modified = []
  const missing = []
  const entries = Array.isArray(manifest.files) ? manifest.files : []
  for (const entry of entries) {
    const filePath = path.join(projectRoot, String(entry.path))
    if (!fs.existsSync(filePath)) {
      missing.push(entry.path)
    } else if (!entry.sha256) {
      // Entry tanpa sidik-jari -> tak bisa diverifikasi -> tandai modified (konservatif, cermin REL-3).
      modified.push(entry.path)
    } else {
      const currentHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toLowerCase()
      if (currentHash !== String(entry.sha256).toLowerCase()) {
        modified.push(entry.path)
      }
    }
  }
  console.log('=== Kit Diff (vs daftar file kit) ===')
  console.log(`Modified (${modified.length}):`)
  for (const m of modified) console.log(`  M ${m}`)
  console.log('')
  console.log(`Missing (${missing.length}):`)
  for (const m of missing) console.log(`  - ${m}`)
  return 0
}

// ---- Delegasi ke port Node (setup/update/check-update/uninstall) ----
function delegateNode(kitDir, scriptName, args) {
  const script = path.join(kitDir, scriptName)
  if (!fs.existsSync(script)) {
    console.log(`ERROR: ${scriptName} tidak ada di ${kitDir}`)
    return 1
  }
  const r = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' })
  if (r.error) {
    console.log(`ERROR: gagal menjalankan ${scriptName}: ${r.error.message}`)
    return 1
  }
  return r.status == null ? 1 : r.status
}

// CATATAN (migrasi PS->Node 2026-06-25): dulu ada delegatePsKit (shim ke `kit.ps1 bump`) karena
// penulis cap-versi masih PowerShell. Kini bump DIPORT ke Node (lib/consistency-check.mjs
// invokeLintasVersionBump, dipanggil langsung di case 'bump') -> shim itu tak diperlukan lagi.
// Cadangan PowerShell `kit.ps1 bump` TETAP ada sebagai jalur manual (lihat PS_FALLBACK / kit.ps1).

// ---- Router ----
function main(argv) {
  const parsed = parseArgs(argv)
  // Cermin PowerShell yang PEKA-HURUF TIDAK (ValidateSet menerima 'Doctor'/'DOCTOR' = 'doctor').
  // Tanpa ini, `node kit.mjs Doctor` salah jatuh ke help (beda perilaku + kode-keluar dari kit.ps1).
  const command = parsed.command.toLowerCase()
  const projectRootArg = parsed.projectRoot
  const extra = parsed.extra
  const { kitDir, projectRoot } = resolveDirs(projectRootArg)

  // Beri tahu kit mana yang diinspeksi (cermin kit.ps1 baris 80-82) - untuk subperintah cuma-baca.
  // CATATAN: 'rollback' DIKELUARKAN di sini - sejak CUTOVER ke port Node (2026-06-23) ia jadi orkestrator
  // yang mencetak header sendiri ("lintasAI rollback - balikin..."), sama seperti setup/update/uninstall
  // yang juga TIDAK ikut baris "Inspecting" (konvensi: cuma perintah inspeksi cuma-baca yang cetak
  // "Inspecting"). Cadangan kit.ps1 rollback tetap cetak "Inspecting" sendiri (jalur PowerShell).
  if (['doctor', 'version', 'scan', 'status', 'diff'].includes(command)) {
    console.log(`Inspecting kit at: ${kitDir}`)
  }

  switch (command) {
    case 'setup':
      return delegateNode(kitDir, 'setup-pola-b.mjs', ['--project-root', projectRoot, ...extra])
    case 'update':
      return delegateNode(kitDir, 'update-kit.mjs', ['--project-root', projectRoot, ...extra])
    case 'check-update':
      // Cermin kit.ps1: panggil update-kit -CheckOnly TANPA meneruskan ExtraArgs (read-only).
      return delegateNode(kitDir, 'update-kit.mjs', ['--project-root', projectRoot, '--check-only'])
    case 'uninstall':
      return delegateNode(kitDir, 'uninstall.mjs', ['--project-root', projectRoot, ...extra])
    case 'doctor':
      return invokeDoctor(kitDir, projectRoot, extra)
    case 'scan':
      return invokeScan(kitDir, projectRoot)
    case 'status':
      return invokeStatus(kitDir, projectRoot)
    case 'diff':
      return invokeDiff(projectRoot)
    case 'version':
      showVersion(kitDir)
      return 0
    case 'rollback':
      // CUTOVER Gelombang 6 (aksi MERUSAK, sesi-khusus owner 2026-06-23): rollback kini pakai port Node
      // lib/rollback.mjs (dulu shim ke kit.ps1). Suntik --project-root supaya rollback menyasar manifest +
      // .claude-kit di project (cermin delegasi setup/update/uninstall). NON-INTERAKTIF: butuh --yes untuk
      // benar-benar menimpa (default-batal). Cadangan PowerShell: `kit.ps1 rollback` -> lib/rollback.ps1.
      return delegateNode(kitDir, 'lib/rollback.mjs', ['--project-root', projectRoot, ...extra])
    case 'bump': {
      // CUTOVER (migrasi PS->Node 2026-06-25, owner-gated): penulis cap-versi kini Node murni
      // (lib/consistency-check.mjs invokeLintasVersionBump). Cermin kit.ps1 case 'bump': stamp dulu,
      // lalu jalankan pemeriksaan kecocokan MODE KIT (verifikasi hasil), exit = jumlah ketakcocokan.
      // Cadangan PowerShell: `kit.ps1 bump` -> Invoke-LintasVersionBump di consistency-check.ps1.
      const newVer = extra && extra.length >= 1 ? extra[0] : ''
      if (!newVer) {
        console.log('Pemakaian: kit bump <versi>   (mis. node kit.mjs bump 1.42.0)')
        console.log('Cap nomor versi baru ke semua berkas + tambah kerangka entri CHANGELOG + cek kecocokan.')
        return 1
      }
      try {
        invokeLintasVersionBump(kitDir, newVer)
        const check = invokeLintasConsistencyCheckKit(kitDir)
        if (check.MismatchCount === 0) {
          console.log(`Sekarang tulis deskripsi entri CHANGELOG [${newVer}] (ganti placeholder), lalu jalankan npm run preflight.`)
        }
        return check.MismatchCount
      } catch (e) {
        console.log(`[ERROR] bump gagal: ${e.message}`)
        return 2
      }
    }
    case 'help':
      showHelp(kitDir)
      return 0
    default:
      showHelp(kitDir)
      return command === '' ? 0 : 1
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  process.exitCode = main(process.argv.slice(2))
}

export { parseArgs, resolveDirs, getKitVersion, versionDisplay, likeMatch, regexValid, invokeDoctor, invokeScan, invokeStatus, invokeDiff, showVersion, showHelp, main }
