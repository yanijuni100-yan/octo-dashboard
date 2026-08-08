#!/usr/bin/env node
// lib/unicode-safety-check.mjs - "Robot pemindai huruf-tipuan" versi Node (deterministik, ~0 token).
//
// MIGRASI grup [A] (ADR-003 / docs/plans/keputusan-per-elemen-node-vs-ps.md): port Node dari
// lib/unicode-safety-check.ps1. Pola Strangler Fig = BERDAMPINGAN: versi .ps1 TETAP hidup
// (dot-source oleh tes Pester + gerbang PS); versi .mjs ini dipakai via dispatcher Node
// (`lintasai unicode-check`) + diuji `node --test`. Output WAJIB identik dgn versi PS
// (terbukti uji-banding 6/6 + gerbang repo bersih).
//
// Kenapa Node pas di sini (kriteria profil tim): logika MURNI (iterasi codepoint, 0 System API),
// C4 keamanan = deteksi deterministik (tak tergantung bahasa), dan Node baca berkas UTF-8 secara
// default -> menghapus kelas bug ANSI PS5.1 (CJK salah-alarm) tanpa flag khusus.
//
// Dijalankan: node lib/unicode-safety-check.mjs [--json] [--include-joiners] [--quiet] <path...>
//   exit code = jumlah temuan (0 = bersih), sama seperti versi PowerShell.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Kode-titik BERBAHAYA (identik dgn $script:LintasDangerousCp di versi PS). Tag block
// U+E0000-E007F ditangani via range di dangerousName(), bukan tabel ini.
const DANGEROUS = new Map([
  [0x200b, 'ZERO WIDTH SPACE'],
  [0x2060, 'WORD JOINER'],
  [0x2061, 'FUNCTION APPLICATION (tak terlihat)'],
  [0x2062, 'INVISIBLE TIMES'],
  [0x2063, 'INVISIBLE SEPARATOR'],
  [0x2064, 'INVISIBLE PLUS'],
  [0x00ad, 'SOFT HYPHEN'],
  [0x202a, 'LRE (bidi embedding)'],
  [0x202b, 'RLE (bidi embedding)'],
  [0x202c, 'PDF (bidi pop)'],
  [0x202d, 'LRO (bidi override)'],
  [0x202e, 'RLO (bidi override - Trojan Source)'],
  [0x2066, 'LRI (bidi isolate)'],
  [0x2067, 'RLI (bidi isolate)'],
  [0x2068, 'FSI (bidi isolate)'],
  [0x2069, 'PDI (bidi isolate pop)'],
])
// Penyambung SAH (default TIDAK ditandai; --include-joiners menyalakan).
const JOINERS = new Map([
  [0x200c, 'ZWNJ (zero width non-joiner)'],
  [0x200d, 'ZWJ (zero width joiner)'],
  [0x200e, 'LRM (left-to-right mark)'],
  [0x200f, 'RLM (right-to-left mark)'],
])

function dangerousName(cp, includeJoiners) {
  if (cp >= 0xe0000 && cp <= 0xe007f) return 'TAG BLOCK (instruksi tersembunyi yang dibaca AI)'
  if (DANGEROUS.has(cp)) return DANGEROUS.get(cp)
  if (includeJoiners && JOINERS.has(cp)) return JOINERS.get(cp)
  return null
}

function hex(cp) {
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')
}

// Tiruan Get-LintasUnicodeFinding: iterasi per code-unit UTF-16 + sadar surrogate-pair,
// agar nomor Col identik dgn versi PowerShell (yang juga indeks UTF-16).
export function getFindings(content, relPath = '<string>', includeJoiners = false) {
  const findings = []
  if (content == null || content.length === 0) return findings
  let bomStripped = false
  const lines = content.split('\n')
  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln]
    for (let i = 0; i < line.length; i++) {
      const ch = line.charCodeAt(i)
      let cp = ch
      let advance = 0
      if (ch >= 0xd800 && ch <= 0xdbff && i + 1 < line.length) {
        const lo = line.charCodeAt(i + 1)
        if (lo >= 0xdc00 && lo <= 0xdfff) {
          cp = (ch - 0xd800) * 0x400 + (lo - 0xdc00) + 0x10000
          advance = 1
        }
      }
      if (cp === 0xfeff) {
        // BOM di paling awal berkas = sah (lewati sekali); selain itu = mencurigakan.
        if (ln === 0 && i === 0 && !bomStripped) {
          bomStripped = true
          i += advance
          continue
        }
        findings.push({ File: relPath, Line: ln + 1, Col: i + 1, CodePoint: cp, Hex: hex(cp), Name: 'BOM/ZWNBSP di tengah berkas' })
        i += advance
        continue
      }
      const name = dangerousName(cp, includeJoiners)
      if (name) findings.push({ File: relPath, Line: ln + 1, Col: i + 1, CodePoint: cp, Hex: hex(cp), Name: name })
      i += advance
    }
  }
  return findings
}

const EXTS = new Set(['.md', '.ps1', '.psm1', '.psd1', '.yml', '.yaml', '.json', '.js', '.mjs', '.txt', '.sh', '.template'])
const SKIP = ['\\.git\\', '\\node_modules\\', '\\.backup-', '\\.claude-kit\\']

export function listTextFiles(root) {
  const out = []
  const walk = (dir) => {
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      // Cocokkan fragmen-skip CASE-INSENSITIVE -> cermin PS `$full -like "*$frag*"` (PS -like tak
      // peka huruf-besar-kecil). Tanpa lower-case, folder 'Node_Modules'/'.GIT' tak ke-skip di Node
      // (scan lebih banyak dari PS = divergensi). SKIP semua huruf-kecil; cukup lower-case norm.
      const normLower = full.replace(/\//g, '\\').toLowerCase()
      if (SKIP.some((frag) => normLower.includes(frag))) continue
      if (e.isDirectory()) walk(full)
      else if (EXTS.has(path.extname(e.name).toLowerCase())) out.push(full)
    }
  }
  walk(root)
  return out
}

export function scan(paths, includeJoiners = false) {
  const targets = []
  for (const p of paths) {
    try {
      const st = fs.statSync(p)
      if (st.isDirectory()) targets.push(...listTextFiles(p))
      else targets.push(p)
    } catch { /* lewati path tak ada */ }
  }
  const all = []
  for (const f of targets) {
    let content
    try { content = fs.readFileSync(f, 'utf8') } catch { continue } // Node default UTF-8 (tak ada kuirk ANSI PS5.1)
    all.push(...getFindings(content, f, includeJoiners))
  }
  return all
}

function main() {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const includeJoiners = args.includes('--include-joiners')
  const quiet = args.includes('--quiet')
  const paths = args.filter((a) => !a.startsWith('--'))
  const all = scan(paths.length ? paths : [process.cwd()], includeJoiners)
  if (json) {
    process.stdout.write(JSON.stringify(all, null, 2))
  } else if (!quiet) {
    if (all.length === 0) console.log('BERSIH: tidak ada karakter Unicode berbahaya ditemukan.')
    else for (const x of all) console.log(`  [BAHAYA] ${x.File}:${x.Line}:${x.Col}  ${x.Hex}  ${x.Name}`)
  }
  // exit = jumlah temuan (0 = bersih untuk gerbang). Pakai process.exitCode (BUKAN process.exit)
  // supaya tulisan --json yang besar (process.stdout.write di atas) selesai di-flush dulu saat
  // di-pipa -> hindari "output kepotong" (cermin pola aman lib/risk-gate.js). Node keluar natural
  // dgn kode ini setelah stdout drain.
  process.exitCode = all.length
}

// Deteksi "program utama" yang TAHAN-WINDOWS (file:// di Windows = file:///D:/...).
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
