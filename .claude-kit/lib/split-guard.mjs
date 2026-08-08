#!/usr/bin/env node
// lib/split-guard.mjs - "Robot Penjaga Anti-Bocor Saat Pecah-Repo" (split-repo leak guard).
//
// KENAPA ADA: saat project dipecah jadi banyak repo (lihat SPLIT_REPO_MIGRATION_PROMPT_v1.md +
// templates/SPLIT_REPO_PREPROVISION_v1.md), pengaman PALING KRITIS = "rahasia (.env / kunci DB)
// JANGAN bocor ke repo tampilan (frontend/dashboard) yang dilihat 40-50 orang". DULU pengaman itu
// cuma "dicek manual oleh AI" (Risk Catalog SPLIT_REPO_MIGRATION_PROMPT_v1.md, baris "Secrets leak" ~691
// -- kini baris itu sudah "Ditegakkan robot deterministik" berkat robot ini, tak lagi cek manual).
// Bertumpu pada AI ingat = bisa lupa. Robot ini mengubah "andalkan AI ingat" -> "mesin deterministik".
//
// SIFAT (sengaja):
//  - MODE AMAN CUMA-BACA: hanya membaca berkas, TIDAK pernah mengubah/menghapus apa pun.
//  - FAIL-CLOSED: ragu = tolak (default deny, sec.5). Peran tak diketahui -> diasumsikan PALING KETAT
//    (feature). Penjelajahan terpotong (repo raksasa) -> GENTING 'SCAN_TAK_LENGKAP' (JANGAN diam-diam
//    bilang "aman" padahal belum dipindai penuh). Marker tier konflik -> ambil yang paling ketat.
//  - TAK PERNAH MENCETAK NILAI RAHASIA (sec.8.1 #6): laporan cuma sebut NAMA berkas/kunci + nomor baris.
//
// APA YANG DIPERIKSA (per folder hasil-pecah, deterministik):
//  C1 - berkas `.env` ASLI (bukan .example) nyelip. Vonis menurut ISI:
//       berisi rahasia -> GENTING (C1_ENV_RAHASIA); env-lokal bersih -> PENTING (C1_ENV_LOKAL);
//       env publik (mis. .env.production hanya NEXT_PUBLIC_*) -> RAPIKAN (C1_ENV_PUBLIK).
//  C2 - `.gitignore` TIDAK menutup `.env`.                                                  -> GENTING
//  C3 - repo non-rahasia (frontend/dashboard/shared) `.env.example` memuat kunci RAHASIA.   -> GENTING
//  C4 - `.env.example` memuat NILAI rahasia ASLI (vendor key / URL-DB-ber-kredensial).      -> GENTING
//  C5 - repo tampilan (feature) punya struktur DB (`*.prisma`/`*.sql` migrasi/`db-schema`). -> GENTING
//  TIER_KONFLIK (marker access_tier vs role bertentangan) -> PENTING; SCAN_TAK_LENGKAP -> GENTING.
//
//  Tingkat: GENTING / PENTING / RAPIKAN (label awam, sec.2.1 #7). Exit = jumlah GENTING (0 = aman).
//
// PERAN -> TINGKAT-SENSITIF (tier):
//  - sensitive : backend/server/api/core/service/engine/worker -> boleh punya DATABASE_URL/secret di .env.example.
//  - feature   : frontend/dashboard/web/ui/client            -> HANYA kunci publik (NEXT_PUBLIC_*); NOL rahasia, NOL DB.
//  - shared    : shared/types/common                         -> biasanya kosong; NOL rahasia.
//  Sumber tier (urut prioritas): --tier > --role > .split-state (access_tier > role) > default 'feature'.
//
// CATATAN pola rahasia: diselaraskan dgn lib/ai-config-check.mjs (SECRET_PATTERNS) +
// templates/hooks/pre-commit-secret-scan.sh. Belum disatukan ke 1 modul karena ai-config-check.mjs
// dijaga byte-identik dgn padanan PowerShell-nya -- konsolidasi = refactor terpisah.
//
// Diperkuat 2026-06-24 lewat cek-silang skeptis 3-pemeriksa (14 temuan diperbaiki): scan fail-closed,
// gitignore ketat, env non-standar, placeholder vendor, kunci publik, C1 by-isi, marker ber-kutip, C5 luas.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTextSafe, pathExists } from './fs-text.mjs'

// --- util kecil (senyap): pathExists/readTextSafe dipindah ke sumber bersama lib/fs-text.mjs
// (impor di atas) -> audit fungsi-kembar 2026-06-25.

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.claude-kit', 'coverage', '.turbo'])
const VALID_TIERS = new Set(['sensitive', 'feature', 'shared'])
// Ketat-relatif: feature paling ketat (NOL rahasia) > shared > sensitive (boleh rahasia). Untuk konflik.
function tierStrictness(t) { return t === 'feature' ? 2 : t === 'shared' ? 1 : 0 }

// === roleToTier ==================================================================================
export function roleToTier(role) {
  if (role == null) return null
  const r = String(role).trim().toLowerCase()
  if (r === '') return null
  if (/^(backend|server|api|core|service|engine|worker)(s)?($|[-_])/.test(r)) return 'sensitive'
  if (/^(frontend|dashboard|web|webapp|ui|client|admin|mobile)($|[-_])/.test(r)) return 'feature'
  if (/^(shared|types|type|common|contracts?|sdk)($|[-_])/.test(r)) return 'shared'
  return null
}

// === resolveTier =================================================================================
// Return { tier, source, conflict }. Marker boleh ber-tanda-kutip (access_tier: "sensitive").
// Kalau access_tier & role di marker BERTENTANGAN -> ambil yang PALING KETAT + tandai conflict.
export function resolveTier(repoRoot, opts = {}) {
  if (opts.tier && VALID_TIERS.has(String(opts.tier).toLowerCase())) {
    return { tier: String(opts.tier).toLowerCase(), source: 'bendera --tier', conflict: null }
  }
  if (opts.role) {
    const t = roleToTier(opts.role)
    if (t) return { tier: t, source: `bendera --role (${opts.role})`, conflict: null }
  }
  const marker = readTextSafe(path.join(repoRoot, '.claude-kit', '.split-state'))
  if (marker) {
    const at = marker.match(/access_tier:\s*["']?([A-Za-z0-9_-]+)/i)   // toleran kutip
    const ro = marker.match(/role:\s*["']?([A-Za-z0-9_-]+)/i)
    const atTier = at && VALID_TIERS.has(at[1].toLowerCase()) ? at[1].toLowerCase() : null
    const roTier = ro ? roleToTier(ro[1]) : null
    if (atTier && roTier && atTier !== roTier) {
      const strict = tierStrictness(atTier) >= tierStrictness(roTier) ? atTier : roTier
      return { tier: strict, source: `.split-state KONFLIK (access_tier=${atTier} vs role->${roTier}) -> pakai paling ketat (${strict})`, conflict: { atTier, roTier, role: ro[1] } }
    }
    if (atTier) return { tier: atTier, source: '.split-state (access_tier)', conflict: null }
    if (roTier) return { tier: roTier, source: `.split-state (role: ${ro[1]})`, conflict: null }
  }
  return { tier: 'feature', source: 'default (peran tak terdeteksi -> diasumsikan paling ketat)', conflict: null }
}

// --- pola nama berkas .env (diperluas: *.env suffix, .envrc, .flaskenv, .env-prod) ----------------
const EXTRA_ENV_NAMES = new Set(['.envrc', '.flaskenv', '.environment'])
function isExampleEnvName(name) {
  return /\.(examples?|samples?|templates?|dist|demo|defaults?)$/i.test(name)
}
function isAnyEnvName(name) {
  const n = name.toLowerCase()
  if (EXTRA_ENV_NAMES.has(n)) return true
  if (/^\.env([._-][a-z0-9_-]+)*$/i.test(name)) return true // .env / .env.local / .env-prod / .env.production
  if (/[._-]env$/i.test(name)) return true                  // suffix: credentials.env / secrets.env / local-env
  return false
}
function isRealEnvName(name) { return isAnyEnvName(name) && !isExampleEnvName(name) }
// Env "lokal-rahasia" (konvensinya gitignored, jangan disalin): .env, *.local, .envrc, .flaskenv, secrets/credentials.env
function isLocalSecretEnvName(name) {
  const n = name.toLowerCase()
  return n === '.env' || /\.local$/i.test(n) || n === '.envrc' || n === '.flaskenv' ||
    /(^|[._-])(secret|secrets|credential|credentials)\.env$/i.test(n)
}

// === gitignoreCoversEnv ==========================================================================
// Apakah isi .gitignore benar-benar mengabaikan berkas `.env` telanjang? PURE.
// PENTING (diperbaiki 2026-06-24, terbukti via git asli): pola `.env.*` TIDAK menutup `.env` telanjang
// (butuh titik kedua), dan `.env/` = DIREKTORI (bukan file). Pola ber-slash DI TENGAH (`config/.env`)
// hanya menutup folder itu. Yang sah: `.env`, `.env*`, `*.env` (+ prefix `**/` / leading-slash anchor-root).
export function gitignoreCoversEnv(content) {
  if (content == null) return false
  for (const raw of String(content).split(/\r\n|\r|\n/)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#') || line.startsWith('!')) continue
    if (line.endsWith('/')) continue          // trailing slash = direktori di git, BUKAN file .env
    let p = line.replace(/^\*\*\//, '')        // `**/` = semua level
    p = p.replace(/^\/+/, '')                  // leading slash = anchor root (sah menutup root .env)
    if (p.includes('/')) continue              // slash MASIH di tengah -> subfolder spesifik, bukan global
    if (/^\.env\*?$/i.test(p)) return true     // .env atau .env* (mencakup .env telanjang)
    if (/^\*\.env$/i.test(p)) return true      // *.env
  }
  return false
}

// --- pola NILAI rahasia ASLI (vendor; case-sensitive selaras ai-config-check.mjs) -----------------
const SECRET_VALUE_PATTERNS = [
  { re: /sk-ant-[A-Za-z0-9_-]{20,}/, name: 'kunci Anthropic (sk-ant-...)' },
  { re: /sk-[A-Za-z0-9_]{20,}/, name: 'kunci gaya OpenAI (sk-...)' },
  { re: /(sk|rk)_live_[A-Za-z0-9]{20,}/, name: 'kunci rahasia Stripe (sk_live_/rk_live_...)' },
  { re: /whsec_[A-Za-z0-9]{20,}/, name: 'signing-secret webhook (whsec_...)' },
  { re: /gh[posur]_[A-Za-z0-9]{30,}/, name: 'token GitHub (ghp_/gho_/...)' },
  { re: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key (AKIA...)' },
  { re: /xox[baprs]-[A-Za-z0-9-]{10,}/, name: 'token Slack (xox..-..)' },
  { re: /glpat-[A-Za-z0-9_-]{18,}/, name: 'token GitLab (glpat-...)' },
  { re: /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}/, name: 'token JWT (eyJ...)' },
  { re: /AIza[0-9A-Za-z_-]{30,}/, name: 'kunci Google (AIza...)' },
  { re: /-----BEGIN[A-Z ]*PRIVATE KEY-----/, name: 'kunci privat PEM (-----BEGIN ... PRIVATE KEY-----)' },
]
const DB_URL_CRED_RE = /\b(postgres|postgresql|mysql|mongodb(\+srv)?|redis|rediss|amqps?):\/\/[^:@/\s]+:[^@/\s]+@/i
// Petunjuk "ini cuma contoh/placeholder" (supaya placeholder klasik tak salah-tuduh GENTING).
const PLACEHOLDER_HINT_RE = /(your[-_ ]?|example|localhost|127\.0\.0\.1|placeholder|change[-_ ]?me|x{4,}|0{6,}|<[^>]*>|\buser:(pass(word)?|secret)\b|username:pass|dummy|host:port|db[-_ ]?name|mydb|redacted|replace|todo|fixme|fill[-_ ]?in|set[-_ ]?me|to[-_ ]?be[-_ ]?set|[-_]here\b|\.\.\.|\*{3,})/i
function valueLooksLikePlaceholder(value) { return PLACEHOLDER_HINT_RE.test(String(value)) }

// Placeholder khusus PASSWORD pada URL DB. KENAPA ADA (perbaikan celah false-negative 2026-06-24):
// dulu valueLooksLikePlaceholder dijalankan ke SELURUH nilai URL -> kata petunjuk di HOST
// (mis. db.example.com) ikut men-suppress URL ber-password ASLI -> kredensial produksi LOLOS.
// Sekarang penanda-placeholder dicek pada PASSWORD-nya saja (lihat scanEnvLines). Kata generik
// khas .env.example (pass/password/user/admin/...) tetap dianggap placeholder supaya contoh sah
// (postgres://user:pass@your-db.example.com/db) tetap lolos -- yang BERUBAH cuma: password ASLI di
// host ber-"example" kini KETAHUAN. Vendor key (sk-/AKIA/...) TIDAK pakai jalur ini (sengaja, agar
// AWS doc-key 'AKIAIOSFODNN7EXAMPLE' tetap di-suppress lewat PLACEHOLDER_HINT_RE).
const WEAK_PW_PLACEHOLDER_RE = /^(pass|passwd|password|pwd|secret|user|username|admin|administrator|root|test|demo|sample|example|changeme|mypassword|yourpassword)$/i
function passwordLooksLikePlaceholder(pw) {
  const p = String(pw).trim()
  if (p === '') return true
  if (valueLooksLikePlaceholder(p)) return true
  return WEAK_PW_PLACEHOLDER_RE.test(p)
}

// --- pola NAMA-kunci RAHASIA (untuk repo non-rahasia) ---------------------------------------------
const PUBLIC_PREFIX_RE = /^(NEXT_PUBLIC_|PUBLIC_|VITE_|REACT_APP_|NUXT_PUBLIC_|EXPO_PUBLIC_|GATSBY_)/i
const SECRET_KEY_RE = /(DATABASE_URL|DB_URL|DATABASE_CONNECTION|CONNECTION_STRING|DIRECT_URL|SERVICE_ROLE|SECRET|PASSWORD|PASSWD|PRIVATE.?KEY|_KEY$|API.?KEY|TOKEN|DSN|CREDENTIAL|SUPABASE_SERVICE|MONGO|REDIS|ELASTIC|RABBITMQ|AMQP)/i
export function keyNameIsSecret(key) {
  const k = String(key).trim()
  // *PRIVATE_KEY* SELALU rahasia (menang atas penanda 'public' apa pun -> mis. 'PUBLIC_PRIVATE_KEY').
  if (/PRIVATE.?KEY/i.test(k)) return true
  if (PUBLIC_PREFIX_RE.test(k)) return false
  if (/PUBLISHABLE/i.test(k)) return false
  // Kunci PUBLIK separuh-keypair (JWT_PUBLIC_KEY, SSH_PUBLIC_KEY) SAH dibagi -> bukan rahasia.
  if (/(^|[_-])PUBLIC([_-]|$)/i.test(k)) return false
  return SECRET_KEY_RE.test(k)
}

// === scanEnvLines (INTI, PURE) ===================================================================
// Pindai baris KEY=VALUE -> array { Line, key, issue } netral. Dipakai C3/C4 (.env.example) + C1 (.env asli).
//  issue 'value'    = NILAI mirip rahasia vendor/DB asli (semua tier).
//  issue 'key'      = NAMA-kunci rahasia di repo non-rahasia (C3).
//  issue 'realvalue'= (realFile saja) kunci-rahasia ber-nilai non-kosong non-placeholder, SEMUA tier
//                     (cegah .env asli ber-rahasia-mentah non-vendor nyelip).
// TAK PERNAH memuat nilai di output.
export function scanEnvLines(content, tier, { realFile = false } = {}) {
  const out = []
  if (content == null) return out
  const nonSensitive = (tier === 'feature' || tier === 'shared')
  const lines = String(content).split(/\r\n|\r|\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/^\s*export\s+/i, '').trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    const num = i + 1
    let valHit = null
    for (const p of SECRET_VALUE_PATTERNS) { if (p.re.test(value) && !valueLooksLikePlaceholder(value)) { valHit = p.name; break } }
    if (!valHit && DB_URL_CRED_RE.test(value)) {
      // Ekstrak password + host; suppress HANYA jika password placeholder ATAU host lokal (dev).
      // Tak bisa di-parse -> JANGAN anggap placeholder (fail-closed: lebih baik tandai dari lolos).
      const m = value.match(/:\/\/[^:@/\s]+:([^@/\s]+)@([^/\s:?#]+)/)
      const host = m ? m[2].toLowerCase() : ''
      const hostIsLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\[::1\])$/.test(host)
      const pwPlaceholder = m ? passwordLooksLikePlaceholder(m[1]) : false
      if (!hostIsLocal && !pwPlaceholder) valHit = 'URL database ber-kredensial'
    }
    if (valHit) out.push({ Line: num, key, issue: 'value', detail: valHit })
    else if (nonSensitive && keyNameIsSecret(key)) out.push({ Line: num, key, issue: 'key' })
    else if (realFile && keyNameIsSecret(key) && value !== '' && !valueLooksLikePlaceholder(value)) out.push({ Line: num, key, issue: 'realvalue' })
  }
  return out
}

// === scanExampleEnvContent (C3 + C4 untuk .env.example) ==========================================
export function scanExampleEnvContent(content, tier, relPath) {
  // realFile:true -> di tier 'sensitive' (backend/engine) yang .env.example-nya SAH punya nama kunci
  // rahasia, robot tetap menandai kalau NILAI-nya terisi sungguhan (bukan placeholder kosong). Tanpa
  // ini, password mentah non-vendor (mis. DB_PASSWORD=KataKunciAsli) lolos di .env.example backend
  // (celah SG-01). Di tier feature/shared, cabang 'key' (C3) sudah menang lebih dulu -> tak berubah.
  return scanEnvLines(content, tier, { realFile: true }).map((h) => {
    if (h.issue === 'key') {
      return { Tingkat: 'GENTING', Kode: 'C3_KUNCI_RAHASIA', File: relPath, Line: h.Line,
        Pesan: `Baris ${h.Line}: kunci rahasia '${h.key}' tak boleh ada di repo tampilan/bersama (${tier}). Repo ini dilihat banyak orang - ambil data lewat API backend, jangan colok DB. Hanya kunci publik (NEXT_PUBLIC_*) yang boleh.` }
    }
    if (h.issue === 'realvalue') {
      return { Tingkat: 'PENTING', Kode: 'C4_NILAI_TERISI', File: relPath, Line: h.Line,
        Pesan: `Baris ${h.Line} (kunci '${h.key}'): berkas contoh (.env.example) MENGISI kunci rahasia dengan nilai non-kosong yang bukan placeholder. .env.example WAJIB placeholder kosong (mis. '${h.key}=' atau '${h.key}=your-value-here'). Kalau ini nilai asli yang terlanjur ke-copy, kosongkan sebelum push. (nilai tak ditampilkan demi keamanan)` }
    }
    return { Tingkat: 'GENTING', Kode: 'C4_NILAI_RAHASIA', File: relPath, Line: h.Line,
      Pesan: `Baris ${h.Line} (kunci '${h.key}'): berkas contoh memuat NILAI mirip rahasia asli (${h.detail || 'rahasia'}). Berkas .env.example WAJIB placeholder kosong - JANGAN tulis kunci sungguhan. (nilai tak ditampilkan demi keamanan)` }
  })
}

// --- deteksi berkas struktur-DB (C5, diperluas: prisma + sql migrasi + db-schema/dbml) ------------
function isDbStructFile(rel, name) {
  const n = name.toLowerCase()
  const r = rel.toLowerCase()
  if (n.endsWith('.prisma') || n.endsWith('.dbml')) return true
  if (n === 'schema.sql' || /^db[-_]?schema\.(md|sql)$/i.test(n)) return true
  if (n.endsWith('.sql') && /(^|\/)(migrations|prisma)\//.test(r)) return true
  return false
}

// --- penjelajah folder (cuma-baca). truncated=true kalau cap tercapai (fail-closed di pemanggil) ---
function walkCollect(root, cap = 50000) {
  const envFiles = []     // { abs, rel, name }
  const dbStructFiles = []// { abs, rel }
  let seen = 0
  let truncated = false
  const stack = [root]
  while (stack.length > 0) {
    if (seen >= cap) { truncated = true; break }
    const dir = stack.pop()
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const ent of entries) {
      if (seen >= cap) { truncated = true; break }
      seen++
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name.toLowerCase())) continue
        stack.push(path.join(dir, ent.name))
      } else if (ent.isFile()) {
        const abs = path.join(dir, ent.name)
        const rel = path.relative(root, abs).split(path.sep).join('/')
        if (isAnyEnvName(ent.name)) envFiles.push({ abs, rel, name: ent.name })
        else if (isDbStructFile(rel, ent.name)) dbStructFiles.push({ abs, rel })
      }
    }
  }
  return { envFiles, dbStructFiles, truncated }
}

// === invokeSplitGuard ============================================================================
export function invokeSplitGuard(repoRoot, { tier = null, role = null, quiet = false } = {}) {
  const resolved = resolveTier(repoRoot, { tier, role })
  const findings = []
  const add = (t, kode, pesan, file = null, line = null) => findings.push({ Tingkat: t, Kode: kode, File: file, Line: line, Pesan: pesan })

  if (!pathExists(repoRoot)) {
    add('GENTING', 'FOLDER_HILANG', `Folder '${repoRoot}' tidak ditemukan - tak bisa diperiksa (fail-closed).`)
    if (!quiet) printReport(repoRoot, resolved, findings)
    return summarize(findings, resolved)
  }

  // Marker tier konflik -> PENTING (jangan diam-diam matikan penjaga repo-tampilan).
  if (resolved.conflict) {
    add('PENTING', 'TIER_KONFLIK', `Penanda .split-state bertentangan: access_tier='${resolved.conflict.atTier}' tapi role='${resolved.conflict.role}' (memetakan ke '${resolved.conflict.roTier}'). Robot pakai yang PALING KETAT ('${resolved.tier}'). Betulkan penanda biar tak salah-deteksi.`, '.claude-kit/.split-state')
  }

  const { envFiles, dbStructFiles, truncated } = walkCollect(repoRoot)

  // FAIL-CLOSED: penjelajahan terpotong -> JANGAN bilang "aman", tolak + minta pindai manual.
  if (truncated) {
    add('GENTING', 'SCAN_TAK_LENGKAP', 'Folder terlalu besar - pemindaian BERHENTI sebelum selesai, jadi robot TIDAK bisa menjamin tak ada rahasia nyelip. JANGAN anggap "aman". Pindai per-subfolder / kurangi berkas dulu, atau periksa manual sebelum push.')
  }

  // C1: berkas .env ASLI -> vonis menurut ISI.
  for (const f of envFiles) {
    if (!isRealEnvName(f.name)) continue
    const content = readTextSafe(f.abs) || ''
    const hits = scanEnvLines(content, resolved.tier, { realFile: true })
    if (hits.length > 0) {
      add('GENTING', 'C1_ENV_RAHASIA', `Berkas '.env' asli berisi RAHASIA nyelip: ${f.rel} (baris ${hits.map((h) => h.Line).join(', ')}). Saat pecah-repo, folder HANYA boleh '.env.example' placeholder. Hapus rahasia + jangan salin '.env' asli. (nilai tak ditampilkan demi keamanan)`, f.rel)
    } else if (isLocalSecretEnvName(f.name)) {
      add('PENTING', 'C1_ENV_LOKAL', `Berkas env lokal nyelip: ${f.rel}. Biasanya ini gitignored + tak ikut saat split (walau sekarang tak terdeteksi rahasia). Pastikan tidak ter-push - saat pecah cukup '.env.example'.`, f.rel)
    } else {
      add('RAPIKAN', 'C1_ENV_PUBLIK', `Berkas '${f.rel}' ikut tersalin (tak terdeteksi rahasia, isinya tampak publik). Pastikan memang sengaja di-commit (mis. var NEXT_PUBLIC build-time), bukan tertinggal.`, f.rel)
    }
  }

  // C2: .gitignore wajib menutup .env.
  const giContent = readTextSafe(path.join(repoRoot, '.gitignore'))
  if (giContent == null) {
    add('GENTING', 'C2_GITIGNORE', "Folder tak punya '.gitignore'. Tanpa itu, berkas rahasia '.env' bisa ter-push ke GitHub tak sengaja. Tambahkan '.gitignore' yang berisi baris '.env*'.", '.gitignore')
  } else if (!gitignoreCoversEnv(giContent)) {
    add('GENTING', 'C2_GITIGNORE', "'.gitignore' ADA tapi TIDAK menutup berkas '.env' telanjang (mis. cuma '.env.*' atau pola folder). Rahasia bisa ter-push tak sengaja. Tambahkan baris '.env*' ke '.gitignore'.", '.gitignore')
  }

  // C3 + C4: pindai tiap berkas .env.example.
  for (const f of envFiles) {
    if (isRealEnvName(f.name)) continue
    for (const x of scanExampleEnvContent(readTextSafe(f.abs), resolved.tier, f.rel)) findings.push(x)
  }

  // C5: repo tampilan (feature) NOL struktur DB.
  if (resolved.tier === 'feature' && dbStructFiles.length > 0) {
    for (const f of dbStructFiles) {
      add('GENTING', 'C5_DB_DI_FRONTEND', `Repo tampilan (feature) punya struktur database: ${f.rel}. Frontend/dashboard "NOL kartu DB" (POLA_REPO_AMAN) - struktur/skema database tak boleh ada di repo yang dilihat banyak orang. Pindahkan ke repo backend/engine.`, f.rel)
    }
  }

  if (!quiet) printReport(repoRoot, resolved, findings)
  return summarize(findings, resolved)
}

function summarize(findings, resolved) {
  const genting = findings.filter((x) => x.Tingkat === 'GENTING').length
  const penting = findings.filter((x) => x.Tingkat === 'PENTING').length
  const rapikan = findings.filter((x) => x.Tingkat === 'RAPIKAN').length
  return { Findings: findings, Count: findings.length, Genting: genting, Penting: penting, Rapikan: rapikan, Tier: resolved.tier, TierSource: resolved.source }
}

function printReport(repoRoot, resolved, findings) {
  console.log('Robot Penjaga Anti-Bocor Saat Pecah-Repo (split-guard)')
  console.log(`Folder    : ${repoRoot}`)
  console.log(`Tingkat   : ${resolved.tier}  (sumber: ${resolved.source})`)
  if (resolved.source.startsWith('default')) {
    console.log('  Catatan : peran tak terbaca dari .claude-kit/.split-state -> diasumsikan PALING KETAT')
    console.log('            (repo tampilan/non-rahasia). Kalau ini repo backend/engine, jalankan ulang')
    console.log('            dengan  --tier sensitive  (atau --role backend).')
  }
  console.log('-'.repeat(64))
  if (findings.length === 0) {
    console.log('BERSIH: tidak ada tanda kebocoran rahasia. Folder aman untuk tahap berikut.')
    return
  }
  for (const x of findings) {
    const loc = x.File ? `${x.File}${x.Line ? ':' + x.Line : ''}  ` : ''
    console.log(`  [${x.Tingkat}] ${loc}${x.Pesan}`)
  }
  console.log('-'.repeat(64))
  const g = findings.filter((x) => x.Tingkat === 'GENTING').length
  console.log(`Ringkasan: GENTING ${g} - PENTING ${findings.filter((x) => x.Tingkat === 'PENTING').length} - RAPIKAN ${findings.filter((x) => x.Tingkat === 'RAPIKAN').length}. (Gerbang GAGAL jika GENTING > 0 - JANGAN lapor "siap push".)`)
}

// --- CLI -----------------------------------------------------------------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = process.argv.slice(2)
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 && i + 1 < args.length ? args[i + 1] : null }
  const quiet = args.includes('--quiet')
  const tier = get('--tier')
  const role = get('--role')
  const rootFlag = get('--repo-root')
  const flagVals = new Set([tier, role, rootFlag].filter(Boolean))
  const positional = args.filter((a) => !a.startsWith('--') && !flagVals.has(a))
  const repoRoot = path.resolve(rootFlag || positional[0] || process.cwd())
  const r = invokeSplitGuard(repoRoot, { tier, role, quiet })
  // exit = jumlah GENTING (0 = aman). process.exitCode (bukan process.exit) supaya stdout selesai
  // di-flush saat di-pipa (cermin pola aman lib/risk-gate.js + ai-config-check.mjs).
  process.exitCode = r.Genting
}
