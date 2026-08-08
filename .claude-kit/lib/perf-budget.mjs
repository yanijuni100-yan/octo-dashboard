#!/usr/bin/env node
// lib/perf-budget.mjs - Penjaga Anggaran Ukuran Halaman (Next.js). Baca manifest build Next.js lalu
// hitung perkiraan ukuran JS yang dimuat tiap route, banding "anggaran" (default 500 KB, sec. 10).
//
// KENAPA ADA: §10 lintasAI menyarankan page weight < 500KB. Robot ini MENGUKUR bagian JS-nya dari
// hasil build Next.js (fakta keras = ukuran berkas nyata di .next/), lalu menandai route yang gemuk.
// CUMA-LAPOR (READ-ONLY) - tak mengubah apa pun. Tingkat = RAPIKAN (saran), TAK PERNAH memblokir.
//
// AUTO-SKIP dengan anggun: kalau tak ada `.next/` (belum `npm run build`, atau bukan project Next.js)
// -> lapor "dilewati", BUKAN error/alarm. Ini cegah rasa-aman-palsu: "dilewati (belum build)" jujur,
// beda dari "0 masalah" palsu.
//
// CATATAN KEJUJURAN: ini PERKIRAAN ukuran JS per route dari manifest (jumlah berkas .js unik yang
// direferensikan route) - BUKAN angka "First Load JS" persis ala Next (yang menghitung shared-chunk
// dengan rumus internalnya). Cukup untuk menyorot route yang jauh lebih berat dari lainnya.
//
// TERUJI tanpa build nyata: analyzeManifest PURE + sizeOf DISUNTIK (tests/perf-budget.test.mjs).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_BUDGET_KB = 500

// Gabung peta `pages` dari build-manifest.json (Pages Router) + app-build-manifest.json (App Router).
// Struktur Next.js standar: { "pages": { "<route>": ["static/chunks/....js", ...] } }. Return null kalau
// tak ada manifest sama sekali (belum build / bukan Next). Manifest rusak -> berkas itu diabaikan (defensif).
export function loadNextManifests(nextDir) {
  const pages = {}
  let found = false
  for (const name of ['build-manifest.json', 'app-build-manifest.json']) {
    const p = path.join(nextDir, name)
    if (!fs.existsSync(p)) continue
    try {
      const m = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (m && m.pages && typeof m.pages === 'object') {
        for (const [route, files] of Object.entries(m.pages)) {
          if (Array.isArray(files)) pages[route] = (pages[route] || []).concat(files)
        }
        found = true
      }
    } catch { /* manifest rusak -> abaikan berkas ini, jangan crash */ }
  }
  return found ? { pages } : null
}

// Analisa PURE: per route, jumlah ukuran berkas .js UNIK. sizeOf(file)->bytes DISUNTIK (tes).
// Return route diurut dari paling berat + daftar yang lewat-anggaran.
export function analyzeManifest(manifest, sizeOf, { budgetBytes = DEFAULT_BUDGET_KB * 1024 } = {}) {
  const routes = []
  for (const [route, files] of Object.entries((manifest && manifest.pages) || {})) {
    const uniq = [...new Set(Array.isArray(files) ? files : [])].filter((f) => /\.js$/.test(f))
    let bytes = 0
    for (const f of uniq) bytes += Math.max(0, Number(sizeOf(f)) || 0)
    routes.push({ route, fileCount: uniq.length, bytes, overBudget: bytes > budgetBytes })
  }
  routes.sort((a, b) => b.bytes - a.bytes)
  const over = routes.filter((r) => r.overBudget)
  return { routes, over, maxBytes: routes.length ? routes[0].bytes : 0, budgetBytes }
}

// Pengukur ukuran berkas nyata di .next/. Berkas hilang -> 0 (jangan crash).
export function realSizeOf(nextDir) {
  return (file) => {
    try { return fs.statSync(path.join(nextDir, file)).size } catch { return 0 }
  }
}

export function fmtKb(bytes) {
  return `${Math.round((Number(bytes) || 0) / 1024)} KB`
}

// Orkestrasi untuk CLI + preflight. present:false = tak ada manifest (auto-skip dengan anggun).
export function runPerfBudget({ repoRoot = process.cwd(), budgetKb = DEFAULT_BUDGET_KB, nextDir = null } = {}) {
  const dir = nextDir || path.join(repoRoot, '.next')
  const manifest = loadNextManifests(dir)
  if (!manifest) return { present: false, dir, budgetKb }
  const res = analyzeManifest(manifest, realSizeOf(dir), { budgetBytes: budgetKb * 1024 })
  return { present: true, dir, budgetKb, ...res }
}

// --- CLI: `node lib/perf-budget.mjs [--project-root <dir>] [--budget-kb 500]` ---
function main() {
  let projectRoot = process.cwd()
  let budgetKb = DEFAULT_BUDGET_KB
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project-root') projectRoot = argv[++i] || projectRoot
    else if (argv[i] === '--budget-kb') budgetKb = Number(argv[++i]) || DEFAULT_BUDGET_KB
  }

  const res = runPerfBudget({ repoRoot: projectRoot, budgetKb })
  if (!res.present) {
    console.log('Anggaran ukuran halaman: DILEWATI - tak ada .next/ build di project ini.')
    console.log('  (Jalankan `npm run build` dulu kalau ini project Next.js, lalu ulang. Bukan Next.js -> abaikan.)')
    process.exit(0)
  }

  console.log('')
  console.log(`Anggaran Ukuran Halaman (Next.js) - perkiraan JS per route vs ${res.budgetKb} KB (READ-ONLY)`)
  console.log('-'.repeat(64))
  for (const r of res.routes.slice(0, 20)) {
    const mark = r.overBudget ? '[ > ANGGARAN]' : '[ ok ]'
    console.log(`  ${mark}  ${fmtKb(r.bytes).padStart(8)}  ${r.route}`)
  }
  console.log('-'.repeat(64))
  if (res.over.length === 0) {
    console.log(`BERSIH: semua ${res.routes.length} route di bawah anggaran ${res.budgetKb} KB (perkiraan JS).`)
  } else {
    console.log(`PERHATIAN: ${res.over.length} route melewati anggaran ${res.budgetKb} KB (perkiraan JS). Pertimbangkan optimasi bundle (sec. 10): code-splitting, lazy-load, hapus dependency berat.`)
  }
  console.log('Catatan: ini PERKIRAAN ukuran JS dari manifest, bukan "First Load JS" persis Next. Hanya saran (RAPIKAN), tak memblokir.')
  console.log('')
  process.exit(0)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
