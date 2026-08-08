#!/usr/bin/env node
// lib/setup-interactive.mjs - Penolong MURNI untuk bagian tanya-jawab (Tahap 2) pemasang Node.
//
// GELOMBANG 4/5 (ADR-004 / docs/plans/migrasi-besar-node-program.md): bagian interaktif pemasang
// (popup-klik) butuh beberapa keputusan kecil yang BISA diuji tanpa layar/popup - mis. cek format
// email benar, deteksi AGENTS.md milik lintasAI atau bukan, urutan opsi popup (yang AMAN di posisi 1),
// cari lokasi VS Code, susun panduan simpan-ke-git. Fungsi-fungsi itu DIPISAH ke sini supaya:
//   1. Bisa diuji deterministik (tes node:test) - cegah port melenceng dari PowerShell.
//   2. Orkestrator (setup-pola-b.mjs) cuma jadi "lem" tipis: panggil popup-shim + fungsi murni ini.
//
// Sumber asli: blok inline di setup-pola-b.ps1 (validasi email baris ~1354, deteksi format AGENTS.md
// baris ~577, opsi popup baris ~590-604, deteksi VS Code baris ~1508, panduan commit baris ~1651).
// Bahasa output WAJIB non-programmer Indonesia (ADR-004 #3) - dijaga robot output-lang-check.
import fs from 'node:fs'
import path from 'node:path'

// Kalimat pembuka yang disalin ke papan-tempel saat membuka VS Code (cermin $starterPrompt PS).
export const STARTER_PROMPT = 'halo aku staff baru pertama kali clone project ini, guide aku step-by-step'

// === Validasi email git ==========================================================================
// Cermin regex setup-pola-b.ps1:1354 - batas 254 huruf (RFC 5321) + tolak spasi/karakter-kendali/@
// ganda. Karakter-kendali (\x00-\x1F + \x7F) ditolak supaya tak ada NUL yang memotong string di
// hilir (bisa bikin pencarian peran di staff-roster.yml meleset diam-diam - relevan keamanan).
// eslint-disable-next-line no-control-regex -- karakter-kendali memang SENGAJA dicocokkan untuk DITOLAK (lihat alasan keamanan di atas)
const GIT_EMAIL_RE = /^[^\s@\x00-\x1F\x7F]+@[^\s@\x00-\x1F\x7F]+\.[^\s@\x00-\x1F\x7F]+$/

// Apakah email berbentuk sah untuk dipasang ke git config? (true/false)
export function isValidGitEmail(email) {
  if (typeof email !== 'string') return false
  const e = email.trim()
  if (e.length === 0 || e.length > 254) return false
  // Tolak awalan '-' (PERKETAT dari PS): `git config user.email -x@y.com` bisa disalahartikan git
  // sebagai opsi, bukan nilai -> identitas gagal di-set diam-diam. Tak ada email sah berawal '-'.
  if (e.startsWith('-')) return false
  return GIT_EMAIL_RE.test(e)
}

// Ambil bagian sebelum '@' sebagai nama (cermin $email.Split("@")[0] PS). Input WAJIB email sah.
export function deriveGitName(email) {
  return String(email).trim().split('@')[0]
}

// === Deteksi format AGENTS.md ====================================================================
// Cermin setup-pola-b.ps1:577-585. 'lintasai' = punya penanda kit (aman di-Lewati); 'foreign' =
// berkas dari alat lain (kalau di-Lewati, aturannya ikut nyetir AI + bisa bentrok aturan tim).
export function detectAgentsFormat(content) {
  if (typeof content === 'string' &&
      (content.includes('standar tim IT (Pola B)') || content.includes('.claude-kit/CLAUDE_universal_v1.md'))) {
    return 'lintasai'
  }
  return 'foreign'
}

// Susun opsi popup pilihan AGENTS.md. Sumber-tunggal: label + aksi DIPASANGKAN per opsi (cegah
// melenceng antara popup & konsol). Opsi REKOMENDASI / paling-AMAN SELALU di INDEKS 0 (§14.1):
//   - format lintasAI  -> aman di-Lewati (berkas lama tak diubah).
//   - format asing      -> aman di-Cadangkan-lalu-ganti (berkas lama disimpan + bisa dibalik).
// Cermin setup-pola-b.ps1:590-604.
export function buildAgentsMdOptions(isLintasai) {
  if (isLintasai) {
    return [
      { label: 'Lewati - jangan sentuh (rekomendasi, paling aman: berkas lama tidak diubah)', action: 'skip' },
      { label: 'Cadangkan lalu ganti (berkas lama disimpan dulu)', action: 'backup-replace' },
      { label: 'Lihat beda dulu (bandingkan isi berkas)', action: 'diff' },
    ]
  }
  return [
    { label: 'Cadangkan lalu ganti - berkas lama dicadangkan (rekomendasi: aman, berkas lama disimpan + bisa dibalik)', action: 'backup-replace' },
    { label: 'Lihat beda dulu (lihat isi berkas lama)', action: 'diff' },
    { label: 'Lewati - pertahankan berkas asing (HATI-HATI, bisa bentrok aturan tim)', action: 'skip' },
  ]
}

// === Cari lokasi VS Code =========================================================================
// Cermin setup-pola-b.ps1:1508-1529 - cek 4 lokasi kandidat dengan PATH PENUH (bukan lewat PATH
// lingkungan). Tolak path tak-berakar (anti CWD-injection). env null/kosong dilewati (tak crash).
export function findVsCodeExe(env = process.env) {
  const candidates = []
  if (env.LOCALAPPDATA) {
    candidates.push(path.join(env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'Code.exe'))
    candidates.push(path.join(env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code Insiders', 'Code - Insiders.exe'))
  }
  if (env.ProgramFiles) {
    candidates.push(path.join(env.ProgramFiles, 'Microsoft VS Code', 'Code.exe'))
  }
  if (env['ProgramFiles(x86)']) {
    candidates.push(path.join(env['ProgramFiles(x86)'], 'Microsoft VS Code', 'Code.exe'))
  }
  for (const cand of candidates) {
    if (!cand) continue
    if (!path.isAbsolute(cand)) continue // tolak path tak-berakar (anti injeksi CWD)
    try { if (fs.existsSync(cand)) return cand } catch { /* lanjut ke kandidat berikut */ }
  }
  return null
}

// === Panduan simpan ke git (kunci-gabung / branch protection) ====================================
// Susun baris-baris panduan commit menurut status kunci-gabung (branch protection) di GitHub.
// bp = { Protected: true|false|null, Reason, DefaultBranch } (dari lib/branch-protect.mjs).
// Cermin setup-pola-b.ps1:1651-1674, TAPI nomor versi DIAMBIL dari kitVersion (bukan paku-mati 'v1.5.6'
// seperti PS - itu jadi basi). Mengembalikan array string (orkestrator yang mencetak baris demi baris).
export function buildCommitGuidance(bp, kitVersion = '') {
  const branch = (bp && bp.DefaultBranch) ? bp.DefaultBranch : 'main'
  const verTag = kitVersion ? ` (lintasAI ${kitVersion})` : ''
  const commitMsg = `git commit -m 'chore: pasang standar tim IT${verTag}'`
  const addCmd = 'git add AGENTS.md .claude-kit/ docs/ .github/'

  if (bp && bp.Protected === true) {
    return [
      `[!] Jalur utama '${branch}' di GitHub TERKUNCI - simpan langsung ke '${branch}' akan ditolak (ini pengaman tim, bukan error).`,
      '    Pakai cara jalur-terpisah + minta-review (branch + PR):',
      '      git checkout -b chore/pasang-lintasai-kit',
      `      ${addCmd}`,
      `      ${commitMsg}`,
      '      git push -u origin chore/pasang-lintasai-kit',
      '      gh pr create --fill',
    ]
  }
  if (bp && bp.Protected === false) {
    return [
      `Jalur utama '${branch}' belum dikunci - simpan langsung boleh:`,
      `  ${addCmd}`,
      `  ${commitMsg}`,
    ]
  }
  // Protected === null -> belum bisa dipastikan (gh belum terpasang / belum tersambung GitHub).
  return [
    "[i] Belum bisa memastikan status kunci-gabung di GitHub (mungkin 'gh' belum terpasang / project belum tersambung ke GitHub).",
    '    Cek manual di GitHub: Settings -> Branches sebelum simpan langsung ke jalur utama.',
    '    Kalau ragu, pakai cara jalur-terpisah + minta-review (lebih aman):',
    '      git checkout -b chore/pasang-lintasai-kit && ' + addCmd + ' && ' + commitMsg + ' && gh pr create --fill',
  ]
}

// === Beda isi berkas (untuk aksi "Lihat beda dulu" AGENTS.md) ====================================
// Cermin Compare-Object PS (setup-pola-b.ps1:668) versi ringan: baris yang HANYA ada di salah satu
// sisi. Bukan diff baris-demi-baris canggih - cukup untuk staff memutuskan gabung manual.
// Mengembalikan { onlyExisting: string[], onlyTemplate: string[] }.
export function diffLines(existing, template) {
  const norm = (s) => String(s == null ? '' : s).split(/\r?\n/)
  const exLines = norm(existing)
  const tplLines = norm(template)
  const exSet = new Set(exLines)
  const tplSet = new Set(tplLines)
  const onlyExisting = exLines.filter((l) => !tplSet.has(l))
  const onlyTemplate = tplLines.filter((l) => !exSet.has(l))
  return { onlyExisting, onlyTemplate }
}
