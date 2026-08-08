#!/usr/bin/env node
// lib/portfolio-write.mjs - Penulis "Buku Induk" portfolio (lintasai-portfolio.yml).
//
// PASANGAN dari lib/portfolio-read.mjs (pembaca READ-ONLY). Robot ini MENULIS berkas Buku Induk
// dari data terstruktur (hasil wawancara AI - lihat templates/WIZARD_BUKU_INDUK_v1.md), supaya
// owner/staff NON-PROGRAMMER tidak perlu menyentuh format YAML sama sekali.
//
// KENAPA robot, bukan "AI ketik YAML langsung": pembaca (portfolio-read.mjs) memparse YAML
// BARIS-PER-BARIS dengan pola yang KAKU (mis. `allowed_teams: [a, b]` WAJIB satu baris dalam
// kurung siku; `members:` WAJIB diikuti daftar `- nama`). Kalau ditulis bebas, satu varian gaya
// YAML bisa bikin pembaca gagal-baca diam-diam. Robot ini menjamin keluaran SEBENTUK dengan
// pembaca - dikunci tes tulis-baca (tests/portfolio-write.test.mjs): tulis -> baca-balik harus
// identik. Robot juga MEMERIKSA keamanan (tolak-default): data rusak ditolak (tak jadi nulis),
// konfigurasi mencurigakan (brankas dibagi ke kelompok besar) ditandai peringatan untuk owner.
//
// AMAN: berkas ini TIDAK pernah menyimpan rahasia - keluaran HANYA berisi field yang dikenal
// (whitelist: nama repo + username + peran + tingkat). Field asing diabaikan -> tak mungkin bocor.
// READ-ONLY pembaca tetap utuh - menulis ada DI SINI, terpisah, supaya jaminan "baca-saja" jelas.
//
// Node-only (fitur BARU - tak ada padanan PowerShell; sesuai keputusan "jalur tim 100% Node").
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readLintasPortfolio } from './portfolio-read.mjs'

const PORTFOLIO_FILE = 'lintasai-portfolio.yml'

// Nilai sah (cermin templates/lintasai-portfolio.example.yml + PORTFOLIO_REGISTRY_v1.md).
const VALID_ROLES = ['backend', 'frontend', 'shared', 'dashboard', 'service', 'tools']
const VALID_TIERS = ['sensitive', 'feature', 'shared']
// Peran "tampilan" yang DILARANG menyimpan rahasia (lihat ACCESS_CONTROL_NREPO_v1.md).
const DISPLAY_ROLES = ['frontend', 'dashboard']
// Ambang "kelompok besar pegang rahasia". core-backend sehat = 3-5 orang; di atas ini patut dicek.
const LARGE_GROUP_THRESHOLD = 5

// Slug GitHub-aman: huruf-kecil/angka, dash di tengah (bukan di ujung). Dipakai untuk base_name,
// id kelompok, nama repo. Bukan untuk username (lihat USERNAME_RE).
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// Username GitHub: alfanumerik + dash (tak diawali/diakhiri dash), maks 39. Cek longgar (WARN, bukan ERROR).
const USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

// Deteksi karakter KONTROL + baris-baru (kode < 0x20 = LF/CR/TAB/dll, atau 0x7f = DEL). Di nilai
// INLINE (username/slug) = data RUSAK: baris-baru bisa memecah satu item daftar jadi field top-level
// -> struktur YAML kacau ("injeksi"). Pakai charCodeAt (angka), BUKAN regex escape, supaya tak ada
// byte kontrol mentah di kode sumber. CATATAN: dash/spasi biasa TIDAK dianggap kontrol (slug aman).
function hasControlChar(s) {
  const str = String(s == null ? '' : s)
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c < 0x20 || c === 0x7f) return true
  }
  return false
}

// Validasi Buku Induk SEBELUM ditulis. Pisahkan errors (data RUSAK -> tolak tulis) dari
// warnings (mencurigakan dari sisi KEAMANAN/kebijakan -> tetap tulis, tandai untuk owner).
// Keputusan akses tetap milik OWNER (owner-gated) - robot menyoroti, tidak memvonis.
export function validatePortfolioData(data) {
  const errors = []
  const warnings = []

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { errors: ['Data Buku Induk kosong / bukan objek.'], warnings }
  }

  const p = data.portfolio || {}
  if (!isNonEmptyString(p.base_name)) {
    errors.push('portfolio.base_name wajib diisi (awalan nama repo, mis. "bigseo").')
  } else if (!SLUG_RE.test(p.base_name)) {
    errors.push(`portfolio.base_name "${p.base_name}" tak valid (pakai huruf kecil/angka/dash, mis. "bigseo").`)
  }
  if (!isNonEmptyString(p.github_owner)) {
    errors.push('portfolio.github_owner wajib diisi (nama org/akun GitHub).')
  } else if (hasControlChar(p.github_owner)) {
    errors.push('portfolio.github_owner mengandung karakter tak valid (baris-baru/kontrol) - data rusak.')
  } else if (!USERNAME_RE.test(p.github_owner)) {
    warnings.push(`portfolio.github_owner "${p.github_owner}" tampak tak biasa untuk nama GitHub - cek lagi.`)
  }
  const visibility = isNonEmptyString(p.default_visibility) ? p.default_visibility : 'private'
  if (visibility !== 'private') {
    warnings.push(`default_visibility = "${visibility}" - repo bisnis sebaiknya "private" supaya kode tidak bisa dilihat publik.`)
  }

  const groups = Array.isArray(data.access_groups) ? data.access_groups : []
  const repos = Array.isArray(data.repos) ? data.repos : []
  if (groups.length === 0 && repos.length === 0) {
    errors.push('Buku Induk kosong - tak ada kelompok akses maupun repo. Minimal isi 1 kelompok + 1 repo.')
  }

  // --- Kelompok akses ---
  const groupIds = new Set()
  const groupMemberCount = new Map()
  for (const [i, g] of groups.entries()) {
    const label = `access_groups[${i}]`
    if (!g || typeof g !== 'object') { errors.push(`${label} bukan objek.`); continue }
    if (!isNonEmptyString(g.id)) {
      errors.push(`${label}.id wajib diisi (mis. "core-backend").`)
    } else if (!SLUG_RE.test(g.id)) {
      errors.push(`${label}.id "${g.id}" tak valid (pakai huruf kecil/angka/dash).`)
    } else if (groupIds.has(g.id)) {
      errors.push(`Kelompok "${g.id}" dobel - tiap id harus unik.`)
    } else {
      groupIds.add(g.id)
    }
    const members = Array.isArray(g.members) ? g.members : []
    groupMemberCount.set(g.id, members.length)
    if (members.length === 0) {
      warnings.push(`Kelompok "${g.id || label}" belum punya anggota - belum ada yang masuk lingkaran ini.`)
    }
    for (const m of members) {
      if (!isNonEmptyString(m)) { errors.push(`${label} punya anggota kosong - isi username GitHub.`); continue }
      // Karakter kontrol/baris-baru di nama anggota = data RUSAK (bukan typo) -> ERROR, bukan warning.
      // Tanpa ini, baris-baru bisa memecah daftar anggota jadi field top-level (YAML kacau). Cegah di pintu masuk.
      if (hasControlChar(m)) { errors.push(`${label} punya anggota dengan karakter tak valid (baris-baru/kontrol) - data rusak, perbaiki dulu.`); continue }
      if (!USERNAME_RE.test(m.trim())) warnings.push(`Anggota "${m}" di kelompok "${g.id}" tampak bukan username GitHub biasa - cek lagi (jangan isi email).`)
    }
  }

  // --- Repo ---
  const repoNames = new Set()
  for (const [i, r] of repos.entries()) {
    const label = `repos[${i}]`
    if (!r || typeof r !== 'object') { errors.push(`${label} bukan objek.`); continue }
    if (!isNonEmptyString(r.name)) {
      errors.push(`${label}.name wajib diisi (nama repo di GitHub).`)
    } else if (!SLUG_RE.test(r.name)) {
      errors.push(`${label}.name "${r.name}" tak valid (pakai huruf kecil/angka/dash).`)
    } else if (repoNames.has(r.name)) {
      errors.push(`Repo "${r.name}" dobel - tiap nama harus unik.`)
    } else {
      repoNames.add(r.name)
    }
    if (!VALID_ROLES.includes(r.role)) {
      errors.push(`${label} ("${r.name || '?'}").role = "${r.role}" tak dikenal. Pilih: ${VALID_ROLES.join(', ')}.`)
    }
    if (!VALID_TIERS.includes(r.access_tier)) {
      errors.push(`${label} ("${r.name || '?'}").access_tier = "${r.access_tier}" tak dikenal. Pilih: ${VALID_TIERS.join(', ')}.`)
    }
    const teams = Array.isArray(r.allowed_teams) ? r.allowed_teams : []
    // E10: rujukan RUSAK = error keras. allowed_teams yang menunjuk kelompok tak terdaftar bikin
    // penegakan akses salah -> harus diperbaiki sebelum dipakai.
    for (const t of teams) {
      if (!groupIds.has(t)) errors.push(`Repo "${r.name}" memberi akses ke kelompok "${t}" yang TIDAK ada di access_groups - perbaiki dulu.`)
    }
    // --- Pemeriksaan KEAMANAN (warning, owner-gated) ---
    if (teams.length === 0) {
      warnings.push(`Repo "${r.name}" belum punya kelompok yang boleh akses (allowed_teams kosong) - belum ada yang bisa clone.`)
    }
    if (r.access_tier === 'sensitive') {
      for (const t of teams) {
        const count = groupMemberCount.get(t) || 0
        if (count > LARGE_GROUP_THRESHOLD) {
          warnings.push(`Repo RAHASIA "${r.name}" dibagi ke kelompok besar "${t}" (${count} orang) - pastikan ini disengaja (brankas sebaiknya lingkaran kecil 3-5 orang).`)
        }
      }
    }
    if (DISPLAY_ROLES.includes(r.role) && r.access_tier === 'sensitive') {
      warnings.push(`Repo "${r.name}" peran "${r.role}" (tampilan) tapi ditandai "sensitive" - repo tampilan seharusnya TIDAK simpan kunci rahasia. Cek lagi tingkatnya.`)
    }
    // E11 -> WARN: consumer boleh repo eksternal, jadi tak diblokir, hanya disorot kalau bukan repo internal.
    const consumers = Array.isArray(r.consumers) ? r.consumers : []
    for (const c of consumers) {
      if (!repoNames.has(c) && !repos.some((rr) => rr && rr.name === c)) {
        warnings.push(`Repo "${r.name}" menyebut consumer "${c}" yang bukan repo di Buku Induk ini - pastikan namanya benar.`)
      }
    }
  }

  return { errors, warnings }
}

// Rapikan description jadi 1 baris: \s+ (termasuk baris-baru/tab) -> 1 spasi. Pakai \s (aman, bukan
// byte mentah). Dipakai sebelum dibungkus kutip-tunggal YAML.
function oneLine(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim()
}

// Pertahanan-lapis-kedua untuk nilai INLINE (slug/username/nama/peran): buang HANYA karakter kontrol +
// baris-baru (kode < 0x20 atau 0x7f) -> output SELALU 1 token per baris (tak bisa "injeksi" field
// top-level lewat newline), bahkan kalau buildPortfolioYaml dipanggil langsung tanpa validatePortfolioData.
// PENTING: dash/spasi biasa TIDAK dibuang -> "core-backend"/"lead-1" tetap utuh.
function inlineSafe(s) {
  const str = String(s == null ? '' : s)
  let out = ''
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c >= 0x20 && c !== 0x7f) out += str[i]
  }
  return out.trim()
}

// Bungkus description sebagai string YAML kutip-TUNGGAL (literal, hanya `'` yang di-escape jadi `''`).
// LEBIH KOKOH dari kutip-ganda: aman dari backslash (`C:\Users`), `#`, `"`, `[` `]` tanpa perlu escape.
function yamlSingleQuoted(s) {
  return `'${oneLine(s).replace(/'/g, "''")}'`
}

// Susun string YAML Buku Induk. PURE + deterministik (urutan field tetap, urutan input dijaga).
// Format keluaran WAJIB cocok pembaca portfolio-read.mjs - dikunci tes tulis-baca.
// HANYA field whitelist yang ditulis -> field asing diabaikan (tak mungkin bocor rahasia).
export function buildPortfolioYaml(data) {
  const p = (data && data.portfolio) || {}
  const baseName = isNonEmptyString(p.base_name) ? inlineSafe(p.base_name) : 'CONTOH'
  const githubOwner = isNonEmptyString(p.github_owner) ? inlineSafe(p.github_owner) : 'CONTOH'
  const visibility = isNonEmptyString(p.default_visibility) ? inlineSafe(p.default_visibility) : 'private'
  const groups = Array.isArray(data && data.access_groups) ? data.access_groups : []
  const repos = Array.isArray(data && data.repos) ? data.repos : []

  const L = []
  // Header bahasa awam (dibuang pembaca - baris komentar). Ringkas; panduan penuh di PORTFOLIO_REGISTRY_v1.md.
  L.push('# lintasai-portfolio.yml - BUKU INDUK repo + akses (dibuat lewat Wizard lintasAI)')
  L.push('#')
  L.push('# APA INI: 1 berkas mencatat SEMUA repo proyekmu + siapa boleh akses masing-masing.')
  L.push('# Dibuat otomatis dari wawancara AI - kamu TIDAK perlu menyentuh format YAML ini.')
  L.push('# Mau ubah? minta AI: "perbarui Buku Induk akses" (jangan edit tangan kalau ragu).')
  L.push('#')
  L.push('# TIDAK menyimpan rahasia TEKNIS (kata sandi / kunci) - jadi aman dibaca AI.')
  L.push('# TAPI isi = NAMA tim + peran + akses = PETA ORGANISASI (siapa pegang apa) = TETAP SENSITIF.')
  L.push('# WAJIB simpan di repo PRIVATE - jangan publik (peta tim bisa bocor ke pesaing).')
  L.push('#')
  L.push("# PENTING: berkas ini cuma MENCATAT keputusan akses. Yang benar-benar MENGUNCI download =")
  L.push("# izin clone GitHub (allowed_teams). Penerapannya MANUAL - lihat ACCESS_CONTROL_NREPO_v1.md")
  L.push('# (AI cetak rencana, manusia yang klik). Berkas ini sendiri tidak mengubah izin apa pun.')
  L.push('')

  // 1) META
  L.push('# 1) META - identitas portfolio')
  L.push('portfolio:')
  L.push(`  base_name: ${baseName}                 # awalan nama repo (mis. ${baseName}-backend)`)
  L.push(`  github_owner: ${githubOwner}           # nama org / akun GitHub pemilik repo`)
  L.push(`  default_visibility: ${visibility}       # SEMUA repo bisnis = private. Jangan public.`)
  L.push('')

  // 2) ACCESS GROUPS
  L.push('# 2) ACCESS GROUPS - kelompok staff (jadi "GitHub Team"). Tingkat KEPERCAYAAN, bukan jabatan.')
  L.push('#    Prinsip TOLAK-DEFAULT: staff mulai TANPA akses, ditambah seperlunya task.')
  L.push('access_groups:')
  for (const g of groups) {
    const id = isNonEmptyString(g && g.id) ? inlineSafe(g.id) : 'CONTOH'
    const members = Array.isArray(g && g.members) ? g.members.filter(isNonEmptyString) : []
    L.push(`  - id: ${id}`)
    if (isNonEmptyString(g && g.description)) {
      L.push(`    description: ${yamlSingleQuoted(g.description)}`)
    }
    if (members.length === 0) {
      L.push('    members: []')
    } else {
      L.push('    members:')
      for (const m of members) L.push(`      - ${inlineSafe(m)}`)
    }
  }
  L.push('')

  // 3) REPOS
  L.push('# 3) REPOS - tiap repo + peran + tingkat-sensitif + siapa boleh AKSES (clone).')
  L.push("#    access_tier: sensitive=ada rahasia(DB/kunci) | feature=tampilan(TANPA kunci) | shared=cuma bentuk-data.")
  L.push('#    allowed_teams: daftar id kelompok yang boleh CLONE repo ini = lapis yang benar-benar memblokir.')
  L.push('repos:')
  for (const r of repos) {
    const name = isNonEmptyString(r && r.name) ? inlineSafe(r.name) : 'CONTOH'
    const role = isNonEmptyString(r && r.role) ? inlineSafe(r.role) : ''
    const tier = isNonEmptyString(r && r.access_tier) ? inlineSafe(r.access_tier) : ''
    const teams = Array.isArray(r && r.allowed_teams) ? r.allowed_teams.filter(isNonEmptyString).map(inlineSafe) : []
    const consumers = Array.isArray(r && r.consumers) ? r.consumers.filter(isNonEmptyString).map(inlineSafe) : []
    L.push(`  - name: ${name}`)
    L.push(`    role: ${role}`)
    L.push(`    access_tier: ${tier}`)
    L.push(`    allowed_teams: [${teams.join(', ')}]`)
    L.push(`    consumers: [${consumers.join(', ')}]`)
  }
  L.push('')

  // 4) CATATAN
  L.push('# 4) CATATAN: jumlah repo ikut jumlah BATAS-AKSES nyata (bukan angka target).')
  L.push('# allowed_teams (izin clone) = SATU-SATUNYA yang benar-benar memblokir salin kode.')
  L.push('# Repo feature/frontend/dashboard DILARANG menyimpan kunci rahasia (ambil data lewat API backend).')
  L.push('')
  return L.join('\n')
}

// Tulis Buku Induk ke berkas. Default-AMAN: TOLAK menimpa berkas yang sudah ada tanpa force
// (cermin pola uninstall/rollback "tanpa --yes hanya rencana"). ERROR validasi -> TIDAK menulis.
// Setelah menulis, BACA-BALIK pakai pembaca yang ada -> verifikasi tulis-dan-baca cocok.
export function writePortfolio(data, outPath, { force = false, dryRun = false } = {}) {
  // Resolve SEKALI di awal: semua cek (exists), tulis, dan baca-balik pakai path absolut yang SAMA,
  // jadi hasil tak bergantung CWD yang mungkin berubah di antara langkah.
  const resolved = path.resolve(outPath)
  const validation = validatePortfolioData(data)
  if (validation.errors.length > 0) {
    return { written: false, reason: 'invalid', outPath: resolved, validation, yaml: null, readback: null }
  }
  if (fs.existsSync(resolved) && !force) {
    return { written: false, reason: 'exists', outPath: resolved, validation, yaml: null, readback: null }
  }
  const yaml = buildPortfolioYaml(data)
  if (!dryRun) {
    fs.mkdirSync(path.dirname(resolved), { recursive: true })
    fs.writeFileSync(resolved, yaml, 'utf8')
  }
  // Verifikasi tulis-baca hanya saat berkas nyata ditulis (dryRun cukup laporkan yaml).
  const readback = !dryRun && fs.existsSync(resolved) ? readLintasPortfolio(resolved) : null
  return { written: !dryRun, reason: dryRun ? 'dry-run' : 'ok', outPath: resolved, validation, yaml, readback }
}

// --- CLI: dipanggil AI di sesi nyata setelah wawancara. Baca data JSON dari --in, tulis YAML ke --out. ---
function parseArgs(argv) {
  const a = { in: null, out: null, force: false, dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--in') a.in = argv[++i]
    else if (t === '--out') a.out = argv[++i]
    else if (t === '--force') a.force = true
    else if (t === '--dry-run' || t === '--simulasi') a.dryRun = true
    else if (t === '--project-root') a.projectRoot = argv[++i] // disuntik dispatcher; out relatif ke sini
  }
  return a
}

function readJsonInput(inArg) {
  if (inArg === '-' || inArg == null) {
    // stdin (opsional). AI biasanya pakai --in <berkas>; stdin = jalur pipa.
    const raw = fs.readFileSync(0, 'utf8')
    return JSON.parse(raw)
  }
  return JSON.parse(fs.readFileSync(inArg, 'utf8'))
}

function main() {
  const a = parseArgs(process.argv.slice(2))
  const root = a.projectRoot || process.cwd()
  const outPath = a.out ? (path.isAbsolute(a.out) ? a.out : path.join(root, a.out)) : path.join(root, PORTFOLIO_FILE)

  if (!a.in) {
    console.error('[ERROR] Wajib --in <berkas.json> (data hasil wawancara) atau --in - (dari pipa).')
    console.error('Pakai: node lib/portfolio-write.mjs --in draft.json --out lintasai-portfolio.yml [--force] [--dry-run]')
    process.exit(2)
  }

  let data
  try {
    data = readJsonInput(a.in)
  } catch (e) {
    console.error(`[ERROR] Gagal baca/parse data JSON dari "${a.in}": ${e.message}`)
    process.exit(2)
  }

  const res = writePortfolio(data, outPath, { force: a.force, dryRun: a.dryRun })

  if (res.reason === 'invalid') {
    console.error('[TOLAK] Buku Induk TIDAK ditulis - ada data yang perlu diperbaiki dulu:')
    for (const er of res.validation.errors) console.error(`  - ${er}`)
    process.exit(3)
  }
  if (res.reason === 'exists') {
    console.error(`[TOLAK-AMAN] "${res.outPath}" sudah ada - tidak ditimpa otomatis.`)
    console.error('  Pakai --force untuk menimpa (yang lama akan tertindih), atau --dry-run untuk lihat hasil dulu.')
    process.exit(4)
  }

  // Sukses (ditulis / simulasi). Tampilkan peringatan keamanan kalau ada.
  if (res.validation.warnings.length > 0) {
    console.log(`PERINGATAN (${res.validation.warnings.length}) - tetap ditulis, tapi mohon dicek (keputusan akses milik kamu):`)
    for (const w of res.validation.warnings) console.log(`  ! ${w}`)
    console.log('')
  }
  if (a.dryRun) {
    console.log('SIMULASI (belum menulis berkas apa pun). Pratinjau isi:')
    console.log('-'.repeat(70))
    console.log(res.yaml)
    process.exit(0)
  }

  console.log(`OK - Buku Induk ditulis: ${res.outPath}`)
  if (res.readback && res.readback.Present) {
    console.log(`Verifikasi baca-balik: ${res.readback.Repos.length} repo, ${res.readback.Groups.length} kelompok - tulis & baca cocok.`)
  }
  console.log('Langkah berikutnya: minta AI cetak RENCANA kontrol-akses (mode aman) - lihat ACCESS_CONTROL_NREPO_v1.md.')
  process.exit(0)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
