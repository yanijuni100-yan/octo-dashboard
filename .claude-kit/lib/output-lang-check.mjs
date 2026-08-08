#!/usr/bin/env node
// lib/output-lang-check.mjs - Robot penjaga bahasa: pastikan TULISAN kit ke staff tetap
// Bahasa Indonesia awam, bukan prosa Inggris. (ADR-004 #3 + docs/plans/migrasi-besar-node-program.md
// "Gate bahasa" yang minta robot pemeriksa-output deterministik dibangun lebih awal.)
//
// KENAPA: gelombang berikutnya memindah pemasang/penghapus/pembaru besar ke Node -- ribuan baris
// TULISAN ke staff. Aturan keras ADR-004 #3: SEMUA output (Node + shim PS) wajib Bahasa Indonesia
// awam. Tanpa pemeriksa otomatis, syarat itu cuma bergantung kewaspadaan AI (yang bisa lupa).
// Robot ini = jaring deterministik (~0 token, selaras CLAUDE_universal_v1 sec.6.3): scan string
// user-facing di .mjs/.cjs/.ps1, tandai PROSA INGGRIS, laporkan berkas:baris.
//
// PRESISI > CAKUPAN (anti alarm-palsu, sec.6.3 "pola tak-ambigu -> robot"): HANYA menandai string
// yang (a) memuat frasa-penghubung khas Inggris (bocoran AI-narasi yang didokumentasikan
// CLAUDE_universal_v1 sec.2.1), ATAU (b) >=2 kata-fungsi Inggris bersinyal-kuat DAN TANPA penanda
// Bahasa Indonesia. Kalimat Indonesia ber-istilah-teknis (mis. "Robot pemindai konfigurasi-AI")
// TIDAK ditandai. Token kode/perintah/path/URL dilewati saat menghitung kata.
//
// BATAS-JUJUR (v1): hanya memindai string pada BARIS yang memuat panggilan output ke-user
// (console.log/error/warn/info, process.stdout/stderr.write, Write-Host/Warning/Error/Output/
// Information). String yang dibangun ke variabel lalu di-log di baris lain bisa terlewat.
// Header/tagline CLI pendek (mis. "Usage:") TIDAK ditandai (bukan prosa) -- itu disengaja.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Kata-fungsi Inggris bersinyal-kuat: jarang berdiri-sendiri di output teknis Bahasa Indonesia.
// SENGAJA tidak memasukkan kata ambigu/lintas-bahasa (for/and/not/to/is/make/need) -> cegah alarm-palsu.
const EN_WORDS = new Set([
  'the', 'this', 'that', 'these', 'those', 'your', 'you', 'please', 'cannot', 'does',
  'doesnt', 'dont', 'wont', 'will', 'would', 'should', 'could', 'been', 'have', 'has',
  'had', 'with', 'from', 'about', 'before', 'after', 'when', 'where', 'which', 'what',
  'while', 'there', 'their', 'they', 'them', 'already', 'instead', 'because', 'however',
  'therefore', 'otherwise', 'following', 'unable', 'must', 'here', 'are', 'were', 'was', 'into',
])

// Penanda Bahasa Indonesia: kalau ADA salah satu -> string dianggap Indonesia -> dilewati.
// Inilah filter presisi utama: kalimat Indonesia ber-jargon-Inggris tak ikut ketandai.
const ID_MARKERS = new Set([
  'yang', 'dan', 'ke', 'di', 'dari', 'untuk', 'tidak', 'sudah', 'akan', 'ini', 'itu', 'aku',
  'kamu', 'kami', 'sebelum', 'atau', 'dengan', 'pada', 'saat', 'kalau', 'supaya', 'jadi', 'bisa',
  'harus', 'tak', 'ada', 'belum', 'juga', 'agar', 'lalu', 'masih', 'sini', 'situ', 'biar', 'dulu',
  'lewat', 'pakai', 'cek', 'berkas', 'daftar', 'perintah', 'jalankan', 'buka', 'simpan', 'hapus',
  'salinan', 'gagal', 'berhasil', 'tanpa', 'semua', 'tiap', 'setiap', 'sebuah', 'adalah',
  'tampilkan', 'periksa', 'nama', 'tidakada', 'belumada', 'kit', 'staf', 'staff',
])

// Frasa-penghubung khas AI-narasi Inggris (bocoran terdokumentasi CLAUDE_universal_v1 sec.2.1).
const CONNECTORS = [
  /\blet me\b/i, /\blet's\b/i, /\bnow i'?(ll| will)\b/i, /,\s*let me\b/i,
  /\bhere'?s\b/i, /\bi'?ll\s/i, /\bfirst,?\s+let\b/i, /\bnext,?\s+let\b/i,
]

// Baris yang memuat panggilan output ke-user (Node + shim PS).
const OUTPUT_LINE =
  /(?:console\.(?:log|error|warn|info)|process\.(?:stdout|stderr)\.write)\s*\(|Write-(?:Host|Warning|Error|Output|Information)\b/

// Ambil literal string dalam satu baris: '...', "...", `...` (tangani escape sederhana).
function extractStringLiterals(line) {
  const out = []
  const re = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g
  let m
  while ((m = re.exec(line)) !== null) {
    let s = m[0].slice(1, -1)
    // Buang interpolasi: ${...} (template JS) + $(...) / $var (PowerShell) -> itu NILAI, bukan teks.
    s = s.replace(/\$\{[^}]*\}/g, ' ').replace(/\$\([^)]*\)/g, ' ').replace(/\$[A-Za-z_][\w]*/g, ' ')
    out.push(s)
  }
  return out
}

// Token = kode/perintah/path/URL/ENV -> dilewati saat menghitung kata (bukan prosa).
function isCodeToken(t) {
  if (!t) return true
  if (/[/\\:.$@=<>|`{}[\]]/.test(t)) return true
  if (/^-/.test(t)) return true
  if (/^(npx|npm|node|pwsh|powershell|git|cd|ls|http|https|www)$/i.test(t)) return true
  if (/^[A-Z0-9_]{2,}$/.test(t)) return true // ENV_VAR / KONSTANTA
  return false
}

// Periksa satu string output. Return { en:[kata Inggris unik], connector:bool, indo:bool }.
export function checkOutputString(s) {
  const connector = CONNECTORS.some((r) => r.test(s))
  const words = s.toLowerCase().match(/[a-z][a-z']*/g) || []
  const indo = words.some((w) => ID_MARKERS.has(w.replace(/'/g, '')))
  const enSet = new Set()
  for (const raw of s.split(/\s+/)) {
    if (isCodeToken(raw)) continue
    const w = (raw.toLowerCase().match(/[a-z][a-z']*/) || [])[0]
    if (!w) continue
    const norm = w.replace(/'/g, '')
    if (EN_WORDS.has(norm)) enSet.add(norm)
  }
  return { en: [...enSet], connector, indo }
}

// Pindai SATU isi berkas -> array temuan { File, Line, Tingkat, Pesan, Teks }.
export function getEnglishOutputFindings(content, relPath = '<string>') {
  const findings = []
  if (content == null || content === '') return findings
  // Pisah baris cermin PS Get-Content: pecah \r\n, \r-tunggal, DAN \n (selaras port lain).
  const lines = content.split(/\r\n|\r|\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!OUTPUT_LINE.test(line)) continue
    for (const s of extractStringLiterals(line)) {
      const r = checkOutputString(s)
      if (r.indo) continue // ada penanda Indonesia -> dianggap Indonesia, lewati (presisi)
      const teks = s.trim().slice(0, 80)
      if (!teks) continue
      if (r.connector) {
        findings.push({ File: relPath, Line: i + 1, Tingkat: 'PENTING', Pesan: 'frasa penghubung khas Inggris di tulisan ke-user', Teks: teks })
      } else if (r.en.length >= 2) {
        findings.push({ File: relPath, Line: i + 1, Tingkat: 'PENTING', Pesan: `prosa Inggris di tulisan ke-user (kata: ${r.en.join(', ')})`, Teks: teks })
      }
    }
  }
  return findings
}

// Pindai daftar berkas (path absolut/relatif terhadap repoRoot).
export function scanFilesForEnglishOutput(files, repoRoot = process.cwd()) {
  const all = []
  for (const f of files) {
    const abs = path.isAbsolute(f) ? f : path.join(repoRoot, f)
    let content
    try { content = fs.readFileSync(abs, 'utf8') } catch { continue }
    const rel = path.relative(repoRoot, abs).replace(/\\/g, '/')
    all.push(...getEnglishOutputFindings(content, rel))
  }
  return all
}

// Orkestrator besar di AKAR repo (port Node bertahap, ADR-004). Dijaga gerbang bahasa BEGITU
// berkasnya ada (existsSync) - sebagian masih PowerShell, ditambah ke sini saat tiap diport.
const ROOT_ORCHESTRATORS = ['setup-pola-b.mjs', 'update-kit.mjs', 'uninstall.mjs', 'kit.mjs', 'rollback.mjs']

// Daftar bawaan = kode Node PRODUKSI yang menulis ke staff: lib/*.mjs + bin/lintasai.js +
// lib/risk-gate.js + orkestrator akar yang sudah diport (ROOT_ORCHESTRATORS). Inilah lingkup gerbang.
export function defaultNodeFiles(repoRoot) {
  const files = []
  const libDir = path.join(repoRoot, 'lib')
  try {
    for (const name of fs.readdirSync(libDir)) {
      if (name.endsWith('.mjs') || name === 'risk-gate.js') files.push(path.join('lib', name))
    }
  } catch { /* lib/ tak ada -> lewati */ }
  const binMain = path.join(repoRoot, 'bin', 'lintasai.js')
  if (fs.existsSync(binMain)) files.push(path.join('bin', 'lintasai.js'))
  for (const name of ROOT_ORCHESTRATORS) {
    if (fs.existsSync(path.join(repoRoot, name))) files.push(name)
  }
  return files
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  // CLI: `node lib/output-lang-check.mjs [berkas...]` (tanpa argumen = pindai kode Node produksi).
  const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const files = args.length > 0 ? args : defaultNodeFiles(KIT_ROOT)
  const repoRoot = args.length > 0 ? process.cwd() : KIT_ROOT
  const findings = scanFilesForEnglishOutput(files, repoRoot)
  console.log('\nRobot penjaga bahasa (output ke-user wajib Bahasa Indonesia awam)')
  console.log('-'.repeat(60))
  if (findings.length === 0) {
    console.log(`BERSIH: ${files.length} berkas diperiksa, semua tulisan ke-user pakai Bahasa Indonesia.`)
  } else {
    for (const f of findings) console.log(`  [${f.Tingkat}] ${f.File}:${f.Line}  ${f.Pesan}\n             "${f.Teks}"`)
    console.log('-'.repeat(60))
    console.log(`${findings.length} tulisan ke-user terdeteksi prosa Inggris - terjemahkan ke Bahasa Indonesia awam.`)
  }
  // Kode-keluar = jumlah temuan (0 = lulus untuk gerbang). process.exitCode (bukan exit) = anti potong-stdout.
  process.exitCode = findings.length
}
