#!/usr/bin/env node
// lib/rollback.mjs - "Balikin ke versi sebelumnya" (rollback) versi Node, berbasis catatan-pasang + backup.
//
// Padanan lib/rollback.ps1. Cara kerja sama: baca .install-manifest.json (catatan berkas terpasang),
// untuk tiap berkas ter-track cari backup TERBARU (.bak.<ts> = merge JSON / .backup-<ts> = deploy
// template), lalu TIMPA berkas yang sekarang dengan isi backup. Sesudahnya: perbarui sidik-jari
// (SHA-256) di catatan + segel ulang catatan (HMAC) supaya tidak memicu alarm "di-utak-atik" palsu.
//
// ===========================================================================================
// STATUS MIGRASI (Gelombang 6, ADR-003/ADR-004) - SUDAH CUTOVER (aksi MERUSAK, sesi-khusus owner
//   2026-06-23) -> FILE INI = JALUR PRODUKSI:
//   File ini = port Node lib/rollback.ps1, hidup BERSAMA (side-by-side) versi PowerShell. Sejak cutover,
//   dispatcher (bin/lintasai.js) memetakan 'rollback' -> 'lib/rollback.mjs' (FILE INI) di COMMANDS_NODE +
//   menyuntik --project-root; router kit.mjs 'rollback' juga men-delegasi ke file ini. Jadi
//   `npx lintasai rollback` dan `kit.mjs rollback` KINI MENJALANKAN file ini di PRODUKSI (AKSI MERUSAK:
//   menimpa berkas project dari backup) -- nilai blast radius dengan benar saat menyunting (bukan dormant).
//   Cadangan PowerShell tetap terbit: `kit.ps1 rollback` -> lib/rollback.ps1 (jalur manual, tak disentuh
//   cutover). Tetap diuji tes pengunci (tests/rollback.test.mjs) + uji-banding PS==Node.
//
// SIFAT NON-INTERAKTIF (keputusan owner 06-22, cermin uninstall.mjs): versi Node TIDAK menampilkan
//   popup jendela. Karena ini aksi MERUSAK (menimpa berkas), default-aman = TIDAK menimpa apa pun.
//   Untuk benar-benar rollback, WAJIB beri bendera --yes (AI mengonfirmasi ke staff di chat dulu, baru
//   menjalankan dengan --yes). Tanpa --yes -> hanya menampilkan rencana lalu berhenti aman. Ini
//   menggantikan prompt Y/N + popup WinForms di versi PowerShell (Confirm-Rollback).
//
// PETA BENDERA (cermin parameter rollback.ps1, disesuaikan ke gaya non-interaktif Node):
//   --dry-run / --simulasi      : pratinjau saja (tak menimpa apa pun) = Get-RollbackPreview / -DryRun.
//   --yes / -y                  : lewati pintu konfirmasi MERUSAK (= "user pilih Yes" pada Confirm-Rollback).
//   --force                     : ikut lewati pintu konfirmasi MERUSAK + lewati abort manifest TANPA-segel
//                                 (legacy/pra-HMAC). Cermin -Force PowerShell (bypass confirm + unsigned).
//   --accept-untrusted-manifest : lanjut walau SEGEL catatan TIDAK COCOK (mungkin di-tamper). DANGEROUS,
//                                 opt-in eksplisit. Cermin -AcceptUntrustedManifest PowerShell.
//   --project-root <path>       : akar project (mode npx; dispatcher menyuntik --project-root <cwd-user>).
//
// BATAS VERIFIKASI SEGEL (jujur, sama dgn uninstall.mjs): manifest-signing.mjs (Node) hanya bisa
//   memverifikasi segel format-BARU (urut-abjad). Manifest bersegel-LAMA (urutan-acak .NET dari kit lama)
//   akan dianggap 'invalid' oleh Node -> butuh --accept-untrusted-manifest untuk lanjut. Ini AMAN (gagal
//   ke arah "jangan timpa" / minta opt-in eksplisit, bukan "timpa sembarangan"). Versi PowerShell punya
//   cadangan baca segel-lama; Node tidak -> divergensi yang DISENGAJA + fail-secure (lebih ketat).
//
// SHIM POWERSHELL (deteksi junction/symlink): pemeriksa reparse-point = Windows-asli
//   (FileAttributes.ReparsePoint, menelusuri SEMUA folder-induk). Node fs.lstat lebih sempit -> untuk
//   batas KEAMANAN ini kita panggil Test-PathHasReparsePoint di lib/safety.ps1 (SUMBER TUNGGAL logika
//   keamanan) lewat PowerShell, di-BATCH. Logika keamanan TIDAK diduplikasi -- hanya pembungkus-spawn
//   yang dicermin dari uninstall.mjs (testPathsHaveReparsePoint). Kalau shim tak bisa jalan -> BATAL
//   (fail-secure: lebih baik tak menimpa daripada salah ikuti junction ke luar project).
//   (Catatan backlog: pembungkus-spawn ini bisa diekstrak ke lib/reparse-shim.mjs di sesi refactor khusus
//    supaya 1 sumber; sengaja TIDAK sekarang -> hindari menyentuh uninstall.mjs di sesi-merusak ini.)
// ===========================================================================================
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { makeSafeProjectRoot, resolveSafeProjectPath, getFileSha256 } from './safety.mjs'
import { getManifestSignatureStatus, newManifestSignature, toSignableManifest } from './manifest-signing.mjs'
import { stripBom, isSymlinkLike } from './fs-text.mjs'
import { testPathsHaveReparsePoint } from './reparse-guard.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---- Penguraian argumen (gaya Node, double-dash) - cermin param rollback.ps1 + Confirm-Rollback ----
export function parseArgs(argv) {
  const a = { dryRun: false, force: false, acceptUntrustedManifest: false, yes: false, projectRoot: null }
  for (let i = 0; i < (argv || []).length; i++) {
    const t = String(argv[i]).toLowerCase()
    if (t === '--dry-run' || t === '--dryrun' || t === '--simulasi') a.dryRun = true
    else if (t === '--force') a.force = true
    else if (t === '--accept-untrusted-manifest' || t === '--accepttustedmanifest' || t === '--accept-untrusted') a.acceptUntrustedManifest = true
    else if (t === '--yes' || t === '-y') a.yes = true
    else if (t === '--project-root' || t === '--projectroot') a.projectRoot = argv[++i] || null
  }
  return a
}

// ---- Buang BOM awal: stripBom kini dari sumber bersama lib/fs-text.mjs (impor di atas) ----

// ---- Cari catatan-pasang: probe 3 lokasi kandidat (cermin Find-ManifestPath) ----
// setup bisa menaruh manifest di akar project ATAU di .claude-kit/ tergantung mode. Cek semua.
export function findManifestPath(projectRoot) {
  const candidates = [
    path.join(projectRoot, '.install-manifest.json'),
    path.join(projectRoot, '.claude-kit', '.install-manifest.json'),
    path.join(projectRoot, '.claude-kit', 'install-manifest.json'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return null
}

// ---- Baca + tulis catatan-pasang (JSON) ----
export function readManifestJson(p) {
  return JSON.parse(stripBom(fs.readFileSync(p, 'utf8')))
}
// Tulis ATOMIK: tulis ke berkas sementara dulu lalu rename (cermin PS WriteAllText tmp + Move-Item -Force).
// Tanpa ini, listrik mati/proses ditebas di tengah tulis bisa meninggalkan catatan setengah jadi (rusak).
// Format JSON.stringify(,2) (cermin pemasang Node manifest.mjs) -> segel TETAP sah krn verifikasi
// menghitung-ulang bentuk-baku (canonical) dari NILAI, bukan tata-letak berkas (lihat manifest-signing.mjs).
export function writeManifestJson(p, manifest) {
  const tmp = p + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2), 'utf8')
  fs.renameSync(tmp, p)
}

// ---- Cek apakah working tree git "kotor" (ada perubahan belum di-commit) - hanya untuk peringatan ----
export function testGitDirty(root) {
  try {
    const r = spawnSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8', timeout: 30000 })
    if (r.error) return false
    if (r.status !== 0) return false
    if (!r.stdout || String(r.stdout).trim() === '') return false
    return true
  } catch { return false }
}

// ---- Cari SEMUA berkas backup untuk satu OriginalPath, cocokkan DUA konvensi nama (cermin
//      Get-LintasBackupCandidate) ----
//   1. "<leaf>.bak.<ts>"     -> backup rutin merge JSON (lib/json-merge-helpers).
//   2. "<leaf>.backup-<ts>"  -> backup deploy template (lib/agents-md, lib/template-deploy) = mayoritas
//                               berkas ter-track (AGENTS.md, docs/, dst.).
// Snapshot ".malformed.bak.<ts>" (salinan JSON korup) DIKECUALIKAN -- itu bukan backup sehat.
// Mengembalikan array { name, fullName, mtimeMs }.
export function getLintasBackupCandidate(originalPath) {
  const dir = path.dirname(originalPath)
  const leaf = path.basename(originalPath)
  if (!fs.existsSync(dir)) return []
  let names
  try { names = fs.readdirSync(dir) } catch { return [] }
  const out = []
  const seen = new Set()
  for (const name of names) {
    // Cocokkan pola #1 (.bak.) ATAU #2 (.backup-). startsWith = anchored prefix (cermin -Filter
    // PowerShell yang anchored; readdir+startsWith juga kebal masalah short-name 8.3 yang bisa salah-
    // cocok di -Filter PowerShell -> Node lebih bersih).
    const isBak = name.startsWith(leaf + '.bak.')
    const isBackup = name.startsWith(leaf + '.backup-')
    if (!isBak && !isBackup) continue
    // KECUALIKAN snapshot korup .malformed.bak.<ts> (defensif; cermin pengecualian PowerShell).
    if (name.startsWith(leaf + '.malformed.bak.')) continue
    const fullName = path.join(dir, name)
    if (seen.has(fullName)) continue
    seen.add(fullName)
    let mtimeMs = 0
    try {
      const st = fs.statSync(fullName)
      if (!st.isFile()) continue // cermin -File: hanya berkas, bukan folder
      mtimeMs = st.mtimeMs
    } catch { continue }
    out.push({ name, fullName, mtimeMs })
  }
  return out
}

// ---- Pilih backup TERBARU (cermin Find-LatestBackup) ----
// "Terbaru" = waktu-ubah (LastWriteTime) terbesar. Pakai WAKTU (bukan urut nama) karena dua konvensi
// nama (.bak. vs .backup-) tak sebanding secara leksikal. Tie-break: Name menurun (deterministik).
export function findLatestBackup(originalPath) {
  const candidates = getLintasBackupCandidate(originalPath)
  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs
    return b.name.localeCompare(a.name) // tie-break: nama menurun
  })
  return candidates[0].fullName
}

// ---- Cek bentuk-path AMAN (cermin BAGIAN shape dari Test-LintasRollbackPathSafe) ----
// Reparse-point (junction/symlink) dicek TERPISAH lewat shim PowerShell (di-batch). Di sini hanya:
// tolak kosong / absolut / segmen naik-folder '..' / keluar dari akar project. REUSE resolveSafeProjectPath
// (safety.mjs) = batas keamanan ter-audit (lempar saat ditolak -> kita bungkus jadi {safe,full}).
export function isRollbackPathShapeSafe(safe, relPath) {
  try {
    const full = resolveSafeProjectPath(safe, relPath, 'entri rollback')
    return { safe: true, full }
  } catch {
    return { safe: false, full: null }
  }
}

// ---- Shim PowerShell: deteksi reparse-point (junction/symlink) untuk banyak path sekaligus ----
// ---- Shim PowerShell deteksi reparse-point -> disatukan ke lib/reparse-guard.mjs (audit fungsi-kembar
//      2026-06-25). Di-impor + di-RE-EXPORT (tanda tangan + perilaku tak berubah). Dulu CERMIN salinan di
//      uninstall.mjs; kini 1 sumber bersama. LOGIKA keamanan = lib/safety.ps1.
export { testPathsHaveReparsePoint }

// isSymlinkLike (penjaga TOCTOU lstat) -> sumber bersama lib/fs-text.mjs (impor di atas).

// ---- Ringkasan rencana (cermin Format-RollbackPlanSummary) - dicetak ke konsol supaya AI/staff paham
//      seberapa luas dampak SEBELUM menjalankan --yes ----
export function formatRollbackPlanSummary(plan, projectRoot) {
  const haveBackup = plan.filter((p) => p.backup != null)
  const count = haveBackup.length
  if (count === 0) return 'Tidak ada file dengan backup yang bisa di-restore.'
  const sampleCount = Math.min(5, count)
  const samples = haveBackup.slice(0, sampleCount).map((p) => {
    let rel = p.original
    if (String(rel).toLowerCase().startsWith(String(projectRoot).toLowerCase())) {
      rel = String(rel).slice(String(projectRoot).length).replace(/^[\\/]+/, '')
    }
    return '  - ' + rel
  })
  let more = ''
  if (count > sampleCount) more = `\n  ... dan ${count - sampleCount} file lain`
  return `Akan restore ${count} file dari backup (.bak.<ts> / .backup-<ts>):\n${samples.join('\n')}${more}\n\n` +
    'File yang sekarang ada di project akan DITIMPA dengan versi backup.'
}

// ============================ Inti: invokeRollback ============================
// Cermin Invoke-Rollback. PURE terhadap argumen (FS read/write + shim reparse). opts.reparseCheck =
// penyuntik pemeriksa-junction tiruan UNTUK UJI (produksi memakai shim PowerShell). opts.signatureCheck =
// penyuntik verifikator-segel tiruan UNTUK UJI (default = getManifestSignatureStatus; dipakai menguji
// jalur fail-secure 'manifest-verify-error' saat verifikator MELEMPAR). opts.now (Date) untuk uji
// deterministik (rolledBackAt).
// Mengembalikan objek hasil: { status?, restored, skipped, items?, dryRun?, cancelled? } (cermin PS).
export function invokeRollback({ projectRoot, kitDir, force = false, acceptUntrustedManifest = false, dryRun = false, yes = false, reparseCheck, signatureCheck, now = null } = {}) {
  // ---- 1. Resolusi akar project ----
  let root
  try {
    if (!projectRoot || String(projectRoot).trim() === '') projectRoot = process.cwd()
    if (!fs.existsSync(projectRoot)) throw new Error('tidak ditemukan')
    root = fs.realpathSync(projectRoot)
  } catch {
    console.log(`[INFO] ProjectRoot tidak valid: ${projectRoot}. Tidak ada yang di-rollback.`)
    return { status: 'no-project-root', restored: 0, skipped: 0 }
  }

  // ---- 2. Cari catatan-pasang ----
  const manifestPath = findManifestPath(root)
  if (!manifestPath) {
    console.log('[INFO] Tidak ada manifest. Belum pernah install atau setup belum jalan. Tidak ada yang di-rollback.')
    return { status: 'no-manifest', restored: 0, skipped: 0 }
  }

  // ---- 3. Peringatan git kotor (tidak menghalangi) ----
  if (testGitDirty(root)) {
    console.warn(`Working tree git dirty di ${root}. Pertimbangkan stash/commit sebelum rollback.`)
  }

  // ---- 4. Baca catatan-pasang ----
  let manifest
  try {
    manifest = readManifestJson(manifestPath)
  } catch (e) {
    console.log(`[ERROR] Gagal parse manifest ${manifestPath}: ${e.message}`)
    return { status: 'manifest-parse-error', restored: 0, skipped: 0 }
  }

  // ---- 5. Manifest punya properti 'files'? (cermin hasFilesProp: properti ADA, walau null/non-array) ----
  const hasFilesProp = manifest && typeof manifest === 'object' && Object.prototype.hasOwnProperty.call(manifest, 'files')
  if (!hasFilesProp) {
    console.log("[INFO] Manifest tidak punya properti 'files'. Tidak ada yang di-rollback.")
    return { status: 'manifest-no-files', restored: 0, skipped: 0 }
  }
  const files = Array.isArray(manifest.files) ? manifest.files : []

  // ---- 6. Resolusi kitDir (tempat lib/safety.ps1 + .manifest-secret) ----
  // Cermin rollback.ps1: signing lib relatif manifest, fallback root/.claude-kit. kitDir dipakai untuk
  // (a) verifikasi/segel-ulang HMAC (kunci .manifest-secret) + (b) shim reparse (lib/safety.ps1).
  if (!kitDir || String(kitDir).trim() === '') {
    const manifestDir = path.dirname(manifestPath)
    if (fs.existsSync(path.join(manifestDir, 'lib', 'manifest-signing.mjs')) || fs.existsSync(path.join(manifestDir, 'lib', 'safety.ps1'))) {
      kitDir = manifestDir
    } else if (fs.existsSync(path.join(root, '.claude-kit'))) {
      kitDir = path.join(root, '.claude-kit')
    } else {
      kitDir = path.dirname(__dirname) // fallback: kit root dari lokasi rollback.mjs sendiri (.claude-kit)
    }
  }

  // ---- 7. Verifikasi SEGEL keaslian (HMAC) sebelum percaya entri ----
  // Rollback = timpa berkas dari .bak ke path arbitrer di akar project -> kalau manifest di-tamper,
  // penyerang bisa menimpa berkas kritis. WAJIB verify segel dulu (threat model lihat header).
  let manifestWasSigned = false
  let kitVerForVerify = ''
  if (manifest.metadata && manifest.metadata.kit_version) kitVerForVerify = String(manifest.metadata.kit_version)
  else if (manifest.kit_version) kitVerForVerify = String(manifest.kit_version)

  const expectedSig = (manifest.metadata && manifest.metadata.signature) ? String(manifest.metadata.signature) : ''
  if (!expectedSig) {
    // ---- Manifest TANPA segel (kit versi lama / pra-HMAC) ----
    console.warn(`[AUDIT] Rollback: manifest UNSIGNED (kit versi lama / install pra-HMAC) di ${manifestPath}.`)
    if (!force) {
      console.log('')
      console.log('[!] Catatan-pasang TANPA segel - tak ada cara memastikan catatan belum diubah.')
      console.log('    RISIKO: kalau backup ter-tamper, rollback bisa restore versi berbahaya.')
      console.log('    Kalau yakin kit dari sumber tepercaya + belum disentuh: ulangi dengan --force.')
      console.log('    Kalau ragu: pasang ulang kit terbaru supaya catatan ber-segel.')
      console.log('[BATAL] Rollback dibatalkan (catatan tanpa segel, butuh --force untuk lanjut).')
      console.warn('[AUDIT] Rollback aborted: unsigned manifest (butuh --force).')
      return { status: 'manifest-unsigned-aborted', restored: 0, skipped: 0 }
    }
    console.warn('[AUDIT] Rollback: --force di-set -> bypass unsigned-manifest (legacy compat).')
  } else {
    // ---- Manifest ber-segel -> verifikasi HMAC ----
    manifestWasSigned = true
    // Penyuntik verifikator (default = produksi). Memungkinkan uji jalur fail-secure saat verifikator
    // MELEMPAR (mis. kunci .manifest-secret tak terbaca / modul rusak) - cermin pola reparseCheck.
    const sigCheckFn = typeof signatureCheck === 'function' ? signatureCheck : (m, o) => getManifestSignatureStatus(m, o)
    let status
    try {
      status = sigCheckFn(manifest, { kitRoot: kitDir })
    } catch (e) {
      // FAIL-SECURE: verifikator error -> JANGAN diam-diam lanjut (cermin rollback.ps1 exit 1).
      console.warn(`[AUDIT] Rollback: signature verification ERRORED (${manifestPath}): ${e.message}`)
      console.log('[ABORT] Rollback dibatalkan: verifikasi tanda-tangan gagal jalan (fail-secure).')
      console.log('        Periksa lib/manifest-signing.mjs sebelum mengulang.')
      return { status: 'manifest-verify-error', restored: 0, skipped: 0 }
    }
    if (status === 'invalid') {
      console.warn(`[AUDIT] Rollback: manifest signature INVALID di ${manifestPath} - mungkin di-tamper`)
      console.warn('        (atau segel format-LAMA yang versi Node belum bisa verifikasi - lihat catatan di atas berkas ini).')
      if (!acceptUntrustedManifest) {
        console.log('[ABORT] Rollback dibatalkan: signature INVALID.')
        console.log('        Pakai --accept-untrusted-manifest kalau yakin manifest legit (DANGEROUS).')
        return { status: 'manifest-signature-invalid', restored: 0, skipped: 0 }
      }
      console.warn('[AUDIT] Rollback: --accept-untrusted-manifest -> proceed dengan signature INVALID (opt-in eksplisit).')
    }
    // status === 'verified' -> lanjut diam-diam.
  }

  // ---- 8. Pra-scan: ada minimal 1 backup yang nyambung ke entri? Kalau zero -> graceful no-op ----
  let hasAnyBak = false
  for (const entry of files) {
    const absOrig = path.join(root, String(entry.path == null ? '' : entry.path).replace(/\//g, path.sep))
    if (getLintasBackupCandidate(absOrig).length > 0) { hasAnyBak = true; break }
  }
  if (!hasAnyBak) {
    console.log('[OK] Manifest ada tapi tidak ada file backup (.bak.<ts> / .backup-<ts>). Tidak ada yang di-rollback (fresh install belum di-update).')
    return { status: 'no-backups', restored: 0, skipped: 0 }
  }

  // ---- 9. Bangun rencana (entri -> path asli -> backup terbaru) ----
  const plan = []
  for (const entry of files) {
    const orig = path.join(root, String(entry.path == null ? '' : entry.path).replace(/\//g, path.sep))
    const bak = findLatestBackup(orig)
    plan.push({ entry, original: orig, backup: bak })
  }

  // ---- 10. SIMULASI (--dry-run): pratinjau saja ----
  if (dryRun) {
    // R5 (audit 2026-06-23): jalankan juga cek BENTUK-path (murni Node, ~0 biaya) supaya pratinjau
    // JUJUR menandai entri yang akan DIBLOKIR saat run nyata - bukan menjanjikan "would restore" untuk
    // berkas yang nanti di-skip. Cek junction/symlink LENGKAP (shim, mahal) tetap hanya di run nyata.
    const safePreview = makeSafeProjectRoot(root)
    let wouldBlock = 0
    for (const p of plan) {
      if (p.backup == null) { console.log(`skip (no backup): ${p.original}`); continue }
      const shape = isRollbackPathShapeSafe(safePreview, String(p.entry.path == null ? '' : p.entry.path))
      if (!shape.safe) { console.log(`would BLOCK (path tidak aman: absolut/'..'/keluar-root): ${p.original}`); wouldBlock++; continue }
      console.log(`would restore: ${p.original} <- ${p.backup}`)
    }
    if (wouldBlock > 0) console.log(`Catatan: ${wouldBlock} entri akan DIBLOKIR demi keamanan. Cek junction/symlink LENGKAP baru jalan saat rollback sungguhan (--yes).`)
    return { dryRun: true, restored: 0, skipped: plan.filter((p) => p.backup == null).length, wouldBlock, items: plan }
  }

  // ---- 11. Pintu konfirmasi MERUSAK (cermin Confirm-Rollback, gaya non-interaktif) ----
  console.log('')
  console.log(formatRollbackPlanSummary(plan, root))
  const confirmed = force || yes
  if (!confirmed) {
    console.log('')
    console.log('BERHENTI (default aman): rollback TIDAK dijalankan.')
    console.log('  Ini aksi MERUSAK (menimpa berkas project dengan versi backup). Versi otomatis (Node)')
    console.log('  TIDAK bertanya Y/N di layar seperti dulu, jadi default = tidak menimpa apa pun (NORMAL,')
    console.log('  bukan rusak). Untuk benar-benar rollback: jalankan ulang dengan --yes (sesudah lihat')
    console.log('  rencana di atas). Contoh: npx lintasai rollback --yes')
    return { cancelled: true, restored: 0, skipped: plan.length, items: [] }
  }

  // ---- 12. Cek-keamanan path (bentuk + reparse di-BATCH) untuk kandidat yang punya backup ----
  const safe = makeSafeProjectRoot(root)
  const evals = [] // { p, noBackup, shapeSafe, full }
  for (const p of plan) {
    if (p.backup == null) { evals.push({ p, noBackup: true }); continue }
    const shape = isRollbackPathShapeSafe(safe, String(p.entry.path == null ? '' : p.entry.path))
    evals.push({ p, noBackup: false, shapeSafe: shape.safe, full: shape.full })
  }
  const reparseFn = typeof reparseCheck === 'function' ? reparseCheck : (absPaths) => testPathsHaveReparsePoint(absPaths, root, kitDir)
  const reparseTargets = evals.filter((e) => !e.noBackup && e.shapeSafe).map((e) => e.full)
  let reparseMap
  try {
    reparseMap = reparseFn(reparseTargets)
  } catch (e) {
    // Shim reparse gagal -> fail-secure batal (jangan ambil risiko ikuti junction ke luar project).
    console.log('')
    console.log(`[BATAL] Tidak bisa memeriksa junction/symlink dengan aman: ${e.message}. Tidak ada yang di-rollback (fail-secure).`)
    return { status: 'reparse-check-failed', restored: 0, skipped: plan.length, items: [] }
  }

  // ---- 13. Eksekusi: timpa berkas dari backup (+ perbarui sidik-jari di catatan) ----
  let restored = 0
  let skipped = 0
  const items = []
  const stampNow = now || new Date()

  for (const e of evals) {
    const p = e.p
    if (e.noBackup) {
      skipped++
      items.push({ path: p.entry.path, action: 'skip', reason: 'no-backup' })
      continue
    }
    // SECURITY: tolak path tak-aman (bentuk: absolut/'..'/keluar-root) ATAU reparse (junction/symlink di
    // jalur ATAU folder-induk) ATAU swap-ke-symlink detik-terakhir (lstat backstop, tutup celah TOCTOU).
    if (!e.shapeSafe || reparseMap.get(e.full) === true || isSymlinkLike(e.full)) {
      console.log(`BLOCKED (path tidak aman, di-skip demi keamanan): ${p.entry.path}`)
      skipped++
      items.push({ path: p.entry.path, action: 'blocked', reason: 'unsafe-path' })
      continue
    }
    try {
      fs.copyFileSync(p.backup, e.full) // timpa berkas sekarang dengan isi backup
    } catch (err) {
      console.log(`GAGAL restore ${p.entry.path}: ${err.message}`)
      skipped++
      items.push({ path: p.entry.path, action: 'error', reason: err.message })
      continue
    }
    const newHash = getFileSha256(e.full) // hex HURUF-KECIL (cermin Get-FileSha256 rollback.ps1)
    // Perbarui entri di tempat (bagian dari manifest.files -> ikut tertulis saat write).
    p.entry.sha256 = newHash
    p.entry.rolledBackAt = stampNow.toISOString()
    restored++
    items.push({ path: p.entry.path, action: 'restore', backup: p.backup, sha256: newHash })
  }

  // ---- 14. Segel ULANG catatan setelah sha256 berubah (cegah alarm "di-tamper" palsu) ----
  // Restore memperbarui entry.sha256 -> segel HMAC lama jadi BASI. Tanpa segel-ulang: rollback BERIKUTNYA
  // / `kit doctor` menilai manifest "INVALID" padahal rollback sendiri yang mengubahnya. Hanya segel-ulang
  // kalau manifest MEMANG ber-segel + ada perubahan nyata (restored > 0). Cermin Invoke-Rollback re-sign.
  if (manifestWasSigned && restored > 0) {
    try {
      const reSignable = toSignableManifest(manifest) // deep-clone + buang metadata.signature
      const newSig = newManifestSignature(reSignable, { kitVersion: kitVerForVerify, kitRoot: kitDir })
      if (!manifest.metadata || typeof manifest.metadata !== 'object') manifest.metadata = {}
      manifest.metadata.signature = newSig
    } catch (e) {
      // Segel-ulang gagal -> JANGAN tinggalkan segel BASI (sumber false-tamper). Hapus segel lama supaya
      // manifest jadi UNSIGNED yang konsisten ("tak ber-segel" lebih aman daripada "ber-segel tapi salah").
      console.warn(`[AUDIT] Rollback: gagal segel ulang manifest (${e.message}). Tanda-tangan lama dihapus agar tidak memicu alarm 'di-tamper' palsu.`)
      // R3 (audit 2026-06-23): petunjuk pemulihan AWAM - restore SUDAH aman; segel bisa dipulihkan
      // tanpa melemahkan pengaman. Cegah staff terbiasa pakai --force sebagai jalan pintas.
      console.warn("[PENTING] Berkas SUDAH dipulihkan dengan aman; hanya 'segel' catatan yang gagal diperbarui.")
      console.warn("          Pulihkan segel: jalankan 'npx lintasai init' (atau '.\\.claude-kit\\kit.ps1 doctor').")
      console.warn('          JANGAN biasakan pakai --force / --accept-untrusted-manifest sebagai jalan pintas (itu melemahkan pengaman).')
      try {
        if (manifest.metadata && Object.prototype.hasOwnProperty.call(manifest.metadata, 'signature')) {
          delete manifest.metadata.signature
        }
      } catch (e2) {
        console.warn(`[AUDIT] Rollback: gagal menghapus tanda-tangan basi: ${e2.message}`)
      }
    }
  }

  // ---- 15. Tulis catatan-pasang (atomik) ----
  writeManifestJson(manifestPath, manifest)

  console.log('')
  console.log(`[OK] Rollback selesai. Dipulihkan: ${restored} berkas. Dilewati: ${skipped} berkas.`)
  return { restored, skipped, items }
}

// ---- Pratinjau (cermin Get-RollbackPreview = Invoke-Rollback -DryRun) ----
export function getRollbackPreview({ projectRoot, kitDir, reparseCheck } = {}) {
  return invokeRollback({ projectRoot, kitDir, dryRun: true, reparseCheck })
}

// ============================ Orkestrasi CLI (runRollback) ============================
// Mengembalikan kode-keluar (number). isMain memakai process.exitCode (anti potong-output).
export function runRollback(argv, opts = {}) {
  const args = parseArgs(argv)

  // ---- Resolusi akar project (param-driven, fallback ke lokasi script) ----
  let projectRoot
  if (args.projectRoot && String(args.projectRoot).trim() !== '') {
    if (!fs.existsSync(args.projectRoot)) {
      console.error(`ERROR: Akar project tidak ditemukan: ${args.projectRoot}`)
      return 1
    }
    projectRoot = fs.realpathSync(args.projectRoot)
  } else {
    // rollback.mjs ada di .claude-kit/lib/ -> akar project = naik 2 level (lib -> .claude-kit -> project).
    projectRoot = path.dirname(path.dirname(__dirname))
  }

  // ---- Resolusi kitDir (.claude-kit; tempat lib/safety.ps1 + .manifest-secret) ----
  let kitDir = path.dirname(__dirname) // .claude-kit (induk dari lib/) - mode lokal/dev
  if (args.projectRoot && String(args.projectRoot).trim() !== '') {
    // Mode npx: script dari cache npm -> arahkan kitDir ke .claude-kit di project user.
    const expected = path.join(projectRoot, '.claude-kit')
    if (fs.existsSync(expected)) kitDir = fs.realpathSync(expected)
    // else: pakai kitDir lokasi script (cache npm) - lib/safety.ps1 + manifest-signing.mjs isi sama.
  }

  console.log('================================================================')
  console.log('  lintasAI rollback - balikin berkas project ke versi backup')
  console.log('================================================================')
  console.log(`Root proyek   : ${projectRoot}`)

  const reparseCheck = typeof opts.reparseCheck === 'function'
    ? opts.reparseCheck
    : (absPaths) => testPathsHaveReparsePoint(absPaths, projectRoot, kitDir)

  const result = invokeRollback({
    projectRoot,
    kitDir,
    force: args.force,
    acceptUntrustedManifest: args.acceptUntrustedManifest,
    dryRun: args.dryRun,
    yes: args.yes,
    reparseCheck,
    signatureCheck: opts.signatureCheck,
    now: opts.now,
  })

  return rollbackResultToExitCode(result)
}

// Pemetaan hasil -> kode keluar. Abort keamanan / parse-error / shim-gagal = 1; no-op aman / simulasi /
// batal-default / sukses = 0 (cermin uninstall.mjs: default-aman & no-op bukan kegagalan).
export function rollbackResultToExitCode(result) {
  if (!result || typeof result !== 'object') return 1
  const failStatuses = new Set([
    'manifest-parse-error',
    'manifest-unsigned-aborted',
    'manifest-signature-invalid',
    'manifest-verify-error',
    'reparse-check-failed',
  ])
  if (result.status && failStatuses.has(result.status)) return 1
  return 0
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  process.exitCode = runRollback(process.argv.slice(2))
}
