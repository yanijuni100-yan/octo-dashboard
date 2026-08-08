#!/usr/bin/env node
// lib/project-manifest.mjs - Pembaca + robot PEMERIKSA "kartu identitas project" (MODE baca .jsonc, port Node).
//
// FASE 3 Langkah 3 (ADR-003 / migrasi .psd1 -> JSON, BERTAHAP + BERDAMPINGAN): port bagian PEMERIKSA
// (cuma-baca) dari project-manifest.ps1, supaya kartu identitas project bisa dibaca runtime Node
// dari `project.lintas.jsonc`. Reuse lib/config-loader.mjs (Langkah 1).
//
// PENULIS BOOTSTRAP kartu identitas (Get-LintasDerivedStack / Write-LintasProjectManifestIfMissing)
// KINI DIPORT ke Node (Gelombang 4, untuk pemasang Node setup-pola-b.mjs). BEDA DISENGAJA
// (keputusan owner 2026-06-22): pemasang Node menulis format BARU .jsonc (sesuai pembaca di atas +
// ADR-003a), BUKAN .psd1 seperti pemasang PowerShell lama. Lihat bagian "PENULIS BOOTSTRAP" di bawah.
//
// Robot REGISTRY (architecture_auto.md) = cuma-baca, baca .md, tak terkait kartu .jsonc. KINI DIPORT
// ke Node (lihat getLintasRegistryFinding/invokeLintasRegistryCheck di bawah) supaya client Node-only
// (tanpa pwsh) juga dapat teguran saat daftar-isi docs melenceng. SETIA ke project-manifest.ps1:436-521.
//
// KEHATI-HATIAN port (pelajaran cek-silang skeptis 2026-06-21, diterapkan + diperketat ronde-2):
//   - PS `-like "*x*"` (cocok framework) = CASE-INSENSITIVE -> Node lowercase KEDUA sisi.
//   - PS hashtable .ContainsKey() = CASE-INSENSITIVE -> lookup package_manager pakai toLowerCase.
//   - PS `@(x)` membungkus nilai-tunggal jadi array 1-elemen -> asArray() cermin itu (modules/frameworks
//     ditulis sbg objek/string tunggal tetap diperiksa, tak dilewati seperti Array.isArray polos).
//   - Manifest akar BUKAN objek (null/array/nilai-tunggal) -> Ok=false anggun (mc=1), BUKAN crash
//     (JSON.parse('null')=null -> hasOwnProperty.call(null) dulu TypeError uncaught).
//   - schema_version: .psd1 `-is [int]` <-> .jsonc number; cek Number.isInteger (1.5/'satu' -> MISMATCH).
//   - BOM di-strip seperti [IO.File]::ReadAllText UTF-8. Path: NTFS Windows case-insensitive (cocok Test-Path).
//
// BEDA YANG DITERIMA (batas wajar port - didokumentasikan, bukan bug):
//   - schema_version `2.0` / `1e0`: di JSON itu integer 2/1 (Number.isInteger=true -> OK), di .psd1
//     [Double] (-is [int] false -> MISMATCH). Info "ada titik desimal" HILANG saat JSON.parse -> tak bisa
//     dibedakan dari `2`. Kasus normal (integer 1/2) COCOK. schema_version dikelola template kit (=1).
//   - framework ber-karakter glob (`[` `]` `*` `?`): PS `-like` mem-parse-nya sbg WILDCARD, Node `.includes`
//     literal. Nama paket npm asli TAK mengandung karakter ini -> tak ada divergensi praktis; Node lebih
//     tahan (PS `-like` malah CRASH pada `[` tak-tertutup - Node anggun).
//   - package.json `dependencies` ditulis ARRAY + framework bernama meta-properti .NET (Count/Length/...):
//     PS `.PSObject.Properties.Name` kembalikan meta-properti array; Node `Object.keys` kembalikan indeks.
//     Sangat dibuat-buat (deps WAJIB objek) - quirk PS, bukan perilaku yang patut ditiru.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readLintasConfig } from './config-loader.mjs'
import { stripBom } from './fs-text.mjs'

const MANIFEST_FILENAME = 'project.lintas.jsonc' // Node/Fase-3 membaca .jsonc (PS membaca .psd1)
const LOCKFILES = { pnpm: 'pnpm-lock.yaml', npm: 'package-lock.json', yarn: 'yarn.lock', bun: 'bun.lockb' }

// Cermin PS `@(x)`: array -> apa adanya; null/undefined -> []; lainnya (objek/string tunggal) -> [x].
// Tanpa ini, modules/frameworks yang ditulis objek/string TUNGGAL (bukan list) dilewati di Node tapi
// TETAP diperiksa di PS -> vonis beda (temuan cek-silang ronde-2).
function asArray(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]) }

export function resolveLintasManifestPath(repoRoot, manifestPath) {
  return manifestPath || path.join(repoRoot, MANIFEST_FILENAME)
}

// Baca manifest + PARSE-OK. Return { Ok, Present, Manifest, Error, Path }.
export function readLintasProjectManifest(p) {
  if (!fs.existsSync(p)) return { Ok: false, Present: false, Manifest: null, Error: null, Path: p }
  try {
    const data = readLintasConfig(p)
    // Akar WAJIB objek (bukan null/array/nilai-tunggal). JSON.parse('null')=null lolos parse tapi bikin
    // hasOwnProperty.call(null) crash di hilir -> tangani anggun di sini (cermin PS: mc=1, bukan throw).
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return { Ok: false, Present: true, Manifest: null, Error: 'kartu identitas harus objek di akar (bukan null/array/nilai tunggal)', Path: p }
    }
    return { Ok: true, Present: true, Manifest: data, Error: null, Path: p }
  } catch (e) {
    return { Ok: false, Present: true, Manifest: null, Error: e.message, Path: p }
  }
}

// Cek schema dasar (schema_version ada + integer >= 1). Return array temuan (Kind='Schema').
export function getLintasManifestSchemaFinding(manifest) {
  if (!Object.prototype.hasOwnProperty.call(manifest, 'schema_version')) {
    return [{ Kind: 'Schema', Field: 'schema_version', Expected: 'integer >= 1', Found: '(tidak ada)', Status: 'MISMATCH' }]
  }
  const sv = manifest.schema_version
  const isValid = typeof sv === 'number' && Number.isInteger(sv) && sv >= 1
  return [{ Kind: 'Schema', Field: 'schema_version', Expected: 'integer >= 1', Found: String(sv), Status: isValid ? 'OK' : 'MISMATCH' }]
}

// Baca semua nama dependency (deps + devDeps) dari package.json. Return array nama; [] kalau tak ada.
export function getLintasPackageJsonDependency(repoRoot) {
  const pkgPath = path.join(repoRoot, 'package.json')
  if (!fs.existsSync(pkgPath)) return []
  let pkg
  try {
    const raw = stripBom(fs.readFileSync(pkgPath, 'utf8'))
    pkg = JSON.parse(raw)
  } catch { return [] }
  const names = []
  for (const section of ['dependencies', 'devDependencies']) {
    if (pkg[section] && typeof pkg[section] === 'object') names.push(...Object.keys(pkg[section]))
  }
  return names
}

// Inti: kumpulkan temuan PathExists + DeriveMatch. Konservatif (SKIP kalau bukti kurang).
export function getLintasManifestFinding(repoRoot, manifest) {
  const findings = []
  const exists = (rel) => fs.existsSync(path.join(repoRoot, rel))

  // PathExists: modules[].path (asArray: objek tunggal pun diperiksa, cermin PS @())
  {
    for (const m of asArray(manifest.modules)) {
      if (!m || typeof m !== 'object' || !m.path) continue
      const rel = String(m.path)
      const ok = exists(rel)
      const name = m.name != null ? String(m.name) : rel
      findings.push({ Kind: 'PathExists', Field: `module:${name}`, Expected: `ada di disk: ${rel}`, Found: ok ? rel : '(tidak ada di disk)', Status: ok ? 'OK' : 'MISSING' })
    }
  }

  // PathExists: refs.* (pointer ke artefak prosa)
  if (manifest.refs && typeof manifest.refs === 'object') {
    for (const key of ['architecture', 'glossary', 'registry']) {
      if (manifest.refs[key]) {
        const rel = String(manifest.refs[key])
        const ok = exists(rel)
        findings.push({ Kind: 'PathExists', Field: `ref:${key}`, Expected: `ada di disk: ${rel}`, Found: ok ? rel : '(tidak ada di disk)', Status: ok ? 'OK' : 'MISSING' })
      }
    }
  }

  // DeriveMatch: stack vs package.json (konservatif)
  if (manifest.stack && typeof manifest.stack === 'object') {
    const deps = getLintasPackageJsonDependency(repoRoot)
    // frameworks: substring (case-insensitive, cermin PS -like). SKIP kalau tak ada deps.
    // asArray: string tunggal pun diperiksa (cermin PS @()).
    const fws = asArray(manifest.stack.frameworks)
    if (fws.length && deps.length > 0) {
      for (const fw of fws) {
        const fwStr = String(fw)
        const matched = deps.some((d) => d.toLowerCase().includes(fwStr.toLowerCase()))
        findings.push({ Kind: 'DeriveMatch', Field: `stack.framework:${fwStr}`, Expected: 'ada di package.json deps', Found: matched ? 'ada' : '(tidak ada di deps)', Status: matched ? 'OK' : 'MISMATCH' })
      }
    }
    // package_manager: MISMATCH hanya bila lockfile pm-dideklarasikan TAK ADA padahal pm LAIN ADA.
    if (manifest.stack.package_manager) {
      const pm = String(manifest.stack.package_manager)
      const pmKey = pm.toLowerCase() // PS hashtable ContainsKey case-insensitive
      if (Object.prototype.hasOwnProperty.call(LOCKFILES, pmKey)) {
        const declaredLock = LOCKFILES[pmKey]
        const declaredLockExists = exists(declaredLock)
        let otherLockExists = false
        for (const otherPm of Object.keys(LOCKFILES)) {
          if (otherPm === pmKey) continue
          if (exists(LOCKFILES[otherPm])) { otherLockExists = true; break }
        }
        if (!declaredLockExists && otherLockExists) {
          findings.push({ Kind: 'DeriveMatch', Field: 'stack.package_manager', Expected: `lockfile ${declaredLock} ada`, Found: '(tidak ada; lockfile pm lain ada)', Status: 'MISMATCH' })
        } else {
          findings.push({ Kind: 'DeriveMatch', Field: 'stack.package_manager', Expected: pm, Found: declaredLockExists ? `${declaredLock} ada` : '(tak bisa verifikasi)', Status: declaredLockExists ? 'OK' : 'SKIP' })
        }
      }
    }
  }
  return findings
}

// Orkestrasi: jalankan + (opsional) cetak. MismatchCount = MISMATCH + MISSING (+ parse gagal=1).
export function invokeLintasManifestCheck(repoRoot, { manifestPath = null, quiet = false } = {}) {
  const p = resolveLintasManifestPath(repoRoot, manifestPath)
  const read = readLintasProjectManifest(p)

  if (!read.Present) {
    if (!quiet) console.log(`[INFO] Tidak ada ${MANIFEST_FILENAME} di ${repoRoot} - kartu identitas project belum dibuat (opsional).`)
    return { Present: false, Ok: true, Findings: [], MismatchCount: 0, Path: p }
  }
  if (!read.Ok) {
    const finding = { Kind: 'ParseOk', Field: '(berkas)', Expected: 'bisa di-baca (.jsonc valid)', Found: `RUSAK: ${read.Error}`, Status: 'MISMATCH' }
    if (!quiet) console.log(`\nKartu identitas project RUSAK - tidak bisa di-baca: ${p}\n  ${read.Error}\n`)
    return { Present: true, Ok: false, Findings: [finding], MismatchCount: 1, Path: p }
  }

  const findings = [...getLintasManifestSchemaFinding(read.Manifest), ...getLintasManifestFinding(repoRoot, read.Manifest)]
  const bad = findings.filter((f) => f.Status === 'MISMATCH' || f.Status === 'MISSING')

  if (!quiet) {
    console.log('\nRobot pemeriksa kartu identitas project (project.lintas.jsonc, Node)')
    console.log(`Berkas: ${p}`)
    console.log('-'.repeat(64))
    for (const f of findings) {
      if (f.Status === 'OK') console.log(`  [OK]        ${f.Field}  ${f.Found}`)
      else if (f.Status === 'MISMATCH') console.log(`  [TAK COCOK] ${f.Field}  ${f.Found} -> HARUS ${f.Expected}`)
      else if (f.Status === 'MISSING') console.log(`  [HILANG]    ${f.Field}  ${f.Expected}`)
      else console.log(`  [LEWAT]     ${f.Field}  (tak bisa verifikasi - dilewati)`)
    }
    console.log('-'.repeat(64))
    console.log(bad.length === 0 ? 'BERSIH: kartu identitas cocok dengan kenyataan project.' : `${bad.length} ketidakcocokan - kartu identitas BASI, perbaiki sebelum rilis.`)
  }
  return { Present: true, Ok: bad.length === 0, Findings: findings, MismatchCount: bad.length, Path: p }
}

// ============================================================================
// ROBOT REGISTRY - anti-basi architecture_auto.md (port dari project-manifest.ps1:436-521).
// WHY: registry docs di-maintain AI manual (§7.4); AI bisa LUPA daftarkan .md baru -> registry tak
// cocok isi docs/ nyata. Robot bandingkan docs/**/*.md vs registry deterministik (~detik, ~0 token):
//   MISSING = ada .md belum terdaftar di architecture_auto.md.
//   ORPHAN  = link registry menunjuk berkas yang sudah tak ada.
// SETIA ke versi PS: boundary non-alfanumerik di depan nama (auth.md != oauth.md); link eksternal/
// parent/absolut dilewati (anti alarm-palsu); berkas indeks (architecture_auto.md + architecture.md)
// tak dihitung sebagai pendamping yang harus terdaftar.
// ============================================================================

const LINTAS_REGISTRY_RELPATH = 'docs/architecture_auto.md'
const LINTAS_REGISTRY_EXCLUDE = ['architecture_auto.md', 'architecture.md']

// Escape metakarakter regex (cermin [regex]::Escape PS).
function escapeRegExpLiteral(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// Kumpul semua docs/**/*.md (rekursif). Walker manual (kompat semua Node) -> { name, full }.
function walkDocsMarkdown(docsDir) {
  const out = []
  const walk = (dir) => {
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) out.push({ name: e.name, full })
    }
  }
  walk(docsDir)
  return out
}

// Kumpulkan temuan Registry (MISSING + ORPHAN). Registry/docs opsional -> [] kalau tak ada.
export function getLintasRegistryFinding(repoRoot) {
  const registryPath = path.join(repoRoot, LINTAS_REGISTRY_RELPATH)
  const docsDir = path.join(repoRoot, 'docs')
  const findings = []
  if (!fs.existsSync(registryPath)) return findings // registry opsional
  if (!fs.existsSync(docsDir)) return findings

  const registryText = stripBom(fs.readFileSync(registryPath, 'utf8'))

  // MISSING: tiap docs/**/*.md (kecuali indeks) harus disebut (basename) di registry. Boundary
  // non-alfanumerik di depan supaya 'auth.md' TIDAK keliru cocok di dalam 'oauth.md' (cermin PS).
  for (const df of walkDocsMarkdown(docsDir)) {
    if (LINTAS_REGISTRY_EXCLUDE.includes(df.name)) continue
    const registered = new RegExp('(?<![A-Za-z0-9])' + escapeRegExpLiteral(df.name)).test(registryText)
    findings.push({
      Kind: 'Registry', Field: `docs/${df.name}`, Expected: 'terdaftar di architecture_auto.md',
      Found: registered ? 'terdaftar' : '(belum terdaftar)',
      Status: registered ? 'OK' : 'MISSING',
    })
  }

  // ORPHAN: tiap link [text](target.md) -> target (relatif ke docs/) harus ada. Lewati eksternal/parent/absolut.
  for (const m of registryText.matchAll(/\]\(([^)]+\.md)\)/g)) {
    const target = m[1]
    if (/^(https?:|\.\.\/|\/)/.test(target)) continue
    if (!fs.existsSync(path.join(docsDir, target))) {
      findings.push({
        Kind: 'Registry', Field: `link:${target}`, Expected: 'berkas tertaut ada di disk',
        Found: '(berkas tak ada -> entri yatim)', Status: 'ORPHAN',
      })
    }
  }
  return findings
}

// Orkestrasi: jalankan + (opsional) cetak. Cermin Invoke-LintasRegistryCheck (PS).
export function invokeLintasRegistryCheck(repoRoot, { quiet = false } = {}) {
  const registryPath = path.join(repoRoot, LINTAS_REGISTRY_RELPATH)
  if (!fs.existsSync(registryPath)) {
    if (!quiet) console.log(`[INFO] Tidak ada ${LINTAS_REGISTRY_RELPATH} - registry docs belum dibuat (opsional).`)
    return { Present: false, Ok: true, Findings: [], MismatchCount: 0 }
  }
  const findings = getLintasRegistryFinding(repoRoot)
  const bad = findings.filter((f) => f.Status !== 'OK')
  if (!quiet) {
    console.log('\nRobot pemeriksa registry docs (architecture_auto.md, Node)')
    console.log('-'.repeat(64))
    for (const f of findings) {
      if (f.Status === 'OK') console.log(`  [OK]              ${f.Field}`)
      else if (f.Status === 'MISSING') console.log(`  [BELUM TERDAFTAR] ${f.Field}`)
      else if (f.Status === 'ORPHAN') console.log(`  [YATIM]           ${f.Field} ${f.Found}`)
    }
    console.log('-'.repeat(64))
    console.log(bad.length === 0 ? 'BERSIH: registry cocok dengan isi docs/.' : `${bad.length} ketidakcocokan registry - perbarui architecture_auto.md.`)
  }
  return { Present: true, Ok: bad.length === 0, Findings: findings, MismatchCount: bad.length }
}

// ============================================================================
// PENULIS BOOTSTRAP - tulis kartu identitas project KALAU belum ada (idempoten).
// Port dari project-manifest.ps1 (Get-LintasDerivedStack + Get-LintasManifestStarterContent +
// Write-LintasProjectManifestIfMissing). BEDA DISENGAJA (owner 2026-06-22): pemasang Node menulis
// format BARU .jsonc (sesuai pembaca di atas + ADR-003a), BUKAN .psd1 seperti PS. Stack di-derive
// dari package.json; intent='pending' (AI isi sesi pertama). UTF-8 NO-BOM (default Node).
// ============================================================================

// Framework dikenal -> nama ringkas. Cocok via substring nama dep (case-insensitive, cermin PS -like).
// Urutan = urutan deteksi (next sebelum react: app Next.js -> ['next','react']). Cermin known-list PS.
const KNOWN_FRAMEWORKS = [
  { token: 'next', name: 'next' },
  { token: 'nuxt', name: 'nuxt' },
  { token: '@angular/core', name: 'angular' },
  { token: 'svelte', name: 'svelte' },
  { token: 'vue', name: 'vue' },
  { token: 'react', name: 'react' },
  { token: '@nestjs/core', name: 'nestjs' },
  { token: 'express', name: 'express' },
  { token: 'fastify', name: 'fastify' },
  { token: 'prisma', name: 'prisma' },
  { token: 'drizzle-orm', name: 'drizzle' },
]

// Derive { type, package_manager, frameworks } dari package.json (cermin Get-LintasDerivedStack).
// Tanpa package.json -> type 'unknown', pm null, frameworks []. pm = lockfile pertama yang ADA
// (urutan LOCKFILES: pnpm, npm, yarn, bun - cermin $script:LintasLockfiles project-manifest.ps1:66).
export function getLintasDerivedStack(repoRoot) {
  const pkgPath = path.join(repoRoot, 'package.json')
  if (!fs.existsSync(pkgPath)) return { type: 'unknown', package_manager: null, frameworks: [] }
  const deps = getLintasPackageJsonDependency(repoRoot)
  let pm = null
  for (const k of Object.keys(LOCKFILES)) {
    if (fs.existsSync(path.join(repoRoot, LOCKFILES[k]))) { pm = k; break }
  }
  const fw = []
  for (const entry of KNOWN_FRAMEWORKS) {
    const tok = entry.token.toLowerCase()
    if (deps.some((d) => String(d).toLowerCase().includes(tok)) && !fw.includes(entry.name)) fw.push(entry.name)
  }
  return { type: 'node', package_manager: pm, frameworks: fw }
}

// getLintasDerivedEnvironment: CAP LINGKUNGAN saat pasang = versi runtime AKTUAL (pembanding dev vs client).
// Dipakai env-check (kit doctor --env) untuk menunjuk sumber-beda: "kit disetel di Node 20, kamu Node 16".
// BEBAS-RAHASIA: hanya versi Node + platform (BUKAN hostname/username/path) -- selaras getLintasDerivedStack.
// Di-generate dari process.version AKTUAL (bukan ditulis tangan) -> anti "no quote no claim". Major di-parse
// inline (regex sederhana) DENGAN SENGAJA, supaya project-manifest tak meng-import env-check (cegah lingkar-impor).
export function getLintasDerivedEnvironment() {
  const v = process.version // mis. "v24.15.0"
  const m = String(v).match(/(\d+)/)
  return { recorded_node: v, recorded_node_major: m ? Number(m[1]) : null, recorded_os: process.platform }
}

// Escape minimal nilai -> string JSON aman (pakai JSON.stringify; cukup untuk nilai stack/refs).
function jsonStr(s) { return JSON.stringify(String(s)) }

// Bangun TEKS .jsonc starter (lahir terisi + ber-komentar // ). refs = objek path-ref yang ADA.
// Hasil WAJIB bisa dibaca readLintasConfig (komentar // + JSON.parse) - dijaga tes round-trip.
export function getLintasManifestStarterContentJsonc({ stack, refs = {}, environment = null }) {
  const pmText = stack.package_manager ? jsonStr(stack.package_manager) : 'null'
  const fwText = (stack.frameworks && stack.frameworks.length)
    ? '[' + stack.frameworks.map((f) => jsonStr(f)).join(', ') + ']'
    : '[]'
  // Entri refs: kit_version SELALU (pertama), lalu architecture/glossary/registry yang ada.
  const refLines = ['    ' + jsonStr('kit_version') + ': ' + jsonStr('.claude-kit/.install-manifest.json#metadata.kit_version')]
  for (const k of ['architecture', 'glossary', 'registry']) {
    if (refs[k]) refLines.push('    ' + jsonStr(k) + ': ' + jsonStr(refs[k]))
  }
  // CAP LINGKUNGAN (opsional): kalau environment null -> blok TAK ditulis (keluaran identik versi lama -> tes
  // round-trip lama tetap lulus). writeLintasProjectManifestIfMissing SELALU mengisinya dari versi aktual.
  const envLines = environment ? [
    '  // CAP LINGKUNGAN: versi runtime saat kit dipasang (pembanding dev vs client). Auto-rekam, jangan edit tangan.',
    '  ' + jsonStr('environment') + ': {',
    '    ' + jsonStr('recorded_node') + ': ' + jsonStr(environment.recorded_node) + ',',
    '    ' + jsonStr('recorded_node_major') + ': ' + (environment.recorded_node_major == null ? 'null' : String(environment.recorded_node_major)) + ',',
    '    ' + jsonStr('recorded_os') + ': ' + jsonStr(environment.recorded_os) + ',',
    '    ' + jsonStr('_derived_from') + ': ' + jsonStr('process.version saat pasang'),
    '  },',
    '',
  ] : []
  const lines = [
    '{',
    '  // project.lintas.jsonc - KARTU IDENTITAS PROJECT (di-generate saat pasang lintasAI)',
    '  // Sumber-tunggal mesin-baca: AI baca 1 tempat (tak meraba tiap sesi). Dijaga robot anti-basi.',
    '  // Kolom stack diisi OTOMATIS dari package.json; intent diisi AI di sesi pertama.',
    '',
    '  ' + jsonStr('schema_version') + ': 1,',
    '',
    "  // DEKLARASI: tujuan project (AI isi sesi pertama - ganti 'pending').",
    '  ' + jsonStr('intent') + ': {',
    '    ' + jsonStr('purpose') + ': ' + jsonStr('pending') + ',',
    '    ' + jsonStr('domain') + ': ' + jsonStr('pending'),
    '  },',
    '',
    '  // DERIVE: diisi otomatis dari package.json. Robot cek masih cocok (DeriveMatch).',
    '  ' + jsonStr('stack') + ': {',
    '    ' + jsonStr('type') + ': ' + jsonStr(stack.type) + ',',
    '    ' + jsonStr('package_manager') + ': ' + pmText + ',',
    '    ' + jsonStr('frameworks') + ': ' + fwText + ',',
    '    ' + jsonStr('_derived_from') + ': ' + jsonStr('package.json'),
    '  },',
    '',
    ...envLines,
    '  // RUJUK: pointer ke sumber lain - JANGAN salin nilainya.',
    '  ' + jsonStr('refs') + ': {',
    refLines.join(',\n'),
    '  },',
    '',
    '  // DEKLARASI inti: peta modul -> lokasi (AI isi saat tahu struktur). Robot cek path ADA.',
    '  ' + jsonStr('modules') + ': [],',
    '',
    '  // DEKLARASI: konvensi mesin-relevan singkat (AI/tim isi).',
    '  ' + jsonStr('conventions') + ': [],',
    '',
    '  // (multi-repo, opsional) - CATATAN niat, BUKAN keamanan (akses nyata di GitHub+CODEOWNERS).',
    '  ' + jsonStr('split') + ': {',
    '    ' + jsonStr('role') + ': null,',
    '    ' + jsonStr('access_tier') + ': null,',
    '    ' + jsonStr('base_name') + ': null,',
    '    ' + jsonStr('portfolio_ref') + ': null',
    '  }',
    '}',
  ]
  return lines.join('\n') + '\n'
}

// Tulis project.lintas.jsonc di akar repoRoot KALAU belum ada (idempoten). force=timpa.
// Return { Written, Path, Reason } (Reason: 'created'|'exists'|'whatif'). UTF-8 NO-BOM.
// Cermin Write-LintasProjectManifestIfMissing (PS), tapi tulis .jsonc (bukan .psd1).
export function writeLintasProjectManifestIfMissing(repoRoot, { force = false, dryRun = false } = {}) {
  const p = resolveLintasManifestPath(repoRoot)
  if (fs.existsSync(p) && !force) return { Written: false, Path: p, Reason: 'exists' }
  const stack = getLintasDerivedStack(repoRoot)
  const refs = {}
  const refCandidates = [
    { key: 'architecture', file: 'docs/architecture.md' },
    { key: 'glossary', file: 'docs/glossary.md' },
    { key: 'registry', file: 'docs/architecture_auto.md' },
  ]
  for (const rc of refCandidates) {
    if (fs.existsSync(path.join(repoRoot, rc.file))) refs[rc.key] = rc.file
  }
  const environment = getLintasDerivedEnvironment() // cap lingkungan dari versi runtime aktual saat pasang
  const content = getLintasManifestStarterContentJsonc({ stack, refs, environment })
  if (dryRun) return { Written: false, Path: p, Reason: 'whatif' }
  fs.writeFileSync(p, content, 'utf8') // Node default = UTF-8 no-BOM
  return { Written: true, Path: p, Reason: 'created' }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = process.argv.slice(2)
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 && i + 1 < args.length ? args[i + 1] : null }
  const repoRoot = get('--repo-root') || process.cwd()
  const quiet = args.includes('--quiet')
  // --registry = jalankan robot REGISTRY (architecture_auto.md) alih-alih cek kartu identitas.
  const r = args.includes('--registry')
    ? invokeLintasRegistryCheck(repoRoot, { quiet })
    : invokeLintasManifestCheck(repoRoot, { manifestPath: get('--manifest-path'), quiet })
  // exit = jumlah ketidakcocokan (0 = cocok). process.exitCode (bukan process.exit) supaya stdout
  // selesai di-flush saat di-pipa (cermin pola aman lib/risk-gate.js).
  process.exitCode = r.MismatchCount
}
