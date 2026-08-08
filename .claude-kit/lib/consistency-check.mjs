#!/usr/bin/env node
// lib/consistency-check.mjs - "Robot pemeriksa kecocokan" lintas-berkas, MODE PROJECT (port Node).
//
// FASE 3 Langkah 2 (ADR-003 / migrasi .psd1 -> JSON, BERTAHAP + BERDAMPINGAN): port HANYA bagian
// PEMERIKSA MODE PROJECT (cuma-baca) dari consistency-check.ps1, supaya project staff bisa
// menjalankan robot konsistensi via Node sambil membaca peta `.jsonc` (bukan `.psd1`).
//
// MODE KIT ($KitVersionChecks/$KitFacts + hitung blok $teamFiles) = pemeriksa internal kit.
//   GELOMBANG 3 (2026-06-22): bagian PEMERIKSA (cuma-baca) kini DIPORT ke Node di berkas ini
//   (lihat bagian "MODE KIT" di bawah), lulus uji-banding DETERMINISTIK PS==Node di repo nyata.
//
// PORT Node (migrasi PS->Node 2026-06-25, owner-gated): Penulis cap-versi (invokeLintasVersionBump dkk)
//   KINI ada di berkas INI (lihat bagian "MODE CAP VERSI" di bawah) - dipanggil kit.mjs case 'bump'.
//   Cadangan PowerShell (Invoke-LintasVersionBump di consistency-check.ps1 + kit.ps1 bump) TETAP ada.
// Versi .ps1 TETAP HIDUP penuh (gerbang + bump) sebagai cadangan. Berdampingan, bukan pengganti.
//
// KEHATI-HATIAN KIT (case-sensitivity, sumber bug parity tersering):
//  - Pemeriksa versi pakai PS `-match` (CASE-INSENSITIVE) -> compileRx (flag i).
//  - Buku FAKTA pakai PS `[regex]::Matches(...)` yang default CASE-SENSITIVE (BEDA dari -match!)
//    -> compileRxGlobalCS (TANPA flag i, DENGAN flag g untuk ambil semua kemunculan).
//
// KEHATI-HATIAN port (diperkuat lewat cek-silang skeptis multi-agen 2026-06-21):
//  - PS `-match` = CASE-INSENSITIVE -> regex Pattern diberi flag `i`. DAN PS `-eq` (banding nilai)
//    JUGA case-insensitive -> banding declared==canonical pakai toLowerCase (bukan === murni).
//  - Pemecah baris cermin PS Get-Content (pisah \r\n, \r-tunggal Mac-lama, \n) - `/\r?\n/` saja
//    tak memisah \r-tunggal -> jendela HeaderLines bisa beda dari PS.
//  - Pola regex khas .NET (opsi inline (?i), posesif \d++, named-group (?'x')) DITOLAK JS RegExp ->
//    beri pesan JELAS, bukan crash "Invalid group".
//  - BOM di-strip seperti [IO.File]::ReadAllText (UTF-8) PowerShell.
//  - BEDA YANG DITERIMA (didokumentasikan): dialek `\d`/`\w` = ASCII di JS, Unicode-Nd/word di .NET.
//    Untuk nilai versi (digit ASCII) TAK ada divergensi praktis; project i18n dengan digit non-ASCII
//    bisa beda - itu batas wajar port (reimplementasi mesin regex .NET di JS tidak sepadan).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readLintasConfig } from './config-loader.mjs'
import { getKitVersionFromChangelog } from './version-detect.mjs'
import { stripBom } from './fs-text.mjs'

function readText(p) {
  return stripBom(fs.readFileSync(p, 'utf8')) // cermin ReadAllText UTF-8 (buang BOM)
}

// Pisah baris cermin PS Get-Content (PS 5.1): pecah \r\n, \r-tunggal (Mac lama), DAN \n.
function splitLines(s) { return s.split(/\r\n|\r|\n/) }

// Kompilasi regex Pattern (flag `i` = cermin PS -match). Pola config staff bisa pakai fitur khas
// .NET yang JS TOLAK -> pesan JELAS + actionable, bukan crash "Invalid group" yang membingungkan.
function compileRx(pattern, label) {
  try {
    return new RegExp(pattern, 'i')
  } catch (e) {
    throw new Error(`consistency-check: pola regex untuk '${label}' tidak didukung di versi Node - pakai sintaks regex JavaScript standar (hindari opsi inline (?i)/(?m), kuantifier posesif seperti \\d++, named-group gaya (?'nama'); di .jsonc tulis backslash ganda \\\\d). Detail: ${e.message}`)
  }
}

// Ambil nilai acuan dari sumber kebenaran. Source = { File, JsonField } ATAU { File, Pattern }.
export function getLintasCanonicalVersion(repoRoot, source) {
  const p = path.join(repoRoot, source.File)
  if (!fs.existsSync(p)) throw new Error(`Sumber kebenaran '${source.File}' tidak ditemukan di ${repoRoot} - tak ada acuan.`)
  const raw = readText(p)
  if (source.JsonField) {
    const obj = JSON.parse(raw)
    const val = obj[source.JsonField]
    if (!val) throw new Error(`Field '${source.JsonField}' tidak ada di ${source.File}.`)
    return String(val)
  }
  if (source.Pattern) {
    const m = raw.match(compileRx(source.Pattern, source.File))
    if (m) return m[1]
    throw new Error(`Pola acuan tidak cocok di ${source.File}.`)
  }
  throw new Error("Source harus punya 'JsonField' atau 'Pattern'.")
}

// Ekstrak nilai yang dideklarasikan satu berkas. Return string nilai atau null kalau tak ketemu.
export function getLintasDeclaredVersion(repoRoot, check) {
  const p = path.join(repoRoot, check.File)
  if (!fs.existsSync(p)) return null
  if (check.UseChangelogParser) {
    const v = getKitVersionFromChangelog(p)
    return v ? v.replace(/^v/, '') : null
  }
  let content
  if (check.HeaderLines) content = splitLines(readText(p)).slice(0, check.HeaderLines).join('\n')
  else content = readText(p)
  const m = content.match(compileRx(check.Pattern, check.File))
  return m ? m[1] : null
}

// Kumpulkan temuan per berkas -> [{ File, Label, Expected, Found, Status }].
export function getLintasVersionFinding(repoRoot, checks, canonical) {
  return checks.map((check) => {
    const declared = getLintasDeclaredVersion(repoRoot, check)
    let status
    if (declared == null) status = 'MISSING'
    // PS `-eq` = case-insensitive -> banding pakai toLowerCase (bukan === murni). Tanpa ini,
    // nilai yang beda HANYA huruf besar/kecil (hash commit, tag, env) salah-vonis MISMATCH.
    else if (String(declared).toLowerCase() === String(canonical).toLowerCase()) status = 'OK'
    else status = 'MISMATCH'
    return { File: check.File, Label: check.Label, Expected: canonical, Found: declared, Status: status }
  })
}

// MODE PROJECT: baca peta .jsonc (Source + Checks) -> jalankan pemeriksaan + ringkasan.
export function invokeLintasConsistencyCheckProject(repoRoot, checksFile, { quiet = false } = {}) {
  const map = readLintasConfig(checksFile)
  if (!Object.prototype.hasOwnProperty.call(map, 'Checks')) throw new Error(`Peta-konsistensi '${checksFile}' tidak punya kunci 'Checks'.`)
  if (!Array.isArray(map.Checks) || map.Checks.length === 0) throw new Error(`Peta-konsistensi '${checksFile}' punya kunci 'Checks' tapi kosong.`)
  const source = map.Source || { File: 'package.json', JsonField: 'version' }
  const canonical = getLintasCanonicalVersion(repoRoot, source)
  const findings = getLintasVersionFinding(repoRoot, map.Checks, canonical)
  const bad = findings.filter((f) => f.Status !== 'OK')

  if (!quiet) {
    console.log('\nRobot pemeriksa kecocokan versi lintasAI (MODE PROJECT, Node)')
    console.log(`Sumber kebenaran: v${canonical}`)
    console.log('-'.repeat(60))
    for (const f of findings) {
      if (f.Status === 'OK') console.log(`  [OK]        ${f.File}  v${f.Found}`)
      else if (f.Status === 'MISMATCH') console.log(`  [TAK COCOK] ${f.File}  v${f.Found}  -> HARUS v${f.Expected}`)
      else console.log(`  [HILANG]    ${f.File}  baris versi tidak ditemukan (${f.Label})`)
    }
    console.log('-'.repeat(60))
    console.log(bad.length === 0 ? `BERSIH: semua ${findings.length} berkas cocok di v${canonical}.` : `${bad.length} berkas TIDAK cocok - perbaiki sebelum rilis.`)
  }
  return { CanonicalVersion: canonical, Findings: findings, MismatchCount: bad.length }
}

// ============================================================================
// MODE KIT (port Gelombang 3, 2026-06-22) - pemeriksa internal kit lintasAI.
// Cermin $KitVersionChecks + $KitFacts + Get-LintasFactFinding di consistency-check.ps1.
// CUMA-BACA (cek). Penulis cap-versi (invokeLintasVersionBump) DIPORT ke Node 2026-06-25 - lihat "MODE CAP VERSI" di bawah.
// ============================================================================

// Daftar deklarasi "versi-saat-ini" milik KIT. Pattern = regex 1 capture group untuk nilai.
// HeaderLines: cari hanya di N baris pertama (hindari salah-tangkap penanda sejarah versi
// di badan berkas). UseChangelogParser: pakai parser CHANGELOG format-agnostic.
export const KIT_VERSION_CHECKS = [
  { File: 'CHANGELOG.md', Label: 'Entri teratas CHANGELOG', UseChangelogParser: true },
  { File: 'CLAUDE_universal_v1.md', Label: 'Judul aturan (auto-baca tiap sesi staff)', Pattern: 'Versi\\s+(\\d+\\.\\d+\\.\\d+)', HeaderLines: 10 },
  { File: 'README.md', Label: 'Baris "Versi stabil sekarang"', Pattern: 'Versi stabil sekarang:\\s*\\*\\*v(\\d+\\.\\d+\\.\\d+)\\*\\*' },
  { File: 'KEUNGGULAN_LINTASAI.md', Label: 'Baris "Terakhir diselaraskan"', Pattern: 'Terakhir diselaraskan:\\s*\\*\\*v(\\d+\\.\\d+\\.\\d+)' },
  { File: 'templates/INDEX.md', Label: 'Judul Index dokumen', Pattern: 'Daftar Lengkap Dokumen lintasAI v(\\d+\\.\\d+\\.\\d+)' },
]

// Sumber kebenaran versi KIT = field 'version' di package.json.
export const KIT_SOURCE = { File: 'package.json', JsonField: 'version' }

// Sumber 'jumlah file tim' didefinisikan SEKALI (anti-DRY); tiap fakta cuma beda Filter.
// Kind 'CountInBlock' = hitung baris ber-Entry di antara baris BlockStart..BlockEnd.
// EXPORT (bukan const lokal) supaya tes paritas (tests/consistency-parity.Tests.ps1) bisa
// membandingkan nilai ini vs $KitTeamFilesSource di consistency-check.ps1 -> simetri penuh PS<->Node.
export const KIT_TEAM_FILES_SOURCE = { Kind: 'CountInBlock', File: 'setup-pola-b.ps1', BlockStart: '\\$teamFiles\\s*=\\s*@\\(', BlockEnd: '^\\s*\\)\\s*$', Entry: "Src\\s*=\\s*'templates" }

// Buku fakta: nilai-berulang NON-versi yang gampang drift (mis. "jumlah file tim").
// Beda dari versi: 1 dokumen boleh sebut angkanya >1x -> dicek SEMUA kemunculan.
export const KIT_FACTS = [
  { Name: 'file-tim-total', Label: 'Jumlah file tim (total)', Source: KIT_TEAM_FILES_SOURCE, Filter: null,
    Declarations: [{ File: 'README.md', Pattern: '(\\d+) file tim' }, { File: 'JALANKAN_KIT.md', Pattern: '(\\d+) file tim' }] },
  { Name: 'file-tim-github', Label: 'Jumlah file tim di .github', Source: KIT_TEAM_FILES_SOURCE, Filter: 'workflowsDir|scriptsDir|githubDir',
    Declarations: [{ File: 'JALANKAN_KIT.md', Pattern: '(\\d+) di \\.github' }] },
  { Name: 'file-tim-docs', Label: 'Jumlah file tim di docs', Source: KIT_TEAM_FILES_SOURCE, Filter: 'docsDir|decisionsDir',
    Declarations: [{ File: 'JALANKAN_KIT.md', Pattern: '(\\d+) di docs' }] },
]

// ---- Penjaga ISTILAH-PENSIUN (retired-term guard) ----
// Masalah yang dipecahkan: istilah/heading kanonik diganti (mis. "Multi-Divisi" -> "Tinjauan
// lintasAI Divisi"), tapi salinan lama nyangkut di berkas instruksi -> klien lihat istilah usang.
// Ini drift TEKS (bukan angka). Robot MENOLAK rilis kalau pola istilah-pensiun muncul di berkas
// instruksi HIDUP (root *.md + templates/*.md + 2 skrip pemasang), KECUALI di berkas sejarah
// (CHANGELOG, di ExcludeFiles). CASE-SENSITIVE (cermin .NET [regex]::Match default): "Multi-Divisi"
// (proper noun) ditangkap; "multi-divisi" (prosa umum, mis. "full multi-divisi") + "Multi-Divisional"
// (sebutan peran) TIDAK. EXPORT supaya tes paritas (via tests/dump-kit-consistency.mjs) bisa
// membandingkan daftar ini vs $script:KitRetiredTerms di consistency-check.ps1 (anti drift-senyap).
export const KIT_RETIRED_TERMS = [
  {
    Name: 'heading-tinjauan-divisi',
    Label: 'Istilah lama blok review (bagian 4.1)',
    Pattern: 'Multi-Divisi(?!onal)', // (?!onal) = izinkan "Multi-Divisional Engineer" (sebutan peran)
    Replacement: 'Tinjauan lintasAI Divisi',
    ExcludeFiles: ['CHANGELOG.md'], // sejarah - boleh menyimpan istilah lama
  },
]

// Cakupan pindai: berkas instruksi HIDUP yang dikirim/di-load sebagai aturan. Dir NON-rekursif.
// (docs/ + docs/plans/ SENGAJA di luar cakupan: berisi laporan bertanggal = sejarah, seperti CHANGELOG.)
export const KIT_RETIRED_SCAN = { Dirs: ['.', 'templates'], Extensions: ['.md'], ExtraFiles: ['setup-pola-b.ps1', 'setup-pola-b.mjs'] }

// Enumerasi berkas yang dipindai (relatif, garis-miring-maju supaya identik PS<->Node).
function getLintasScanFiles(repoRoot, scan) {
  const set = new Set()
  for (const dir of scan.Dirs) {
    const full = dir === '.' ? repoRoot : path.join(repoRoot, dir)
    if (!fs.existsSync(full)) continue
    let entries
    try { entries = fs.readdirSync(full, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      if (!e.isFile()) continue
      if (!scan.Extensions.some((ext) => e.name.endsWith(ext))) continue
      set.add(dir === '.' ? e.name : `${dir}/${e.name}`)
    }
  }
  for (const extra of scan.ExtraFiles) {
    if (fs.existsSync(path.join(repoRoot, extra))) set.add(extra)
  }
  return [...set].sort()
}

// Temuan istilah-pensiun: 1 temuan per (term, berkas, baris) yang melanggar. CASE-SENSITIVE.
// Return [] kalau bersih. Cermin Get-LintasRetiredFinding (consistency-check.ps1).
export function getLintasRetiredFinding(repoRoot, terms = KIT_RETIRED_TERMS, scan = KIT_RETIRED_SCAN) {
  const files = getLintasScanFiles(repoRoot, scan)
  const findings = []
  for (const term of terms) {
    // tanpa flag 'i' = CASE-SENSITIVE (cermin .NET [regex]::Match default). Lookahead (?!...) didukung JS + .NET.
    let rx
    try { rx = new RegExp(term.Pattern) } catch (e) {
      throw new Error(`consistency-check (istilah-pensiun): pola '${term.Name}' tak didukung di Node: ${e.message}`)
    }
    const exclude = new Set(term.ExcludeFiles || [])
    for (const rel of files) {
      if (exclude.has(rel)) continue
      const lines = splitLines(readText(path.join(repoRoot, rel)))
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(rx) // rx tanpa flag 'g' -> stateless, aman dipakai ulang lintas-baris
        if (m) findings.push({ Term: term.Name, File: rel, Line: i + 1, Label: term.Label, Expected: term.Replacement, Found: m[0], Status: 'TERLARANG' })
      }
    }
  }
  return findings
}

// Kompilasi regex GLOBAL + CASE-SENSITIVE - cermin [regex]::Matches(...) PowerShell yang default
// case-SENSITIVE (BEDA dari operator -match yang case-insensitive). Flag g WAJIB untuk matchAll.
function compileRxGlobalCS(pattern, label) {
  try {
    return new RegExp(pattern, 'g')
  } catch (e) {
    throw new Error(`consistency-check (fakta): pola regex untuk '${label}' tidak didukung di Node - pakai sintaks regex JavaScript standar. Detail: ${e.message}`)
  }
}

// Hitung baris cocok 'Entry' di antara baris cocok 'BlockStart' dan 'BlockEnd' (Kind=CountInBlock).
// Filter (opsional): hanya hitung baris yang JUGA cocok Filter. Cermin Get-LintasCountFromBlock.
// $line -match (PS) = CASE-INSENSITIVE -> compileRx (flag i). .test() tanpa flag g = stateless (aman).
export function getLintasCountFromBlock(repoRoot, source, filter) {
  const p = path.join(repoRoot, source.File)
  if (!fs.existsSync(p)) throw new Error(`Sumber fakta '${source.File}' tidak ditemukan di ${repoRoot}.`)
  const lines = splitLines(readText(p))
  const startRx = compileRx(source.BlockStart, `${source.File} (BlockStart)`)
  const endRx = compileRx(source.BlockEnd, `${source.File} (BlockEnd)`)
  const entryRx = compileRx(source.Entry, `${source.File} (Entry)`)
  const filterRx = filter ? compileRx(filter, `${source.File} (Filter)`) : null
  let inBlock = false
  let count = 0
  for (const line of lines) {
    if (!inBlock) {
      if (startRx.test(line)) inBlock = true
      continue
    }
    if (endRx.test(line)) break
    if (entryRx.test(line)) {
      if (!filterRx || filterRx.test(line)) count++
    }
  }
  return count
}

// Ambil SEMUA angka yang ditulis satu berkas untuk sebuah pola. Cermin Get-LintasDeclaredNumber.
// Return: null kalau berkas tak ada; [] kalau pola tak ketemu; else array string angka.
// PENTING: pakai compileRxGlobalCS (CASE-SENSITIVE) - cermin [regex]::Matches, BUKAN compileRx (flag i).
export function getLintasDeclaredNumber(repoRoot, declaration) {
  const p = path.join(repoRoot, declaration.File)
  if (!fs.existsSync(p)) return null
  const content = readText(p)
  const rx = compileRxGlobalCS(declaration.Pattern, declaration.File)
  return [...content.matchAll(rx)].map((m) => m[1])
}

// Temuan buku fakta (MODE KIT). Fakta yang sumbernya TAK ADA dilewati (repo tiruan di tes).
// Cermin Get-LintasFactFinding: 1 temuan per Declaration (fakta 'total' punya 2 Declarations -> 2 temuan).
export function getLintasFactFinding(repoRoot, facts = KIT_FACTS) {
  const findings = []
  for (const fact of facts) {
    const srcPath = path.join(repoRoot, fact.Source.File)
    if (!fs.existsSync(srcPath)) continue // sumber tak ada -> lewati (tidak melempar, supaya tes lain aman)
    const canonical = String(getLintasCountFromBlock(repoRoot, fact.Source, fact.Filter))
    for (const decl of fact.Declarations) {
      const declared = getLintasDeclaredNumber(repoRoot, decl)
      let status
      let found
      if (declared == null) { status = 'MISSING'; found = '(berkas tak ada)' }
      else if (declared.length === 0) { status = 'MISSING'; found = '(angka tak ketemu)' }
      else {
        const wrong = declared.filter((d) => String(d) !== canonical)
        if (wrong.length > 0) { status = 'MISMATCH'; found = declared.join(',') }
        else { status = 'OK'; found = canonical }
      }
      findings.push({ Fact: fact.Name, File: decl.File, Label: fact.Label, Expected: canonical, Found: found, Status: status })
    }
  }
  return findings
}

// MODE KIT: cek versi (5 deklarasi vs package.json) + buku fakta (nilai-berulang non-versi).
// Cermin Invoke-LintasConsistencyCheck cabang KIT. Return shape SAMA dgn PS (+ FactFindings).
export function invokeLintasConsistencyCheckKit(repoRoot, { quiet = false } = {}) {
  const canonical = getLintasCanonicalVersion(repoRoot, KIT_SOURCE)
  const findings = getLintasVersionFinding(repoRoot, KIT_VERSION_CHECKS, canonical)
  const factFindings = getLintasFactFinding(repoRoot, KIT_FACTS)
  const retiredFindings = getLintasRetiredFinding(repoRoot) // istilah-pensiun bocor (drift TEKS) = pelanggaran
  const bad = findings.filter((f) => f.Status !== 'OK')
  const badFacts = factFindings.filter((f) => f.Status !== 'OK')

  if (!quiet) {
    console.log('\nRobot pemeriksa kecocokan versi lintasAI (MODE KIT, Node)')
    console.log(`Sumber kebenaran: v${canonical}`)
    console.log('-'.repeat(60))
    for (const f of findings) {
      if (f.Status === 'OK') console.log(`  [OK]        ${f.File}  v${f.Found}`)
      else if (f.Status === 'MISMATCH') console.log(`  [TAK COCOK] ${f.File}  v${f.Found}  -> HARUS v${f.Expected}`)
      else console.log(`  [HILANG]    ${f.File}  baris versi tidak ditemukan (${f.Label})`)
    }
    console.log('-'.repeat(60))
    console.log(bad.length === 0 ? `BERSIH: semua ${findings.length} berkas cocok di v${canonical}.` : `${bad.length} berkas TIDAK cocok - perbaiki sebelum rilis.`)

    if (factFindings.length > 0) {
      console.log('\nBuku fakta (nilai-berulang non-versi)')
      console.log('-'.repeat(60))
      for (const f of factFindings) {
        if (f.Status === 'OK') console.log(`  [OK]        ${f.File}  ${f.Label} = ${f.Found}`)
        else if (f.Status === 'MISMATCH') console.log(`  [TAK COCOK] ${f.File}  ${f.Label}: ${f.Found} -> HARUS ${f.Expected}`)
        else console.log(`  [HILANG]    ${f.File}  ${f.Label} ${f.Found}`)
      }
      console.log('-'.repeat(60))
      console.log(badFacts.length === 0 ? `BERSIH: semua ${factFindings.length} fakta cocok dengan sumbernya.` : `${badFacts.length} fakta TIDAK cocok - perbaiki sebelum rilis.`)
    }

    console.log('\nPenjaga istilah-pensiun (heading/SSOT)')
    console.log('-'.repeat(60))
    if (retiredFindings.length === 0) {
      console.log(`  [OK]        bersih - ${KIT_RETIRED_TERMS.length} istilah dijaga, 0 bocor di berkas instruksi.`)
    } else {
      for (const f of retiredFindings) console.log(`  [TERLARANG] ${f.File}:${f.Line}  '${f.Found}' -> pakai "${f.Expected}"`)
      console.log(`${retiredFindings.length} istilah-pensiun bocor - perbaiki sebelum rilis.`)
    }
  }

  return { CanonicalVersion: canonical, Findings: findings, FactFindings: factFindings, RetiredFindings: retiredFindings, MismatchCount: bad.length + badFacts.length + retiredFindings.length }
}

// ============================================================================
// MODE CAP VERSI (kit dev) - "tombol bump 1-langkah" (PORT Node dari consistency-check.ps1,
// migrasi PS->Node 2026-06-25, owner-gated). Cermin Invoke-LintasVersionBump dkk.
// WHY: nomor versi-saat-ini ditulis tangan di 6 tempat (package.json + 5 deklarasi KIT_VERSION_CHECKS).
// Naik versi = gampang lupa salah satu. Fungsi ini PAKAI ULANG KIT_VERSION_CHECKS (sumber tunggal
// lokasi versi) untuk MENULIS, bukan cuma cek. Hanya mengganti substring nomor versi (capture group 1)
// supaya format berkas + status BOM TIDAK ikut berubah -> diff bersih. CHANGELOG dapat kerangka entri
// baru (deskripsi ditulis manusia).
// ============================================================================

// Apakah berkas diawali BOM UTF-8 (EF BB BF)? Baca 3 byte pertama (cermin ReadAllBytes head di PS).
function fileHasBom(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r')
    try {
      const buf = Buffer.alloc(3)
      const n = fs.readSync(fd, buf, 0, 3, 0)
      return n >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF
    } finally { fs.closeSync(fd) }
  } catch { return false }
}

// Tulis ulang teks berkas dengan MEMPERTAHANKAN status BOM aslinya (anti diff palsu).
// `text` = isi TANPA BOM (sudah di-stripBom oleh pemanggil) - cermin Set-LintasFileTextPreservingBom PS.
function setFileTextPreservingBom(filePath, text) {
  if (fileHasBom(filePath)) {
    // Tulis BOM eksplisit (EF BB BF) lalu teks. Pakai byte mentah (bukan literal U+FEFF di source)
    // supaya kode bebas "spasi aneh" (ESLint no-irregular-whitespace) - hasil byte SAMA.
    fs.writeFileSync(filePath, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(text, 'utf8')]))
  } else {
    fs.writeFileSync(filePath, text, 'utf8')
  }
}

// Ganti HANYA substring "nilai" (capture group 1) pada kemunculan PERTAMA pola. CASE-SENSITIVE
// (cermin [regex]::Match PS yang default peka-huruf - BEDA dari pembaca yang pakai -match). Return
// true kalau berhasil ganti, false kalau berkas/pola/group tak ada.
export function setLintasDeclaredVersion(repoRoot, check, newVersion) {
  const p = path.join(repoRoot, check.File)
  if (!fs.existsSync(p)) return false
  const raw = readText(p) // ReadAllText UTF-8 (BOM dibuang untuk pencocokan)
  let rx
  try { rx = new RegExp(check.Pattern, 'd') } catch { return false } // 'd' = hasIndices (ambil posisi group 1)
  const m = rx.exec(raw)
  if (!m || !m.indices || !m.indices[1]) return false
  const [gStart, gEnd] = m.indices[1]
  const next = raw.slice(0, gStart) + newVersion + raw.slice(gEnd)
  setFileTextPreservingBom(p, next)
  return true
}

// Set field "version" di package.json LEWAT regex (BUKAN JSON.stringify) supaya indentasi + urutan
// field TIDAK ikut berubah. Ganti kemunculan pertama saja. Cermin Set-LintasPackageJsonVersion PS.
export function setLintasPackageJsonVersion(repoRoot, newVersion, file = 'package.json') {
  const p = path.join(repoRoot, file)
  if (!fs.existsSync(p)) return false
  const raw = readText(p)
  const rx = /("version"\s*:\s*")\d+\.\d+\.\d+(")/
  if (!rx.test(raw)) return false
  // Fungsi pengganti (bukan string $1) supaya angka versi tak salah-tafsir sebagai rujukan grup.
  const next = raw.replace(rx, (_m, g1, g2) => g1 + newVersion + g2)
  setFileTextPreservingBom(p, next)
  return true
}

// Tanggal lokal yyyy-MM-dd (cermin Get-Date -Format 'yyyy-MM-dd' PS).
function todayYmd() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// Sisipkan kerangka entri CHANGELOG baru DI ATAS entri teratas (sebelum '## [' pertama). Tidak
// menghapus apa pun. Idempoten: kalau entri teratas SUDAH versi ini -> skip. Cermin Add-LintasChangelogSkeleton PS.
export function addLintasChangelogSkeleton(repoRoot, newVersion, date, file = 'CHANGELOG.md') {
  const theDate = date || todayYmd()
  const p = path.join(repoRoot, file)
  if (!fs.existsSync(p)) return false
  const raw = readText(p)
  const m = raw.match(/^## \[(\d+\.\d+\.\d+)\]/m)
  if (!m) return false
  if (m[1] === newVersion) return false // idempoten: entri versi ini sudah ada
  const skeleton = `## [${newVersion}] - ${theDate}\n\n### <Diubah/Ditambah/Diperbaiki> - <ringkas apa yang berubah + manfaatnya>\n\n- <ISI deskripsi (untuk programmer + non-programmer). Ganti baris placeholder ini.>\n\n`
  const next = raw.slice(0, m.index) + skeleton + raw.slice(m.index)
  setFileTextPreservingBom(p, next)
  return true
}

// Bandingkan 2 versi semver "X.Y.Z". Return -1 (A<B) / 0 (sama) / 1 (A>B). Cermin Compare-LintasSemver PS.
export function compareLintasSemver(a, b) {
  const pa = String(a).split('.').map((x) => parseInt(x, 10))
  const pb = String(b).split('.').map((x) => parseInt(x, 10))
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1
    if (pa[i] > pb[i]) return 1
  }
  return 0
}

// Orkestrasi cap versi (1-langkah). Guard: cuma jalan kalau package.json name == 'lintasai' (repo kit)
// supaya tak salah jalan di project staf. Tolak format invalid + tolak DOWNGRADE. Cermin Invoke-LintasVersionBump PS.
export function invokeLintasVersionBump(repoRoot, newVersion, { date, quiet = false } = {}) {
  if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
    throw new Error(`Versi '${newVersion}' tidak valid. Format wajib BESAR.MENENGAH.KECIL (mis. 1.42.0).`)
  }
  const pkgPath = path.join(repoRoot, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`package.json tidak ada di ${repoRoot} - ini bukan repo kit; bump dibatalkan.`)
  }
  const pkg = JSON.parse(readText(pkgPath))
  if (pkg.name !== 'lintasai') {
    throw new Error(`Perintah 'bump' cuma untuk repo kit lintasAI (package.json name='lintasai'), bukan project staf. Dibatalkan (name='${pkg.name}').`)
  }
  const current = String(pkg.version || '')
  if (current && /^\d+\.\d+\.\d+$/.test(current)) {
    if (compareLintasSemver(newVersion, current) < 0) {
      throw new Error(`Versi baru ${newVersion} LEBIH RENDAH dari versi sekarang ${current} (downgrade). Dibatalkan - kalau memang sengaja, ganti manual.`)
    }
  }

  const stamped = []
  if (setLintasPackageJsonVersion(repoRoot, newVersion)) stamped.push('package.json')
  for (const check of KIT_VERSION_CHECKS) {
    if (check.UseChangelogParser) {
      if (addLintasChangelogSkeleton(repoRoot, newVersion, date)) stamped.push(`${check.File} (kerangka entri baru)`)
    } else if (check.Pattern) {
      if (setLintasDeclaredVersion(repoRoot, check, newVersion)) stamped.push(check.File)
    }
  }

  if (!quiet) {
    console.log('')
    console.log(`Cap versi: ${current} -> ${newVersion}`)
    for (const s of stamped) console.log(`  [stamped] ${s}`)
    console.log('')
  }

  return { OldVersion: current, NewVersion: newVersion, Stamped: stamped }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = process.argv.slice(2)
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 && i + 1 < args.length ? args[i + 1] : null }
  const checksFile = get('--checks-file')
  const quiet = args.includes('--quiet')
  try {
    let r
    if (checksFile) {
      // MODE PROJECT: peta .jsonc milik project staff. Default repoRoot = folder saat ini.
      const repoRoot = get('--repo-root') || process.cwd()
      r = invokeLintasConsistencyCheckProject(repoRoot, checksFile, { quiet })
    } else {
      // MODE KIT (tanpa --checks-file): self-check kit. Default repoRoot = induk lib/ (cermin PS
      // Resolve-Path lib/..), supaya gerbang kit + node:test memeriksa berkas kit yang benar.
      const repoRoot = get('--repo-root') || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
      r = invokeLintasConsistencyCheckKit(repoRoot, { quiet })
    }
    // exit = jumlah ketidakcocokan (0 = cocok). process.exitCode (bukan process.exit) supaya stdout
    // selesai di-flush saat di-pipa (cermin pola aman lib/risk-gate.js).
    process.exitCode = r.MismatchCount
  } catch (e) { console.error(e.message); process.exitCode = 1 }
}
